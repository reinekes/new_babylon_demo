import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,encode,decode,advanceTime,resolveEvent,build} from '../engine.js';
import {advanceWorkers,syncCitizens,recoverCitizenCargo} from '../workforce.js';
import {manualGatheringView,orderManualGathering,cancelManualGathering,MANUAL_GATHERING,workManualGathering} from '../manual-gathering.js';
import {forestStock,FOREST_CAPACITY} from '../forest-stock.js';
import {strictScenario} from '../scenario-profiles.js';
import {setCitizenRole} from '../management.js';
import {BUILDINGS,buildingKey} from '../definitions.js';
import {syncInventory,stockStores,storeCapacity} from '../inventory.js';
import {isWorkday,workforceStats} from '../workforce.js';
import {startFuneral,advanceFuneral} from '../funerals.js';
import {startRelicQuest,cancelRelicQuest} from '../relic-quest.js';
import {orderFestival,advanceFestival,cancelFestival} from '../festival.js';
import {signedRiverDistance} from '../world.js';

function fixture(mode='awakening',seed){const s=createGame({mode,...seed===undefined?{}:{seed}});for(const c of s.citizens){c.age=30;c.health=100;c.hunger=0;c.thirst=0;c.clothing=100;c.role='auto';c.work=null;c.site=null;c.phase='home';delete c.waterTrip;delete c.pantryTrip;delete c.clothingTarget;}for(const b of s.buildings){b.pantry=30;b.pantryDelivered=30;b.water=12;b.waterDelivered=12;b.householdStock={...b.householdStock,clothing:2};}syncCitizens(s);return s;}
function step(s,n=1){if(s.event)resolveEvent(s,'skip');advanceTime(s,n);}
function until(s,predicate,max=600){for(let i=0;i<max;i++){if(predicate())return true;step(s,.5);}return predicate();}
const target=s=>s.world.deposits.find(d=>d.kind==='clay'&&d.x<12&&!s.buildings.some(b=>b.x===d.x&&b.y===d.y));

test('manual orders require a real unoccupied deposit and cost no faith',()=>{const s=fixture(),d=target(s),before=s.resources.faith;assert.equal(s.resources.faith,0);assert.equal(manualGatheringView(s,0,0),null);assert.equal(orderManualGathering(s,0,0).ok,false);assert.equal(orderManualGathering(s,d.x,d.y).ok,true);assert.equal(s.resources.faith,before);assert.equal(orderManualGathering(s,d.x,d.y).ok,true);assert.equal(s.manualGathering.orders.length,1);const wildlife=s.world.deposits.find(v=>v.kind==='wildlife');assert.equal(orderManualGathering(s,wildlife.x,wildlife.y).ok,false);});

test('gatherers walk to the real deposit, work slowly and carry a conserved load before it reaches a store',()=>{const s=fixture(),d=target(s),before=s.resources.clay;orderManualGathering(s,d.x,d.y);assert.ok(until(s,()=>s.citizens.some(c=>c.phase==='manualGathering')));const c=s.citizens.find(c=>c.phase==='manualGathering');assert.ok(Math.hypot(c.x-d.x,c.y-d.y)<1);assert.equal(s.resources.clay,before);assert.ok(MANUAL_GATHERING.clay.workSeconds/MANUAL_GATHERING.clay.batchSize>BUILDINGS.clay.workTime/BUILDINGS.clay.output.clay*3);assert.ok(until(s,()=>s.citizens.some(c=>c.manualGathering&&(c.cargo.clay||0)>0)));assert.equal(s.resources.clay,before,'work does not directly credit stock');const loaded=s.citizens.find(c=>c.manualGathering&&c.cargo.clay>0);assert.equal(loaded.cargo.clay,.25);assert.equal(loaded.phase,'toStore');assert.ok(decode(encode(s)),'carrying state reloads');assert.ok(until(s,()=>s.resources.clay>before));assert.equal(s.delivered.clay,s.resources.clay-before);});

