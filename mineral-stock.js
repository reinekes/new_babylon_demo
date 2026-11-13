import {isStrictSumer} from './scenario-profiles.js';
import {depositAt,depositSiteAt,DEFAULT_STONE_CAPACITY} from './world.js';

export const CLAY_CAPACITY=480;
export const STONE_CAPACITY=DEFAULT_STONE_CAPACITY;
const minerals={clay:{capacity:CLAY_CAPACITY,ledger:'clayPits'},stone:{capacity:STONE_CAPACITY,ledger:'stonePits'}};
const pitKey=(x,y)=>`${x},${y}`;
export const mineralCapacity=(state,kind,x,y)=>depositSiteAt(state,x,y)?.capacity??minerals[kind]?.capacity;

export function mineralRemaining(state,kind,x,y){
 const mineral=minerals[kind];
 if(!mineral||!isStrictSumer(state))return Infinity;
 if(depositAt(state,x,y)!==kind)return 0;
 return state[mineral.ledger]?.[pitKey(x,y)]??mineralCapacity(state,kind,x,y);
}

export function takeMineral(state,kind,x,y,requested){
 if(!Number.isFinite(requested)||requested<=0)return 0;
 const remaining=mineralRemaining(state,kind,x,y);
 if(!Number.isFinite(remaining))return requested;
 const amount=Math.min(remaining,requested);
 if(amount>0){
  const {ledger}=minerals[kind];
  state[ledger]??={};
  state[ledger][pitKey(x,y)]=remaining-amount;
 }
 return amount;
}

export function validateMineralPits(state,kind){
 const {ledger}=minerals[kind],pits=state[ledger];
 if(pits===undefined)return true;
 if(!isStrictSumer(state)||!pits||typeof pits!=='object'||Array.isArray(pits))return false;
 return Object.entries(pits).every(([key,amount])=>{
  const match=/^(0|[1-9]\d*),(0|[1-9]\d*)$/.exec(key);
  return !!match&&depositAt(state,Number(match[1]),Number(match[2]))===kind&&
   Number.isFinite(amount)&&amount>=0&&amount<mineralCapacity(state,kind,Number(match[1]),Number(match[2]));
 });
}

export const clayRemaining=(state,x,y)=>mineralRemaining(state,'clay',x,y);
export const takeClay=(state,x,y,amount)=>takeMineral(state,'clay',x,y,amount);
export const validateClayPits=state=>validateMineralPits(state,'clay');
export const stoneRemaining=(state,x,y)=>mineralRemaining(state,'stone',x,y);
export const takeStone=(state,x,y,amount)=>takeMineral(state,'stone',x,y,amount);
