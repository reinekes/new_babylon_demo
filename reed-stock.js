import {DAY_SECONDS} from './city-life.js';
import {isStrictSumer} from './scenario-profiles.js';
import {depositAt} from './world.js';
import {CARDINAL,irrigationFor} from './irrigation.js';

export const REED_CAPACITY=120;
export const REED_RECOVERY=24;
const REST_SECONDS=DAY_SECONDS*2;
const siteKey=(x,y)=>`${x},${y}`;
const drainedBy=(network,x,y)=>CARDINAL.some(([dx,dy])=>network.outlets.has(siteKey(x+dx,y+dy)));

export function reedStatus(state,x,y){
 if(!isStrictSumer(state))return {stock:Infinity,resting:false,seconds:0,drained:false};
 const entry=state.reedBeds?.[siteKey(x,y)];
 const seconds=Math.max(0,(entry?.restUntil||0)-state.simTime);
 return {stock:entry?.stock??REED_CAPACITY,resting:seconds>0,seconds,drained:drainedBy(irrigationFor(state),x,y)};
}

export function takeReeds(state,x,y,requested){
 if(!Number.isFinite(requested)||requested<=0)return 0;
 if(!isStrictSumer(state))return requested;
 if(depositAt(state,x,y)!=='reed')return 0;
 const key=siteKey(x,y),entry=state.reedBeds?.[key];
 if(entry?.restUntil!==undefined)return 0;
 const remaining=entry?.stock??REED_CAPACITY,amount=Math.min(remaining,requested);
 if(amount>0){
  state.reedBeds??={};
  state.reedBeds[key]={stock:remaining-amount};
 }
 return amount;
}

export function restReeds(state,x,y){
 if(!isStrictSumer(state)||depositAt(state,x,y)!=='reed')return false;
 advanceReedBeds(state);
 const {stock,resting,drained}=reedStatus(state,x,y);
 if(resting||drained||stock>=REED_CAPACITY)return false;
 state.reedBeds[siteKey(x,y)]={stock,restUntil:state.simTime+REST_SECONDS};
 return true;
}

export function advanceReedBeds(state){
 if(!state.reedBeds)return;
 let network;
 for(const [key,entry] of Object.entries(state.reedBeds)){
  if(entry.restUntil===undefined)continue;
  network??=irrigationFor(state);
  const [x,y]=key.split(',').map(Number);
  const drained=drainedBy(network,x,y);
  if(!drained&&state.simTime+1e-8<entry.restUntil)continue;
  if(!drained)entry.stock=Math.min(REED_CAPACITY,entry.stock+REED_RECOVERY);
  delete entry.restUntil;
  if(entry.stock===REED_CAPACITY)delete state.reedBeds[key];
 }
}

export function validateReedBeds(state){
 const records=state.reedBeds;
 if(records===undefined)return true;
 if(!isStrictSumer(state)||!records||typeof records!=='object'||Array.isArray(records))return false;
 return Object.entries(records).every(([key,entry])=>{
  const m=/^(0|[1-9]\d*),(0|[1-9]\d*)$/.exec(key);
  return !!m&&depositAt(state,Number(m[1]),Number(m[2]))==='reed'&&entry&&Number.isFinite(entry.stock)&&entry.stock>=0&&entry.stock<REED_CAPACITY&&
   (entry.restUntil===undefined||Number.isFinite(entry.restUntil)&&entry.restUntil>0&&entry.restUntil<=state.simTime+REST_SECONDS+1e-7);
 });
}
