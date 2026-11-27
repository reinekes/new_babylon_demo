import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTime,createGame,decode,encode} from '../engine.js';
import {useOneDayCalendar} from '../calendar.js';
import {buildingKey,housingOf} from '../definitions.js';
import {homeStockCapacity,initializeBuildingInventory} from '../building-inventory.js';
import {putStock,takeStock} from '../inventory.js';
import {navigationDistance} from '../navigation.js';
import {networkFor,routeBetween,syncCitizens} from '../workforce.js';
import {mealRation} from '../wellbeing.js';
import {householdSupplyRoute} from '../supply.js';

const receiver='8,8',anotherReceiver='7,9';
const building=(s,key)=>s.buildings.find(b=>buildingKey(b)===key);
const port=(s,b)=>networkFor(s).ports.find(p=>p.building===b);
function near(actual,expected){
 assert.ok(Math.abs(actual-expected)<1e-7,`expected ${expected}, got ${actual}`);
}
function until(s,condition,seconds=24){
 for(let step=0;step<Math.ceil(seconds*10)&&!condition();step++)advanceTime(s,.1);
 return condition();
}
function setup({separateBank=false,twoRequests=false,extra=10,donorPosition}={}){
 const s=useOneDayCalendar(createGame({start:'established'}));
 s.buildings=s.buildings.filter(b=>b.type==='house'||b.type==='shrine');
 const donor=building(s,'9,9');
 if(separateBank)Object.assign(donor,{x:22,y:8});
 if(donorPosition)Object.assign(donor,donorPosition);
 if(twoRequests)s.buildings.push({type:'house',x:7,y:9,level:1});
 for(const c of s.citizens){
  if(c.home==='9,9')c.home=buildingKey(donor);
  else if(twoRequests&&c.id%2)c.home=anotherReceiver;
  const b=building(s,c.home);
  Object.assign(c,{x:b.x+.5,y:b.y+.5,role:'builder',phase:'home',work:null,site:null});
 }
 s.capacity=housingOf(s);
 initializeBuildingInventory(s);
 takeStock(s,'9,8','food',s.resources.food);
 for(const b of s.buildings.filter(b=>b.type==='house'))Object.assign(b,{pantry:0,pantryDelivered:0,water:100,waterDelivered:100});
 const half=homeStockCapacity(s,donor,'food')/2;
 donor.pantry=donor.pantryDelivered=half+extra;
 syncCitizens(s);
 assert.ok(decode(encode(s)),'fixture must load before any trip');
 return {s,donor,half};
}

test('an adult asks a neighbour, picks up one dinner at their door and carries it home after reloading',()=>{
 let {s,donor}=setup();
 const key=buildingKey(donor),initial=donor.pantry,door=port(s,donor);
 const grain=[{field:'12,8',amount:1,end:1}];
 donor.grainPantry=structuredClone(grain);
 const dinner=s.citizens.filter(c=>c.home===receiver).reduce((n,c)=>n+mealRation(c),0);
 const shopping=()=>s.citizens.find(c=>c.home===receiver&&c.store===key&&c.phase==='toPantrySupply');
 assert.ok(until(s,shopping),'someone from the empty home should set off for the stocked neighbour');
 const id=shopping().id;
 const outbound=householdSupplyRoute(s,receiver,'food');
 assert.equal(outbound.status,'Идёт к соседям за едой');
 assert.equal(outbound.source,key);
 near(donor.pantry,initial);
 near(building(s,receiver).pantry,0);
 s=decode(encode(s));assert.ok(s);
 let walker=s.citizens.find(c=>c.id===id);
 assert.ok(until(s,()=>walker.pantryFood>0));
 assert.ok(Math.hypot(walker.x-door.x,walker.y-door.y)<.15,'pickup occurs at the neighbour’s door');
 near(walker.pantryFood,dinner);
 const returning=householdSupplyRoute(s,receiver,'food');
 assert.equal(returning.status,'Несёт еду от соседей домой');
 near(returning.amount,dinner);
 assert.deepEqual(walker.grainPantry,grain);
 assert.equal(building(s,key).grainPantry,undefined);
 near(building(s,key).pantry+dinner,initial);
 near(building(s,receiver).pantry,0);
 s=decode(encode(s));assert.ok(s);
 walker=s.citizens.find(c=>c.id===id);
 near(walker.pantryFood,dinner);
 const home=building(s,receiver);
 assert.ok(until(s,()=>home.pantryDelivered>0));
 assert.ok(Math.hypot(walker.x-port(s,home).x,walker.y-port(s,home).y)<.15);
 near(home.pantry,dinner);
 near(home.pantryDelivered,dinner);
 near(home.pantry+building(s,key).pantry,initial);
 assert.deepEqual(home.grainPantry,grain);
 assert.deepEqual(home.lastRation.grain,grain);
 assert.equal(home.lastRation.source,key);
 assert.equal(home.lastRation.carrier,id);
 assert.equal(walker.store,'9,8','normal freight resumes at the public store after the visit');
 assert.equal(s.resources.food,0);
});

