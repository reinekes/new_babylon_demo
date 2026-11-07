import {recordRevelationFact} from './revelation-evidence.js';
import {DAY_SECONDS} from './city-life.js';
import {buildingKey} from './definitions.js';
import {supplyHome} from './households.js';
import {isStrictSumer} from './scenario-profiles.js';
import {worldWidth,worldHeight} from './world.js';

const LIMIT=32;
const WITNESSES_PER_PROJECT=2;
const keyPattern=/^\d+,\d+$/;
const id=n=>Number.isSafeInteger(n)&&n>0;

const causalLedger=s=>s.causalFacts??={version:1,nextEntityId:1,water:[]};
const aidDay=time=>Math.floor(time/DAY_SECONDS);
const aidKey=({originId,homeId,time})=>`${Math.min(originId,homeId)}:${Math.max(originId,homeId)}:${aidDay(time)}`;

export function bindWaterProject(s,station,home){
 const ledger=causalLedger(s);
 station.waterEntityId=ledger.nextEntityId++;
 home.waterEntityId??=ledger.nextEntityId++;
 station.humanWaterProject.homeId=home.waterEntityId;
}

export function recordProjectWaterFact(s,station,home,delivery){
 const project=station.humanWaterProject,ledger=s.causalFacts;
 if(!ledger||!station.waterEntityId||project.homeId!==home.waterEntityId)return;
 ledger.water.push({stationId:station.waterEntityId,homeId:home.waterEntityId,station:buildingKey(station),home:buildingKey(home),
  organizerId:project.organizerId,requesterId:project.requesterId,...delivery});
 if(ledger.water.length>LIMIT)ledger.water.shift();
}

function distinctCourtyardPair(receipts){
 const first=receipts?.[0];
 if(!first)return null;
 const second=receipts.find(receipt=>receipt.homeId!==first.homeId&&receipt.home!==first.home);
 return second?[first,second]:null;
}

function trimNameReceipts(receipts){
 if(receipts.length<=LIMIT)return;
 const evidence=distinctCourtyardPair(receipts);
 // Keep the first receipt while it waits for a different courtyard.
 const oldest=receipts.findIndex((receipt,index)=>index>0&&!evidence?.includes(receipt));
 receipts.splice(oldest,1);
}

export function waterNameEvidence(s){
 return distinctCourtyardPair(s.causalFacts?.waterWitnesses);
}

export function recordProjectWaterWitness(s,station,home,delivery){
 const project=station.humanWaterProject,ledger=s.causalFacts,homeKey=buildingKey(home);
 if(!ledger||!station.waterEntityId||!project.homeId||project.home===homeKey||home.type!=='house')return;
 const witnessed=project.witnessHomeIds;
 if(witnessed?.length>=WITNESSES_PER_PROJECT||witnessed?.includes(home.waterEntityId))return;
 const recipient=s.citizens.find(c=>supplyHome(c,{arrived:true})===homeKey);
 if(!recipient)return;
 home.waterEntityId??=ledger.nextEntityId++;
 (project.witnessHomeIds??=[]).push(home.waterEntityId);
 const facts=ledger.waterWitnesses??=[];
 facts.push({stationId:station.waterEntityId,station:buildingKey(station),homeId:home.waterEntityId,home:homeKey,recipientId:recipient.id,...delivery});
 trimNameReceipts(facts);
}

export function healingNameEvidence(s){
 return distinctCourtyardPair(s.causalFacts?.healing);
}

export function householdNameEvidence(s,residents){
 const ledger=s.causalFacts;
 if(!ledger||!residents.length)return {water:null,healing:null};
 const ids=new Set(residents.map(c=>c.id));
 const requested=ledger.water.findLast(f=>ids.has(f.requesterId));
 const witnessed=ledger.waterWitnesses?.findLast(f=>ids.has(f.recipientId));
 const water=witnessed&&(!requested||witnessed.time>requested.time)?witnessed:requested;
 const healing=ledger.healing?.findLast(f=>ids.has(f.patientId));
 return {water:water||null,healing:healing||null};
}

export function recordHealingNameEvidence(s,healer,patient){
 if(healer.calling!=='healer'||patient.health<60)return;
 if(s.causalFacts?.healing?.some(f=>f.patientId===patient.id))return;
 const home=s.buildings.find(b=>b.type==='house'&&buildingKey(b)===patient.home);
 if(!home)return;
 const ledger=causalLedger(s),care=ledger.healing??=[];
 home.waterEntityId??=ledger.nextEntityId++;
 care.push({homeId:home.waterEntityId,home:patient.home,healerId:healer.id,patientId:patient.id,time:s.simTime});
 trimNameReceipts(care);
}

