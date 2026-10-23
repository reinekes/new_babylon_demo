import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGameBuildings,gameBuildingSignature} from '../game3d/buildings.js';
import {organicHousePoint,organicHouseVariant,fieldWorldPoint,FIELD_SHORE_BUFFER} from '../game3d/field-shore.js';
import {renderedShoreDistance} from '../game3d/shore-profile.js';
import {BUILDINGS} from '../definitions.js';
const sandbox={module:{exports:{}},console,setTimeout,clearTimeout,performance,self:{}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.BABYLON;
// Decode the actual local, uncompressed static GLB geometry for NullEngine. This
// avoids browser-only image decoding while testing its real node transforms.
function loadGeometry(scene){
 const bytes=readFileSync(new URL('../assets/art-courtyard/models/adobe-courtyard.glb',import.meta.url));
 const jsonSize=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+jsonSize)),binary=bytes.subarray(28+jsonSize);
 const container=new B.AssetContainer(scene),root=new B.TransformNode('gltf-reflection',scene);root.scaling.z=-1;container.transformNodes.push(root);
 const mats=g.materials.map(m=>new B.PBRMaterial(m.name,scene));container.materials.push(...mats);
 function data(i){
  const a=g.accessors[i],view=g.bufferViews[a.bufferView],n=({SCALAR:1,VEC2:2,VEC3:3,VEC4:4})[a.type],offset=(view.byteOffset||0)+(a.byteOffset||0),size=({5126:4,5125:4,5123:2,5121:1})[a.componentType],out=[];
  for(let k=0;k<a.count;k++)for(let j=0;j<n;j++){
   const p=offset+k*(view.byteStride||n*size)+j*size;
   out.push(a.componentType===5126?binary.readFloatLE(p):a.componentType===5125?binary.readUInt32LE(p):a.componentType===5123?binary.readUInt16LE(p):binary.readUInt8(p));
  }return out;
 }
 for(const node of g.nodes){
  if(node.mesh===undefined)continue;
  for(const p of g.meshes[node.mesh].primitives){
   const mesh=new B.Mesh(node.name,scene),v=new B.VertexData();v.positions=data(p.attributes.POSITION);v.normals=data(p.attributes.NORMAL);v.indices=data(p.indices);if(p.attributes.TEXCOORD_0!==undefined)v.uvs=data(p.attributes.TEXCOORD_0);v.applyToMesh(mesh);
   mesh.position.set(...(node.translation||[0,0,0]));mesh.scaling.set(...(node.scale||[1,1,1]));if(node.rotation)mesh.rotationQuaternion=new B.Quaternion(...node.rotation);
   mesh.parent=root;mesh.material=mats[p.material];container.meshes.push(mesh);
  }
 }container.removeAllFromScene();return container;
}
async function setup(configure){
 const engine=new B.NullEngine(),scene=new B.Scene(engine),materials=Object.fromEntries(['plaster','brick','wood','linen','reed','terracotta','soil','grass','stone'].map(name=>[name,new B.PBRMaterial(name,scene)]));
 configure?.(B,scene,materials);
 const previous=B.SceneLoader.LoadAssetContainerAsync;let loads=0;
 B.SceneLoader.LoadAssetContainerAsync=async(_root,file)=>{loads++;assert.equal(file,'assets/art-courtyard/models/adobe-courtyard.glb');return loadGeometry(scene);};
 const layer=await createGameBuildings(B,scene,materials);B.SceneLoader.LoadAssetContainerAsync=previous;
 return {layer,scene,materials,loads,dispose(){layer.dispose();scene.dispose();engine.dispose();}};
}
const house=(level=1,x=3,y=4,id='home')=>({id,type:'house',level,x,y});
function bounds(meshes){let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,maxY=0;for(const m of meshes){m.computeWorldMatrix(true);const b=m.getBoundingInfo().boundingBox;minX=Math.min(minX,b.minimumWorld.x);maxX=Math.max(maxX,b.maximumWorld.x);minZ=Math.min(minZ,b.minimumWorld.z);maxZ=Math.max(maxZ,b.maximumWorld.z);maxY=Math.max(maxY,b.maximumWorld.y);}return {minX,maxX,minZ,maxZ,maxY};}

