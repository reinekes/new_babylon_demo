import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTime,build,buildingAt,canUpgrade,createGame,decode,encode} from '../engine.js';
import {buildingKey,capacityOf,isResidence} from '../definitions.js';
import {legacyScenario,strictScenario} from '../scenario-profiles.js';
import {syncCitizens} from '../workforce.js';
import {advanceGenerations} from '../demography.js';
import {residentMood} from '../wellbeing.js';
import {household,totalFood} from '../households.js';
import {waterSummary} from '../water.js';
import {arrivalHousing} from '../arrival-hospitality.js';
import {canDemolish,demolish} from '../management.js';

function withLodge(scenario=strictScenario(),instant=true){
 const s=createGame({start:'established',seed:137,scenario});
 assert.deepEqual(build(s,'communalHouse',8,6,1,{instant}),{ok:true});
 return {s,lodge:buildingAt(s,8,6)};
}
function fillHomes(s){
 s.population=s.capacity;
 syncCitizens(s);
}
function checkSave(s){
 const raw=encode(s),restored=decode(raw);
 assert.ok(restored);
 assert.equal(encode(restored),raw);
}

test('builders deliver the price and complete all four cells before the lodge opens',()=>{
 const {s,lodge}=withLodge(strictScenario(),false);
 assert.equal(capacityOf(lodge),0);
 for(const [x,y] of [[8,6],[9,6],[8,7],[9,7]])assert.equal(buildingAt(s,x,y),lodge);
 const {clay,reed,wood}=lodge.construction.required;
 assert.deepEqual({clay,reed,wood},{clay:36,reed:24,wood:8});
 checkSave(s);
 let carried=false;
 for(let step=0;step<200&&lodge.construction;step++){
  advanceTime(s,.25);
  carried||=s.citizens.some(c=>c.site===buildingKey(lodge)&&Object.values(c.buildCargo).some(n=>n>0));
 }
 assert.ok(carried);
 assert.equal(lodge.construction,undefined);
 assert.equal(capacityOf(lodge),24);
 assert.equal(s.capacity,40);
 assert.match(canUpgrade(s,lodge),/один уровень/);
 checkSave(s);
 for(const wrong of [{level:2},{footprint:1},{footprint:undefined}]){
  const data=JSON.parse(encode(s));
  Object.assign(data.buildings.find(b=>b.type==='communalHouse'),wrong);
  assert.equal(decode(JSON.stringify(data)),null);
 }
});

test('private beds fill first and both scenarios save all 24 residents with their identities',()=>{
 for(const scenario of [strictScenario(),legacyScenario()]){
  const {s,lodge}=withLodge(scenario),key=buildingKey(lodge),initial=s.citizens.map(c=>[c.id,c.home,c.parents]);
  s.population=17;syncCitizens(s);
  assert.equal(household(s,lodge).residents.length,1);
  assert.deepEqual(arrivalHousing(s),[{home:key,beds:23}]);
  fillHomes(s);
  const {residents,free}=household(s,lodge);
  assert.equal(residents.length,24);
  assert.equal(free,0);
  assert.deepEqual(s.citizens.slice(0,initial.length).map(c=>[c.id,c.home,c.parents]),initial);
  assert.equal(waterSummary(s,lodge).demand,24);
  assert.match(canDemolish(s,lodge),/жилья/);
  checkSave(s);
 }
});

test('real couriers supply the lodge, residents eat and the city averages the occupied beds',()=>{
 const {s,lodge}=withLodge();fillHomes(s);
 const key=buildingKey(lodge),residents=household(s,lodge).residents;
 let foodInTransit=false,waterInTransit=false,sharedDinner=false;
 for(let step=0;step<450;step++){
  advanceTime(s,.1);
  foodInTransit||=s.citizens.some(c=>c.pantryTrip&&(c.pantryTarget||c.home)===key&&c.pantryFood>0);
  waterInTransit||=s.citizens.some(c=>c.waterTrip?.target===key&&c.waterTrip.load>0);
  sharedDinner||=residents.some(c=>c.familyMeal&&c.diningUntil>s.simTime);
 }
 assert.ok(foodInTransit&&lodge.pantryDelivered>0);
 assert.ok(waterInTransit&&lodge.waterDelivered>0);
 assert.ok(sharedDinner);
 for(const c of residents)assert.equal(residentMood(c,lodge),c.mood-8);
 const homes=new Map(s.buildings.filter(isResidence).map(b=>[buildingKey(b),b]));
 const mean=s.citizens.reduce((n,c)=>n+residentMood(c,homes.get(c.home)),0)/s.citizens.length;
 assert.equal(s.happiness,mean);
 checkSave(s);
});

test('singles can walk to new private beds while carriers keep their load and home',()=>{
 const {s,lodge}=withLodge();s.population=18;syncCitizens(s);
 const [busy,free]=household(s,lodge).residents;
 busy.cargo={clay:2};
 assert.deepEqual(build(s,'house',10,9,0,{instant:true}),{ok:true});
 assert.equal(free.home,'10,9');
 assert.equal(free.phase,'toHome');
 assert.equal(residentMood(free,buildingAt(s,10,9)),75);
 assert.equal(free.mood,75);
 assert.equal(busy.home,buildingKey(lodge));
 assert.deepEqual(busy.cargo,{clay:2});
 busy.cargo={};
 syncCitizens(s);
 assert.equal(busy.home,'10,9');
 assert.equal(residentMood(busy,buildingAt(s,10,9)),75);
});

test('a couple cannot have a child in the lodge and can after moving together into a private home',()=>{
 const {s,lodge}=withLodge();
 const pair=s.citizens.slice(0,2);
 s.citizens=pair;s.population=2;
 const key=buildingKey(lodge);
 for(const [i,c] of pair.entries())Object.assign(c,{home:key,sex:i?'f':'m',age:24,partner:pair[1-i].id,parents:[],phase:'home'});
 s.buildings=s.buildings.filter(b=>b.type!=='house');
 s.happiness=95;s.hungry=false;lodge.pantry=100;
 for(let i=0;i<12;i++){
  s.demography.rngState=1;
  assert.equal(advanceGenerations(s).newborns.length,0);
 }
 assert.deepEqual(build(s,'house',10,9,0,{instant:true}),{ok:true});
 const privateHome=buildingAt(s,10,9);privateHome.pantry=100;
 s.demography.rngState=1;
 const {newborns}=advanceGenerations(s);
 assert.ok(pair.every(c=>c.home===buildingKey(privateHome)));
 assert.equal(newborns.length,1);
 assert.deepEqual(newborns[0].parents,[pair[1].id,pair[0].id]);
 assert.equal(newborns[0].home,buildingKey(privateHome));
});

test('demolition relocates the same residents and returns real pantry stock',()=>{
 const {s,lodge}=withLodge();
 const residents=s.citizens.slice(0,2);for(const c of residents)c.home=buildingKey(lodge);
 lodge.pantry=lodge.pantryDelivered=6;
 const food=totalFood(s),ids=s.citizens.map(c=>c.id);
 assert.equal(demolish(s,lodge.x,lodge.y).ok,true);
 assert.deepEqual(s.citizens.map(c=>c.id),ids);
 assert.ok(residents.every(c=>c.home!==buildingKey(lodge)));
 assert.ok(Math.abs(totalFood(s)-food)<1e-7);
 checkSave(s);
});
