import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {createGameBuildings} from '../game3d/buildings.js';
import {fieldWorldPoint,FIELD_SHORE_BUFFER} from '../game3d/field-shore.js';
import {renderedShoreDistance} from '../game3d/shore-profile.js';

const sandbox={console,setTimeout,clearTimeout,performance,self:{}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.BABYLON;
// Actual crop accessors and transforms; browser image decoding alone is replaced.
function loadGeometry(scene,path){
 const bytes=readFileSync(new URL('../'+path,import.meta.url)),size=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+size)),binary=bytes.subarray(28+size),container=new B.AssetContainer(scene),root=new B.TransformNode('gltf-reflection',scene);root.scaling.z=-1;container.transformNodes.push(root);
 const materials=g.materials.map(info=>{const m=new B.PBRMaterial(info.name,scene);if(info.pbrMetallicRoughness?.baseColorTexture){m.albedoTexture=B.RawTexture.CreateRGBATexture(new Uint8Array([210,180,100,255]),1,1,scene);container.textures.push(m.albedoTexture);}return m;});container.materials.push(...materials);
 function data(index){const a=g.accessors[index],v=g.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],size={5126:4,5125:4,5123:2}[a.componentType],out=[];for(let k=0;k<a.count;k++)for(let j=0;j<n;j++){const p=(v.byteOffset||0)+(a.byteOffset||0)+k*(v.byteStride||n*size)+j*size;out.push(a.componentType===5126?binary.readFloatLE(p):a.componentType===5125?binary.readUInt32LE(p):binary.readUInt16LE(p));}return out;}
 for(const node of g.nodes)if(node.mesh!==undefined)for(const p of g.meshes[node.mesh].primitives){const mesh=new B.Mesh(node.name,scene),v=new B.VertexData();v.positions=data(p.attributes.POSITION);v.normals=data(p.attributes.NORMAL);if(p.attributes.TEXCOORD_0!==undefined)v.uvs=data(p.attributes.TEXCOORD_0);v.indices=data(p.indices);v.applyToMesh(mesh);mesh.position.set(...(node.translation||[0,0,0]));mesh.scaling.set(...(node.scale||[1,1,1]));if(node.rotation)mesh.rotationQuaternion=B.Quaternion.FromArray(node.rotation);mesh.parent=root;mesh.material=materials[p.material];container.meshes.push(mesh);}
 container.removeAllFromScene();return container;
}
async function setup(fallback=false){
 const engine=new B.NullEngine(),scene=new B.Scene(engine),materials=Object.fromEntries(['plaster','brick','wood','linen','reed','terracotta','soil','grass','stone'].map(name=>[name,new B.PBRMaterial(name,scene)])),previous=B.SceneLoader.LoadAssetContainerAsync;
 B.SceneLoader.LoadAssetContainerAsync=async(_root,file)=>{if(fallback)throw Error('Offline crop asset');return loadGeometry(scene,file.split('?')[0]);};
 const layer=await createGameBuildings(B,scene,materials);
 return {engine,scene,materials,layer,async fresh(state){const other=await createGameBuildings(B,scene,materials);other.sync(state);const value=snapshot(other.meshes);other.dispose();return value;},dispose(){layer.dispose();B.SceneLoader.LoadAssetContainerAsync=previous;scene.dispose();engine.dispose();}};
}
const field=(x=12,y=8)=>({id:'field',type:'field',x,y,level:1,crop:{year:1,sown:0,growth:0,total:0,remaining:0,sheaves:0}});
const soil=meshes=>meshes.find(m=>m.material.name==='district-wet-silt');
function digest(mesh){const data={};for(const kind of [B.VertexBuffer.PositionKind,B.VertexBuffer.NormalKind,B.VertexBuffer.UVKind,B.VertexBuffer.ColorKind])data[kind]=Array.from(mesh.getVerticesData(kind)||[]);data.indices=Array.from(mesh.getIndices());return createHash('sha256').update(JSON.stringify(data)).digest('hex');}
const snapshot=meshes=>meshes.map(m=>({material:m.material.name,hash:digest(m),orientation:m.sourceMesh?.overrideMaterialSideOrientation??m.overrideMaterialSideOrientation,position:m.position.asArray(),rotation:m.rotation.asArray(),pickable:m.isPickable,shadows:m.receiveShadows}));