test('actual renewed houses stay centered in one tile, tiers differ and outward winding survives merge',async()=>{
 const t=await setup();try{
  let previousHeight=0;
  for(const level of [1,2,3]){
   t.layer.sync({buildings:[house(level)],citizens:[]});const b=bounds(t.layer.meshes);
   assert.ok(b.minX>=15.2&&b.maxX<=20.8,JSON.stringify(b));assert.ok(b.minZ>=21.2&&b.maxZ<=26.8,JSON.stringify(b));
   assert.ok(Math.abs((b.minX+b.maxX)/2-18)<.25);assert.ok(Math.abs((b.minZ+b.maxZ)/2-24)<.25);
   assert.ok(b.maxY>previousHeight);previousHeight=b.maxY;
   const glb=t.layer.meshes.filter(m=>m.name.includes('game-courtyard'));
   assert.equal(glb.length,0);assert.ok(t.layer.meshes.some(m=>m.name.includes(`game-house-courtyard-${level}`)));for(const m of t.layer.meshes.filter(m=>m.name.includes('game-house-courtyard')))assert.equal(m.sourceMesh.overrideMaterialSideOrientation,B.Material.CounterClockWiseSideOrientation);
   for(const m of t.layer.meshes){assert.equal(m.metadata.buildingKey,'home');assert.deepEqual(m.metadata.tile,{x:3,y:4});assert.equal(m.checkCollisions,false);assert.equal(m.isPickable,true);}
   if(level===2)assert.ok(t.layer.meshes.some(m=>m.material.name.startsWith('game-home-plaster-2')));
   if(level===3)assert.ok(t.layer.meshes.some(m=>m.material.name.startsWith('game-home-plaster-3')));
  }
 }finally{t.dispose();}
});

test('sync is read only, shares geometry and creates no meshes for unchanged frames; live shadow list follows removal',async()=>{
 const t=await setup();try{
  const state={buildings:[house(),house(1,8,4,'second')],citizens:[{home:'home'}],tick:1,simTime:2};
  const before=structuredClone(state);Object.freeze(state.buildings[0]);Object.freeze(state.buildings[1]);Object.freeze(state.buildings);Object.freeze(state);
  const live=t.layer.meshes;t.layer.sync(state);assert.deepEqual(state,before);
  const count=t.scene.meshes.length,first=live[0],firstSource=first.sourceMesh;
  assert.ok(firstSource.instances.length===2);for(let i=0;i<30;i++)t.layer.sync(state);
  assert.equal(t.scene.meshes.length,count);assert.equal(live[0],first);assert.equal(t.layer.meshes,live);
  assert.equal(live.find(m=>m.metadata.buildingKey==='home'&&m.metadata.homeLamp).material.name,'game-occupied-home');
  assert.equal(live.find(m=>m.metadata.buildingKey==='second'&&m.metadata.homeLamp).material.name,'game-door-shadow');
  t.layer.sync({buildings:[house(1,8,4,'second')],citizens:[]});assert.ok(first.isDisposed());assert.ok(live.every(m=>m.metadata.buildingKey==='second'));
  t.layer.sync({buildings:[]});assert.equal(live.length,0);assert.ok(firstSource.isDisposed());
  t.layer.dispose();assert.equal(t.scene.meshes.length,0);t.layer.dispose();
 }finally{t.dispose();}
});

