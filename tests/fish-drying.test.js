import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTime,createGame,decode,encode} from '../engine.js';
import {strictScenario} from '../scenario-profiles.js';
import {isResidence,buildingKey} from '../definitions.js';
import {invalidateAssignments,recoverCitizenCargo,syncCitizens} from '../workforce.js';
import {setFishRackEnabled,setFishReserveOpen,dryFishAmount} from '../fish-drying.js';
import {canDemolish} from '../management.js';

const at=(s,key)=>s.buildings.find(b=>buildingKey(b)===key);
const reload=s=>{const saved=encode(s),copy=decode(saved);assert.ok(copy);assert.equal(encode(copy),saved);return copy;};
function until(s,condition,limit=3500){
 for(let i=0;i<limit&&!condition();i++){s.event=null;advanceTime(s,.1);}
 assert.ok(condition(),`condition not reached by simulation time ${s.simTime}`);
}
function setup(){
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 s.buildings.push({type:'fishing',x:11,y:9,level:1},{type:'granary',x:10,y:9,level:1});
 const adults=s.citizens.filter(c=>c.age>=16);
 Object.assign(adults[0],{role:'production',workplace:'11,9',calling:'fisher'});
 for(const c of adults.slice(1,5))c.role='carrier';
 invalidateAssignments(s);syncCitizens(s);
 return s;
}

test('a numbered catch dries on the yard and reaches a family through two real carrier trips',()=>{
 let s=setup();
 const yard=()=>at(s,'11,9'),granary=()=>at(s,'10,9');
 const active=(toHome=false)=>s.citizens.find(c=>c.cargo?.food>0&&s.district.jobs.some(q=>q.id===c.districtJob&&q.fishLot?.id===1&&!!q.targetKind===toHome));
 assert.ok(setFishRackEnabled(s,yard(),true).ok);
 const food=s.resources.food;
 assert.equal(yard().fishRack.batch,undefined);assert.equal(s.resources.food,food);
 until(s,()=>yard().fishRack.batch);
 assert.equal(yard().fishRack.batch.amount,2);
 assert.equal(yard().workshopStock.output.food,3);
 assert.match(canDemolish(s,yard()),/сушки/);
 assert.ok(setFishRackEnabled(s,yard(),false).ok);
 s=reload(s);
 const remaining=yard().fishRack.batch.remaining;
 s.rain=1;advanceTime(s,1);assert.equal(yard().fishRack.batch.remaining,remaining);s.rain=0;
 until(s,()=>active());
 assert.equal(dryFishAmount(yard()),0);assert.equal(dryFishAmount(granary()),0);
 const interrupted=reload(s),carrier=active();
 assert.ok(recoverCitizenCargo(interrupted,carrier.id));
 assert.equal(dryFishAmount(at(interrupted,'11,9')),2);
 assert.equal(dryFishAmount(at(interrupted,'10,9')),0);
 assert.ok(decode(encode(interrupted)));
 s=reload(s);
 until(s,()=>granary().lastFishReceipt);
 assert.equal(granary().lastFishReceipt.id,1);
 assert.deepEqual(granary().dryFishLots,[{yard:'11,9',id:1,amount:2}]);
 assert.equal(s.district.jobs.some(q=>q.fishLot&&q.targetKind==='input'),false);
 s=reload(s);
 assert.ok(setFishReserveOpen(s,granary(),true).ok);
 until(s,()=>active(true));
 s=reload(s);
 until(s,()=>s.buildings.some(b=>b.lastFishRation?.id===1));
 const home=s.buildings.find(b=>b.lastFishRation);
 assert.ok(isResidence(home));assert.ok(home.pantry>=home.lastFishRation.amount);
 assert.equal(home.lastFishRation.yard,'11,9');assert.equal(home.lastFishRation.granary,'10,9');
 assert.ok(s.citizens.some(c=>c.id===home.lastFishRation.carrier));
 assert.ok(home.lastFishRation.at>granary().lastFishReceipt.at);reload(s);
});

test('only free reserve space is shipped; rejected and cancelled pickups leave fish at the rack',async()=>{
 const {syncDistrictJobs,cancelTransfer}=await import('../district-logistics.js');
 const {validateFishRacks}=await import('../fish-drying.js');
 const s=setup(),yard=at(s,'11,9'),granary=at(s,'10,9');
 s.lastFishLotId=13;yard.fishRack={serial:13,enabled:true};
 yard.dryFishLots=[{yard:'11,9',id:13,amount:2}];
 granary.dryFishLots=Array.from({length:12},(_,i)=>({yard:'11,9',id:i+1,amount:2}));
 syncDistrictJobs(s);
 assert.equal(s.district.jobs.some(q=>q.fishLot),false);
 granary.dryFishLots[0].amount=1.5;s.district.lastScan=-1;syncDistrictJobs(s);
 const order=s.district.jobs.find(q=>q.fishLot);
 assert.equal(order.amount,.5);assert.equal(order.remaining,.5);
 assert.ok(cancelTransfer(s,order.id).ok);assert.equal(dryFishAmount(yard),2);
 s.district.lastScan=-1;syncDistrictJobs(s);
 assert.equal(s.district.jobs.filter(q=>q.fishLot&&q.remaining>0).length,1);
 assert.ok(validateFishRacks(s));
 granary.dryFishLots[0]={...yard.dryFishLots[0]};
 assert.equal(validateFishRacks(s),false);
});

