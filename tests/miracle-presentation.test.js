import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.js';
import {startMiracleCelebration,advanceMiracleCelebration,miracleCelebrationView} from '../miracle-celebration.js';
import {actorViewFrame} from '../game3d/actors.js';
import {Renderer,miraclePlantClear} from '../renderer.js';
import {isDryPoint,river} from '../world.js';
import {footprintSize} from '../footprints.js';
import {miracleGardenPlan} from '../miracle-garden-plan.js';

test('both renderers show every real resident at authored miracle coordinates without mutating cargo or identity',()=>{
 const s=createGame({start:'established'});s.citizens[0].phase='resting';s.citizens[0].cargo={clay:7};
 assert.ok(startMiracleCelebration(s,'fertility',{center:{x:15,y:12}}));
 const saved=structuredClone(s.citizens),renderer=Object.create(Renderer.prototype);
 for(const elapsed of [0,7,22,49,59]){
  advanceMiracleCelebration(s,elapsed-(s.miracleCelebration?.elapsed||0));
  const authored=miracleCelebrationView(s),three=actorViewFrame(s),two=renderer.ceremonyCitizens(s,.1,{paused:false,speed:4});
  assert.equal(three.citizens.length,s.citizens.length);assert.equal(two.length,s.citizens.length);assert.deepEqual(three.pettingPairs,[]);
  for(const expected of authored.participants)for(const crowd of [three.citizens,two]){
   const actor=crowd.find(c=>c.id===expected.id);assert.equal(actor.x,expected.x);assert.equal(actor.y,expected.y);assert.equal(actor.miracleContact.yaw,expected.yaw);assert.equal(actor.celebrating,expected.celebrating);assert.equal(actor.carrying,false);assert.deepEqual(actor.cargo,{});
   const original=s.citizens.find(c=>c.id===actor.id);assert.equal(actor.name,original.name);assert.equal(actor.age,original.age);assert.equal(actor.sex,original.sex);
  }
 }
 assert.deepEqual(s.citizens,saved);
});
test('2D garden plan is browser-asset-free, deterministic, bounded and placed at the actual target',()=>{
 const p=miracleGardenPlan({x:15,y:12});assert.equal(p.length,148);assert.equal(p.filter(p=>p.kind==='birch').length,1);assert.deepEqual(p,miracleGardenPlan({x:15,y:12}));assert.ok(p.every(p=>Math.hypot(p.x-15,p.y-12)<=2));
});

test('garden seeks saved scene age, stays fixed during pause and clears without rebuilding every frame',async()=>{
 const {readFileSync}=await import('node:fs'),vm=await import('node:vm'),{createMiracleGarden}=await import('../game3d/miracle-garden.js');
 const box={console,setTimeout,clearTimeout,performance,window:{addEventListener(){},removeEventListener(){}},navigator:{userAgent:'node'}};vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),box);const B=box.BABYLON,engine=new B.NullEngine(),scene=new B.Scene(engine),load=B.SceneLoader.LoadAssetContainerAsync;
 B.SceneLoader.LoadAssetContainerAsync=async()=>{const c=new B.AssetContainer(scene),m=B.MeshBuilder.CreatePlane('plant',{size:.4},scene);m.material=new B.StandardMaterial('leaf',scene);c.meshes.push(m);c.materials.push(m.material);c.removeAllFromScene();return c;};let garden;
 try{
  garden=await createMiracleGarden(B,scene);const celebration={kind:'fertility',center:{x:15,y:12},elapsed:23};garden.update(0,{celebration});assert.equal(garden.gardens[0].age,23);assert.equal(garden.activeGardens,1);
  const meshes=[...garden.meshes],count=scene.meshes.length;garden.update(4,{paused:true,celebration});assert.equal(garden.gardens[0].age,23);assert.deepEqual(garden.meshes,meshes);assert.equal(scene.meshes.length,count);
  garden.update(0,{celebration:{...celebration,elapsed:57}});assert.equal(garden.gardens[0].age,57);assert.deepEqual(garden.meshes,meshes);
  garden.update(0,{celebration:null});assert.equal(garden.activeGardens,0);assert.ok(meshes.filter(m=>m.metadata?.miracleGarden).every(m=>m.isDisposed()));
 }finally{garden?.dispose();B.SceneLoader.LoadAssetContainerAsync=load;scene.dispose();engine.dispose();}
});

test('2D miracle plants exclude occupied foundations, river and lakes at the actual target',()=>{
 const s=createGame({start:'established'}),center={x:9.5,y:8.5},all=miracleGardenPlan(center),plants=all.filter(p=>miraclePlantClear(s,p));
 assert.ok(plants.length>0&&plants.length<all.length);
 for(const p of plants){assert.ok(isDryPoint(s,p.x,p.y));for(const b of s.buildings){const n=footprintSize(b);assert.ok(Math.abs(b.x+(n-1)/2-p.x)>=n/2+.16||Math.abs(b.y+(n-1)/2-p.y)>=n/2+.16);}}
 assert.equal(miraclePlantClear(s,{x:river(8),y:8}),false);
 const water={...s,world:{...s.world,lakes:[{cells:[{x:15,y:12}]}]}};assert.equal(miraclePlantClear(water,{x:15,y:12}),false);
 const monument={...s,buildings:[{type:'ishtarGate',x:15,y:12,footprint:3}]};assert.equal(miraclePlantClear(monument,{x:17.55,y:14}),false);
});
