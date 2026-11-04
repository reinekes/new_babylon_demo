import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {strictScenario,legacyScenario} from '../scenario-profiles.js';
import {houseVisualKind,createHouseArchitecture} from '../game3d/house-architecture.js';
import {roofAccessLayout} from '../game3d/roof-access.js';
import {createSacredModels,sacredModelKey} from '../game3d/sacred-models.js';
import {gameBuildingSignature,createGameBuildings} from '../game3d/buildings.js';
import {createArchitecture} from '../game3d/architecture.js';
const strict={scenario:strictScenario()},legacy={scenario:legacyScenario()};
const sandbox={console,setTimeout,clearTimeout,performance,self:{}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.BABYLON;
function setup(){const engine=new B.NullEngine(),scene=new B.Scene(engine),m=Object.fromEntries(['warm','raw','fired','shade','trim','plaster','brick','wood','linen','reed','terracotta','soil','grass','stone'].map(k=>[k,new B.PBRMaterial(k,scene)]));return {scene,m,dispose(){scene.dispose();engine.dispose();}};}

test('strict starter retains its economic flag but has flat room and matching roof access, including upgrade',()=>{
 const t=setup();try{for(const construction of [undefined,{kind:'upgrade',target:2}]){
  const b={type:'house',level:1,x:3,y:4,starterHut:true,construction},before=structuredClone(b);
  assert.equal(houseVisualKind(b,strict),'courtyard-1');assert.equal(houseVisualKind(b,legacy),'hut');
  const meshes=createHouseArchitecture(B,t.scene,b,t.m,strict),parts=meshes.flatMap(m=>m.metadata.houseParts);
  assert.ok(parts.includes('earth-roof'));assert.ok(parts.includes('modest-back-room'));assert.ok(!parts.includes('beehive-shell'));
  assert.ok(roofAccessLayout(b,strict));assert.equal(roofAccessLayout(b,legacy),null);assert.deepEqual(b,before);
  for(const mesh of meshes)mesh.dispose();
 }}finally{t.dispose();}
});

test('strict temples never request late or unverified sacred assets, even after legacy use',async()=>{
 const loads=[],models=createSacredModels({SceneLoader:{LoadAssetContainerAsync(_root,file){loads.push(file);throw Error('offline');}}},{},{onError(){}});
 try{for(const b of [{type:'shrine',level:3},{type:'ziggurat',level:1,footprint:2},{type:'ziggurat',level:3,footprint:2},{type:'ishtarGate',footprint:3}]){
  assert.equal(sacredModelKey(b,strict),null);assert.equal(models.request(b,strict),null);
  assert.equal(models.ready(b,strict),false);assert.equal(models.sources(b,strict),null);
  assert.ok(sacredModelKey(b,legacy));await models.request(b,legacy);assert.equal(models.request(b,strict),null);
 }assert.equal(loads.length,4);}finally{models.dispose();}
});

test('strict building templates cannot reuse same-coordinate legacy sources or preview',async()=>{
 const t=setup(),layer=await createGameBuildings(B,t.scene,t.m,{deferAssets:true});
 try{const b={type:'house',level:1,x:3,y:4,starterHut:true},s={...legacy,buildings:[b],citizens:[]};
  assert.notEqual(gameBuildingSignature(b,s),gameBuildingSignature(b,{...s,...strict}));
  layer.sync(s);const old=layer.meshes.find(m=>m.name.includes('house-hut'));assert.ok(old);
  layer.sync({...s,...strict});assert.ok(old.isDisposed());assert.ok(layer.meshes.some(m=>m.name.includes('house-courtyard-1')));
  assert.ok(!layer.meshes.some(m=>m.name.includes('house-hut')));
  layer.sync(s);assert.ok(layer.meshes.some(m=>m.name.includes('house-hut')));
 }finally{layer.dispose();t.dispose();}
});

test('strict gate has a real rectangular opening, earth pigments and timber lintel within reserved footprint',()=>{
 const t=setup();try{const b={type:'ishtarGate',level:1,footprint:3},before=structuredClone(b),meshes=createArchitecture(B,t.scene,b,t.m,strict);
  assert.ok(meshes.some(m=>m.name.includes('sumer-gate')));assert.ok(meshes.some(m=>m.material===t.m.wood));
  assert.ok(meshes.every(m=>[t.m.raw,t.m.fired,t.m.trim,t.m.wood,t.m.soil].includes(m.material)));
  for(const mesh of meshes){mesh.computeWorldMatrix(true);const bb=mesh.getBoundingInfo().boundingBox;assert.ok(bb.minimumWorld.x>=-3&&bb.maximumWorld.x<=15);assert.ok(bb.minimumWorld.z>=-3&&bb.maximumWorld.z<=15);}
  const ray=new B.Ray(new B.Vector3(6,1.5,14),new B.Vector3(0,0,-1),16);assert.ok(!meshes.some(m=>ray.intersectsMesh(m).hit),'entry is an empty passage');
  assert.deepEqual(b,before);
 }finally{t.dispose();}
});

test('strict ziggurat grows through three brick stages while legacy procedural tier remains unchanged',()=>{
 const t=setup();try{const heights=[];
  for(const level of [1,2,3]){
   const meshes=createArchitecture(B,t.scene,{type:'ziggurat',level,footprint:2},t.m,strict);
   heights.push(Math.max(...meshes.map(m=>{m.computeWorldMatrix(true);return m.getBoundingInfo().boundingBox.maximumWorld.y;})));
   for(const mesh of meshes)mesh.dispose();
  }
  assert.ok(heights[0]+1<heights[1]);assert.ok(heights[1]+1<heights[2]);
 }finally{t.dispose();}
});
