import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {loadFieldCrops,usesBarleyCards,FIELD_CROP_ASSET} from '../game3d/field-crops.js';
import {createGameBuildings} from '../game3d/buildings.js';
import {fieldWorldPoint,FIELD_SHORE_BUFFER} from '../game3d/field-shore.js';
import {renderedShoreDistance} from '../game3d/shore-profile.js';
const sandbox={console,setTimeout,clearTimeout,performance,self:{}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.BABYLON;
// Decode actual accessor geometry and reflected glTF root in NullEngine. Textures
// use a 1×1 stand-in because PNG decoding is the browser's responsibility.
function loadGeometry(scene,path){
 const bytes=readFileSync(new URL('../'+path,import.meta.url)),size=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+size)),binary=bytes.subarray(28+size),container=new B.AssetContainer(scene),root=new B.TransformNode('gltf-reflection',scene);root.scaling.z=-1;container.transformNodes.push(root);
 const materials=g.materials.map(info=>{const m=new B.PBRMaterial(info.name,scene);if(info.pbrMetallicRoughness?.baseColorTexture){m.albedoTexture=B.RawTexture.CreateRGBATexture(new Uint8Array([210,180,100,255]),1,1,scene);container.textures.push(m.albedoTexture);}return m;});container.materials.push(...materials);
 function data(index){const a=g.accessors[index],v=g.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],size={5126:4,5125:4,5123:2}[a.componentType],out=[];for(let k=0;k<a.count;k++)for(let j=0;j<n;j++){const p=(v.byteOffset||0)+(a.byteOffset||0)+k*(v.byteStride||n*size)+j*size;out.push(a.componentType===5126?binary.readFloatLE(p):a.componentType===5125?binary.readUInt32LE(p):binary.readUInt16LE(p));}return out;}
 for(const node of g.nodes)if(node.mesh!==undefined)for(const p of g.meshes[node.mesh].primitives){const mesh=new B.Mesh(node.name,scene),v=new B.VertexData();v.positions=data(p.attributes.POSITION);v.normals=data(p.attributes.NORMAL);if(p.attributes.TEXCOORD_0!==undefined)v.uvs=data(p.attributes.TEXCOORD_0);v.indices=data(p.indices);v.applyToMesh(mesh);mesh.position.set(...(node.translation||[0,0,0]));mesh.scaling.set(...(node.scale||[1,1,1]));if(node.rotation)mesh.rotationQuaternion=B.Quaternion.FromArray(node.rotation);mesh.parent=root;mesh.material=materials[p.material];container.meshes.push(mesh);}
 container.removeAllFromScene();return container;
}
function setup(fail=false){
 const engine=new B.NullEngine(),scene=new B.Scene(engine),materials=Object.fromEntries(['plaster','brick','wood','linen','reed','terracotta','soil','grass','stone'].map(name=>[name,new B.PBRMaterial(name,scene)])),previous=B.SceneLoader.LoadAssetContainerAsync,loads=[];
 B.SceneLoader.LoadAssetContainerAsync=async(_root,path)=>{loads.push(path);if(fail&&path===FIELD_CROP_ASSET)throw Error('Optional crop download failed');return loadGeometry(scene,path);};
 return {scene,materials,loads,dispose(){B.SceneLoader.LoadAssetContainerAsync=previous;scene.dispose();engine.dispose();}};
}
const field=(crop={},x=3,y=4)=>({type:'field',id:'field',x,y,level:1,crop:{sown:1,growth:1,total:100,remaining:100,...crop}});

test('actual barley GLB batches 64 grounded clumps with shared atlas, alpha cutouts and reflected winding',async()=>{
 const t=setup();let assets;try{
  assets=await loadFieldCrops(B,t.scene);assert.ok(assets);const b=field(),state={buildings:[b]},before=structuredClone(state),[a]=assets.create(b,state),[other]=assets.create({...b,id:'other',x:5},state);
  assert.equal(a.metadata.clumps,64);assert.equal(a.getTotalVertices(),64*16);assert.equal(a.getIndices().length,64*24);assert.equal(a.geometry,other.geometry);assert.equal(a.material,other.material);assert.equal(a.material.transparencyMode,B.PBRMaterial.PBRMATERIAL_ALPHATEST);assert.ok(a.material.albedoTexture);assert.equal(a.material.albedoTexture.hasAlpha,true);assert.equal(a.material.backFaceCulling,false);assert.equal(a.overrideMaterialSideOrientation,B.Material.ClockWiseSideOrientation);
  const p=a.getVerticesData(B.VertexBuffer.PositionKind),heights=Array.from(p).filter((_,i)=>i%3===1);assert.ok(Math.abs(Math.min(...heights)-.16)<1e-6);assert.ok(Math.abs(Math.max(...heights)-1.11)<1e-6);assert.deepEqual(state,before);a.dispose();other.dispose();assets.dispose();assert.equal(t.scene.meshes.length,0);
 }finally{assets?.dispose();t.dispose();}
});

