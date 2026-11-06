import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,encode,decode} from '../engine.js';
import {strictScenario} from '../scenario-profiles.js';
import {putStock} from '../inventory.js';
import {buildingKey} from '../definitions.js';

test('the depot serves a real portion once and the home pantry stays intact',async()=>{
 const {serveCommonMeal}=await import('../common-meal.js');
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const c=s.citizens[0],home=s.buildings.find(b=>buildingKey(b)===c.home),depot={type:'depot',x:10,y:9,level:1,commonMeals:true};
 s.buildings.push(depot);
 putStock(s,'10,9','food',13);
 Object.assign(s,{simTime:12,seasonElapsed:12});
 c.hunger=50;
 const pantry=home.pantry;
 assert.equal(serveCommonMeal(s,c,depot),true);
 assert.equal(serveCommonMeal(s,c,depot),false);
 assert.ok(Math.abs(depot.stock.food-12.6)<1e-9);
 assert.equal(home.pantry,pantry);
 assert.ok(c.hunger<50);
 const raw=encode(s),restored=decode(raw);
 assert.ok(restored);
 assert.equal(encode(restored),raw);
 advanceTime(restored,19,{calendarRate:1});
 assert.ok(restored.citizens.find(p=>p.id===c.id).mealEaten>=.4);
});

test('workers walk to delivered food and reload on the way to the depot',async()=>{
 const {setCommonMeals}=await import('../common-meal.js');
 const {requestTransfer}=await import('../district-logistics.js');
 const {assignWorkplace}=await import('../management.js');
 const {networkFor}=await import('../workforce.js');
 let s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const worker=s.citizens[0],id=worker.id,field=s.buildings.find(b=>b.type==='field');
 const work=buildingKey(field),depot={type:'depot',x:11,y:8,level:1,stockMinimum:{food:0}},key=buildingKey(depot);
 s.buildings.push(depot);
 for(const h of s.buildings.filter(b=>b.type==='house'))Object.assign(h,{pantry:40,pantryDelivered:40,water:20,waterDelivered:20});
 putStock(s,key,'food',12);
 assert.ok(requestTransfer(s,'9,8',key,'food',1).ok);
 const order=s.district.jobs.at(-1);
 for(let i=0;i<450&&order.delivered<1;i++)advanceTime(s,.1);
 assert.equal(order.delivered,1);
 assert.ok(setCommonMeals(s,key,true).ok);
 assert.ok(assignWorkplace(s,id,work).ok);
 const port=networkFor(s).ports.find(p=>p.building===field);
 const wait=Math.max(0,7.55-s.simTime);
 s.simTime+=wait;s.seasonElapsed+=wait;
 assert.ok(s.simTime<20);
 Object.assign(worker,{x:port.x,y:port.y,phase:'working',route:[],routeIndex:0});
 let loaded=false;
 for(let i=0;i<100&&s.citizens.find(c=>c.id===id).commonMealDay===undefined;i++){
  advanceTime(s,.1,{calendarRate:1});
  if(!loaded&&s.citizens.find(c=>c.id===id).phase==='toCommonMeal'){
   const raw=encode(s);s=decode(raw);assert.ok(s);assert.equal(encode(s),raw);loaded=true;
  }
 }
 assert.ok(loaded,JSON.stringify({time:s.simTime,phase:worker.phase,work:worker.work,home:worker.home,stock:depot.stock.food,day:worker.commonMealDay}));
 const diner=s.citizens.find(c=>c.id===id);
 assert.equal(diner.commonMealDay,0);
 assert.equal(diner.phase,'commonMeal');
 const raw=encode(s),restored=decode(raw);
 assert.ok(restored);
 assert.equal(encode(restored),raw);
 advanceTime(restored,1.2,{calendarRate:1});
 assert.equal(restored.citizens.find(c=>c.id===id).commonMealTarget,undefined);
});
