import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createBuildingFoundations,foundationWorldPoint,foundationSignature} from '../game3d/building-foundations.js';
import {visualSurfaceElevation} from '../game3d/shore-profile.js';
import {createGameBuildings} from '../game3d/buildings.js';
import {ARCHITECTURE_TYPES} from '../game3d/architecture.js';
import {river} from '../world.js';
const sandbox={console,setTimeout,clearTimeout,performance,self:{}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.BABYLON;
function setup(){const engine=new B.NullEngine(),scene=new B.Scene(engine),materials=Object.fromEntries(['plaster','brick','raw','wood','linen','reed','terracotta','soil','grass','stone','fired'].map(name=>[name,new B.PBRMaterial(name,scene)]));return {scene,materials,dispose(){scene.dispose();engine.dispose();}};}
const shore={type:'pottery',id:'shore',x:river(8)+1.25,y:8,level:1};
function checkBed(mesh,b,state){
 const p=mesh.getVerticesData(B.VertexBuffer.PositionKind);let submerged=0;
 for(let i=0;i<p.length;i+=3){if(p[i+1]>=0)continue;const at=foundationWorldPoint(b,p[i],p[i+2]),ground=visualSurfaceElevation(at.x,at.y,state);assert.ok(p[i+1]<=ground+.00001,`floating foundation corner: ${p[i+1]} > ${ground}`);submerged++;}
 assert.ok(submerged);assert.ok(p.some((v,i)=>i%3===1&&Math.abs(v-.012)<.00001));
}
test('all ordinary building types receive a solid shore foundation, dry land and intentional water geometry stay clear',()=>{
 const t=setup();try{
  for(const type of ['house',...ARCHITECTURE_TYPES].filter(type=>!['fishing','harbor'].includes(type))){
   const b={...shore,type},state={buildings:[b]},before=structuredClone(state),meshes=createBuildingFoundations(B,t.scene,b,t.materials,state);
   assert.equal(meshes.length,1,type);checkBed(meshes[0],b,state);
   const normals=meshes[0].getVerticesData(B.VertexBuffer.NormalKind);assert.ok(normals[16*3+1]>.9,'upper foundation surface faces daylight');assert.ok(normals[2]<-.9,'outside wall faces outwards');assert.ok(meshes[0].getTotalVertices()<=64*24);assert.deepEqual(state,before);meshes.forEach(m=>m.dispose());
  }
  for(const type of ['bridge','field','canal'])assert.equal(createBuildingFoundations(B,t.scene,{...shore,type},t.materials,{}).length,0);
  assert.equal(createBuildingFoundations(B,t.scene,{...shore,x:3},t.materials,{}).length,0);
 }finally{t.dispose();}
});
test('rotated two-tile monuments, levels, new sites and upgrades bury support in the actual saved lake bed',()=>{
 const t=setup();try{
  for(const rotation of [0,1,2,3])for(const level of [1,2,3])for(const construction of [undefined,{kind:'new'},{kind:'upgrade'}]){
   const b={type:'ziggurat',x:3,y:4,footprint:2,level,rotation,construction},state={buildings:[b],world:{lakes:[{cells:[{x:4,y:4},{x:4,y:5}]}]}},meshes=createBuildingFoundations(B,t.scene,b,t.materials,state);
   assert.equal(meshes.length,1);checkBed(meshes[0],b,state);assert.ok(meshes[0].getTotalVertices()<=256*24);meshes[0].dispose();
  }
 }finally{t.dispose();}
});
test('fishing and harbor piles reach below water to the bed, and stay in the footprint',()=>{
 const t=setup();try{
  for(const type of ['fishing','harbor']){
   const b={...shore,type},state={buildings:[b]},[mesh]=createBuildingFoundations(B,t.scene,b,t.materials,state);assert.ok(mesh);assert.equal(mesh.material,t.materials.wood);assert.equal(mesh.metadata.timber,true);
   const p=mesh.getVerticesData(B.VertexBuffer.PositionKind);assert.ok(p.some((v,i)=>i%3===1&&v<-.8));assert.ok(mesh.getTotalVertices()<2000);mesh.computeWorldMatrix(true);assert.ok(mesh.getBoundingInfo().boundingBox.minimum.y<-.8);mesh.dispose();
  }
 }finally{t.dispose();}
});
test('shore signatures account for moves, quarter turns and saved lake edits; inland templates remain shared',()=>{
 const state={world:{lakes:[{cells:[{x:4,y:4}]}]}},b={type:'pottery',x:3,y:4};
 const signature=foundationSignature(b,state);assert.ok(signature);assert.notEqual(signature,foundationSignature({...b,rotation:1},state));assert.notEqual(signature,foundationSignature({...b,x:3.1},state));state.world.lakes[0].cells.push({x:4,y:5});assert.notEqual(signature,foundationSignature(b,state));
 assert.equal(foundationSignature({type:'pottery',x:1,y:10},{}),'');
});
test('adapter registers support in live shadow meshes and preview, reuses unchanged sources and disposes shore replacements',async()=>{
 const t=setup(),previous=B.SceneLoader.LoadAssetContainerAsync;
 B.SceneLoader.LoadAssetContainerAsync=async()=>{const c=new B.AssetContainer(t.scene),mesh=B.MeshBuilder.CreateBox('mock-home',{size:1},t.scene);mesh.material=t.materials.plaster;c.meshes.push(mesh);c.removeAllFromScene();return c;};
 let layer;
 try{
  layer=await createGameBuildings(B,t.scene,t.materials);const b={...shore,rotation:1},state={buildings:[b],citizens:[]},before=structuredClone(state);layer.sync(state);
  const support=layer.meshes.find(m=>m.name.includes('game-shore-'));assert.ok(support);assert.equal(support.sourceMesh.receiveShadows,true);assert.equal(support.isPickable,true);const count=t.scene.meshes.length;
  for(let i=0;i<50;i++)layer.sync(state);assert.equal(t.scene.meshes.length,count);assert.ok(layer.meshes.includes(support));assert.deepEqual(state,before);
  const preview=layer.preview(b,state);assert.ok(preview.meshes.some(m=>m.name.includes('game-shore-')));layer.clearPreview();
  b.rotation=2;layer.sync(state);assert.ok(support.isDisposed());
  for(let i=0;i<16;i++)layer.preview({...b,x:b.x+i*.03},state);layer.dispose();assert.equal(t.scene.meshes.length,0);
 }finally{B.SceneLoader.LoadAssetContainerAsync=previous;layer?.dispose();t.dispose();}
});
