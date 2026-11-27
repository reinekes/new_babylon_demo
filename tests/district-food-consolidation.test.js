import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,decode,encode} from '../engine.js';
import {useOneDayCalendar} from '../calendar.js';
import {initializeBuildingInventory,putProductionOutput} from '../building-inventory.js';
import {districtPickup,indexDistrictJobs,requestTransfer,syncDistrictJobs,validateDistricts} from '../district-logistics.js';
import {syncInventory} from '../inventory.js';
import {strictScenario} from '../scenario-profiles.js';

function settlement(type='fishing'){
 const s=useOneDayCalendar(createGame({start:'established'}));
 const source={type,x:11,y:9,level:1};
 s.buildings.push(source,{type:'granary',x:10,y:9,level:1});
 initializeBuildingInventory(s);syncInventory(s);
 return {s,source};
}
const from='11,9',to='10,9';
const routes=s=>s.district.jobs.filter(q=>q.source===from&&q.target===to);
function scan(s){s.district.lastScan=-1;syncDistrictJobs(s);}

test('successive catches fill one automatic order and one carrier can take their total',()=>{
 const {s,source}=settlement();
 const stock=s.resources.food;
 assert.ok(putProductionOutput(s,source,{food:5}));
 scan(s);
 const [order]=routes(s);
 assert.ok(order);
 assert.ok(putProductionOutput(s,source,{food:3}));
 scan(s);
 assert.deepEqual(routes(s).map(q=>[q.id,q.amount,q.remaining]),[[order.id,8,8]]);
 assert.equal(source.workshopStock.output.food,8);
 assert.equal(s.resources.food,stock);

 const carrier=s.citizens.find(c=>c.age>=16);
 Object.assign(carrier,{districtJob:order.id,work:null,site:null,phase:'home'});
 assert.equal(districtPickup(s,carrier),8);
 carrier.phase='toDistrictStore';
 assert.equal(carrier.cargo.food,8);
 assert.equal(source.workshopStock.output.food,0);
 assert.equal(s.resources.food,stock);
 assert.equal(indexDistrictJobs(s).carried.get(order.id),8);
 const raw=encode(s);
 const restored=decode(raw);
 assert.ok(restored);
 assert.equal(encode(restored),raw);
});

test('the scan joins only untouched duplicate meal reservations and keeps owned and manual IDs',()=>{
 const {s,source}=settlement();
 assert.ok(putProductionOutput(s,source,{food:18}));
 const add=(amount,automatic)=>requestTransfer(s,from,to,'food',amount,{automatic});
 const first=add(5,true),remainder=add(3,true),owned=add(4,true),manual=add(5,false),civic=add(1,true);
 assert.ok([first,remainder,owned,manual,civic].every(q=>q.ok));
 s.civicOrder={case:{aid:civic.id},history:[]};
 const carrier=s.citizens.find(c=>c.age>=16);
 Object.assign(carrier,{districtJob:owned.id,work:null,site:null,phase:'home',store:from});
 scan(s);
 assert.deepEqual(routes(s).map(q=>[q.id,q.amount,q.remaining]),[[first.id,8,8],[owned.id,4,4],[manual.id,5,5],[civic.id,1,1]]);
 assert.equal(carrier.districtJob,owned.id);
 assert.equal(source.workshopStock.output.food,18);
 assert.equal(indexDistrictJobs(s).queued.get(from+':food'),18);
 assert.ok(validateDistricts(s));
});

test('milk batches share their own route and marked harvest stays in its original requests',()=>{
 const {s,source}=settlement('cowshed');
 assert.ok(putProductionOutput(s,source,{milk:3}));
 scan(s);
 assert.ok(putProductionOutput(s,source,{milk:3}));
 scan(s);
 assert.deepEqual(routes(s).filter(q=>q.resource==='milk').map(q=>q.amount),[6]);

 const marked=settlement('field');
 marked.source.grainFieldId=1;
 assert.ok(putProductionOutput(marked.s,marked.source,{food:7}));
 scan(marked.s);
 assert.ok(putProductionOutput(marked.s,marked.source,{food:7}));
 scan(marked.s);
 assert.deepEqual(routes(marked.s).map(q=>q.amount),[7,7]);
});

