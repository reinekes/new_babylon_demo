import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.js';
import {useOneDayCalendar} from '../calendar.js';
import {districtPickup,requestTransfer,syncDistrictJobs,validateDistricts} from '../district-logistics.js';
import {initializeBuildingInventory,putProductionOutput} from '../building-inventory.js';
import {syncCitizens} from '../workforce.js';
import {mealRation} from '../wellbeing.js';

function orders(s,key){
 return s.district.jobs.filter(q=>q.resource==='food'&&q.targetKind==='input'&&q.target===key&&q.remaining>0);
}
const assigned=(s,key)=>orders(s,key).reduce((total,q)=>total+q.remaining,0);
function scan(s){s.district.lastScan=-1;syncDistrictJobs(s);}

test('limited exportable stock supplies each dinner before either house can reserve extra meals',()=>{
 const s=useOneDayCalendar(createGame({start:'established'}));
 const shrine=s.buildings.find(b=>b.type==='shrine');
 const demand=key=>s.citizens.filter(c=>c.home===key).reduce((sum,c)=>sum+mealRation(c),0);
 const first=demand('8,8'),second=demand('9,9');
 shrine.stockMinimum={food:shrine.stock.food-first-second};
 scan(s);
 assert.ok(Math.abs(assigned(s,'8,8')-first)<1e-7);
 assert.ok(Math.abs(assigned(s,'9,9')-second)<1e-7);
 const ids=orders(s,'9,9').map(q=>q.id);
 scan(s);
 assert.deepEqual(orders(s,'9,9').map(q=>q.id),ids);
 assert.equal(shrine.stock.food,100);
 assert.ok(validateDistricts(s));
});

test('a single resident can receive a first dinner below one whole food unit',()=>{
 const s=useOneDayCalendar(createGame({start:'established'}));
 const c=s.citizens.find(c=>c.age>=16&&c.home==='9,9');
 s.citizens=s.citizens.filter(p=>p.home!=='9,9'||p===c);s.population=s.citizens.length;
 const shrine=s.buildings.find(b=>b.type==='shrine');
 s.buildings.find(b=>b.x===8&&b.y===8).pantry=30;
 s.resources.food=shrine.stock.food=mealRation(c);
 s.foodPlan.protectSeeds=false;
 scan(s);
 assert.ok(Math.abs(assigned(s,c.home)-mealRation(c))<1e-7);
 assert.ok(validateDistricts(s));
});

test('a partially empty source releases the unfunded part of its dinner order for another warehouse',async()=>{
 const {putStock,takeStock}=await import('../inventory.js');
 const s=useOneDayCalendar(createGame({start:'established'}));
 s.buildings.push({type:'granary',x:10,y:9,level:1});
 initializeBuildingInventory(s);
 const home=s.buildings.find(b=>b.x===8&&b.y===8),dinner=6.4;
 s.buildings.find(b=>b.x===9&&b.y===9).pantry=40;
 s.foodPlan.protectSeeds=false;
 assert.ok(requestTransfer(s,'9,8','8,8','food',dinner,{automatic:true,targetKind:'input'}).ok);
 assert.ok(takeStock(s,'9,8','food',s.resources.food-0.25)>0);
 assert.equal(putStock(s,'10,9','food',dinner),dinner);
 home.pantry=0;
 scan(s);
 const existing=orders(s,'8,8').find(q=>q.source==='9,8');
 assert.ok(existing&&Math.abs(existing.remaining-0.25)<1e-7);
 assert.ok(orders(s,'8,8').some(q=>q.source==='10,9'&&q.remaining>=dinner-.25-1e-7));
 assert.ok(Math.abs(existing.amount-existing.remaining-existing.cancelled)<1e-7);
 assert.ok(validateDistricts(s));
});

test('a first dinner can reserve the free portions of two small warehouse stocks in one scan',async()=>{
 const {takeStock,putStock}=await import('../inventory.js');
 const s=useOneDayCalendar(createGame({start:'established'}));
 s.buildings.push({type:'granary',x:10,y:9,level:1});
 initializeBuildingInventory(s);
 s.buildings.find(b=>b.x===9&&b.y===9).pantry=10;
 s.foodPlan.protectSeeds=false;
 takeStock(s,'9,8','food',s.resources.food-2);
 putStock(s,'10,9','food',4.4);
 scan(s);
 assert.equal(orders(s,'8,8').length,2);
 assert.ok(Math.abs(assigned(s,'8,8')-6.4)<1e-7);
 assert.ok(validateDistricts(s));
});

test('an established town serves full portions through six complete dinners and a birth',async()=>{
 const {advanceTime,encode,decode}=await import('../engine.js');
 let s=useOneDayCalendar(createGame({start:'established'}));
 const initial=s.population;
 for(let day=0;day<6;day++){
  const limit=s.simTime+61;
  while(s.citizens.some(c=>c.mealEvaluated<day)&&s.simTime<limit){
   assert.ok(advanceTime(s,.25)>0);
  }
  assert.ok(s.citizens.every(c=>c.mealEvaluated===day&&c.lastMealQuality>=1-1e-7));
  s=decode(encode(s));
  assert.ok(s);
 }
 assert.ok(s.population>initial);
 assert.ok(s.lifeAnalytics.people.every(c=>c.cause!=='starvation'));
});

function foodOrderWithTwoPorters(){
 const s=useOneDayCalendar(createGame({start:'established'}));
 const field={type:'field',x:10,y:11,level:1};
 s.buildings.push(field);
 initializeBuildingInventory(s);
 for(const b of s.buildings.filter(b=>b.type==='house'))b.pantry=18;
 const adults=s.citizens.filter(c=>c.age>=16);
 const [original,relief]=adults;
 for(const c of adults)Object.assign(c,{role:c===original||c===relief?'carrier':'builder',work:null,phase:'home'});
 assert.ok(putProductionOutput(s,field,{food:3}));
 const order=requestTransfer(s,'10,11','8,8','food',3,{automatic:true,targetKind:'input'});
 assert.ok(order.ok);
 original.districtJob=order.id;
 original.store='10,11';
 return {s,original,relief,field,id:order.id};
}

test('a blocked empty dinner porter gets a replacement on the same order and only one load leaves the field',()=>{
 const {s,original,relief,field,id}=foodOrderWithTwoPorters();
 original.phase='blocked';
 syncCitizens(s);
 assert.equal(relief.districtJob,id);
 assert.equal(original.districtJob,id);
 assert.equal(districtPickup(s,relief),3);
 assert.equal(districtPickup(s,original),0);
 assert.equal(field.workshopStock.output.food,0);
 assert.equal(relief.cargo.food,3);
});

test('a blocked porter who has already picked up dinner retains the only load and its order',()=>{
 const {s,original,relief,field,id}=foodOrderWithTwoPorters();
 assert.equal(districtPickup(s,original),3);
 original.phase='blocked';
 syncCitizens(s);
 assert.equal(original.districtJob,id);
 assert.equal(original.cargo.food,3);
 assert.notEqual(relief.districtJob,id);
 assert.equal(field.workshopStock.output.food,0);
});
