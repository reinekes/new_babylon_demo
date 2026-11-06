import {buildingKey} from './definitions.js';
import {isStrictSumer} from './scenario-profiles.js';

const LIMIT=32;
const keyPattern=/^\d+,\d+$/;
const id=n=>Number.isSafeInteger(n)&&n>0;

export function bindWaterProject(s,station,home){
 const ledger=s.causalFacts??={version:1,nextEntityId:1,water:[]};
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

export function validateCausalFacts(s){
 const ledger=s.causalFacts,live=new Map();
 if(ledger===undefined)return s.buildings.every(b=>b.waterEntityId===undefined&&b.humanWaterProject?.homeId===undefined);
 if(!isStrictSumer(s)||!ledger||ledger.version!==1||!id(ledger.nextEntityId)||!Array.isArray(ledger.water)||ledger.water.length>LIMIT)return false;
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
 return true;
}
