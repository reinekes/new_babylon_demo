import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTime,createGame,decode,encode} from '../engine.js';
import {createNewCity} from '../new-game.js';
import {buildingKey} from '../definitions.js';
import {supplyHome,totalFood} from '../households.js';
import {syncInventory} from '../inventory.js';
import {inspirationReason,inspireCitizen} from '../management.js';
import {advanceCivicOrder,civicCityEpithet,finishCivicYear,newCivicOrder,publishCivicLaw,reconcileCivicConflict,sendCivicAid} from '../civic-order.js';

function hungryTown(){
 const state=createGame({start:'established'}),person=state.citizens.find(c=>c.age>=16);
 state.civicOrder=newCivicOrder();syncInventory(state);
 const home=state.buildings.find(b=>b.type==='house'&&buildingKey(b)===supplyHome(person,{arrived:true}));
 home.pantry=0;person.hunger=70;person.mood=40;
 return {state,person,home};
}

test('unanswered food requests can result in one conserved theft and a recorded year',()=>{
 const {state,home}=hungryTown(),before=totalFood(state),stock=state.resources.food;
 advanceCivicOrder(state);
 assert.equal(state.civicOrder.case.home,buildingKey(home));
 state.simTime=60;advanceCivicOrder(state);
 assert.equal(state.civicOrder.history.length,0);
 state.simTime=120;advanceCivicOrder(state);advanceCivicOrder(state);
 assert.equal(state.civicOrder.history[0].outcome,'theft');
 assert.equal(state.civicOrder.history.length,1);
 assert.equal(state.resources.food,stock-2);assert.equal(home.pantry,2);assert.equal(totalFood(state),before);
 state.year=2;
 assert.match(finishCivicYear(state,1),/зерно/);
 finishCivicYear(state,1);assert.equal(state.civicOrder.years.length,1);
 assert.equal(civicCityEpithet(state),'');
});

test('inspired lawmaker publishes once and trusted rules dispatch a physical aid order',()=>{
 const {state,person,home}=hungryTown(),author=state.citizens.find(c=>c!==person&&c.age>=16);
 state.resources.faith=100;author.faith=100;author.mood=100;state.rngState=0;
 assert.equal(inspirationReason(state,author.id,'lawmaker'),'');
 assert.equal(inspireCitizen(state,author.id,'lawmaker').success,true);
 const clay=state.resources.clay;
 assert.ok(publishCivicLaw(state,author.id).ok);
 assert.equal(publishCivicLaw(state,author.id).ok,false);
 assert.equal(state.resources.clay,clay-1);
 advanceCivicOrder(state);
 state.simTime=60;advanceCivicOrder(state);
 const order=state.district.jobs.find(q=>q.id===state.civicOrder.case.aid);
 assert.ok(order);assert.equal(order.target,buildingKey(home));assert.equal(order.remaining,2);assert.equal(home.pantry,0);
 assert.equal(sendCivicAid(state).ok,false);
});

test('new awakening saves include civic order, old saves load without activation',()=>{
 const current=createNewCity({mode:'awakening',seed:137}),old=createGame({start:'established'});
 const raw=encode(current);
 assert.equal(encode(decode(raw)),raw);
 assert.equal(decode(encode(old)).civicOrder,undefined);
 current.civicOrder.case={home:'1,1',person:0,name:'Амал',day:99};
 assert.equal(decode(encode(current)),null);
});

test('repeated guarded conflict causes injury and a later fatal case uses the city funeral and family archive',()=>{
 const state=createNewCity({mode:'awakening',seed:137}),adults=state.citizens.filter(c=>c.age>=16),[person,guard]=adults;
 const home=state.buildings.find(b=>b.type==='house'&&buildingKey(b)===person.home);
 const key=buildingKey(home),source='9,9';
 state.buildings.push({type:'granary',x:9,y:9,level:1});
 person.hunger=70;person.mood=30;home.pantry=0;
 guard.guardPost=source;
 state.fearCrisis={version:1,tension:3,last:{at:0,x:9,y:9,people:[person.id,guard.id]}};
 const dispute=(day)=>({day,disputeDay:day,person:person.id,name:'Амал',home:key,source,guard:guard.id,guardName:'Сторож'});
 state.civicOrder.case=dispute(0);
 state.simTime=60;advanceCivicOrder(state);
 assert.equal(state.civicOrder.history[0].outcome,'assault');
 assert.equal(guard.health,70);
 guard.health=25;
 state.civicOrder.case=dispute(1);state.simTime=120;state.seasonElapsed=10;state.calendarOffset=110;
 advanceTime(state,.05);
 assert.equal(state.civicOrder.history[0].outcome,'killing');
 assert.ok(state.funeral.deceased.some(p=>p.id===guard.id));
 assert.equal(state.lifeAnalytics.people.find(p=>p.id===guard.id).cause,'violence');
 assert.equal(state.citizens.some(p=>p.id===guard.id),false);
 assert.ok(decode(encode(state)));
});

test('a dispute can be reconciled through the trusted tablet',()=>{
 const {state,person}=hungryTown(),guard=state.citizens.find(c=>c!==person&&c.age>=16);
 guard.calling='lawmaker';assert.ok(publishCivicLaw(state,guard.id).ok);
 advanceCivicOrder(state);
 Object.assign(state.civicOrder.case,{source:'9,8',guard:guard.id,guardName:'Сторож',disputeDay:0});
 assert.ok(reconcileCivicConflict(state).ok);
 assert.equal(state.civicOrder.history[0].outcome,'reconciled');
 assert.equal(guard.health,100);
});
