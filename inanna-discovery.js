import {DAY_SECONDS} from './city-life.js';
import {usesCatDiscovery} from './scenario-profiles.js';

export const INANNA_GUARD_DAYS=3;
export const newInannaDiscovery=()=>({version:1,days:[],chased:false});
const guardDay=s=>Math.floor(s.simTime/DAY_SECONDS);

export function inannaGuardDayPending(s){
 const record=s.inannaDiscovery;
 return !!record&&!record.chased&&record.days.length<INANNA_GUARD_DAYS&&record.days.at(-1)!==guardDay(s);
}

export function recordInannaGuard(s,{stocked=false,chased=false}={}){
 const record=s.inannaDiscovery;
 if(!record||record.chased||record.days.length>=INANNA_GUARD_DAYS)return;
 if(chased){record.chased=true;return;}
 const day=guardDay(s);
 if(stocked&&record.days.at(-1)!==day)record.days.push(day);
}

export function inannaReadinessReason(s){
 const record=s.inannaDiscovery;
 if(!record)return '';
 if(!record.chased&&record.days.length<INANNA_GUARD_DAYS)return 'Сторож должен прогнать мышь или охранять запас в три разных дня';
 if(!s.citizens.some(c=>c.age>=16&&c.health>0&&c.calling==='priest'))return 'Вдохнови взрослого жителя жрецом';
 return '';
}

export function validateInannaDiscovery(s){
 const record=s.inannaDiscovery;
 return record===undefined||usesCatDiscovery(s)&&!!record&&Object.keys(record).length===3&&record.version===1&&
  typeof record.chased==='boolean'&&Array.isArray(record.days)&&record.days.length<=INANNA_GUARD_DAYS&&
  record.days.every((day,index)=>Number.isSafeInteger(day)&&day>=0&&day<=guardDay(s)&&(index===0||day>record.days[index-1]));
}
