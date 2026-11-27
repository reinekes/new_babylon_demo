import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.js';
import {useOneDayCalendar} from '../calendar.js';
import {tryEmergencyMeal,createEmergencyMealContext,mealRation} from '../wellbeing.js';
import {networkFor} from '../workforce.js';
import {buildingKey} from '../definitions.js';
import {initializeBuildingInventory,putProductionOutput} from '../building-inventory.js';
import {requestTransfer,districtPickup,validateDistricts} from '../district-logistics.js';
import {putStock} from '../inventory.js';

function fixture(type='granary'){
 const s=useOneDayCalendar(createGame({start:'established'}));
 const b={type,x:8,y:13,level:1};
 s.buildings.push(b);
 initializeBuildingInventory(s);
 const key=buildingKey(b),port=networkFor(s).ports.find(p=>p.building===b);
 if(type==='granary')putStock(s,key,'food',4);
 else putProductionOutput(s,b,{food:4});
 const c=s.citizens[0],home=s.buildings.find(b=>buildingKey(b)===c.home);
 home.pantry=0;
 s.simTime=31;
 Object.assign(c,{x:port.x,y:port.y,hunger:100,health:0,missedMeals:3,mealDay:0,mealEvaluated:-1,mealEaten:0,phase:'toHome'});
 return {s,b,c,home};
}

test('hungry resident at warehouse entrance takes one real emergency ration',()=>{
 const {s,b,c}=fixture();
 tryEmergencyMeal(s,c,createEmergencyMealContext(s));
 assert.equal(c.mealEaten,mealRation(c));
 assert.ok(Math.abs(b.stock.food-(4-mealRation(c)))<1e-8);
 tryEmergencyMeal(s,c,createEmergencyMealContext(s));
 assert.ok(Math.abs(b.stock.food-(4-mealRation(c)))<1e-8);
 assert.ok(c.health>0);
});

test('a hungry resident can eat finished food at a producer with empty household stores',()=>{
 const {s,b,c}=fixture('garden');
 tryEmergencyMeal(s,c,createEmergencyMealContext(s));
 assert.equal(c.mealEaten,mealRation(c));
 assert.ok(Math.abs(b.workshopStock.output.food-3.2)<1e-8);
});

test('distant warehouses and protected stocks do not feed a hungry resident',()=>{
 const {s,b,c}=fixture();
 c.x+=4;
 tryEmergencyMeal(s,c,createEmergencyMealContext(s));
 assert.equal(c.mealEaten,0);
 c.x-=4;b.stockMinimum={food:4};
 tryEmergencyMeal(s,c,createEmergencyMealContext(s));
 assert.equal(c.mealEaten,0);
 assert.equal(b.stock.food,4);
});

test('a vulnerable resident home after breakfast can eat food delivered since the missed dinner',()=>{
 const {s,c,home}=fixture();
 s.simTime=57;c.phase='home';c.x=home.x;c.y=home.y;c.mealEvaluated=0;c.lastMealQuality=0;
 home.pantry=home.pantryDelivered=1;
 tryEmergencyMeal(s,c,createEmergencyMealContext(s));
 assert.ok(c.health>0);
 assert.equal(c.mealEaten,mealRation(c));
 assert.equal(c.lastMealQuality,0);
 assert.ok(Math.abs(home.pantry-.2)<1e-8);
});

test('an urgent meal may spend the family’s own order while protecting other reserved food',()=>{
 const {s,b,c}=fixture('garden');
 const other=s.citizens.find(p=>p.home!==c.home).home,from=buildingKey(b);
 const first=requestTransfer(s,from,other,'food',3,{automatic:true,targetKind:'input'});
 const own=requestTransfer(s,from,c.home,'food',1,{automatic:true,targetKind:'input'});
 assert.ok(first.ok&&own.ok);
 const job=s.district.jobs.find(q=>q.id===own.id);
 tryEmergencyMeal(s,c,createEmergencyMealContext(s));
 assert.equal(c.mealEaten,mealRation(c));
 assert.ok(Math.abs(job.remaining-.2)<1e-7);
 assert.ok(Math.abs(job.cancelled-.8)<1e-7);
 assert.equal(job.delivered,0);
 assert.ok(validateDistricts(s));
});

test('at a producer, food promised to another household stays in the yard',()=>{
 const {s,b,c}=fixture('garden');
 const other=s.citizens.find(p=>p.home!==c.home).home;
 assert.ok(requestTransfer(s,buildingKey(b),other,'food',4,{automatic:true,targetKind:'input'}).ok);
 tryEmergencyMeal(s,c,createEmergencyMealContext(s));
 assert.equal(c.mealEaten,0);
 assert.equal(b.workshopStock.output.food,4);
});

