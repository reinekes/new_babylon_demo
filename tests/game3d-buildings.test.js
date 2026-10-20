import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGameBuildings,gameBuildingSignature} from '../game3d/buildings.js';
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

test('actual courtyard GLB transforms stay centered in one tile, tiers are distinct and reflected winding survives merge',async()=>{
 const t=await setup();try{
  let previousHeight=0;
  for(const level of [1,2,3]){
   t.layer.sync({buildings:[house(level)],citizens:[]});const b=bounds(t.layer.meshes);
   assert.ok(b.minX>=15.2&&b.maxX<=20.8,JSON.stringify(b));assert.ok(b.minZ>=21.2&&b.maxZ<=26.8,JSON.stringify(b));
   assert.ok(Math.abs((b.minX+b.maxX)/2-18)<.25);assert.ok(Math.abs((b.minZ+b.maxZ)/2-24)<.25);
   assert.ok(b.maxY>previousHeight);previousHeight=b.maxY;
   const glb=t.layer.meshes.filter(m=>m.name.includes('game-courtyard'));assert.ok(glb.length>=7);
   for(const m of glb)assert.equal(m.sourceMesh.overrideMaterialSideOrientation,B.Material.ClockWiseSideOrientation);
   for(const m of t.layer.meshes){assert.equal(m.metadata.buildingKey,'home');assert.deepEqual(m.metadata.tile,{x:3,y:4});assert.equal(m.checkCollisions,false);assert.equal(m.isPickable,true);}
   if(level===2)assert.ok(t.layer.meshes.some(m=>m.material.name==='game-raw-brick-facing'));
   if(level===3)assert.ok(t.layer.meshes.some(m=>m.material.name==='game-fired-brick-facing'));
  }
 }finally{t.dispose();}
});

test('sync is read only, shares geometry and creates no meshes for unchanged frames; live shadow list follows removal',async()=>{
 const t=await setup();try{
  const state={buildings:[house(),house(1,5,4,'second')],citizens:[{home:'home'}],tick:1,simTime:2};
  const before=structuredClone(state);Object.freeze(state.buildings[0]);Object.freeze(state.buildings[1]);Object.freeze(state.buildings);Object.freeze(state);
  const live=t.layer.meshes;t.layer.sync(state);assert.deepEqual(state,before);
  const count=t.scene.meshes.length,first=live[0],firstSource=first.sourceMesh;
  assert.ok(firstSource.instances.length===2);for(let i=0;i<30;i++)t.layer.sync(state);
  assert.equal(t.scene.meshes.length,count);assert.equal(live[0],first);assert.equal(t.layer.meshes,live);
  assert.equal(live.find(m=>m.metadata.buildingKey==='home'&&m.metadata.homeLamp).material.name,'game-occupied-home');
  assert.equal(live.find(m=>m.metadata.buildingKey==='second'&&m.metadata.homeLamp).material.name,'game-door-shadow');
  t.layer.sync({buildings:[house(1,5,4,'second')],citizens:[]});assert.ok(first.isDisposed());assert.ok(live.every(m=>m.metadata.buildingKey==='second'));
  t.layer.sync({buildings:[]});assert.equal(live.length,0);assert.ok(firstSource.isDisposed());
  t.layer.dispose();assert.equal(t.scene.meshes.length,0);t.layer.dispose();
 }finally{t.dispose();}
});

test('all defined buildings produce visible pickable architecture; construction and upgrades progress without changing source',async()=>{
 const t=await setup();try{
  for(const type of Object.keys(BUILDINGS)){
   const b={type,x:3,y:4,id:type,level:1};t.layer.sync({buildings:[b],citizens:[]});assert.ok(t.layer.meshes.length,type);
   const bb=bounds(t.layer.meshes);assert.ok(Number.isFinite(bb.maxY),type);
   if(type!=='bridge'){assert.ok(bb.minX>=15.1&&bb.maxX<=20.9,`${type} ${JSON.stringify(bb)}`);assert.ok(bb.minZ>=21.1&&bb.maxZ<=26.9,`${type} ${JSON.stringify(bb)}`);}
  }
  const b={...house(),construction:{kind:'new',target:1,required:{clay:10},delivered:{clay:0},work:0}},state={buildings:[b],citizens:[]};
  const signature=gameBuildingSignature(b);t.layer.sync(state);assert.ok(!t.layer.meshes.some(m=>m.name.includes('game-courtyard')));const old=t.layer.meshes[0];
  b.construction.delivered.clay=10;b.construction.work=10;assert.notEqual(gameBuildingSignature(b),signature);t.layer.sync(state);assert.ok(old.isDisposed());
  b.construction={kind:'upgrade',target:2,required:{},delivered:{},work:0};t.layer.sync(state);assert.ok(t.layer.meshes.some(m=>m.name.includes('game-courtyard')));assert.ok(t.layer.meshes.some(m=>m.name.includes('game-raw-brick-facing')));
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