test('all defined buildings produce visible pickable architecture; construction and upgrades progress without changing source',async()=>{
 const t=await setup();try{
  for(const type of Object.keys(BUILDINGS)){
   const b={type,x:3,y:4,id:type,level:1};t.layer.sync({buildings:[b],citizens:[]});if(type==='canal'){assert.equal(t.layer.meshes.length,0,'landscape owns canals');continue;}assert.ok(t.layer.meshes.length,type);
   const bb=bounds(t.layer.meshes);assert.ok(Number.isFinite(bb.maxY),type);
   if(type!=='bridge'){assert.ok(bb.minX>=15.1&&bb.maxX<=20.9,`${type} ${JSON.stringify(bb)}`);assert.ok(bb.minZ>=21.1&&bb.maxZ<=26.9,`${type} ${JSON.stringify(bb)}`);}
  }
  const b={...house(),construction:{kind:'new',target:1,required:{clay:10},delivered:{clay:0},work:0}},state={buildings:[b],citizens:[]};
  const signature=gameBuildingSignature(b);t.layer.sync(state);assert.ok(!t.layer.meshes.some(m=>m.name.includes('game-house-courtyard')));const old=t.layer.meshes[0];
  b.construction.delivered.clay=10;b.construction.work=10;assert.notEqual(gameBuildingSignature(b),signature);t.layer.sync(state);assert.ok(old.isDisposed());
  b.construction={kind:'upgrade',target:2,required:{},delivered:{},work:0};t.layer.sync(state);assert.ok(t.layer.meshes.some(m=>m.name.includes('game-house-courtyard')));assert.ok(t.layer.meshes.some(m=>m.name.includes('game-raw-brick-facing')));
  delete b.construction;t.layer.sync(state);assert.ok(!t.layer.meshes.some(m=>m.name.includes('game-raw-brick-facing')));
 }finally{t.dispose();}
});


test('masonry variants share uploaded dynamic maps instead of cloning unready textures',async()=>{
 let texture,textureCount;
 const t=await setup((B,scene,materials)=>{
  const canvas={width:16,height:16,getContext(){return {fillRect(){},drawImage(){},clearRect(){}};}};
  texture=new B.DynamicTexture('mudbrick-courses',canvas,scene,false);
  // NullEngine has no GPU upload; model the already uploaded source map explicitly.
  texture._texture.isReady=true;texture.clone=()=>{throw Error('DynamicTexture must be shared, not cloned');};
  materials.brick.albedoTexture=texture;materials.plaster.bumpTexture=texture;textureCount=scene.textures.length;
 });
 try{
  assert.equal(t.scene.textures.length,textureCount,'material variants must not allocate texture copies');
  for(const name of ['game-raw-brick-facing','game-fired-brick-facing']){
   const mat=t.scene.materials.find(m=>m.name===name);assert.equal(mat.albedoTexture,texture);assert.equal(mat.albedoTexture.isReady(),true);
  }
  assert.equal(t.scene.materials.find(m=>m.name==='game-plaster-trim').bumpTexture,texture);
  t.layer.sync({buildings:[house(3)],citizens:[]});assert.equal(t.scene.textures.length,textureCount);
  t.layer.dispose();assert.ok(t.scene.textures.includes(texture),'caller owns the shared texture');assert.equal(texture.isReady(),true);
 }finally{t.dispose();}
});


