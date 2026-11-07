import {buildingKey,isOperational} from './definitions.js';
import {supplyHome} from './households.js';
import {usesCatDiscovery} from './scenario-profiles.js';
import {worldHeight,worldWidth} from './world.js';

export const DEPTH_HOMES_REQUIRED=3;
export const newDepthSupply=()=>({version:1,homes:[]});

export function recordDepthSupply(s,c,b,amount){
 const homes=s.depthSupply?.homes;
 if(!homes||homes.length>=DEPTH_HOMES_REQUIRED||b.type!=='house'||!isOperational(b)||!(amount>1e-8)||
  c.age<16||!['fisher','watercarrier'].includes(c.calling))return;
 const home=buildingKey(b);
 if(homes.some(row=>row.x===b.x&&row.y===b.y)||!s.citizens.some(c=>supplyHome(c,{arrived:true})===home))return;
 homes.push({x:b.x,y:b.y,carrier:c.id,at:s.simTime});
}

export function depthSearchReason(s){
 if(!s.depthSupply||s.relicQuest?.attempts>0)return '';
 if(!s.irrigatedHarvest)return 'Сначала открой «Небесный дождь»';
 return s.depthSupply.homes.length<DEPTH_HOMES_REQUIRED?'Рыбаки или водоносы должны снабдить три дома':'';
}

export function validateDepthSupply(s){
 const record=s.depthSupply;
 if(record===undefined)return true;
 if(!usesCatDiscovery(s)||!record||Object.keys(record).length!==2+Number(record.sceneSeen!==undefined)||record.version!==1||
  (record.sceneSeen!==undefined&&(record.sceneSeen!==true||s.relicQuest?.phase!=='completed'))||
  !Array.isArray(record.homes)||record.homes.length>DEPTH_HOMES_REQUIRED)return false;
 const seen=new Set();
 return record.homes.every((row,i)=>{
  if(!row||Object.keys(row).length!==4||!Number.isInteger(row.x)||row.x<0||row.x>=worldWidth(s)||
   !Number.isInteger(row.y)||row.y<0||row.y>=worldHeight(s)||
   !Number.isSafeInteger(row.carrier)||row.carrier<0||row.carrier>=s.demography.nextId||
   !Number.isFinite(row.at)||row.at<(record.homes[i-1]?.at??0)||row.at>s.simTime)return false;
  const key=buildingKey(row);
  if(seen.has(key))return false;
  seen.add(key);
  return true;
 });
}
