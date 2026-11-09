import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewCity} from '../new-game.js';
import {decode,encode,resolveEvent} from '../engine.js';
import {buildingKey} from '../definitions.js';
import {createCityEvent} from '../city-events.js';

test('a threat at the water crisis needs a real crew and commits once',()=>{
 const town=createNewCity({mode:'awakening',seed:137});
 town.event=createCityEvent(town,'wellRepair');
 town.resources.reed=100;
 const before=encode(town);
 assert.match(resolveEvent(town,'threat').reason,/бригады/);
 assert.equal(encode(town),before);
 const station={type:'waterpoint',x:12,y:7,level:1};
 town.buildings.push(station);
 const carrier=town.citizens.find(c=>c.age>=16);
 Object.assign(carrier,{work:buildingKey(station),role:'watercarrier',calling:'watercarrier',faith:40,mood:65,health:80});
 const faith=town.resources.faith,reed=town.resources.reed;
 const result=resolveEvent(town,'threat');
 assert.ok(result.ok,result.reason);
 assert.equal(town.resources.faith,faith);
 assert.equal(town.resources.reed,reed-6);
 assert.equal(carrier.faith,32);
 assert.equal(carrier.mood,53);
 assert.equal(carrier.health,83);
 assert.deepEqual(town.fearCrisis.last.people,[carrier.id]);
 const saved=encode(town),loaded=decode(saved);
 assert.equal(encode(loaded),saved);
 assert.equal(resolveEvent(loaded,'threat').ok,false);
 assert.equal(encode(loaded),saved);
});

test('voluntary support is available and earlier cities cannot use threats',()=>{
 const town=createNewCity({mode:'awakening',seed:137});
 town.event=createCityEvent(town,'wellRepair');
 town.resources.food=100;
 town.resources.reed=100;
 town.citizens[0].health=80;
 const old=structuredClone(town);
 delete old.fearCrisis;
 assert.equal(resolveEvent(old,'threat').ok,false);
 assert.ok(resolveEvent(town,'accept').ok);
 assert.equal(town.citizens[0].health,83);
 assert.equal(town.fearCrisis.last,undefined);
});

test('threats accumulate tension and voluntary support for a real crew reduces it',()=>{
 let town=createNewCity({mode:'awakening',seed:137});
 const station={type:'waterpoint',x:12,y:7,level:1};
 town.buildings.push(station);
 const carrierId=town.citizens.find(c=>c.age>=16).id;
 const prepare=()=>{
  town.event=createCityEvent(town,'wellRepair');
  town.resources.food=100;town.resources.reed=100;
  Object.assign(town.citizens.find(c=>c.id===carrierId),{work:'12,7',role:'watercarrier',calling:'watercarrier',health:80});
 };
 prepare();
 assert.ok(resolveEvent(town,'threat').ok);
 assert.equal(town.fearCrisis.tension,1);
 prepare();
 assert.ok(resolveEvent(town,'threat').ok);
 assert.equal(town.fearCrisis.tension,2);
 const raw=encode(town);
 town=decode(raw);
 assert.equal(encode(town),raw);
 prepare();
 assert.ok(resolveEvent(town,'accept').ok);
 assert.equal(town.fearCrisis.tension,1);
 assert.deepEqual(town.fearCrisis.last.people,[carrierId]);
 prepare();
 assert.ok(resolveEvent(town,'accept').ok);
 assert.equal(town.fearCrisis.tension,0);
 const saved=encode(town);
 assert.equal(encode(decode(saved)),saved);
});

test('harvest pressure needs field workers and crews refuse at the city tension limit',()=>{
 let town=createNewCity({mode:'awakening',seed:137});
 const field={type:'field',x:12,y:8,level:1};
 town.buildings.push(field);
 const workerId=town.citizens.find(c=>c.age>=16).id;
 const prepare=()=>{
  town.event=createCityEvent(town,'harvestThanks');
  town.resources.food=100;town.resources.beer=20;
  Object.assign(town.citizens.find(c=>c.id===workerId),{work:buildingKey(field),role:'production',calling:'farmer',health:80});
 };
 for(let i=0;i<3;i++){
  prepare();
  const prestige=town.resources.prestige,faith=town.resources.faith;
  assert.ok(resolveEvent(town,'threat').ok);
  assert.equal(town.resources.prestige,prestige+6);
  assert.equal(town.resources.faith,faith);
  assert.equal(town.resources.beer,18);
 }
 assert.equal(town.fearCrisis.last.kind,'harvestThanks');
 prepare();
 const saved=encode(town);
 town=decode(saved);
 assert.equal(encode(town),saved);
 assert.match(resolveEvent(town,'threat').reason,/отказывается/);
 assert.equal(encode(town),saved);
 assert.ok(resolveEvent(town,'accept').ok);
 assert.equal(town.fearCrisis.tension,2);
 prepare();
 assert.ok(resolveEvent(town,'threat').ok);
});
