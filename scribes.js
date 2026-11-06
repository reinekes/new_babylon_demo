import {MATERIALS,isOperational} from './definitions.js';
import {isStrictSumer} from './scenario-profiles.js';
import {calendarAt} from './calendar.js';

export const ACCOUNT_WORK_SECONDS=12;

const RECEIPT_LIMIT=8;

export function queueGranaryReceipt(state,building,carrier,accepted){
 if(building?.type!=='granary'||!isStrictSumer(state)||!isOperational(building))return;
 const cargo=Object.fromEntries(MATERIALS.filter(k=>accepted[k]>1e-8).map(k=>[k,accepted[k]]));
 if(!Object.keys(cargo).length)return;
 const archive=building.receiptArchive??={version:1,nextId:1,pending:[],tablets:[]};
 archive.pending.push({id:archive.nextId++,carrier:carrier.id,arrivedAt:state.simTime,cargo});
 if(archive.pending.length>RECEIPT_LIMIT)archive.pending.shift();
}

function workOnReceipt(state,building,scribe){
 const archive=building.receiptArchive;
 if(!archive)return false;
 const previous=archive.tablets.at(-1);
 if(previous&&previous.author!==scribe.id&&archive.reading?.author!==scribe.id){
  archive.reading={author:scribe.id,tablet:previous.id};
  return true;
 }
 const delivery=archive.pending.shift();
 if(!delivery)return false;
 archive.tablets.push({...delivery,author:scribe.id,writtenAt:state.simTime});
 if(archive.tablets.length>RECEIPT_LIMIT){
  const removed=archive.tablets.shift();
  if(archive.reading?.tablet===removed.id)delete archive.reading;
 }
 return true;
}

function validArchive(state,building){
 const a=building.receiptArchive;
 if(a===undefined)return true;
 const integer=n=>Number.isSafeInteger(n)&&n>0;
 const citizen=n=>Number.isSafeInteger(n)&&n>=0&&n<state.demography.nextId;
 const time=n=>Number.isFinite(n)&&n>=0&&n<=state.simTime;
 if(building.type!=='granary'||!isStrictSumer(state)||!a||a.version!==1||!integer(a.nextId)||![a.pending,a.tablets].every(list=>Array.isArray(list)&&list.length<=RECEIPT_LIMIT))return false;
 let last=0;
 for(const r of [...a.tablets,...a.pending]){
  if(!r||!integer(r.id)||r.id<=last||r.id>=a.nextId||!citizen(r.carrier)||!time(r.arrivedAt)||!r.cargo||Array.isArray(r.cargo)||
   !Object.keys(r.cargo).length||Object.entries(r.cargo).some(([k,n])=>!MATERIALS.includes(k)||!Number.isFinite(n)||n<=0))return false;
  last=r.id;
 }
 return a.tablets.every(r=>citizen(r.author)&&time(r.writtenAt)&&r.writtenAt>=r.arrivedAt)&&
  a.pending.every(r=>r.author===undefined&&r.writtenAt===undefined)&&
  (a.reading===undefined||a.reading&&citizen(a.reading.author)&&a.tablets.some(r=>r.id===a.reading.tablet&&r.author!==a.reading.author));
}

// One dated tablet per granary. It records stock without moving it.
export function workOnAccount(state,building,scribe,seconds){
 scribe.workElapsed+=seconds;
 if(scribe.workElapsed<ACCOUNT_WORK_SECONDS)return;
 scribe.workElapsed%=ACCOUNT_WORK_SECONDS;
 if(workOnReceipt(state,building,scribe))return;
 const date=calendarAt(state);
 building.stockAccount={
  author:scribe.id,
  simTime:state.simTime,
  year:date.year,month:date.month,day:date.day,
  stock:Object.fromEntries(MATERIALS.map(resource=>[resource,building.stock?.[resource]||0]))
 };
}

export function validateStockAccounts(state){
 return state.buildings.every(building=>{
  if(!validArchive(state,building))return false;
  const tablet=building.stockAccount;
  if(tablet===undefined)return true;
  return building.type==='granary'&&tablet&&Number.isSafeInteger(tablet.author)&&tablet.author>=0
   &&Number.isFinite(tablet.simTime)&&tablet.simTime>=0&&tablet.simTime<=state.simTime
   &&Number.isSafeInteger(tablet.year)&&tablet.year>=1&&tablet.year<=state.year
   &&Number.isSafeInteger(tablet.month)&&tablet.month>=0&&tablet.month<12
   &&Number.isSafeInteger(tablet.day)&&tablet.day>=1&&tablet.day<=30
   &&tablet.stock&&Object.keys(tablet.stock).length===MATERIALS.length
   &&MATERIALS.every(resource=>Number.isFinite(tablet.stock[resource])&&tablet.stock[resource]>=0);
 });
}