test('river and saved-lake fields keep their dry portions and clip all crop triangles above the real bank',async()=>{
 const t=await setup();try{
  for(const [x,y,lakes]of [[12,8,[]],[3,4,[{id:'edge-lake',cells:[{x:4,y:4}]}]]]){
   const b={type:'field',id:'field',x,y,level:1,crop:{sown:1,growth:1,total:100,remaining:100}},s={buildings:[b],citizens:[],world:{lakes}},before=structuredClone(s);
   t.layer.sync(s);assert.ok(t.layer.meshes.length>1,'ground and actual standing crops remain');
   const points=[];assert.ok(t.layer.meshes.reduce((n,m)=>n+m.getTotalVertices(),0)<150000,'adaptive shoreline geometry remains bounded');
   for(const mesh of t.layer.meshes){
    const src=mesh.sourceMesh,p=src.getVerticesData(B.VertexBuffer.PositionKind),indices=src.getIndices();
    for(let i=0;i<p.length;i+=3){const world=fieldWorldPoint(b,p[i],p[i+2]),d=renderedShoreDistance(world.x,world.y,s);assert.ok(d>=FIELD_SHORE_BUFFER-1e-6,`wet field vertex ${d}`);points.push([p[i],p[i+2]]);}
    // Interior and edges matter too: testing only vertices misses river-straddling triangles.
    for(let i=0;i<indices.length;i+=3){const a=indices.slice(i,i+3).map(k=>[p[k*3],p[k*3+2]]);for(const weights of [[1/3,1/3,1/3],[.5,.5,0],[0,.5,.5],[.5,0,.5]]){const xx=a.reduce((n,v,j)=>n+v[0]*weights[j],0),zz=a.reduce((n,v,j)=>n+v[1]*weights[j],0);const world=fieldWorldPoint(b,xx,zz);assert.ok(renderedShoreDistance(world.x,world.y,s)>=FIELD_SHORE_BUFFER-.0001);}}
   }
   if(x===12)assert.ok(points.reduce((max,p)=>Math.max(max,p[0]),-Infinity)<2.65,'actual river overlap was clipped');else assert.ok(points.reduce((max,p)=>Math.max(max,p[0]),-Infinity)>2.67,'field beside a rounded lake retains its already dry outer edge');assert.ok(points.reduce((min,p)=>Math.min(min,p[0]),Infinity)<-2.5,'dry field portion retained');
   assert.deepEqual(s,before,'crop yields, growth and saved world unchanged');
   const first=t.layer.meshes[0];t.layer.sync(s);assert.equal(t.layer.meshes[0],first);
   s.world.lakes=[{id:'new',cells:[{x:x+1,y}]}];t.layer.sync(s);assert.ok(first.isDisposed(),'shore cache follows actual saved lakes');
  }
 }finally{t.dispose();}
});

test('level-one homes share three organic variants with coherent non-affine walls and ground contact',async()=>{
 const t=await setup();try{
  const houses=[house(1,3,4,'a'),house(1,8,4,'b'),house(1,4,4,'c')];t.layer.sync({buildings:houses,citizens:[]});
  const a=t.layer.meshes.find(m=>m.metadata.buildingKey==='a'&&m.material.name.startsWith('game-home-plaster-1')),b=t.layer.meshes.find(m=>m.metadata.buildingKey==='b'&&m.material.name.startsWith('game-home-plaster-1')),c=t.layer.meshes.find(m=>m.metadata.buildingKey==='c'&&m.material.name.startsWith('game-home-plaster-1'));
  assert.equal(organicHouseVariant(houses[0]),organicHouseVariant(houses[1]));assert.equal(a.sourceMesh,b.sourceMesh);assert.notEqual(a.sourceMesh.geometry,c.sourceMesh.geometry);
  const left=organicHousePoint(-2,0,1,0),middle=organicHousePoint(0,0,1,0),right=organicHousePoint(2,0,1,0);
  assert.ok(Math.abs(middle[2]-(left[2]+right[2])/2)>.003,'wall outline is curved rather than a rigid skew');
  assert.equal(left[1],0);assert.equal(middle[1],0);assert.equal(right[1],0);
  for(let variant=0;variant<3;variant++)for(let x=-2;x<=2;x+=.5){const p=organicHousePoint(x,2.2,1,variant);assert.ok(Math.abs(p[0]-x)<.25);assert.ok(Math.abs(p[1]-2.2)<.15);}
  assert.notEqual(gameBuildingSignature(houses[0]),gameBuildingSignature(houses[2]));
 }finally{t.dispose();}
});

