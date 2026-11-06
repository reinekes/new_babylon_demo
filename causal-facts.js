import {recordRevelationFact} from './revelation-evidence.js';
import {DAY_SECONDS} from './city-life.js';
import {buildingKey} from './definitions.js';
import {isStrictSumer} from './scenario-profiles.js';

const LIMIT=32;
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
 if(ledger===undefined)return s.buildings.every(b=>b.waterEntityId===undefined&&b.humanWaterProject?.homeId===undefined);
 if(!isStrictSumer(s)||!ledger||ledger.version!==1||!id(ledger.nextEntityId)||!Array.isArray(ledger.water)||ledger.water.length>LIMIT||
  [ledger.neighborWater,ledger.neighborFood].some(rows=>rows!==undefined&&(!Array.isArray(rows)||rows.length>LIMIT)))return false;
 const entity=n=>id(n)&&n<ledger.nextEntityId;
 for(const b of s.buildings){
  const uid=b.waterEntityId,p=b.humanWaterProject;
  if(uid!==undefined){
   if(!entity(uid)||live.has(uid)||b.type!=='house'&&!(b.type==='waterpoint'&&p))return false;
   live.set(uid,b);
  }
  if(p?.homeId!==undefined&&(!entity(p.homeId)||!entity(uid)||p.homeId===uid))return false;
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