test('unloaded food at a producer can be dispatched to a hungry home with empty warehouses',()=>{
 const {s,source}=settlement();
 for(const b of s.buildings){if(b.stock)b.stock.food=0;if(b.pantry)b.pantry=0;}
 s.resources.food=0;
 syncInventory(s);
 const home=s.buildings.find(b=>s.citizens.some(c=>c.home===`${b.x},${b.y}`));
 assert.ok(home);
 assert.ok(putProductionOutput(s,source,{food:18}));
 const warehouse=requestTransfer(s,from,to,'food',18,{automatic:true});
 assert.ok(warehouse.ok);
 scan(s);
 const direct=s.district.jobs.find(q=>q.source===from&&q.target===`${home.x},${home.y}`&&q.targetKind==='input');
 assert.ok(direct?.remaining>0);
 assert.equal(source.workshopStock.output.food,18);
 assert.ok(validateDistricts(s));
});

test('a porter collecting a small household order fills the load while honoring another reservation',()=>{
 const {s,source}=settlement();
 assert.ok(putProductionOutput(s,source,{food:18}));
 assert.ok(requestTransfer(s,from,to,'food',5).ok);
 const order=requestTransfer(s,from,'8,8','food',1,{automatic:true,targetKind:'input'});
 assert.ok(order.ok);
 const carrier=s.citizens.find(c=>c.age>=16);
 Object.assign(carrier,{districtJob:order.id,work:null,site:null,phase:'home'});
 assert.equal(districtPickup(s,carrier),13);
 carrier.phase='toDistrictStore';
 assert.equal(source.workshopStock.output.food,5);
 assert.ok(decode(encode(s)));
});

test('a household pantry holds fifteen full family dinners in the one-day calendar',async()=>{
 const {homeStockCapacity}=await import('../building-inventory.js');
 const {mealRation}=await import('../wellbeing.js');
 const {pantryRestockTarget}=await import('../households.js');
 const {s}=settlement(),home=s.buildings.find(b=>b.x===8&&b.y===8);
 const dinner=s.citizens.filter(c=>c.home==='8,8').reduce((n,c)=>n+mealRation(c),0);
 assert.ok(Math.abs(homeStockCapacity(s,home,'food')-15*dinner)<1e-7);
 s.resources.food=0;
 assert.ok(Math.abs(homeStockCapacity(s,home,'food')-15*dinner)<1e-7);
 assert.equal(pantryRestockTarget(s,dinner),dinner);
});

test('food freight uses larger physical loads on foot, with a basket and with a cart',()=>{
 for(const [equipment,expected] of [[{},18.75],[{basketCondition:1},25],[{freightCart:'10,9'},37.5]]){
  const s=useOneDayCalendar(createGame({start:'established',scenario:strictScenario()}));
  s.buildings.push({type:'depot',x:10,y:9,level:1});
  syncInventory(s);
  const order=requestTransfer(s,'9,8','10,9','food',40);
  assert.ok(order.ok);
  const carrier=s.citizens[0];
  Object.assign(carrier,{role:'carrier',districtJob:order.id,work:null,site:null},equipment);
  const before=s.resources.food;
  assert.equal(districtPickup(s,carrier),expected);
  carrier.phase='toDistrictStore';
  assert.equal(s.resources.food+carrier.cargo.food,before);
  const restored=decode(encode(s));
  assert.ok(restored);
  assert.equal(restored.citizens[0].cargo.food,expected);
  assert.equal(restored.district.jobs.find(q=>q.id===order.id).remaining,40-expected);
 }
});
