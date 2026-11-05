import {DAY_SECONDS} from './city-life.js';
import {isStrictSumer} from './scenario-profiles.js';
import {depositAt} from './world.js';

export const FOREST_CAPACITY=96;
export const FOREST_RECOVERY=24;
const REST_SECONDS=DAY_SECONDS*3;

export function forestFor(state,x,y){
 let closest=null,distance=Infinity;
 for(const site of state.world?.deposits||[]){
  if(site.kind!=='forest')continue;
  const gap=(site.x-x)**2+(site.y-y)**2;
  if(gap>4||gap>=distance)continue;
  closest=`${site.x},${site.y}`;distance=gap;
 }
 return closest;
}

function validForest(state,key){
 const m=/^(0|[1-9]\d*),(0|[1-9]\d*)$/.exec(key);
 return !!m&&depositAt(state,Number(m[1]),Number(m[2]))==='forest';
}

export function forestStock(state,key){
 const entry=state.forests?.[key];
 if(!entry)return {stock:FOREST_CAPACITY,resting:false,seconds:0};
 const seconds=Math.max(0,(entry.restUntil||0)-state.simTime);
 return {stock:entry.restUntil&&seconds===0?Math.min(FOREST_CAPACITY,entry.stock+FOREST_RECOVERY):entry.stock,resting:seconds>0,seconds};
}

export function takeWood(state,key,requested){
 if(!Number.isFinite(requested)||requested<=0)return 0;
 if(!isStrictSumer(state))return requested;
 if(!validForest(state,key))return 0;
 const {stock,resting}=forestStock(state,key),amount=resting?0:Math.min(stock,requested);
 if(amount>0){
  state.forests??={};
  state.forests[key]={stock:stock-amount};
 }
 return amount;
}

export function restForest(state,key){
 if(!isStrictSumer(state)||!validForest(state,key))return false;
 const {stock,resting}=forestStock(state,key);
 if(resting||stock>=FOREST_CAPACITY)return false;
 state.forests[key]={stock,restUntil:state.simTime+REST_SECONDS};
 return true;
}

export function forestOpen(state,building){
 if(!isStrictSumer(state))return true;
 const key=forestFor(state,building.x,building.y);
 if(!key)return false;
 const {stock,resting}=forestStock(state,key);
 return !resting&&stock>1e-8;
}

export function validateForests(state){
 const forests=state.forests;
 if(forests===undefined)return true;
 return isStrictSumer(state)&&!!forests&&typeof forests==='object'&&!Array.isArray(forests)&&
  Object.entries(forests).every(([key,entry])=>validForest(state,key)&&entry&&Number.isFinite(entry.stock)&&entry.stock>=0&&entry.stock<FOREST_CAPACITY&&
   (entry.restUntil===undefined||Number.isFinite(entry.restUntil)&&entry.restUntil>0&&entry.restUntil<=state.simTime+REST_SECONDS+1e-7));
}
