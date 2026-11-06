import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,encode,decode} from '../engine.js';
import {strictScenario} from '../scenario-profiles.js';
import {buildingKey} from '../definitions.js';

function fixture(){
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const helper=s.citizens[0],target=s.citizens.find(c=>c.id===helper.partner);
 assert.equal(helper.home,target.home);
 const house=s.buildings.find(b=>buildingKey(b)===helper.home);
 Object.assign(s,{simTime:28,seasonElapsed:28,event:null});
 Object.assign(house,{pantry:40,pantryDelivered:40,water:20,waterDelivered:20});
 Object.assign(target,{age:57,mood:40,thirst:15});
 return {s,house,helper,target};
}

test('a relative works at home, uses water once, and resumes a care visit after saving',()=>{
 const {s,house,helper,target}=fixture();
 const before=house.water;
 advanceTime(s,.4,{calendarRate:1});
 assert.equal(house.familyCare.helper,helper.id);
 assert.equal(house.familyCare.target,target.id);
 assert.equal(house.familyCare.done,false);
 const raw=encode(s),restored=decode(raw);
 assert.ok(restored);
 assert.equal(encode(restored),raw);
 advanceTime(restored,1.5,{calendarRate:1});
 const h=restored.buildings.find(b=>buildingKey(b)===helper.home),patient=restored.citizens.find(c=>c.id===target.id);
 assert.equal(h.familyCare.done,true);
 assert.equal(patient.mood,48);
 assert.ok(h.water<before-.25);
 assert.equal(h.pantry,40);
 advanceTime(restored,.05,{calendarRate:1});
 assert.equal(patient.mood,48);
});

test('family care leaves cargo and the family dinner reserve alone',()=>{
 const {s,house,helper,target}=fixture();
 helper.cargo={clay:2};helper.phase='resting';
 house.pantry=0;
 advanceTime(s,.2,{calendarRate:1});
 assert.equal(house.familyCare,undefined);
 assert.deepEqual(helper.cargo,{clay:2});
 assert.equal(target.mood,40);
});

test('a parent can care for an infant before the regular family dinner',()=>{
 const {s,house,helper,target}=fixture();
 target.age=25;
 const child=s.citizens.find(c=>c.age<16);
 Object.assign(child,{age:1,parents:[helper.id,target.id],home:helper.home,phase:'home',mood:40});
 advanceTime(s,1.8,{calendarRate:1});
 assert.equal(house.familyCare.target,child.id);
 assert.equal(house.familyCare.done,true);
 assert.equal(child.mood,48);
 assert.equal(house.pantry,40);
 advanceTime(s,4,{calendarRate:1});
 assert.ok(house.pantry<40);
 assert.ok(child.mealEaten>0);
});

test('a relative already in a clinic is ineligible for home care',async()=>{
 const {advanceFamilyCare}=await import('../family-care.js');
 const {s,house,target}=fixture();
 Object.assign(target,{age:45,health:45,phase:'treatment',clinic:'10,9'});
 assert.equal(advanceFamilyCare(s,1.5).size,0);
 assert.equal(house.familyCare,undefined);
 assert.equal(target.clinic,'10,9');
 assert.equal(target.health,45);
});

test('a sick relative at home gets comfort while their health follows ordinary rules',()=>{
 const {s,house,target}=fixture();
 Object.assign(target,{age:45,health:55});
 advanceTime(s,1.8,{calendarRate:1});
 assert.equal(house.familyCare.done,true);
 assert.equal(target.mood,48);
 assert.equal(target.health,55);
});