test('worker inside a productive courtyard can eat there before the next dinner',()=>{
 const {s,b,c}=fixture('garden');
 s.simTime=57;c.mealEvaluated=0;c.lastMealQuality=0;
 c.work=buildingKey(b);c.phase='working';c.x=b.x;c.y=b.y;
 tryEmergencyMeal(s,c,createEmergencyMealContext(s));
 assert.equal(c.mealEaten,mealRation(c));
 assert.ok(Math.abs(b.workshopStock.output.food-3.2)<1e-8);
});

test('a dying family courier can eat part of the family order and deliver its exact remainder',()=>{
 const {s,b,c}=fixture('garden');
 const order=requestTransfer(s,buildingKey(b),c.home,'food',4,{automatic:true,targetKind:'input'});
 assert.ok(order.ok);
 Object.assign(c,{districtJob:order.id,store:buildingKey(b),phase:'toDistrictSupply',work:null,site:null,buildCargo:{}});
 assert.equal(districtPickup(s,c),4);
 Object.assign(c,{phase:'toDistrictStore',store:s.district.jobs.find(q=>q.id===order.id).target,x:b.x+3,y:b.y+3});
 assert.ok(validateDistricts(s));
 assert.equal(tryEmergencyMeal(s,c,createEmergencyMealContext(s)),true);
 assert.equal(c.mealEaten,mealRation(c));
 const job=s.district.jobs.find(q=>q.id===order.id);
 assert.equal(job.delivered,0);
 assert.ok(Math.abs(c.cargo.food-3.2)<1e-7);
 assert.ok(Math.abs(job.cancelled-.8)<1e-7);
 assert.equal(validateDistricts(s),true);
});

test('physical milk at an accessible warehouse replaces a meal at the ordinary two-to-one rate',()=>{
 const {s,b,c}=fixture();
 b.stockMinimum={food:4};
 putStock(s,buildingKey(b),'milk',4);
 assert.equal(tryEmergencyMeal(s,c,createEmergencyMealContext(s)),true);
 assert.equal(c.mealEaten,mealRation(c));
 assert.equal(b.stock.food,4);
 assert.ok(Math.abs(b.stock.milk-2.4)<1e-7);
});

test('evacuee may eat food actually in hand for their permanent home',()=>{
 const {s,b,c}=fixture('garden');
 b.workshopStock.output.food=1.08;
 const order=requestTransfer(s,buildingKey(b),c.home,'food',1.08,{automatic:true,targetKind:'input'});
 assert.ok(order.ok);
 Object.assign(c,{districtJob:order.id,store:buildingKey(b),phase:'toDistrictSupply',work:null,site:null,buildCargo:{}});
 assert.equal(districtPickup(s,c),1.08);
 const shelter=s.citizens.find(p=>p.home!==c.home).home;
 Object.assign(c,{phase:'toDistrictStore',floodShelter:shelter,x:b.x+3,y:b.y+3,hunger:10});
 assert.equal(tryEmergencyMeal(s,c,createEmergencyMealContext(s)),true);
 assert.ok(Math.abs(c.cargo.food-.28)<1e-7);
 assert.equal(c.mealEaten,mealRation(c));
 assert.equal(validateDistricts(s),true);
});

test('an approaching resident can eat from their pantry 0.278 tiles along the street from its doorway',()=>{
 const {s,b,c,home}=fixture();
 b.noExport=true;
 const door=networkFor(s).ports.find(p=>p.building===home);
 c.x=door.x;c.y=door.y+.278;
 home.pantry=home.pantryDelivered=3.976;
 assert.equal(tryEmergencyMeal(s,c,createEmergencyMealContext(s)),true);
 assert.ok(Math.abs(home.pantry-3.176)<1e-7);
 assert.equal(c.mealEaten,mealRation(c));
});

test('a starving carrier keeps another family’s delivery moving after eating one portion in hand',()=>{
 const {s,b,c}=fixture('garden');
 const target=s.citizens.find(p=>p.home!==c.home).home;
 const order=requestTransfer(s,buildingKey(b),target,'food',4,{automatic:true,targetKind:'input'});
 assert.ok(order.ok);
 Object.assign(c,{districtJob:order.id,store:buildingKey(b),phase:'toDistrictSupply',work:null,site:null,buildCargo:{}});
 assert.equal(districtPickup(s,c),4);
 Object.assign(c,{phase:'toDistrictStore',store:s.district.jobs.find(q=>q.id===order.id).target,x:b.x+3,y:b.y+3});
 assert.ok(validateDistricts(s));
 assert.equal(tryEmergencyMeal(s,c,createEmergencyMealContext(s)),true);
 const job=s.district.jobs.find(q=>q.id===order.id);
 assert.equal(job.target,target);
 assert.equal(job.delivered,0);
 assert.ok(Math.abs(c.cargo.food+mealRation(c)-4)<1e-7);
 assert.ok(Math.abs(job.cancelled-mealRation(c))<1e-7);
 assert.ok(validateDistricts(s));
});
