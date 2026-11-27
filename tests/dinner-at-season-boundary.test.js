import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTime,createGame,encode,decode} from '../engine.js';
import {useOneDayCalendar} from '../calendar.js';
import {canWaitForDinner,createEmergencyMealContext,mealCycle,mealRation} from '../wellbeing.js';
import {networkFor} from '../workforce.js';
import {buildingKey} from '../definitions.js';

test('a critically hungry resident at their doorstep can use a late delivery before seasonal mortality',()=>{
 const s=useOneDayCalendar(createGame({start:'established'}));
 const c=s.citizens[0],house=s.buildings.find(b=>buildingKey(b)===c.home);
 const door=networkFor(s).ports.find(p=>p.building===house);
 s.simTime=179.99;s.seasonElapsed=s.simTime/4;
 s.calendarOffset=s.simTime-s.seasonElapsed;
 house.pantry=house.pantryDelivered=mealRation(c);
 Object.assign(c,{x:door.x,y:door.y,phase:'toHome',route:[{x:door.x,y:door.y},{x:door.x+.3,y:door.y}],routeIndex:1,
  hunger:100,health:0,missedMeals:3,lastMealQuality:0,mealEaten:0,mealDay:mealCycle(s.simTime),mealEvaluated:mealCycle(s.simTime)});
 advanceTime(s,.01);
 assert.equal(s.tick,1);
 assert.ok(s.citizens.some(person=>person.id===c.id));
 assert.ok(c.health>0);
 assert.ok(house.pantry<1e-7);
 assert.ok(decode(encode(s)));
});

function pendingDinner(){
 const s=useOneDayCalendar(createGame({start:'established'})),c=s.citizens[0];
 const house=s.buildings.find(b=>buildingKey(b)===c.home),net=networkFor(s);
 const port=net.ports.find(p=>p.building===house),courier=s.citizens.find(p=>p.id!==c.id&&p.home===c.home&&p.age>=16);
 house.pantry=0;
 Object.assign(c,{x:port.x,y:port.y,phase:'home',health:0,hunger:100,missedMeals:3,mealEaten:0});
 const before={x:port.x,y:port.y+.8},end={x:port.x,y:port.y};
 Object.assign(courier,{...before,phase:'toPantryHome',pantryTrip:true,pantryFood:10,work:null,site:null,route:[before,end],routeIndex:1});
 return {s,c,courier};
}
test('a real dinner in transit allows a single wait and survives a reload without feeding anyone early',()=>{
 const {s,c,courier}=pendingDinner();
 assert.equal(canWaitForDinner(s,c,createEmergencyMealContext(s)),true);
 assert.equal(c.mealEaten,0);
 assert.equal(c.health,0);
 assert.equal(courier.pantryFood,10);
 const copy=decode(encode(s));assert.ok(copy);
 assert.equal(canWaitForDinner(copy,copy.citizens[0],createEmergencyMealContext(copy)),false);
 copy.citizens[0].waitedForDinner='yes';assert.equal(decode(encode(copy)),null);
});
test('an unreachable or underloaded shipment cannot cover an emergency share for every resident',()=>{
 const {s,c,courier}=pendingDinner();
 courier.phase='blocked';const x=courier.x;courier.x=-50;
 assert.equal(canWaitForDinner(s,c,createEmergencyMealContext(s)),false);
 courier.x=x;courier.phase='toPantryHome';courier.pantryFood=.8;
 assert.equal(canWaitForDinner(s,c,createEmergencyMealContext(s)),false);
 courier.pantryFood=0;
 assert.equal(canWaitForDinner(s,c,createEmergencyMealContext(s)),false);
 // Even when a full dinner is unavailable, a real share for each person matters.
 courier.pantryFood=s.citizens.filter(p=>p.home===c.home).reduce((n,p)=>n+.25*mealRation(p),0);
 assert.equal(canWaitForDinner(s,c,createEmergencyMealContext(s)),true);
});

test('a loaded carrier stranded by the previous flood counts when the road actually reopens',()=>{
 const {s,c,courier}=pendingDinner();
 Object.assign(courier,{phase:'blocked',route:[],routeIndex:0,floodShelter:c.home});
 assert.equal(canWaitForDinner(s,c,createEmergencyMealContext(s)),true);
 assert.equal(courier.pantryFood,10);
});

test('a worker may leave their own court through its real door to reach a funded dinner',()=>{
 const {s,c}=pendingDinner();
 const court={type:'garden',level:1,footprint:2,x:8,y:13};
 s.buildings.push(court);
 Object.assign(c,{phase:'working',x:court.x+.7,y:court.y+.7,work:buildingKey(court)});
 assert.equal(canWaitForDinner(s,c,createEmergencyMealContext(s)),true);
});

test('a household shipment contains only the food actually loaded for its recipient',()=>{
 const {s,c,courier}=pendingDinner();
 const other=s.citizens.find(p=>p.home!==c.home).home;
 courier.pantryTarget=other;
 courier.districtJob=1;
 courier.phase='toDistrictStore';
 s.district.jobs.push({id:1,target:c.home,targetKind:'input',resource:'food'});
 courier.cargo={food:.1};
 assert.equal(canWaitForDinner(s,c,createEmergencyMealContext(s)),false);
});
