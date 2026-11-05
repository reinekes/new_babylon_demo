import {isStrictSumer} from './scenario-profiles.js';
import {depositAt} from './world.js';

export const CLAY_CAPACITY=480;
const pitKey=(x,y)=>`${x},${y}`;

export function clayRemaining(state,x,y){
 if(!isStrictSumer(state))return Infinity;
 if(depositAt(state,x,y)!=='clay')return 0;
 return state.clayPits?.[pitKey(x,y)]??CLAY_CAPACITY;
}

export function takeClay(state,x,y,requested){
 if(!Number.isFinite(requested)||requested<=0)return 0;
 if(!isStrictSumer(state))return requested;
 const remaining=clayRemaining(state,x,y),amount=Math.min(remaining,requested);
 if(amount>0){
  state.clayPits??={};
  state.clayPits[pitKey(x,y)]=remaining-amount;
 }
 return amount;
}

export function validateClayPits(state){
 const pits=state.clayPits;
 if(pits===undefined)return true;
 if(!isStrictSumer(state)||!pits||typeof pits!=='object'||Array.isArray(pits))return false;
 return Object.entries(pits).every(([key,amount])=>{
  const match=/^(0|[1-9]\d*),(0|[1-9]\d*)$/.exec(key);
  return !!match&&depositAt(state,Number(match[1]),Number(match[2]))==='clay'&&
   Number.isFinite(amount)&&amount>=0&&amount<CLAY_CAPACITY;
 });
}