test('renewed organic houses have upward roof normals and all authored normals agree with face winding',async()=>{
 const t=await setup();try{for(const x of [3,4,10]){
  t.layer.sync({buildings:[house(1,x,4)],citizens:[]});let upward=0,compared=0;
  for(const instance of t.layer.meshes.filter(m=>m.name.includes('game-house-courtyard'))){const mesh=instance.sourceMesh,p=mesh.getVerticesData(B.VertexBuffer.PositionKind),n=mesh.getVerticesData(B.VertexBuffer.NormalKind),idx=mesh.getIndices();
   for(let i=0;i<n.length;i+=3)if(n[i+1]>.95&&p[i+1]>1.6)upward++;
   for(let i=0;i<idx.length;i+=3){const v=j=>B.Vector3.FromArray(p,idx[i+j]*3),face=B.Vector3.Cross(v(2).subtract(v(0)),v(1).subtract(v(0))).normalize(),normal=B.Vector3.FromArray(n,idx[i]*3).add(B.Vector3.FromArray(n,idx[i+1]*3)).add(B.Vector3.FromArray(n,idx[i+2]*3)).normalize();if(face.length()>.1&&normal.length()>.1){assert.ok(B.Vector3.Dot(face,normal)>-.05,`${mesh.name} triangle${i/3} dot=${B.Vector3.Dot(face,normal)}`);compared++;}}
  }assert.ok(compared>300);assert.ok(upward>30);
 }}finally{t.dispose();}
});

test('main building adapter never duplicates landscape canals with legacy crossbars or scaffolds',async()=>{
 const t=await setup();try{
  const baseline=t.scene.meshes.length,canal={id:'canal',type:'canal',x:12,y:8,level:1};
  for(const construction of [undefined,{kind:'new',target:1,required:{clay:4},delivered:{clay:2},work:3},{kind:'upgrade',target:2,required:{},delivered:{},work:0}]){
   const s={buildings:[{...canal,construction}],citizens:[]},before=structuredClone(s);t.layer.sync(s);
   assert.equal(t.layer.meshes.length,0);assert.equal(t.scene.meshes.length,baseline,'canals create no hidden legacy geometry either');assert.deepEqual(s,before);
  }
  t.layer.sync({buildings:[house(1,12,8,'canal')],citizens:[]});const old=t.layer.meshes[0];
  t.layer.sync({buildings:[canal],citizens:[]});assert.ok(old.isDisposed());assert.equal(t.layer.meshes.length,0);assert.equal(t.scene.meshes.length,baseline);
 }finally{t.dispose();}
});

test('two-tile ziggurat template remains at its saved anchor and warm lamp material follows daylight',async()=>{
 const t=await setup();try{
  const b={id:'grand',type:'ziggurat',x:3,y:4,level:1,footprint:2},state={buildings:[b],citizens:[]},before=structuredClone(state);
  t.layer.sync(state);const bb=bounds(t.layer.meshes);assert.ok(bb.minX>=15.3&&bb.maxX<=26.7&&bb.minZ>=21.3&&bb.maxZ<=32.7,JSON.stringify(bb));assert.ok(bb.maxY>10);assert.ok(t.layer.meshes.every(m=>m.metadata.tile.x===3&&m.metadata.tile.y===4));assert.deepEqual(state,before);
  const material=t.scene.materials.find(m=>m.name==='game-occupied-home');t.layer.light(0);const day=material.emissiveColor.r;t.layer.light(1);assert.ok(material.emissiveColor.r>day*5);assert.ok(material.emissiveColor.r>material.emissiveColor.b*4);const meshes=t.scene.meshes.length;t.layer.light(.5);assert.equal(t.scene.meshes.length,meshes);
  assert.notEqual(gameBuildingSignature(b),gameBuildingSignature({...b,footprint:undefined}));
 }finally{t.dispose();}
});

