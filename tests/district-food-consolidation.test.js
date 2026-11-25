import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,decode,encode} from '../engine.js';
import {useOneDayCalendar} from '../calendar.js';
import {initializeBuildingInventory,putProductionOutput} from '../building-inventory.js';
import {districtPickup,indexDistrictJobs,requestTransfer,syncDistrictJobs,validateDistricts} from '../district-logistics.js';
import {syncInventory} from '../inventory.js';

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