test('hand gathering logs wood and dates at quarter yield while old baskets remain valid',()=>{
 const s=createGame({mode:'mature',scenario:strictScenario()});
 for(const [kind,resource] of [['forest','wood'],['dates','food']]){
  const site=s.world.deposits.find(d=>d.kind===kind&&!s.buildings.some(b=>b.x===d.x&&b.y===d.y));
  assert.ok(orderManualGathering(s,site.x,site.y).ok);
  const view=manualGatheringView(s,site.x,site.y),before=s.resources[resource],stand={x:site.x-.5,y:site.y-.5};
  const worker={...stand,phase:'manualGathering',cargo:{},manualGathering:{key:view.key,stand,progress:view.workSeconds}};
  assert.equal(view.batchSize,.25);assert.ok(workManualGathering(s,worker,.1));
  assert.deepEqual(worker.cargo,{[resource]:.25});assert.equal(s.resources[resource],before);
  assert.equal(s.cityProductionArchive[1][`manual:${view.key}`][resource],.25);
  if(kind==='forest')assert.equal(forestStock(s,view.key).stock,FOREST_CAPACITY-1);
 }
 assert.ok(decode(encode(s)));
 const legacy=fixture(),clay=target(legacy);orderManualGathering(legacy,clay.x,clay.y);
 assert.ok(until(legacy,()=>legacy.citizens.some(c=>c.manualGathering&&c.cargo.clay>0)));
 const carrier=legacy.citizens.find(c=>c.manualGathering&&c.cargo.clay>0);carrier.cargo.clay=1.75;
 const raw=encode(legacy),loaded=decode(raw);assert.ok(loaded);assert.equal(encode(loaded),raw);
 const before=loaded.resources.clay;assert.ok(until(loaded,()=>!(loaded.citizens.find(c=>c.id===carrier.id).cargo.clay>0)));
 assert.ok(loaded.resources.clay>=before+1.75);
});

test('cancelling work preserves a carried resource and releases only the manual assignment',()=>{const s=fixture(),d=target(s);orderManualGathering(s,d.x,d.y);assert.ok(until(s,()=>s.citizens.some(c=>c.manualGathering&&c.cargo.clay>0)));const before=s.resources.clay+s.citizens.reduce((n,c)=>n+(c.cargo.clay||0),0);assert.equal(cancelManualGathering(s,d.x,d.y).ok,true);step(s,.1);assert.ok(s.citizens.every(c=>!c.manualGathering));assert.equal(s.resources.clay+s.citizens.reduce((n,c)=>n+(c.cargo.clay||0),0),before);assert.ok(until(s,()=>s.citizens.every(c=>!c.cargo.clay)));assert.equal(s.resources.clay,before);assert.ok(decode(encode(s)));});

test('explicit jobs and important household duties are never stolen for a gathering order',()=>{const s=createGame({start:'established'}),d=s.world.deposits.find(d=>d.kind==='stone'&&!s.buildings.some(b=>b.x===d.x&&b.y===d.y));for(const c of s.citizens)c.role='builder';syncCitizens(s);orderManualGathering(s,d.x,d.y);step(s,10);assert.equal(s.citizens.filter(c=>c.manualGathering).length,0);assert.equal(manualGatheringView(s,d.x,d.y).status,'waiting');});

test('role reassignment cancels manual work and death recovers the actual owned load once',()=>{const s=fixture(),d=target(s);orderManualGathering(s,d.x,d.y);assert.ok(until(s,()=>s.citizens.some(c=>c.phase==='manualGathering')));const c=s.citizens.find(c=>c.phase==='manualGathering');assert.equal(setCitizenRole(s,c.id,'builder').ok,true);assert.equal(c.manualGathering,undefined);assert.notEqual(c.phase,'manualGathering');assert.ok(until(s,()=>s.citizens.some(c=>c.manualGathering&&c.cargo.clay>0)));const carrier=s.citizens.find(c=>c.manualGathering&&c.cargo.clay>0),total=s.resources.clay+carrier.cargo.clay;assert.equal(recoverCitizenCargo(s,carrier.id),true);assert.equal(carrier.manualGathering,undefined);assert.equal(s.resources.clay,total);assert.equal(recoverCitizenCargo(s,carrier.id),true);assert.equal(s.resources.clay,total);});

test('legacy saves remain unchanged and invalid manual job references are rejected',()=>{const s=fixture(),legacy=encode(s);assert.equal(decode(legacy).manualGathering,undefined);const d=target(s);orderManualGathering(s,d.x,d.y);assert.ok(until(s,()=>s.citizens.some(c=>c.phase==='manualGathering')));const original=encode(s);assert.equal(encode(decode(original)),original);const invalid=JSON.parse(original);invalid.manualGathering.orders.push({...invalid.manualGathering.orders[0]});assert.equal(decode(JSON.stringify(invalid)),null);const bad=JSON.parse(original),c=bad.citizens.find(c=>c.manualGathering);c.manualGathering.key='0,0';assert.equal(decode(JSON.stringify(bad)),null);});


