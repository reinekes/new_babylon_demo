import {usesCatDiscovery} from './scenario-profiles.js';
import {worldHeight,worldWidth} from './world.js';

const kinds=['artisan','envoy','pilgrim'];
const needed=2;
export const newArrivalHospitality=()=>({version:1,receipts:[]});

export function recordArrivalHospitality(s,kind,guest){
 const journal=s.arrivalHospitality;
 if(!journal||!kinds.includes(kind)||guest.phase!=='departed'||journal.receipts.some(r=>r.kind===kind))return;
 if(kind==='artisan'?guest.outcome!=='taught'||!guest.fed:guest.outcome!=='accepted')return;
 journal.receipts.push({kind,place:kind==='artisan'?guest.home:guest.destination,at:s.simTime});
}

export function arrivalHospitalityView(s){
 const journal=s.arrivalHospitality;
 return journal?{visits:journal.receipts.length,needed,qualified:journal.receipts.length>=needed}:null;
}

export function validateArrivalHospitality(s){
 const journal=s.arrivalHospitality;
 if(journal===undefined)return true;
 if(!usesCatDiscovery(s)||!journal||Object.keys(journal).length!==2||journal.version!==1||
  !Array.isArray(journal.receipts)||journal.receipts.length>kinds.length)return false;
 const seen=new Set();
 let previous=0;
 for(const row of journal.receipts){
  if(!row||Object.keys(row).length!==3||!kinds.includes(row.kind)||seen.has(row.kind)||
   !Number.isFinite(row.at)||row.at<previous||row.at>s.simTime)return false;
  const point=typeof row.place==='string'&&/^(\d+),(\d+)$/.exec(row.place);
  if(!point||Number(point[1])>=worldWidth(s)||Number(point[2])>=worldHeight(s))return false;
  previous=row.at;seen.add(row.kind);
 }
 return true;
}
