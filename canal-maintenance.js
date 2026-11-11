import {isOperational} from './definitions.js';
import {isStrictSumer} from './scenario-profiles.js';

export const canalMaintenanceEnabled=isStrictSumer;
export const canalShares=b=>b.silt>=.95?0:b.silt>=.75?1:b.silt>=.5?2:3;
export const nextCanalSilt=b=>Math.min(1,((b.silt||0)*100+12)/100);
export const needsCanalCleaning=b=>b?.type==='canal'&&isOperational(b)&&b.canalCleaning===true&&(b.silt||0)>0;

export function depositCanalSilt(state,wet){
 if(!canalMaintenanceEnabled(state))return;
 for(const [key,canal] of wet.cells)if(wet.wet.has(key)||wet.outlets?.has(key)){
  canal.silt=nextCanalSilt(canal);
 }
}

export function clearCanalSilt(canal,work){
 canal.silt=Math.max(0,(canal.silt||0)-work/28);
 if(canal.silt>1e-8)return false;
 delete canal.silt;
 delete canal.canalCleaning;
 return true;
}

export function validateCanalMaintenance(state){
 let preferred=false;
 return state.buildings.every(b=>{
  if(b.waterPriority!==undefined){
   if(preferred||b.waterPriority!==true||!canalMaintenanceEnabled(state)||b.type!=='field'||!isOperational(b))return false;
   preferred=true;
  }
  if(b.drain!==undefined&&(!canalMaintenanceEnabled(state)||b.type!=='canal'||!isOperational(b)||b.drain!==true))return false;
  if(b.silt===undefined&&b.canalCleaning===undefined)return true;
  return canalMaintenanceEnabled(state)&&b.type==='canal'&&isOperational(b)
   &&Number.isFinite(b.silt)&&b.silt>=0&&b.silt<=1
   &&(b.canalCleaning===undefined||b.canalCleaning===true&&b.silt>0);
 });
}
