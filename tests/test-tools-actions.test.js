import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,encode,decode,resolveEvent} from '../engine.js';
import {buildingKey,MATERIALS} from '../definitions.js';
import {takeStock,validateInventory} from '../inventory.js';
import {funeralView,validateFuneral} from '../funerals.js';
import {CITY_EVENTS} from '../city-events.js';
import {TEST_EVENTS,testToolsReason,triggerTestEvent,grantTestResources,instantTestUpgrade,killTestCitizens} from '../test-tools.js';

test('event catalogue opens each existing decision without consuming resources or advancing time',()=>{
 assert.equal(TEST_EVENTS,CITY_EVENTS);assert.equal(TEST_EVENTS.length,8);for(const id of ['caravan','festival','refugees'])assert.ok(TEST_EVENTS.some(e=>e.id===id));
 for(const event of TEST_EVENTS){const s=createGame({start:'established'}),before=structuredClone(s);assert.equal(triggerTestEvent(s,event.id).ok,true);assert.equal(s.event.id,event.id);assert.equal(s.tick,before.tick);assert.equal(s.simTime,before.simTime);assert.deepEqual(s.resources,before.resources);assert.ok(decode(encode(s)));assert.equal(resolveEvent(s,'skip').ok,true);}
});
test('testing resource selector adds exactly one resource, with no hidden unlock or population change',()=>{
 const s=createGame({start:'established'}),before=structuredClone(s);assert.deepEqual(grantTestResources(s,'beer').added,{beer:1000});for(const key of Object.keys(s.resources))assert.equal(s.resources[key],before.resources[key]+(key==='beer'?1000:0));assert.deepEqual(s.citizens,before.citizens);assert.deepEqual(s.sacred,before.sacred);assert.ok(validateInventory(s));assert.ok(decode(encode(s)));
 const unchanged=JSON.stringify(s);assert.equal(grantTestResources(s,'not-a-resource').ok,false);assert.equal(JSON.stringify(s),unchanged);
});
test('instant testing improvement finishes one free level, preserves construction date, cargo and identity',()=>{
 const s=createGame({start:'established'}),b=s.buildings.find(b=>b.type==='house'),before=structuredClone(s),date=structuredClone(b.built),ids=s.citizens.map(c=>c.id),nextId=s.demography.nextId;
 assert.equal(instantTestUpgrade(s,buildingKey(b)).ok,true);assert.equal(b.level,2);assert.equal(b.construction,undefined);assert.deepEqual(b.built,date);assert.deepEqual(s.resources,before.resources);assert.deepEqual(s.citizens.map(c=>c.id),ids);assert.equal(s.demography.nextId,nextId);assert.equal(s.capacity,before.capacity+4);assert.ok(decode(encode(s)));assert.equal(instantTestUpgrade(s,buildingKey(b)).ok,true);assert.equal(b.level,3);const snapshot=JSON.stringify(s);assert.equal(instantTestUpgrade(s,buildingKey(b)).ok,false);assert.equal(JSON.stringify(s),snapshot);
});
test('instant testing improvement refuses construction sites and canals without changing any allocation',()=>{
 for(const type of ['canal','house']){const s=createGame({start:'established'}),b=s.buildings[0];if(type==='canal')b.type='canal';else b.construction={kind:'upgrade',target:2,remaining:{clay:12},sources:{'9,8':{clay:12}}};const before=JSON.stringify(s);assert.equal(instantTestUpgrade(s,buildingKey(b)).ok,false);assert.equal(JSON.stringify(s),before);}
});
test('testing death returns owned cargo and records real deceased IDs with matching biers',()=>{
 const s=createGame({start:'established'}),c=s.citizens[0],id=c.id,nextId=s.demography.nextId,store=s.buildings.find(b=>b.type==='shrine'),before=s.resources.food;
 takeStock(s,buildingKey(store),'food',2);c.store=buildingKey(store);c.phase='toStore';c.cargo={food:2};
 const result=killTestCitizens(s,[id]);assert.equal(result.ok,true);assert.deepEqual(result.ids,[id]);assert.equal(s.population,11);assert.equal(s.deaths,1);assert.equal(s.resources.food,before);assert.ok(!s.citizens.some(p=>p.id===id));assert.equal(s.demography.nextId,nextId);assert.equal(s.lifeAnalytics.people.find(p=>p.id===id).diedTick,s.tick);assert.equal(s.lifeAnalytics.people.find(p=>p.id===id).cause,'unknown');assert.deepEqual(s.funeral.deceased.map(p=>p.id),[id]);assert.deepEqual(funeralView(s).biers.map(b=>b.deceasedId),[id]);assert.ok(validateInventory(s));assert.ok(validateFuneral(s));assert.ok(decode(encode(s)));
});
test('testing several deaths uses living stable IDs once and preserves all stock totals',()=>{
 const s=createGame({start:'established'}),ids=s.citizens.slice(0,5).map(c=>c.id),stock={...s.resources},nextId=s.demography.nextId,result=killTestCitizens(s,5);
 assert.equal(result.ok,true);assert.deepEqual(result.ids,ids);assert.equal(s.population,7);assert.equal(s.deaths,5);assert.equal(s.demography.nextId,nextId);assert.equal(s.funeral.deceased.length,5);assert.equal(funeralView(s).biers.length,5);for(const key of MATERIALS)assert.equal(s.resources[key],stock[key],key);assert.ok(decode(encode(s)));
});
test('invalid death selections refuse atomically, including duplicates, missing residents and no survivors',()=>{
 for(const selection of [[],[0,0],[99999],0,-1,1.5,12,Infinity]){const s=createGame({start:'established'}),before=JSON.stringify(s);assert.equal(killTestCitizens(s,selection).ok,false,String(selection));assert.equal(JSON.stringify(s),before);}
});
test('a stranded second victim keeps the complete batch alive with all original cargo in place',()=>{
 const s=createGame({start:'established'}),[first,stranded]=s.citizens;first.cargo={food:2};stranded.x=30;stranded.y=10;stranded.cargo={clay:3};const before=JSON.stringify(s),result=killTestCitizens(s,[first.id,stranded.id]);
 assert.equal(result.ok,false);assert.match(result.reason,/груз/);assert.equal(JSON.stringify(s),before);assert.equal(s.funeral,null);
});
test('every testing mutation respects possession, unresolved decisions and active ceremonies',()=>{
 for(const busy of ['relic','event','funeral','festival','lost'])for(const operation of [s=>grantTestResources(s),s=>triggerTestEvent(s,'caravan'),s=>instantTestUpgrade(s,buildingKey(s.buildings[0])),s=>killTestCitizens(s,1)]){
  const s=createGame({start:'established'});if(busy==='relic')s.relicQuest.phase='controlled';else if(busy==='lost')s.lost=true;else s[busy]={id:'festival',stage:'feasting'};const before=JSON.stringify(s);assert.ok(testToolsReason(s));const result=operation(s);assert.equal(result.ok,false,busy);assert.ok(result.reason);assert.equal(JSON.stringify(s),before,busy);
 }
});
