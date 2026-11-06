import {usesCatDiscovery} from './scenario-profiles.js';
import {buildingKey,isOperational} from './definitions.js';
import {signedRiverDistance,worldHeight,worldWidth} from './world.js';

const kinds=['artisan','envoy','pilgrim'];
const needed=2;
export const newArrivalHospitality=()=>({version:1,receipts:[]});

export function recordArrivalHospitality(s,kind,guest){
 const journal=s.arrivalHospitality;
 if(!journal||!kinds.includes(kind)||guest.phase!=='departed'||journal.receipts.some(r=>r.kind===kind))return;
 if(kind==='artisan'?guest.outcome!=='taught'||!guest.fed:guest.outcome!=='accepted')return;
 journal.receipts.push({kind,place:kind==='artisan'?guest.home:guest.destination,at:s.simTime});
}

const cell=(s,key)=>{
 const point=typeof key==='string'&&/^(\d+),(\d+)$/.exec(key);
 return point&&Number(point[1])<worldWidth(s)&&Number(point[2])<worldHeight(s)?[Number(point[1]),Number(point[2])]:null;
};
function differentBanks(s,from,to){
 const a=cell(s,from),b=cell(s,to);
 return a&&b&&signedRiverDistance(...a,s)*signedRiverDistance(...b,s)<0;
}

export function recordArrivalShelter(s,house,guest,served){
 const journal=s.arrivalHospitality;
 if(!journal||!(served>1e-9)||journal.shelters?.length>=needed||
  house.type!=='house'||!isOperational(house)||!guest.floodShelter||guest.routeIndex<guest.route.length)return;
 const host=buildingKey(house),origin=guest.home;
 if(guest.floodShelter!==host||!differentBanks(s,origin,host)||
  journal.shelters?.some(row=>row.host===host||row.origin===origin)||
  !s.citizens.some(c=>c.home===host&&!c.floodShelter&&['home','resting'].includes(c.phase)))return;
 (journal.shelters??=[]).push({host,origin,at:s.simTime});
}

export function arrivalHospitalityView(s){
 const journal=s.arrivalHospitality;
 if(!journal)return null;
 const visits=journal.receipts.length,shelters=journal.shelters?.length||0;
 return {visits,shelters,needed,qualified:visits>=needed||shelters>=needed};
}

export function validateArrivalHospitality(s){
 const journal=s.arrivalHospitality;
 if(journal===undefined)return true;
 if(!usesCatDiscovery(s)||!journal||Object.keys(journal).length!==2+Number(journal.shelters!==undefined)||journal.version!==1||
  !Array.isArray(journal.receipts)||journal.receipts.length>kinds.length)return false;
 const seen=new Set();
 let previous=0;
 for(const row of journal.receipts){
  if(!row||Object.keys(row).length!==3||!kinds.includes(row.kind)||seen.has(row.kind)||
   !Number.isFinite(row.at)||row.at<previous||row.at>s.simTime)return false;
  if(!cell(s,row.place))return false;
  previous=row.at;seen.add(row.kind);
 }
 const shelters=journal.shelters;
 if(shelters===undefined)return true;
 if(!Array.isArray(shelters)||!shelters.length||shelters.length>needed)return false;
 const hosts=new Set(),origins=new Set();
 previous=0;
 for(const row of shelters){
  if(!row||Object.keys(row).length!==3||!differentBanks(s,row.origin,row.host)||
   hosts.has(row.host)||origins.has(row.origin)||!Number.isFinite(row.at)||row.at<previous||row.at>s.simTime)return false;
  hosts.add(row.host);origins.add(row.origin);previous=row.at;
 }
 return true;
}