test('stone work survives the night without generating goods, and night cancellation sends no new collectors',()=>{const s=fixture(),d=s.world.deposits.find(d=>d.kind==='stone'&&d.x<12);orderManualGathering(s,d.x,d.y);assert.ok(until(s,()=>s.citizens.some(c=>c.phase==='manualGathering')));const c=s.citizens.find(c=>c.phase==='manualGathering');while(isWorkday(s.simTime))step(s,.1);const partial=c.manualGathering.progress,total=s.resources.stone+s.citizens.reduce((n,c)=>n+(c.cargo.stone||0),0);assert.ok(partial>0&&partial<28);assert.match(manualGatheringView(s,d.x,d.y).statusReason,/Ночью/);step(s,10);assert.equal(c.manualGathering.progress,partial);assert.equal(s.resources.stone+s.citizens.reduce((n,c)=>n+(c.cargo.stone||0),0),total);assert.ok(decode(encode(s)));cancelManualGathering(s,d.x,d.y);step(s,.1);assert.ok(s.citizens.every(c=>!c.manualGathering));assert.ok(decode(encode(s)));});

test('all three deposits support actual hand collection, with two distinct working stations per order',()=>{for(const resource of ['clay','reed','stone']){const s=fixture(),d=s.world.deposits.filter(d=>d.kind===resource&&d.x<12&&!s.buildings.some(b=>b.x===d.x&&b.y===d.y)).sort((a,b)=>Math.hypot(a.x-7,a.y-8)-Math.hypot(b.x-7,b.y-8))[0],before=s.resources[resource];assert.ok(orderManualGathering(s,d.x,d.y).ok,resource);assert.ok(until(s,()=>s.resources[resource]>before,1000),resource);const workers=s.citizens.filter(c=>c.manualGathering);assert.ok(workers.length<=2);assert.equal(new Set(workers.map(c=>`${c.manualGathering.stand.x},${c.manualGathering.stand.y}`)).size,workers.length);assert.ok(decode(encode(s)),resource);}});

test('unreachable deposits and full stores explain the wait without manufacturing stock or changing existing jobs',()=>{const s=fixture(),far=s.world.deposits.find(d=>d.kind==='clay'&&d.x>20),before=s.resources.clay;assert.ok(orderManualGathering(s,far.x,far.y).ok);step(s,2);assert.equal(s.citizens.filter(c=>c.manualGathering).length,0);assert.match(manualGatheringView(s,far.x,far.y).statusReason,/Нет сухого пути/);assert.equal(s.resources.clay,before);cancelManualGathering(s,far.x,far.y);const near=target(s);for(const b of stockStores(s))b.stock.clay=storeCapacity(b);s.resources.clay=stockStores(s).reduce((n,b)=>n+b.stock.clay,0);orderManualGathering(s,near.x,near.y);step(s,2);assert.equal(s.citizens.filter(c=>c.manualGathering).length,0);assert.match(manualGatheringView(s,near.x,near.y).statusReason,/Нет доступного склада/);assert.ok(decode(encode(s)));});

test('building a workshop on an active deposit releases collectors without erasing their already carried load',()=>{const s=fixture('mature'),d=target(s);orderManualGathering(s,d.x,d.y);assert.ok(until(s,()=>s.citizens.some(c=>c.manualGathering&&c.cargo.clay>0)));const carrier=s.citizens.find(c=>c.manualGathering&&c.cargo.clay>0),load=carrier.cargo.clay;const result=build(s,'clay',d.x,d.y);assert.equal(result.ok,true,result.reason);assert.ok(s.citizens.every(c=>!c.manualGathering));assert.equal(carrier.cargo.clay,load);assert.match(manualGatheringView(s,d.x,d.y).reason,/здание|стройка/);assert.ok(decode(encode(s)));});

test('manual collection follows the generated 64×64 river axis and preserves identity through loading',()=>{for(const seed of [1,2,3,4]){const s=fixture('awakening',seed),home=s.buildings.find(b=>b.type==='house'),side=Math.sign(signedRiverDistance(home.x,home.y,s)),d=s.world.deposits.filter(d=>d.kind==='clay'&&Math.sign(signedRiverDistance(d.x,d.y,s))===side&&!s.buildings.some(b=>b.x===d.x&&b.y===d.y)).sort((a,b)=>Math.hypot(a.x-home.x,a.y-home.y)-Math.hypot(b.x-home.x,b.y-home.y))[0],ids=s.citizens.map(c=>c.id);assert.equal(orderManualGathering(s,d.x,d.y).ok,true);assert.ok(until(s,()=>s.citizens.some(c=>c.manualGathering),500),`seed ${seed}`);const loaded=decode(encode(s));assert.ok(loaded);assert.deepEqual(loaded.citizens.map(c=>c.id),ids);assert.equal(loaded.world.width,64);assert.equal(encode(loaded),encode(s));}});