test('automatic release waits for ordinary stores to run dry and full households do not take a lot',async()=>{
 const {syncDistrictJobs}=await import('../district-logistics.js');
 const {homeStockCapacity}=await import('../building-inventory.js');
 const s=setup(),granary=at(s,'10,9'),home=at(s,'8,8'),other=at(s,'9,9');
 const scan=()=>{s.district.lastScan=-1;syncDistrictJobs(s);};
 s.lastFishLotId=1;granary.dryFishLots=[{yard:'11,9',id:1,amount:2}];
 home.pantry=homeStockCapacity(s,home,'food');other.pantry=homeStockCapacity(s,other,'food');
 home.pantryDelivered=other.pantryDelivered=200;
 scan();assert.equal(s.district.jobs.some(q=>q.fishLot),false);
 s.resources.food=0;scan();assert.equal(s.district.jobs.some(q=>q.fishLot),false);
 home.pantry-=1;scan();
 const job=s.district.jobs.find(q=>q.fishLot);
 assert.equal(job.target,'8,8');assert.equal(job.amount,1);
 assert.equal(dryFishAmount(granary),2);
});

test('drying a second fisher’s landing keeps the first output and both warehouse lessons intact',async()=>{
 const {CAT_DISCOVERY_RULES}=await import('../scenario-profiles.js');
 const {recordFishingCatch,pickupFishingOutput,acceptFishingCargo,pickupDryFishingEvidence,validateCatFishing}=await import('../cat-fishing-ledger.js');
 const {appendFish}=await import('../fish-provenance.js');
 const {hangFreshCatch,advanceFishRack,collectDryFishLot}=await import('../fish-drying.js');
 const s=createGame({start:'established',mode:'awakening',scenario:{...strictScenario(),miracles:CAT_DISCOVERY_RULES}});
 const yard={type:'fishing',x:11,y:9,workshopStock:{output:{food:1}}};s.buildings.push(yard);
 const [first,second,porter]=s.citizens.filter(c=>c.age>=16);
 first.work=second.work='11,9';
 for(const person of [first,second]){
  const before=yard.workshopStock.output.food;
  yard.workshopStock.output.food+=5;
  recordFishingCatch(s,yard,person,5,{inBuffer:true,before});
  appendFish(yard,'fishOutput',[5],before);
 }
 assert.ok(setFishRackEnabled(s,yard,true).ok);
 hangFreshCatch(s,yard,5);assert.deepEqual(yard.fishOutput,[-1,8]);
 assert.deepEqual(s.catFishing.flows['rack:1'],[{id:2,amount:2}]);
 assert.equal(hangFreshCatch(s,yard,5),false);assert.equal(yard.fishRack.serial,1);
 assert.ok(validateCatFishing(s));
 pickupFishingOutput(s,yard,porter,9,9);yard.workshopStock.output.food=0;porter.cargo={food:9};
 acceptFishingCargo(s,porter,9,9,{qualifies:true});porter.cargo={};
 assert.equal(s.catFishing.lessons[first.id],1);assert.equal(s.catFishing.lessons[second.id],undefined);
 advanceFishRack(yard,12,1);
 assert.equal(collectDryFishLot(yard,{yard:'11,9',id:1},2),2);
 pickupDryFishingEvidence(s,porter,1,2,2);porter.cargo={food:2};assert.ok(validateCatFishing(s));
 acceptFishingCargo(s,porter,2,2,{qualifies:true});porter.cargo={};assert.ok(validateCatFishing(s));
 assert.equal(s.catFishing.lessons[second.id],1);
});

test('a public funeral interrupts the fishing pose while the landed catch stays with its owner',async()=>{
 const {startFuneral}=await import('../funerals.js');
 const s=setup(),fisher=s.citizens.find(c=>c.workplace==='11,9');
 until(s,()=>fisher.fishingLanding);
 const catchSize=fisher.cargo.food;
 assert.ok(startFuneral(s,[{id:777,name:'Лу',x:9,y:8}]));
 assert.ok(s.funeral.actors.some(c=>c.id===fisher.id));
 assert.equal(fisher.fishingLanding,undefined);assert.equal(fisher.cargo.food,catchSize);
 const before=s.resources.food;
 assert.ok(recoverCitizenCargo(s,fisher.id));
 assert.equal(s.resources.food,before+catchSize);
 assert.ok(recoverCitizenCargo(s,fisher.id));assert.equal(s.resources.food,before+catchSize);
});
