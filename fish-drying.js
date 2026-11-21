import {buildingKey,isOperational,isResidence} from './definitions.js';
import {cityCommandReason} from './city-command-lock.js';
import {hangFishingEvidence} from './cat-fishing-ledger.js';
import {trimFishingOutput} from './fish-provenance.js';

export const FISH_RACK_SECONDS=12,FISH_RESERVE_CAPACITY=24;
const EPS=1e-7,portion=2;
export const dryFishAmount=b=>(b?.dryFishLots||[]).reduce((sum,lot)=>sum+lot.amount,0);
const sameFishLot=(a,b)=>a.yard===b.yard&&a.id===b.id;
export const dryFishLotStock=(b,lot)=>b?.dryFishLots?.find(stored=>sameFishLot(stored,lot))?.amount||0;

function switchReason(s,b,type,enabled){
 return cityCommandReason(s)||(s.event?'Сначала заверши событие':s.lost?'Поселение покинуто':
  typeof enabled!=='boolean'||b?.type!==type||!isOperational(b)||!s.buildings.includes(b)?'Выбери готовое здание':'');
}
export function setFishRackEnabled(s,b,enabled){
 const reason=switchReason(s,b,'fishing',enabled);if(reason)return {ok:false,reason};
 b.fishRack??={enabled:false,serial:0};b.fishRack.enabled=enabled;
 return {ok:true};
}
export function setFishReserveOpen(s,b,enabled){
 const reason=switchReason(s,b,'granary',enabled);if(reason)return {ok:false,reason};
 if(enabled)b.fishReserveOpen=true;else delete b.fishReserveOpen;
 if(s.district)s.district.lastScan=-1;
 return {ok:true};
}
// In-transit lots keep their place at origin in case their carrier is lost.
export function dryFishRoom(s,b){
 if(!b)return 0;
 const key=buildingKey(b);
 let occupied=dryFishAmount(b)+(b.fishRack?.batch?.amount||0);
 for(const job of s.district?.jobs||[])if(job.fishLot&&job.source===key)
  occupied+=Math.max(0,job.amount-job.cancelled-job.delivered-job.remaining);
 return Math.max(0,FISH_RESERVE_CAPACITY-occupied);
}
export function hangFreshCatch(s,b,delivered){
 const rack=b.fishRack;
 if(!rack?.enabled||rack.batch||delivered<portion*2||dryFishRoom(s,b)<portion)return false;
 const before=b.workshopStock.output.food;
 if(before+EPS<delivered)return false;
 // The fishing yard's output contains only actual local catches. Reservations
 // made before this landing still fit in the remaining fresh output.
 b.workshopStock.output.food-=portion;
 trimFishingOutput(b,b.workshopStock.output.food);
 rack.serial=s.lastFishLotId=(s.lastFishLotId||0)+1;
 hangFishingEvidence(s,b,rack.serial,portion,before);
 rack.batch={id:rack.serial,amount:portion,remaining:FISH_RACK_SECONDS};
 return true;
}
export function addDryFishLot(b,lot,amount){
 const lots=b.dryFishLots??=[];
 const row=lots.find(r=>sameFishLot(r,lot));
 if(row)row.amount+=amount;else lots.push({yard:lot.yard,id:lot.id,amount});
}
export function advanceFishRack(b,dt,rate){
 const batch=b.fishRack?.batch;
 if(!batch||!isOperational(b)||rate<=0)return;
 batch.remaining-=dt*rate;
 if(batch.remaining>EPS)return;
 addDryFishLot(b,{yard:buildingKey(b),id:batch.id},batch.amount);
 delete b.fishRack.batch;
}
export function collectDryFishLot(b,lot,amount){
 const row=b.dryFishLots?.find(r=>sameFishLot(r,lot));
 if(!row)return 0;
 const actual=Math.min(amount,row.amount);row.amount-=actual;
 if(row.amount<EPS)b.dryFishLots=b.dryFishLots.filter(r=>r!==row);
 if(!b.dryFishLots.length)delete b.dryFishLots;
 return actual;
}

export function validateFishRacks(s){
 if(s.lastFishLotId!==undefined&&(!Number.isSafeInteger(s.lastFishLotId)||s.lastFishLotId<1))return false;
 const key=value=>typeof value==='string'&&/^\d+,\d+$/.test(value);
 const lot=r=>r&&key(r.yard)&&Number.isSafeInteger(r.id)&&r.id>0&&r.id<=s.lastFishLotId;
 const size=r=>lot(r)&&Number.isFinite(r.amount)&&r.amount>0&&r.amount<=portion+EPS;
 const receipt=r=>size(r)&&Number.isSafeInteger(r.carrier)&&r.carrier>=0&&Number.isFinite(r.at)&&r.at>=0&&r.at<=s.simTime+EPS;
 const physical=new Map(),reserved=new Map(),origins=new Map();
 const add=(map,key,amount)=>map.set(key,(map.get(key)||0)+amount);
 const track=(r,amount)=>{
  if(origins.has(r.id)&&origins.get(r.id)!==r.yard)return false;
  origins.set(r.id,r.yard);add(physical,r.id,amount);
  return physical.get(r.id)<=portion+EPS;
 };
 for(const b of s.buildings){
  const rack=b.fishRack;
  if(rack!==undefined){
   if(!rack||b.type!=='fishing'||!isOperational(b)||typeof rack.enabled!=='boolean'||!Number.isSafeInteger(rack.serial)||rack.serial<0||rack.serial>(s.lastFishLotId||0))return false;
   const batch=rack.batch;
   if(batch!==undefined&&(!batch||batch.amount!==portion||batch.id!==rack.serial||!batch.id||
    !Number.isFinite(batch.remaining)||batch.remaining<=0||batch.remaining>FISH_RACK_SECONDS))return false;
  }
  if(rack?.batch&&!track({yard:buildingKey(b),id:rack.batch.id},rack.batch.amount))return false;
  if(b.dryFishLots!==undefined&&(!['fishing','granary'].includes(b.type)||!Array.isArray(b.dryFishLots)||!b.dryFishLots.length||
   !b.dryFishLots.every(r=>size(r)&&(b.type!=='fishing'||r.yard===buildingKey(b)&&r.id<=(rack?.serial||0))&&track(r,r.amount))||
   new Set(b.dryFishLots.map(r=>r.yard+':'+r.id)).size!==b.dryFishLots.length||
   dryFishAmount(b)+(rack?.batch?.amount||0)>FISH_RESERVE_CAPACITY+EPS))return false;
  if(b.fishReserveOpen!==undefined&&(b.type!=='granary'||b.fishReserveOpen!==true)||
   b.lastFishReceipt!==undefined&&(b.type!=='granary'||!receipt(b.lastFishReceipt))||
   b.lastFishRation!==undefined&&(!isResidence(b)||!receipt(b.lastFishRation)||!key(b.lastFishRation.granary)))return false;
 }
 if(s.lastFishLotId){
  for(const q of s.district?.jobs||[])if(q.fishLot){
   if(!lot(q.fishLot))return false;
   const load=Math.max(0,q.amount-q.delivered-q.cancelled-q.remaining);
   if(load>EPS&&!track(q.fishLot,load))return false;
   if(q.remaining>EPS)add(reserved,q.source+'#'+q.fishLot.id,q.remaining);
  }
  for(const b of s.buildings)for(const r of b.dryFishLots||[]){
   const id=buildingKey(b)+'#'+r.id;
   if((reserved.get(id)||0)>r.amount+EPS)return false;
   reserved.delete(id);
  }
  if(reserved.size)return false;
 }
 return true;
}