test('each house tier shares only three deterministic finishes/layouts and family occupancy lights its fraction of windows',async()=>{
 const t=await setup();try{
  for(const level of [1,2,3]){
   const houses=[house(level,3,4,'a'),house(level,8,4,'b'),house(level,4,4,'c')];t.layer.sync({buildings:houses,citizens:[]});
   const facade=id=>t.layer.meshes.find(m=>m.metadata.buildingKey===id&&m.material.name.startsWith(`game-home-plaster-${level}`));
   assert.equal(facade('a').sourceMesh,facade('b').sourceMesh);assert.notEqual(facade('a').material,facade('c').material);assert.notEqual(facade('a').sourceMesh.geometry,facade('c').sourceMesh.geometry);assert.notEqual(gameBuildingSignature(houses[0]),gameBuildingSignature(houses[2]));
   for(const h of houses){const bb=bounds(t.layer.meshes.filter(m=>m.metadata.buildingKey===h.id));assert.ok(bb.minX>=h.x*6-2.8&&bb.maxX<=h.x*6+2.8&&bb.minZ>=h.y*6-2.8&&bb.maxZ<=h.y*6+2.8,JSON.stringify(bb));}
  }
  const b=house(),windows=()=>t.layer.meshes.filter(m=>m.metadata.homeLamp),lit=()=>windows().filter(m=>m.material.name==='game-occupied-home').length;
  const state={buildings:[b],citizens:[]};t.layer.sync(state);assert.equal(windows().length,4);assert.equal(lit(),0);const geometry=windows()[0].geometry;
  for(const [count,expected]of [[1,1],[4,2],[8,4],[0,0]]){state.citizens=Array.from({length:count},()=>({home:'home'}));const before=structuredClone(state);t.layer.sync(state);assert.equal(lit(),expected);assert.equal(windows()[0].geometry,geometry);assert.deepEqual(state,before);}
 }finally{t.dispose();}
});

test('saved quarter-turns rotate shared architecture around the centre of its reserved footprint',async()=>{
 const t=await setup();try{
  for(const footprint of [undefined,2]){
   const b={id:'monument',type:'ziggurat',x:3,y:4,level:1,...(footprint?{footprint}:{})},state={buildings:[b],citizens:[]};t.layer.sync(state);const first=t.layer.meshes[0],source=first.sourceMesh,baseline=gameBuildingSignature(b),count=t.scene.meshes.length,offset=footprint?3:0;
   for(const rotation of [0,1,2,3,0]){
    b.rotation=rotation;const before=structuredClone(state);t.layer.sync(state);assert.equal(t.layer.meshes[0],first);assert.equal(first.sourceMesh,source);assert.equal(t.scene.meshes.length,count);assert.equal(gameBuildingSignature(b),baseline);assert.deepEqual(state,before);
    const pivot=B.Vector3.TransformCoordinates(new B.Vector3(offset,0,offset),first.parent.getWorldMatrix());assert.ok(Math.abs(pivot.x-(18+offset))<1e-5&&Math.abs(pivot.z-(24+offset))<1e-5);assert.deepEqual(first.metadata.tile,{x:3,y:4});
    const bb=bounds(t.layer.meshes),edge=footprint?8.7:2.9;assert.ok(bb.minX>=18-2.9&&bb.maxX<=18+edge&&bb.minZ>=24-2.9&&bb.maxZ<=24+edge,JSON.stringify(bb));
   }
  }
  assert.notEqual(gameBuildingSignature({type:'field',x:3,y:4,rotation:0}),gameBuildingSignature({type:'field',x:3,y:4,rotation:1}));
 }finally{t.dispose();}
});

