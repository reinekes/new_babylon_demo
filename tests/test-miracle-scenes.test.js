import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,encode,decode,miracle} from '../engine.js';
import * as testing from '../test-tools.js';
import {eventMusicTheme} from '../city-audio.js';
import {miracleCelebrationView} from '../miracle-celebration.js';
import {validateInventory,takeStock} from '../inventory.js';
import {buildingKey} from '../definitions.js';

test('testing previews both full scenes in an unrecognized zero-faith village without unlocking or charging miracles',()=>{
 assert.equal(typeof testing.triggerTestMiracleScene,'function');
 for(const [kind,theme,cooldown] of [['cat','catArrival',1],['fertility','earthBreath',3]]){
  const s=createGame({mode:'awakening'});s.cooldowns[kind]=cooldown;assert.ok(decode(encode(s)));
  const before=structuredClone(s);
  assert.equal(miracle(s,kind).ok,false);
  assert.equal(testing.triggerTestMiracleScene(s,kind).ok,true);
  assert.equal(s.miracleCelebration.kind,kind);assert.equal(s.miracleCelebration.elapsed,0);
  assert.equal(eventMusicTheme(s),theme);
  assert.deepEqual(s.resources,before.resources);assert.deepEqual(s.cooldowns,before.cooldowns);assert.deepEqual(s.buffs,before.buffs);
  assert.deepEqual(s.godhood,before.godhood);assert.deepEqual(s.divinity,before.divinity);assert.equal(s.miracleCount,before.miracleCount);
  assert.deepEqual(s.citizens,before.citizens);assert.deepEqual(s.buildings,before.buildings);assert.ok(validateInventory(s));
  advanceTime(s,30);const view=miracleCelebrationView(s);assert.ok(view.participants.some(c=>c.celebrating));if(kind==='cat')assert.ok(view.cat);
  const restored=decode(encode(s));assert.ok(restored);assert.deepEqual(miracleCelebrationView(restored),view);
  advanceTime(restored,30);assert.equal(restored.miracleCelebration,null);assert.equal(restored.simTime,before.simTime);assert.deepEqual(restored.citizens,before.citizens);
  assert.equal(testing.triggerTestMiracleScene(restored,kind).ok,true);assert.equal(restored.cooldowns[kind],cooldown);assert.equal(restored.resources.faith,0);
  if(kind==='cat')assert.equal(restored.pests.cats.length,1,'replays reuse the cat instead of multiplying them');
 }
});

test('preview preserves in-flight stock and existing cat identity across replay and save',()=>{
 assert.equal(typeof testing.triggerTestMiracleScene,'function');
 const s=createGame({start:'established'}),c=s.citizens[0],store=s.buildings.find(b=>b.type==='shrine');
 takeStock(s,buildingKey(store),'food',2);c.store=buildingKey(store);c.phase='toStore';c.cargo={food:2};
 assert.equal(testing.triggerTestMiracleScene(s,'cat').ok,true);advanceTime(s,60);
 const before=structuredClone(s);assert.equal(testing.triggerTestMiracleScene(s,'cat').ok,true);
 assert.deepEqual(s.pests,before.pests);assert.deepEqual(s.citizens,before.citizens);assert.deepEqual(s.resources,before.resources);assert.deepEqual(s.buildings,before.buildings);
 const restored=decode(encode(s));assert.ok(restored);assert.deepEqual(restored.citizens,s.citizens);assert.ok(validateInventory(restored));
});

test('scene testing refuses every active ceremony, possession and decision atomically',()=>{
 assert.equal(typeof testing.triggerTestMiracleScene,'function');
 for(const busy of ['miracleCelebration','funeral','festival','relicQuest','landRelicQuest','event','lost'])for(const kind of ['cat','fertility']){
  const s=createGame({mode:'awakening'});if(busy.endsWith('Quest'))s[busy].phase='controlled';else if(busy==='lost')s.lost=true;else s[busy]={kind:'cat',stage:'celebrating'};
  const before=JSON.stringify(s),result=testing.triggerTestMiracleScene(s,kind);
  assert.equal(result.ok,false,busy);assert.ok(result.reason);assert.equal(JSON.stringify(s),before,busy);
 }
 for(const kind of ['rain',null,'']){const s=createGame(),before=JSON.stringify(s);assert.equal(testing.triggerTestMiracleScene(s,kind).ok,false);assert.equal(JSON.stringify(s),before);}
 const s=createGame();s.buildings=[];const before=JSON.stringify(s);assert.equal(testing.triggerTestMiracleScene(s,'cat').ok,false);assert.equal(JSON.stringify(s),before,'no cat is created when a scene cannot start');
});
