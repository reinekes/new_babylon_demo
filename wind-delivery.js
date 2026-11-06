import {usesCatDiscovery} from './scenario-profiles.js';

export const WIND_DELIVERY_GOAL=60;
export const WIND_DESTINATION_GOAL=2;
export const newWindDelivery=()=>({version:1,amount:0,destinations:[]});
const EPS=1e-8;
const coordinate=value=>typeof value==='string'&&/^\d+,\d+$/.test(value);

export function markWindCargo(s,c,amount){
 if(s.windDelivery&&c.calling==='carrier'&&amount>EPS)c.windCargo=amount;
}

export function recordWindDelivery(s,c,job,accepted){
 if(!s.windDelivery||!job||!(accepted>EPS)||!(c.windCargo>EPS))return;
 const delivered=Math.min(accepted,c.windCargo);
 c.windCargo-=delivered;
 if(c.windCargo<=EPS)delete c.windCargo;
 if(c.calling!=='carrier')return;
 const q=s.windDelivery;
 q.amount=Math.min(WIND_DELIVERY_GOAL,q.amount+delivered);
 if(q.destinations.length<WIND_DESTINATION_GOAL&&!q.destinations.includes(job.target))q.destinations.push(job.target);
}

export function validateWindDelivery(s){
 const q=s.windDelivery;
 if(q!==undefined&&(!usesCatDiscovery(s)||!q||q.version!==1||Object.keys(q).length!==3||
  !Number.isFinite(q.amount)||q.amount<0||q.amount>WIND_DELIVERY_GOAL||
  !Array.isArray(q.destinations)||q.destinations.length>WIND_DESTINATION_GOAL||
  new Set(q.destinations).size!==q.destinations.length||!q.destinations.every(coordinate)||
  (q.amount===0)!==(q.destinations.length===0)))return false;
 const jobs=new Map();
 for(const c of s.citizens){
  if(c.windCargo===undefined)continue;
  if(!q||!Number.isFinite(c.windCargo)||c.windCargo<=EPS||c.windCargo>12+EPS||c.tradeJob||c.saleJob)return false;
  if(!jobs.size)for(const job of s.district?.jobs||[])jobs.set(job.id,job);
  const job=jobs.get(c.districtJob);
  if(!job||job.targetKind==='votive'||c.store!==job.target||c.windCargo>(c.cargo?.[job.resource]||0)+EPS)return false;
 }
 return true;
}