test('whole rotated barley clumps avoid real river and rounded saved-lake shore, including triangle interiors',async()=>{
 const t=setup();let assets;try{
  assets=await loadFieldCrops(B,t.scene);
  for(const rotation of [0,1,2,3])for(const lake of [false,true]){
   const b={...field({},lake?3.2:12,lake?4:8),rotation},state={buildings:[b],world:{lakes:lake?[{cells:[{x:4,y:4}]}]:[]}},meshes=assets.create(b,state);assert.equal(meshes.length,1);
   const mesh=meshes[0],p=mesh.getVerticesData(B.VertexBuffer.PositionKind),indices=mesh.getIndices();assert.ok(mesh.metadata.clumps<64);
   for(let i=0;i<indices.length;i+=3)for(const weights of [[1,0,0],[0,1,0],[0,0,1],[1/3,1/3,1/3],[.5,.5,0]]){
    const x=weights.reduce((sum,w,j)=>sum+w*p[indices[i+j]*3],0),z=weights.reduce((sum,w,j)=>sum+w*p[indices[i+j]*3+2],0),world=fieldWorldPoint(b,x,z);assert.ok(renderedShoreDistance(world.x,world.y,state)>=FIELD_SHORE_BUFFER-1e-6);
   }
   mesh.dispose();
  }
 }finally{assets?.dispose();t.dispose();}
});

test('crop state alone controls empty fields, early sprouts, standing harvest loss and construction',async()=>{
 const t=setup();let assets;try{
  assets=await loadFieldCrops(B,t.scene);
  for(const crop of [{sown:0},{growth:0},{growth:.3},{remaining:0,harvested:100}])assert.equal(assets.create(field(crop),{}).length,0);
  assert.equal(usesBarleyCards({...field(),construction:{kind:'new'}}),false);
  const [young]=assets.create(field({growth:.4}),{}),[ripe]=assets.create(field(),{}),[half]=assets.create(field({remaining:50}),{});assert.equal(half.metadata.clumps,32);assert.ok(young.getBoundingInfo().boundingBox.maximum.y<ripe.getBoundingInfo().boundingBox.maximum.y);[young,ripe,half].forEach(m=>m.dispose());
 }finally{assets?.dispose();t.dispose();}
});

test('adapter loads barley once, removes only old standing stalks and rebuilds on crop stages rather than workers or frames',async()=>{
 const t=setup();let layer;try{
  layer=await createGameBuildings(B,t.scene,t.materials);const b=field(),state={buildings:[b],citizens:[],season:'summer',tick:10},before=structuredClone(state);layer.sync(state);
  const crop=layer.meshes.find(m=>m.name.includes('game-field-barley'));assert.ok(crop);assert.ok(layer.meshes.some(m=>m.material.name==='district-wet-silt'));assert.ok(!layer.meshes.some(m=>m.material===t.materials.grass));const count=t.scene.meshes.length;
  for(let i=0;i<40;i++){state.tick++;b.workers=0;layer.sync(state);}assert.ok(layer.meshes.includes(crop));assert.equal(t.scene.meshes.length,count);assert.deepEqual(b.crop,before.buildings[0].crop);assert.equal(t.loads.filter(p=>p===FIELD_CROP_ASSET).length,1);
  b.crop.remaining=50;layer.sync(state);assert.ok(crop.isDisposed());assert.equal(layer.meshes.find(m=>m.name.includes('game-field-barley')).sourceMesh.metadata.clumps,32);
  b.crop.remaining=0;b.crop.harvested=100;b.crop.sheaves=20;layer.sync(state);assert.ok(!layer.meshes.some(m=>m.name.includes('game-field-barley')));assert.ok(layer.meshes.some(m=>m.material.name==='district-dry-straw'),'retained actual sheaves');
  layer.preview(b,state);layer.dispose();assert.equal(t.scene.meshes.length,0);
 }finally{layer?.dispose();t.dispose();}
});

test('optional barley load failure keeps the existing standing crop and empty field behavior intact',async()=>{
 const t=setup(true);let layer;try{
  layer=await createGameBuildings(B,t.scene,t.materials);const b=field(),state={buildings:[b],citizens:[]};layer.sync(state);assert.ok(layer.meshes.some(m=>m.material===t.materials.grass));assert.ok(!layer.meshes.some(m=>m.name.includes('game-field-barley')));
  b.crop.sown=0;layer.sync(state);assert.ok(!layer.meshes.some(m=>m.material===t.materials.grass));layer.dispose();assert.equal(t.scene.meshes.length,0);
 }finally{layer?.dispose();t.dispose();}
});
