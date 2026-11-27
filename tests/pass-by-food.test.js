import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,encode,decode} from '../engine.js';
import {useOneDayCalendar} from '../calendar.js';
import {initializeBuildingInventory,putProductionOutput} from '../building-inventory.js';
import {requestTransfer,districtPickup,setStoreExports,setStoreMinimum} from '../district-logistics.js';
import {putStock,takeStock} from '../inventory.js';
import {networkFor,syncCitizens} from '../workforce.js';

const key='8,13';
const homeKey='8,8';
const at=(s,key)=>s.buildings.find(b=>b.x+','+b.y===key);

function walk(c,start,end,phase='toHome'){
 Object.assign(c,{...start,phase,route:[start,end],routeIndex:1});
}

function fixture(type){
 const s=useOneDayCalendar(createGame({start:'established'}));
 const source={type,x:8,y:13,level:1};
 s.buildings.push(source);
 for(const c of s.citizens)c.role='builder';
 for(const b of s.buildings.filter(b=>b.type==='house'))b.pantry=b.pantryDelivered=b===at(s,homeKey)?0:30;
 initializeBuildingInventory(s);
 syncCitizens(s);
 if(type==='granary')assert.equal(putStock(s,key,'food',8),8);
 else{
  takeStock(s,'9,8','food',s.resources.food);
  assert.ok(putProductionOutput(s,source,{food:5}));
 }
 const family=s.citizens.filter(c=>c.home===homeKey);
 const resident=family[0];
 // The others return by a different street, beyond walking distance for this trip.
 for(const c of family)walk(c,{x:1.5,y:23.5},{x:8.5,y:8.5});
 const port=networkFor(s).ports.find(p=>p.building===source);
 walk(resident,{x:port.x,y:port.y+2},{x:8.5,y:8.5});
 return {s,resident,source};
}

function waitFor(s,predicate,seconds){
 for(let i=0;i<seconds*4&&!predicate();i++)advanceTime(s,.25);
 return predicate();
}

test('a resident passing a granary mid-segment carries its food home after reloading',()=>{
 const {s,resident,source}=fixture('granary');
 const before=source.stock.food;
 assert.ok(waitFor(s,()=>resident.pantryFood>0,18),'pickup must occur before the long street ends');
 const load=resident.pantryFood;
 assert.equal(source.stock.food,before-load);
 assert.equal(at(s,homeKey).pantryDelivered,0);
 const saved=decode(encode(s));assert.ok(saved);
 const walker=saved.citizens.find(c=>c.id===resident.id);
 assert.equal(walker.pantryFood,load);
 const home=at(saved,homeKey);
 assert.ok(waitFor(saved,()=>home.pantryDelivered>=load,55));
 assert.equal(home.lastRation.carrier,resident.id);
 assert.equal(home.lastRation.source,key);
 assert.equal(home.pantryDelivered,load);
 assert.equal(at(saved,key).stock.food,before-load);
});

function gardenOrder(){
 const setup=fixture('garden');
 const {s,resident}=setup;
 const {ok,id}=requestTransfer(s,key,homeKey,'food',5,{automatic:true,targetKind:'input'});
 assert.ok(ok);
 const courier=s.citizens.find(c=>c.home!==resident.home&&c.age>=16);
 Object.assign(courier,{districtJob:id,store:key});
 walk(courier,{x:1.5,y:23.5},{x:8.5,y:13.5},'toDistrictSupply');
 return {...setup,id,courier};
}

test('passing family member collects an existing producer order once, ahead of an empty courier',()=>{
 const {s,resident,source,courier,id}=gardenOrder();
 assert.ok(waitFor(s,()=>resident.cargo.food>0,18),'resident should load the nearby order before original courier');
 assert.equal(resident.districtJob,id);
 assert.equal(courier.cargo.food||0,0);
 assert.equal(source.workshopStock.output.food,0);
 const load=resident.cargo.food;
 assert.equal(load,5);
 const saved=decode(encode(s));assert.ok(saved);
 const job=saved.district.jobs.find(q=>q.id===id);
 assert.ok(waitFor(saved,()=>job.delivered===load,55));
 assert.equal(job.remaining,0);
 assert.equal(job.cancelled,0);
 assert.equal(at(saved,homeKey).lastRation.carrier,resident.id);
 assert.equal(at(saved,homeKey).pantryDelivered,load);
 assert.ok(decode(encode(saved)));
});

test('a passing family member leaves a loaded producer shipment with its courier',()=>{
 const {s,courier,resident,source,id}=gardenOrder();
 Object.assign(courier,{x:8.5,y:13.5});
 assert.equal(districtPickup(s,courier),5);
 walk(courier,{x:8.5,y:13.5},{x:8.5,y:8.5},'toDistrictStore');
 assert.ok(waitFor(s,()=>resident.y<13.25,12),'resident crosses the store entrance');
 assert.equal(resident.cargo.food||0,0);
 assert.equal(courier.districtJob,id);
 assert.equal(courier.cargo.food,5);
 assert.equal(source.workshopStock.output.food,0);
});

test('a resident passing the entrance keeps the order with an approaching courier already in the yard',()=>{
 const {s,courier,resident,id}=gardenOrder();
 walk(resident,{x:8.5,y:13.55},{x:8.5,y:8.5});
 walk(courier,{x:9.95,y:13.5},{x:8.5,y:13.5},'toDistrictSupply');
 assert.ok(waitFor(s,()=>resident.y<13.4,2));
 assert.equal(courier.cargo.food||0,0);
 assert.equal(courier.districtJob,id);
 assert.equal(resident.districtJob,undefined);
 assert.ok(waitFor(s,()=>courier.cargo.food===5,12));
});

for(const [policy,restrict] of [
 ['exports disabled',s=>setStoreExports(s,key,false)],
 ['all stock held at the minimum',s=>setStoreMinimum(s,key,'food',8)]
]){
 test('granary keeps food when '+policy,()=>{
  const {s,source,resident}=fixture('granary');
  assert.ok(restrict(s).ok);
  assert.ok(waitFor(s,()=>resident.y<13.25,13));
  assert.equal(resident.phase,'toHome');
  assert.equal(resident.pantryFood||0,0);
  assert.equal(source.stock.food,8);
 });
}

test('a save during the turn into the producer keeps the original courier until the family actually loads',()=>{
 const {s,courier,resident,id}=gardenOrder();
 walk(resident,{x:8.85,y:15.5},{x:8.5,y:8.5});
 assert.ok(waitFor(s,()=>resident.walkPantryPickup,13));
 assert.equal(resident.cargo.food||0,0);
 const saved=decode(encode(s));assert.ok(saved);
 const walker=saved.citizens.find(c=>c.id===resident.id);
 const original=saved.citizens.find(c=>c.id===courier.id);
 assert.equal(walker.walkPantryPickup,true);
 assert.equal(walker.districtJob,id);
 assert.equal(original.districtJob,id);
 assert.equal(at(saved,key).workshopStock.output.food,5);
 assert.ok(waitFor(saved,()=>walker.cargo.food===5,12));
 assert.equal(walker.walkPantryPickup,undefined);
 assert.notEqual(original.districtJob,id);
 assert.equal(saved.citizens.filter(c=>c.districtJob===id).length,1);
 assert.equal(at(saved,key).workshopStock.output.food,0);
});
