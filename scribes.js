import {MATERIALS} from './definitions.js';
import {calendarAt} from './calendar.js';

export const ACCOUNT_WORK_SECONDS=12;

// One dated tablet per granary. It records stock without moving it.
export function workOnAccount(state,building,scribe,seconds){
 scribe.workElapsed+=seconds;
 if(scribe.workElapsed<ACCOUNT_WORK_SECONDS)return;
 scribe.workElapsed%=ACCOUNT_WORK_SECONDS;
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
