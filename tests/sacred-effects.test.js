import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGame} from '../engine.js';
import {createRelicScene,drawRelic2D} from '../game3d/relic-scene.js';
import {createSacredEffects,SACRED_EFFECT_LIMITS} from '../game3d/sacred-effects.js';

const sandbox={module:{exports:{}},console,setTimeout,clearTimeout,performance,self:{}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.BABYLON;
test('both unique relics remain visible independently and render no ordinary cargo or simulation changes',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),s=createGame({start:'established'}),view=createRelicScene(B,scene),before=JSON.stringify(s);
 try{view.update(s);assert.deepEqual(view.stats().visibleIds,['oasis','land']);assert.equal(JSON.stringify(s),before);const lake=view.meshes.find(m=>m.name==='relic-oasis-gold-ring'),land=view.meshes.find(m=>m.name==='relic-land-gold-ring');assert.ok(lake&&land);lake.computeWorldMatrix(true);land.computeWorldMatrix(true);assert.ok(lake.getAbsolutePosition().y<-.18);assert.ok(land.getAbsolutePosition().y>=0);assert.ok(view.meshes.every(m=>!m.isPickable&&!m.checkCollisions));
  const count=scene.meshes.length;for(let i=0;i<20;i++)view.update(s);assert.equal(scene.meshes.length,count);view.dispose();view.dispose();assert.ok(view.meshes.every(m=>m.isDisposed()));
 }finally{view.dispose();scene.dispose();engine.dispose();}
});
test('2D shows both unique relics through the same read-only quest views',()=>{
 const s=createGame({start:'established'}),points=[],ctx={save(){},restore(){},beginPath(){},arc(){},fill(){},stroke(){},ellipse(){}};const before=JSON.stringify(s);
 drawRelic2D({ctx,point:(x,y)=>{points.push([x,y]);return{x,y};}},s);assert.equal(points.length,2);assert.equal(JSON.stringify(s),before);
});
test('completed temple effects trigger on an observed transition once, pause, expire and do not replay loaded rewards',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),s=createGame({start:'established'}),fx=createSacredEffects(B,scene);
 try{fx.update(s,.1);assert.equal(fx.stats().bursts,0);Object.assign(s.relicQuest,{phase:'completed',completedAt:25,temple:'9,8'});s.relicQuest.artifact={location:'temple',x:9,y:8,temple:'9,8'};
  const before=JSON.stringify(s);fx.update(s,.1);assert.equal(fx.stats().bursts,1);assert.equal(JSON.stringify(s),before);const frozen=fx.meshes.filter(m=>m.isEnabled()).map(m=>[m.position.asArray(),m.scaling.asArray(),m.material.alpha]);for(let i=0;i<5;i++)fx.update(s,.2,{paused:true});assert.deepEqual(fx.meshes.filter(m=>m.isEnabled()).map(m=>[m.position.asArray(),m.scaling.asArray(),m.material.alpha]),frozen);
  for(let i=0;i<90;i++)fx.update(s,.1);assert.equal(fx.stats().bursts,0);fx.update(s,.1);assert.equal(fx.stats().bursts,0);
  fx.reset(s);fx.update(s,.1);assert.equal(fx.stats().bursts,0);fx.update(structuredClone(s),.1);assert.equal(fx.stats().bursts,0,'loaded completed reward never replays');
 }finally{fx.dispose();scene.dispose();engine.dispose();}
});
test('portals have a fixed count cap, remain unpickable and all meshes/materials release on disposal',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),s=createGame({start:'established'});for(let i=0;i<20;i++)s.buildings.push({type:'ishtarGate',x:i,y:15,level:1,footprint:3});const fx=createSacredEffects(B,scene,{reducedMotion:true});
 try{const before=JSON.stringify(s);fx.update(s,.1);assert.equal(fx.stats().portals,SACRED_EFFECT_LIMITS.portals);assert.ok(fx.meshes.length<=SACRED_EFFECT_LIMITS.meshes);const count=scene.meshes.length,positions=fx.meshes.map(m=>[m.position.asArray(),m.scaling.asArray(),m.material.alpha]);for(let i=0;i<20;i++)fx.update(s,.1);assert.equal(scene.meshes.length,count);assert.deepEqual(fx.meshes.map(m=>[m.position.asArray(),m.scaling.asArray(),m.material.alpha]),positions);assert.ok(fx.meshes.every(m=>!m.isPickable));assert.equal(JSON.stringify(s),before);const owned=[...fx.meshes];fx.dispose();fx.dispose();assert.ok(owned.every(m=>m.isDisposed()));
 }finally{fx.dispose();scene.dispose();engine.dispose();}
});