test('funeral pauses hand work and moving mourners remain reloadable without a second basket',()=>{const s=fixture(),d=target(s);orderManualGathering(s,d.x,d.y);assert.ok(until(s,()=>s.citizens.some(c=>c.phase==='manualGathering')));const total=s.resources.clay+s.citizens.reduce((n,c)=>n+(c.cargo.clay||0),0),progress=s.citizens.filter(c=>c.manualGathering).map(c=>[c.id,c.manualGathering.progress]);startFuneral(s,[{id:100,name:'Покойный',x:8,y:8}]);for(let i=0;i<20;i++)advanceTime(s,.2);assert.equal(s.resources.clay+s.citizens.reduce((n,c)=>n+(c.cargo.clay||0),0),total);assert.deepEqual(s.citizens.filter(c=>c.manualGathering).map(c=>[c.id,c.manualGathering.progress]),progress);assert.ok(decode(encode(s)));});

test('a collector may become the chosen resident at home; possession locks new orders without duplicating goods',()=>{const s=fixture('mature');s.buildings.push({type:'shrine',x:9,y:8,level:1});syncInventory(s);syncCitizens(s);const d=target(s);orderManualGathering(s,d.x,d.y);assert.ok(until(s,()=>s.citizens.some(c=>c.phase==='manualGathering')));assert.ok(until(s,()=>s.citizens.some(c=>c.manualGathering&&c.phase==='home'&&!Object.values(c.cargo).some(n=>n>0)),500));const c=s.citizens.find(c=>c.manualGathering&&c.phase==='home'),identity=c.id,total=s.resources.clay+s.citizens.reduce((n,c)=>n+(c.cargo.clay||0),0),started=startRelicQuest(s,c.id,'land');assert.equal(started.ok,true,started.reason);assert.ok(decode(encode(s)),'the just-selected resident is reloadable before a frame');assert.equal(orderManualGathering(s,d.x,d.y).ok,false);assert.equal(cancelManualGathering(s,d.x,d.y).ok,false);step(s,.1);assert.equal(c.manualGathering,undefined);assert.equal(c.id,identity);assert.equal(s.resources.clay+s.citizens.reduce((n,c)=>n+(c.cargo.clay||0),0),total);assert.equal(cancelRelicQuest(s).ok,true);assert.ok(decode(encode(s)));});

test('a home collector can join festival supply and the suspended hand-work reference is safely released',()=>{const s=fixture('mature');s.buildings.push({type:'shrine',x:9,y:8,level:1});s.resources.beer=20;syncInventory(s);syncCitizens(s);const d=target(s);orderManualGathering(s,d.x,d.y);assert.ok(until(s,()=>s.citizens.some(c=>c.phase==='manualGathering')));assert.ok(until(s,()=>s.citizens.some(c=>c.manualGathering&&c.phase==='home'&&!Object.values(c.cargo).some(n=>n>0)),500));const collectors=s.citizens.filter(c=>c.manualGathering),ids=new Set(collectors.map(c=>c.id));for(const c of s.citizens)if(!ids.has(c.id))setCitizenRole(s,c.id,'builder');assert.equal(orderFestival(s).ok,true);for(let i=0;i<600&&!s.festival.actors.some(a=>ids.has(a.id));i++)step(s,.1);assert.ok(s.festival.actors.some(a=>ids.has(a.id)));for(const a of s.festival.actors)assert.equal(s.citizens.find(c=>c.id===a.id).manualGathering,undefined);assert.ok(decode(encode(s)));assert.equal(cancelFestival(s).ok,true);step(s,.1);assert.ok(decode(encode(s)));});

test('Hands of the Creator boosts a hand-carried load and the load survives buff expiry',()=>{
 for(const resource of ['clay','reed','stone']){
  const s=fixture();
  const d=s.world.deposits.find(d=>d.kind===resource&&d.x<12&&!s.buildings.some(b=>b.x===d.x&&b.y===d.y));
  assert.ok(d,resource);
  s.buffs.inspiration=3;
  const expected=resource==='stone'?.25:.4375;
  assert.equal(manualGatheringView(s,d.x,d.y).batchSize,expected);
  assert.ok(orderManualGathering(s,d.x,d.y).ok);
  assert.ok(until(s,()=>s.citizens.some(c=>c.manualGathering&&c.cargo[resource]>0)),resource);
  const c=s.citizens.find(c=>c.manualGathering&&c.cargo[resource]>0);
  assert.equal(c.cargo[resource],expected);
  s.buffs.inspiration=0;
  assert.equal(manualGatheringView(s,d.x,d.y).batchSize,.25);
  const raw=encode(s);
  assert.equal(encode(decode(raw)),raw);
 }
});
