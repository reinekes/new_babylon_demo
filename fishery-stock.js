import {DAY_SECONDS} from './city-life.js';
import {isStrictSumer} from './scenario-profiles.js';
import {riverLength,riverLocal} from './world.js';

const CAPACITY=48;
const RECOVERY=18;
const REACH_LENGTH=4;

export function fisheryKey(state,point){
 const x=Math.round(point.x),y=Math.round(point.y);
 const lake=state.world?.lakes?.find(l=>l.cells.some(c=>c.x===x&&c.y===y));
 return lake?`lake:${lake.id}`:`river:${Math.floor(riverLocal(x,y,state).along/REACH_LENGTH)}`;
}

function validKey(state,key){
 const reach=/^river:(0|[1-9]\d*)$/.exec(key);
 return reach?Number(reach[1])*REACH_LENGTH<riverLength(state):
  !!state.world?.lakes?.some(l=>key===`lake:${l.id}`);
}

export function fisheryStock(state,key){
 const entry=state.fisheries?.[key];
 if(!entry)return {stock:CAPACITY,resting:false,seconds:0};
 const seconds=Math.max(0,(entry.restUntil||0)-state.simTime);
 const stock=entry.restUntil&&seconds===0?Math.min(CAPACITY,entry.stock+RECOVERY):entry.stock;
 return {stock,resting:seconds>0,seconds};
}

export function takeFish(state,key,requested){
 if(!Number.isFinite(requested)||requested<=0)return 0;
 if(!isStrictSumer(state))return requested;
 if(!validKey(state,key))return 0;
 const {stock,resting}=fisheryStock(state,key);
 if(resting||stock<=0)return 0;
 const amount=Math.min(requested,stock);
 state.fisheries??={};
 state.fisheries[key]={stock:stock-amount};
 return amount;
}

export function restFishery(state,key){
 if(!isStrictSumer(state)||!validKey(state,key))return false;
 const {stock,resting}=fisheryStock(state,key);
 if(resting||stock>=CAPACITY)return false;
 state.fisheries[key]={stock,restUntil:state.simTime+DAY_SECONDS};
 return true;
}

export function validateFisheries(state){
 const records=state.fisheries;
 if(records===undefined)return true;
 return isStrictSumer(state)&&!!records&&typeof records==='object'&&!Array.isArray(records)&&
  Object.entries(records).every(([key,entry])=>validKey(state,key)&&entry&&Number.isFinite(entry.stock)&&entry.stock>=0&&entry.stock<CAPACITY&&
   (entry.restUntil===undefined||Number.isFinite(entry.restUntil)&&entry.restUntil>0&&entry.restUntil<=state.simTime+DAY_SECONDS+1e-7));
}