test('an occupied neighbour keeps exactly half of its pantry',()=>{
 const {s,donor,half}=setup({extra:0});
 const key=buildingKey(donor);
 const departs=()=>s.citizens.some(c=>c.home===receiver&&c.store===key&&c.phase==='toPantrySupply');
 assert.equal(until(s,departs,14),false);
 near(building(s,receiver).pantryDelivered,0);
 near(donor.pantry,half);
});

test('two empty families cannot take the same surplus below the donor’s half',()=>{
 const extra=1.25,{s,donor,half}=setup({twoRequests:true,extra});
 const homes=[building(s,receiver),building(s,anotherReceiver)];
 assert.ok(until(s,()=>homes.some(h=>h.pantryDelivered>0)),'the small surplus reaches a family');
 advanceTime(s,6);
 near(homes.reduce((n,b)=>n+b.pantryDelivered,0),extra);
 near(donor.pantry,half);
 assert.ok(decode(encode(s)));
});

test('food stored on a disconnected bank cannot be requested across the river',()=>{
 const {s,donor}=setup({separateBank:true});
 const net=networkFor(s),initial=donor.pantry;
 assert.notEqual(net.components.get(port(s,donor).key),net.components.get(port(s,building(s,receiver)).key));
 const departed=()=>s.citizens.some(c=>c.home===receiver&&c.store===buildingKey(donor)&&c.pantryTrip);
 assert.equal(until(s,departed,14),false);
 near(building(s,receiver).pantryDelivered,0);
 near(donor.pantry,initial);
});

test('a visitor rechecks the surplus at the door if the donor has already eaten',()=>{
 const {s,donor,half}=setup();
 const key=buildingKey(donor),home=building(s,receiver);
 const asking=()=>s.citizens.find(c=>c.home===receiver&&c.phase==='toPantrySupply'&&c.store===key);
 assert.ok(until(s,asking),'an adult sets out while surplus still exists');
 donor.pantry=half;
 advanceTime(s,14);
 near(home.pantryDelivered,0);
 near(donor.pantry,half);
 assert.ok(s.citizens.every(c=>!(c.pantryFood>0)));
});

test('a family with milk at home uses it before asking another household for food',()=>{
 const {s,donor}=setup(),home=building(s,receiver);
 home.householdStock.milk=1;
 const initial=donor.pantry,key=buildingKey(donor);
 assert.equal(until(s,()=>s.citizens.some(c=>c.home===receiver&&c.store===key&&c.pantryTrip),14),false);
 near(home.pantryDelivered,0);
 near(donor.pantry,initial);
});


test('a family that missed dinners looks beyond the usual nearby streets',()=>{
 const {s,donor}=setup({donorPosition:{x:8,y:15}}),home=building(s,receiver);
 for(const c of s.citizens.filter(c=>c.home===receiver))Object.assign(c,{missedMeals:2,hunger:100,lastMealQuality:0});
 const distance=navigationDistance(routeBetween(s,port(s,home).key,port(s,donor).key));
 assert.ok(distance>6&&distance<=8,`expected a nearby donor just beyond six cells, distance ${distance}`);
 assert.ok(until(s,()=>s.citizens.some(c=>c.home===receiver&&c.neighborPantry===buildingKey(donor))));
});

test('a hungry family may use the neighbour next door when a stocked warehouse is farther down the street',()=>{
 const {s,donor}=setup(),warehouse={type:'granary',x:12,y:12,level:1};
 s.buildings.push(warehouse);
 initializeBuildingInventory(s);
 putStock(s,buildingKey(warehouse),'food',10);
 for(const c of s.citizens.filter(c=>c.home===receiver))Object.assign(c,{missedMeals:2,hunger:100,lastMealQuality:0});
 const home=building(s,receiver),from=port(s,home).key;
 const distanceTo=b=>navigationDistance(routeBetween(s,from,port(s,b).key));
 assert.ok(distanceTo(donor)<distanceTo(warehouse)&&distanceTo(warehouse)<=8);
 assert.ok(until(s,()=>s.citizens.some(c=>c.home===receiver&&c.neighborPantry===buildingKey(donor))));
});

test('a well-fed household waits for its usual local stock rather than taking a long neighbour trip',()=>{
 const {s,donor}=setup({donorPosition:{x:8,y:15}});
 const asking=()=>s.citizens.some(c=>c.neighborPantry===buildingKey(donor));
 assert.equal(until(s,asking,14),false);
});