export function craftNameEvidence(s){
 return distinctCourtyardPair(s.causalFacts?.craft);
}

export function recordCraftNameEvidence(s,site,{mentor,pupil}){
 if(!isStrictSumer(s)||!site?.construction||!Number.isFinite(site.x)||!Number.isFinite(site.y))return;
 const first=s.causalFacts?.craft?.[0];
 if(craftNameEvidence(s)||first?.home===pupil.home||first?.pupilId===pupil.id)return;
 const home=s.buildings.find(b=>b.type==='house'&&buildingKey(b)===pupil.home);
 if(!home||first&&first.homeId===home.waterEntityId)return;
 const ledger=causalLedger(s);
 home.waterEntityId??=ledger.nextEntityId++;
 (ledger.craft??=[]).push({homeId:home.waterEntityId,home:pupil.home,mentorId:mentor.id,pupilId:pupil.id,
  site:[site.x,site.y],time:s.simTime});
}

export function harvestNameEvidence(s){
 return distinctCourtyardPair(s.causalFacts?.harvest);
}

export function recordHarvestNameEvidence(s,field,home,part){
 if(!isStrictSumer(s)||!part.inspired||home.type!=='house')return;
 const key=buildingKey(home);
 const recipient=s.citizens.find(c=>supplyHome(c,{arrived:true})===key);
 if(!recipient)return;
 const known=s.causalFacts?.harvest;
 if(known?.some(f=>f.home===key||f.homeId===home.waterEntityId||f.recipientId===recipient.id))return;
 const ledger=causalLedger(s),receipts=ledger.harvest??=[];
 home.waterEntityId??=ledger.nextEntityId++;
 receipts.push({homeId:home.waterEntityId,home:key,fieldId:field.grainFieldId,field:buildingKey(field),
  farmerId:part.farmerId,recipientId:recipient.id,amount:part.amount,time:s.simTime});
 trimNameReceipts(receipts);
}

export function recordNeighborWaterFact(s,c,home,trip,amount){
 if(trip.station!==null||trip.neighborRecorded||trip.origin!==c.home||trip.target!==buildingKey(home))return;
 if(recordNeighborAid(s,c,home,amount,'neighborWater'))trip.neighborRecorded=true;
}

export function recordNeighborFoodFact(s,c,home,amount){
 if(c.pantryTarget===buildingKey(home))recordNeighborAid(s,c,home,amount,'neighborFood');
}

function recordNeighborAid(s,c,home,amount,kind){
 const target=buildingKey(home);
 if(!isStrictSumer(s)||!(amount>1e-8)||home.type!=='house'||c.home===target||!s.citizens.some(p=>p.home===target))return false;
 const origin=s.buildings.find(b=>b.type==='house'&&buildingKey(b)===c.home);
 if(!origin)return false;
 const ledger=causalLedger(s);
 origin.waterEntityId??=ledger.nextEntityId++;
 home.waterEntityId??=ledger.nextEntityId++;
 const fact={originId:origin.waterEntityId,homeId:home.waterEntityId,origin:c.home,home:target,
  courierId:c.id,time:s.simTime,amount};
 const key=aidKey(fact);
 if(![ledger.neighborWater,ledger.neighborFood].some(rows=>rows?.some(row=>aidKey(row)===key))){
  const facts=ledger[kind]??=[];
  if(facts.length===LIMIT){
   if(aidDay(facts[0].time)===aidDay(fact.time))return true;
   facts.shift();
  }
  facts.push(fact);
  recordRevelationFact(s,'family',c,home);
 }
 return true;
}