test('placement preview uses the exact shared building geometry and pivot with separate reusable transparent materials',async()=>{
 const t=await setup();try{
  const b={id:'grand',type:'ziggurat',x:3,y:4,footprint:2,level:1,rotation:1},state={buildings:[b],citizens:[]},before=structuredClone(state);t.layer.sync(state);
  const originals=t.layer.meshes.map(m=>m.material),baseAlpha=originals.map(m=>m.alpha),actualBounds=bounds(t.layer.meshes),actualCount=t.layer.meshes.length;
  const p=t.layer.preview(b,state,{allowed:true});assert.deepEqual(state,before);assert.equal(p.meshes.length,actualCount);assert.equal(t.layer.meshes.length,actualCount);assert.deepEqual(bounds(p.meshes),actualBounds);
  for(let i=0;i<p.meshes.length;i++){const m=p.meshes[i];assert.equal(m.geometry,t.layer.meshes[i].sourceMesh.geometry);assert.notEqual(m.material,originals[i]);assert.ok(m.material.alpha>=.25&&m.material.alpha<=.4);assert.equal(m.isPickable,false);assert.equal(m.receiveShadows,false);assert.equal(m.checkCollisions,false);assert.ok(!t.layer.meshes.includes(m));}
  t.layer.preview(b,state,{allowed:false});const blocked=p.meshes[0].material;assert.ok(blocked.albedoColor.r>blocked.albedoColor.g);t.layer.preview(b,state,{allowed:true});const sceneCount=t.scene.meshes.length,materialCount=t.scene.materials.length,textureCount=t.scene.textures.length,first=p.meshes[0];
  for(let i=0;i<20;i++){assert.equal(t.layer.preview({...b,rotation:i%4},state,{allowed:i%2===0}).meshes[0],first);t.layer.light(i%2);}
  assert.equal(t.scene.meshes.length,sceneCount);assert.equal(t.scene.materials.length,materialCount);assert.equal(t.scene.textures.length,textureCount);
  assert.deepEqual(t.layer.meshes.map(m=>m.material),originals);assert.deepEqual(originals.map(m=>m.alpha),baseAlpha);t.layer.clearPreview();assert.ok(first.isDisposed());assert.equal(t.layer.meshes.length,actualCount);
  t.layer.dispose();assert.equal(t.scene.meshes.length,0);assert.ok(!t.scene.materials.includes(blocked));
 }finally{t.dispose();}
});

test('house preview is complete, lamp-free, follows its position variant and does not alter a construction order',async()=>{
 const t=await setup();try{
  const b={...house(),rotation:3,construction:{kind:'new',target:1,required:{clay:8},delivered:{clay:0},work:0}},state={buildings:[],citizens:[]},before=structuredClone(b);
  const p=t.layer.preview(b,state,{allowed:true});assert.ok(p.meshes.some(m=>m.name.includes('game-house-courtyard')));assert.ok(p.meshes.every(m=>!m.name.includes('home-lamp')));assert.equal(t.layer.meshes.length,0);assert.deepEqual(b,before);
  const count=t.scene.meshes.length,first=p.meshes[0];for(let i=0;i<20;i++)t.layer.preview({...b,x:8},state,{allowed:true});assert.equal(t.scene.meshes.length,count);assert.equal(t.layer.preview({...b,x:8},state).meshes[0],first);assert.equal(p.root.metadata.tile.x,8);
  t.layer.preview(null,state);assert.ok(first.isDisposed());
 }finally{t.dispose();}
});

test('starter hut templates remain through upgrade, then become ordinary II geometry with no permanent hut cache identity',async()=>{
 const t=await setup();try{
  const b={...house(),starterHut:true},state={buildings:[b],citizens:[]};t.layer.sync(state);
  assert.ok(t.layer.meshes.some(m=>m.name.includes('game-house-hut')));assert.ok(!t.layer.meshes.some(m=>m.name.includes('game-house-courtyard')));
  const count=t.scene.meshes.length,first=t.layer.meshes[0];for(let i=0;i<12;i++)t.layer.sync(state);assert.equal(t.scene.meshes.length,count);assert.equal(t.layer.meshes[0],first);
  b.construction={kind:'upgrade',target:2,required:{clay:8},delivered:{clay:4},work:0};t.layer.sync(state);assert.ok(t.layer.meshes.some(m=>m.name.includes('game-house-hut')));assert.ok(!t.layer.meshes.some(m=>m.name.includes('game-house-courtyard-2')));
  b.level=2;delete b.construction;t.layer.sync(state);assert.ok(t.layer.meshes.some(m=>m.name.includes('game-house-courtyard-2')));assert.ok(!t.layer.meshes.some(m=>m.name.includes('game-house-hut')));assert.equal(gameBuildingSignature(b),gameBuildingSignature({...b,starterHut:undefined}));
 }finally{t.dispose();}
});
