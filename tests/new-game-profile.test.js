import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewCity} from '../new-game.js';
import {advanceTime,build,createGame,decode,encode,resolveEvent} from '../engine.js';
import {useThreeDayCalendar} from '../calendar.js';
import {marketStatus,trade} from '../trading.js';
import {strictScenario,legacyScenario,CAT_DISCOVERY_RULES} from '../scenario-profiles.js';

test('new Awakening selects C01 while mature towns retain classic miracles in strict Sumer',()=>{
 for(const mode of ['awakening','mature']){const s=createNewCity({mode,seed:137});assert.deepEqual(s.scenario,{version:1,history:'sumer-iii-v1',miracles:mode==='awakening'?CAT_DISCOVERY_RULES:'classic-v1'});assert.equal(s.catDiscovery?.phase,mode==='awakening'?'learning':undefined);assert.equal(s.catDiscovery?.trial,mode==='awakening'?'locked':undefined);assert.equal(s.godhood.mode,mode);assert.equal(s.resources.faith,mode==='awakening'?0:1000);assert.equal(s.buildings.length,5);assert.ok(s.buildings.every(b=>b.starterHut));assert.deepEqual(decode(encode(s)),s);assert.doesNotMatch(s.news[0].text,/ульев/);}
});
test('new town creation never enrolls old cities or changes the low-level fixture default',()=>{
 const old=createGame({mode:'awakening',seed:137}),raw=encode(old),fresh=createNewCity({mode:'awakening',seed:138});assert.deepEqual(old.scenario,legacyScenario());assert.equal(encode(old),raw);assert.deepEqual(decode(raw).scenario,legacyScenario());assert.notEqual(old.world.seed,fresh.world.seed);
});

test('the mode chooser placeholder and an existing strict classic town do not silently enroll in C01',()=>{
 const placeholder=createNewCity({seed:137});assert.deepEqual(placeholder.scenario,strictScenario());assert.equal(placeholder.catDiscovery,undefined);
 const old=createGame({mode:'awakening',seed:137,scenario:strictScenario()}),raw=encode(old);createNewCity({mode:'awakening',seed:138});const loaded=decode(raw);assert.ok(loaded);assert.deepEqual(loaded.scenario,strictScenario());assert.equal(loaded.catDiscovery,undefined);assert.equal(loaded.catFishing,undefined);assert.equal(encode(old),raw);
});

test('new Sumerian cities import timber and stone while existing maps retain local deposits',()=>{
 for(const mode of ['awakening','mature']){
  const city=createNewCity({mode,seed:137});
  const loaded=decode(encode(city));
  assert.ok(loaded);
  assert.ok(!loaded.world.deposits.some(d=>['forest','stone'].includes(d.kind)));
  for(const kind of ['clay','reed','dates','wildlife'])assert.ok(loaded.world.deposits.some(d=>d.kind===kind));
 }
 const old=createGame({mode:'mature',seed:137,scenario:strictScenario()});
 const saved=encode(old),loaded=decode(saved);
 assert.equal(encode(loaded),saved);
 for(const kind of ['forest','stone'])assert.ok(loaded.world.deposits.some(d=>d.kind===kind));
});

test('a new city can build its first trade route and receive both imports with starting resources',()=>{
 let city=useThreeDayCalendar(createNewCity({mode:'mature',seed:137}));
 const step=()=>{if(city.event)resolveEvent(city,'skip');advanceTime(city,.5);};
 for(const [type,x,y] of [['market',10,9],['granary',10,8]]){
  const result=build(city,type,x,y);
  assert.ok(result.ok,result.reason);
 }
 for(let i=0;i<1600&&marketStatus(city);i++)step();
 assert.equal(marketStatus(city),'');
 const before={wood:city.resources.wood,stone:city.resources.stone};
 for(const material of ['wood','stone']){
  const result=trade(city,material,'buy',2);
  assert.ok(result.ok,result.reason);
  assert.equal(city.resources[material],before[material]);
 }
 const paid=encode(city);
 city=decode(paid);
 assert.ok(city);
 assert.equal(encode(city),paid);
 for(let i=0;i<200&&city.trade.deliveries.some(q=>q.delivered<q.amount);i++)step();
 for(const material of ['wood','stone'])assert.equal(city.resources[material],before[material]+2);
});