export function validateCausalFacts(s){
 const ledger=s.causalFacts,live=new Map();
 if(ledger===undefined)return s.buildings.every(b=>b.waterEntityId===undefined&&b.humanWaterProject?.homeId===undefined&&b.humanWaterProject?.witnessHomeIds===undefined);
 if(!isStrictSumer(s)||!ledger||ledger.version!==1||!id(ledger.nextEntityId)||!Array.isArray(ledger.water)||ledger.water.length>LIMIT||
  [ledger.neighborWater,ledger.neighborFood,ledger.waterWitnesses].some(rows=>rows!==undefined&&(!Array.isArray(rows)||rows.length>LIMIT)))return false;
 const entity=n=>id(n)&&n<ledger.nextEntityId;
 for(const b of s.buildings){
  const uid=b.waterEntityId,p=b.humanWaterProject;
  if(uid!==undefined){
   if(!entity(uid)||live.has(uid)||b.type!=='house'&&!(b.type==='waterpoint'&&p))return false;
   live.set(uid,b);
  }
  if(p?.homeId!==undefined&&(!entity(p.homeId)||!entity(uid)||p.homeId===uid))return false;
  if(p?.witnessHomeIds!==undefined&&!entity(uid))return false;
  if(b.type==='waterpoint'&&uid!==undefined&&p?.homeId===undefined)return false;
 }
 const citizen=n=>Number.isSafeInteger(n)&&n>=0&&n<s.demography.nextId;
 const seen=new Set(),kinds=new Map();
 const entityMatches=(uid,type,key)=>{
  const signature=type+':'+key,b=live.get(uid),previous=kinds.get(uid);
  if(b&&(b.type!==type||buildingKey(b)!==key)||previous&&previous!==signature)return false;
  kinds.set(uid,signature);return true;
 };
 for(const b of live.values()){
  const p=b.humanWaterProject;
  if(p?.homeId!==undefined&&!entityMatches(p.homeId,'house',p.home))return false;
  const witnesses=p?.witnessHomeIds;
  if(witnesses!==undefined&&(!p.homeId||b.construction?.kind==='new'||!Array.isArray(witnesses)||
   witnesses.length<1||witnesses.length>WITNESSES_PER_PROJECT||new Set(witnesses).size!==witnesses.length||
   witnesses.some(uid=>!entity(uid)||uid===p.homeId||uid===b.waterEntityId||live.has(uid)&&live.get(uid).type!=='house')))return false;

 }
 let previousTime=0;
 for(const fact of ledger.water){
  if(!fact||!entity(fact.stationId)||!entity(fact.homeId)||fact.stationId===fact.homeId||seen.has(fact.stationId)||
   typeof fact.station!=='string'||!keyPattern.test(fact.station)||typeof fact.home!=='string'||!keyPattern.test(fact.home)||
   !entityMatches(fact.stationId,'waterpoint',fact.station)||!entityMatches(fact.homeId,'house',fact.home)||
   ![fact.organizerId,fact.requesterId,fact.courierId].every(citizen)||!Number.isFinite(fact.time)||fact.time<previousTime||fact.time>s.simTime||
   !Number.isFinite(fact.amount)||fact.amount<=0||fact.amount>12)return false;
  const p=live.get(fact.stationId)?.humanWaterProject;
  if(p&&(p.homeId!==fact.homeId||p.home!==fact.home||p.organizerId!==fact.organizerId||p.requesterId!==fact.requesterId||
   p.delivery?.courierId!==fact.courierId||p.delivery?.time!==fact.time||p.delivery?.amount!==fact.amount))return false;
  seen.add(fact.stationId);previousTime=fact.time;
 }
 const witnessedByStation=new Map();
 previousTime=0;
 for(const fact of ledger.waterWitnesses||[]){
  if(!fact||!entity(fact.stationId)||!entity(fact.homeId)||fact.stationId===fact.homeId||fact.station===fact.home||
   typeof fact.station!=='string'||!keyPattern.test(fact.station)||typeof fact.home!=='string'||!keyPattern.test(fact.home)||
   !entityMatches(fact.stationId,'waterpoint',fact.station)||!entityMatches(fact.homeId,'house',fact.home)||
   !citizen(fact.courierId)||fact.recipientId!==undefined&&!citizen(fact.recipientId)||
   !Number.isFinite(fact.time)||fact.time<previousTime||fact.time>s.simTime||
   !Number.isFinite(fact.amount)||fact.amount<=0||fact.amount>12)return false;
  const origin=ledger.water.find(row=>row.stationId===fact.stationId);
  if(origin&&(origin.homeId===fact.homeId||origin.home===fact.home))return false;
  const p=live.get(fact.stationId)?.humanWaterProject;
  if(p&&(!p.witnessHomeIds?.includes(fact.homeId)||p.home===fact.home||fact.time<p.startedAt))return false;
  const homes=witnessedByStation.get(fact.stationId)||new Set();
  if(homes.has(fact.homeId)||homes.size>=WITNESSES_PER_PROJECT)return false;
  homes.add(fact.homeId);witnessedByStation.set(fact.stationId,homes);previousTime=fact.time;
 }
 if((ledger.waterWitnesses?.length||0)<LIMIT){
  for(const [stationId,b] of live){
   const homes=witnessedByStation.get(stationId);
   if(b.humanWaterProject?.witnessHomeIds?.some(uid=>!homes?.has(uid)))return false;
  }
 }
 const healing=ledger.healing;
 if(healing!==undefined){
  if(!Array.isArray(healing)||healing.length<1||healing.length>LIMIT)return false;
  const patients=new Set();
  let previousHealingTime=0;
  for(const fact of healing){
   if(!fact||Object.keys(fact).length!==5||!entity(fact.homeId)||typeof fact.home!=='string'||!keyPattern.test(fact.home)||
    !entityMatches(fact.homeId,'house',fact.home)||!citizen(fact.healerId)||!citizen(fact.patientId)||fact.healerId===fact.patientId||
    patients.has(fact.patientId)||
    !Number.isFinite(fact.time)||fact.time<previousHealingTime||fact.time>s.simTime)return false;
   patients.add(fact.patientId);previousHealingTime=fact.time;
  }
 }
 const craft=ledger.craft;
 if(craft!==undefined){
  if(s.godhood?.mode!=='awakening'||!Array.isArray(craft)||!craft.length||craft.length>2)return false;
  const [first,second]=craft;
  if(!craft.every(f=>f&&Object.keys(f).length===6&&entity(f.homeId)&&typeof f.home==='string'&&keyPattern.test(f.home)&&
   entityMatches(f.homeId,'house',f.home)&&Array.isArray(f.site)&&f.site.length===2&&
   f.site.every((value,i)=>Number.isFinite(value)&&value>=-.5&&value<=(i===0?worldWidth(s):worldHeight(s))-.5)&&
   citizen(f.mentorId)&&citizen(f.pupilId)&&f.mentorId!==f.pupilId&&Number.isFinite(f.time)&&f.time>=0&&f.time<=s.simTime)||
   second&&(second.homeId===first.homeId||second.home===first.home||second.pupilId===first.pupilId||second.time<first.time))return false;
 }
 const harvest=ledger.harvest;
 if(harvest!==undefined){
  if(!Array.isArray(harvest)||!harvest.length||harvest.length>LIMIT||!s.earthDiscovery)return false;
  const homes=new Set(),addresses=new Set(),recipients=new Set();
  let previousHarvestTime=0;
  for(const fact of harvest){
   if(!fact||Object.keys(fact).length!==8||!entity(fact.homeId)||typeof fact.home!=='string'||!keyPattern.test(fact.home)||
    !entityMatches(fact.homeId,'house',fact.home)||!id(fact.fieldId)||fact.fieldId>=s.earthDiscovery.nextFieldId||
    typeof fact.field!=='string'||!keyPattern.test(fact.field)||!citizen(fact.farmerId)||!citizen(fact.recipientId)||
    homes.has(fact.homeId)||addresses.has(fact.home)||recipients.has(fact.recipientId)||
    !Number.isFinite(fact.amount)||fact.amount<=0||fact.amount>12||
    !Number.isFinite(fact.time)||fact.time<previousHarvestTime||fact.time>s.simTime)return false;
   const field=s.buildings.find(b=>b.grainFieldId===fact.fieldId);
   if(field&&buildingKey(field)!==fact.field)return false;
   homes.add(fact.homeId);addresses.add(fact.home);recipients.add(fact.recipientId);previousHarvestTime=fact.time;
  }
 }
 const aidedPairs=new Set();
 for(const [rows,maxAmount] of [[ledger.neighborWater,12],[ledger.neighborFood,6]]){
  let previousAidTime=0;
  for(const fact of rows||[]){
   if(!fact||Object.keys(fact).length!==7||!entity(fact.originId)||!entity(fact.homeId)||fact.originId===fact.homeId||
    typeof fact.origin!=='string'||!keyPattern.test(fact.origin)||typeof fact.home!=='string'||!keyPattern.test(fact.home)||fact.origin===fact.home||
    !entityMatches(fact.originId,'house',fact.origin)||!entityMatches(fact.homeId,'house',fact.home)||!citizen(fact.courierId)||
    !Number.isFinite(fact.time)||fact.time<previousAidTime||fact.time>s.simTime||!Number.isFinite(fact.amount)||fact.amount<=0||fact.amount>maxAmount)return false;
   const key=aidKey(fact);
   if(aidedPairs.has(key))return false;
   aidedPairs.add(key);previousAidTime=fact.time;
  }
 }
 return true;
}