for(const fallback of [true,false])test(`field soil geometry survives sowing and harvest while ${fallback?'fallback':'loaded'} crops keep exact fresh appearance`,async()=>{
 const t=await setup(fallback);try{
  const b=field(),s={buildings:[b],citizens:[],world:{lakes:[]}};t.layer.sync(s);const original=soil(t.layer.meshes),geometry=original.geometry,hash=digest(original);
  for(const crop of [{sown:.002},{sown:.202},{sown:.602},{sown:1,growth:1,total:100,remaining:100},{remaining:40,sheaves:20},{remaining:0,harvested:100,sheaves:35}]){
   Object.assign(b.crop,crop);const before=JSON.stringify(s);t.layer.sync(s);const bed=soil(t.layer.meshes);
   assert.ok(bed.geometry===geometry,'crop-only change must retain uploaded soil geometry');assert.equal(digest(bed),hash);assert.equal(JSON.stringify(s),before);
   assert.deepEqual(snapshot(t.layer.meshes),await t.fresh(s),'all field geometry/materials/picking/shadows match a fresh render');
  }
  // On this river edge the sheaf positions are submerged; move inland to
  // verify the same harvested crop still shows the actual collected bundles.
  b.x=3;b.y=4;t.layer.sync(s);
  assert.ok(t.layer.meshes.some(m=>m.material.name==='district-dry-straw'),'dry harvested sheaves remain visible');
  assert.equal(t.scene.meshes.filter(m=>m.metadata?.fieldBedCache).length,0,'inland ground needs no retained owner');
  t.layer.dispose();assert.equal(t.scene.meshes.length,0,t.scene.meshes.map(m=>m.name).join(','));assert.equal(t.scene.geometries.length,0);
 }finally{t.dispose();}
});

test('soil cache follows rotation, relocation, lake edits, replacement state and field removal',async()=>{
 const t=await setup(true);try{
  const b=field(3.2,4);let s={buildings:[b],citizens:[],world:{lakes:[{cells:[{x:4,y:4}]}]}};t.layer.sync(s);let geometry=soil(t.layer.meshes).geometry;
  for(const rotation of [1,2,3]){b.rotation=rotation;t.layer.sync(s);assert.ok(soil(t.layer.meshes).geometry!==geometry);geometry=soil(t.layer.meshes).geometry;assert.deepEqual(snapshot(t.layer.meshes),await t.fresh(s));}
  b.x=3;b.y=3;t.layer.sync(s);assert.ok(soil(t.layer.meshes).geometry!==geometry);geometry=soil(t.layer.meshes).geometry;
  s.world.lakes[0].cells.push({x:4,y:3});t.layer.sync(s);assert.ok(soil(t.layer.meshes).geometry!==geometry);assert.deepEqual(snapshot(t.layer.meshes),await t.fresh(s));
  geometry=soil(t.layer.meshes).geometry;s=structuredClone(s);t.layer.sync(s);
  assert.equal(t.scene.meshes.filter(m=>m.metadata?.fieldBedCache).length,0,'a replacement save clears previous cache owners even with identical lakes');
  s.buildings[0].crop.sown=.2;t.layer.sync(s);assert.ok(soil(t.layer.meshes).geometry!==geometry);assert.deepEqual(snapshot(t.layer.meshes),await t.fresh(s));
  s=structuredClone(s);s.world.lakes=[];t.layer.sync(s);assert.deepEqual(snapshot(t.layer.meshes),await t.fresh(s));
  s.buildings=[];t.layer.sync(s);assert.equal(t.layer.meshes.length,0);assert.equal(t.scene.meshes.filter(m=>m.metadata?.fieldBedCache).length,0,'removed fields release retained soil');
 }finally{t.dispose();}
});

test('cached field ground and all four preview rotations remain on the dry bank and dispose cleanly',async()=>{
 const t=await setup(true);try{
  const b=field(),s={buildings:[b],citizens:[],world:{lakes:[]}};t.layer.sync(s);const geometry=soil(t.layer.meshes).geometry;
  for(const rotation of [0,1,2,3]){
   const input={...b,rotation},before=JSON.stringify(s),preview=t.layer.preview(input,s);
   assert.equal(JSON.stringify(s),before);assert.ok(preview.meshes.every(m=>!m.isPickable&&!m.receiveShadows));
   const p=soil(preview.meshes)||preview.meshes.find(m=>m.material.name.includes('district-wet-silt'));
   assert.ok(p);for(let i=0,positions=p.getVerticesData(B.VertexBuffer.PositionKind);i<positions.length;i+=3){const world=fieldWorldPoint(input,positions[i],positions[i+2]);assert.ok(renderedShoreDistance(world.x,world.y,s)>=FIELD_SHORE_BUFFER-1e-6);}
  }
  t.layer.clearPreview();assert.equal(soil(t.layer.meshes).geometry,geometry);t.layer.dispose();assert.equal(t.scene.meshes.length,0);assert.equal(t.scene.geometries.length,0);
 }finally{t.dispose();}
});

test('construction transitions keep scaffolding separate from completed field soil',async()=>{
 const t=await setup(true);try{
  const b=field(),s={buildings:[b],citizens:[],world:{lakes:[]}};b.construction={kind:'new',target:1,required:{clay:1},delivered:{clay:0},work:0};t.layer.sync(s);assert.equal(soil(t.layer.meshes),undefined);
  delete b.construction;t.layer.sync(s);const geometry=soil(t.layer.meshes).geometry;
  b.construction={kind:'upgrade',target:2,required:{clay:1},delivered:{clay:1},work:1};t.layer.sync(s);assert.equal(soil(t.layer.meshes).geometry,geometry);assert.deepEqual(snapshot(t.layer.meshes),await t.fresh(s));
  b.construction.work=12;t.layer.sync(s);assert.equal(soil(t.layer.meshes).geometry,geometry);delete b.construction;b.level=2;t.layer.sync(s);assert.deepEqual(snapshot(t.layer.meshes),await t.fresh(s));
 }finally{t.dispose();}
});
