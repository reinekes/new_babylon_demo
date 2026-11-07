import {buildingKey,isOperational} from './definitions.js';
import {stockStores,syncInventory,takeStock} from './inventory.js';
import {isStrictSumer} from './scenario-profiles.js';
// The al-Ubaid dairy frieze supports the activity; quantities are game balance.
export const dairyRecipe=Object.freeze({reed:1,water:4});
export const dairySpec=()=>({recipe:dairyRecipe,duration:8,output:{milk:3},inputCapacity:12,outputCapacity:24});
const n=v=>Number.isFinite(v)?Math.max(0,v):0;
export function initializeDairy(s){for(const b of s.buildings||[])if(b.type==='cowshed'){b.dairy??={reed:0,water:0,elapsed:0,cows:3,calves:2};}}
export function startManagedDairy(b){
 b.dairy={reed:0,water:0,elapsed:0,cows:3,calves:2,shortage:0,pasture:0};
}
export const dairyRation=b=>b.dairy?.shortage===undefined?0:Math.ceil((b.dairy.cows+b.dairy.calves)/2);
export const dairyRate=b=>b.dairy?.shortage===undefined?1:b.dairy.shortage?0:Math.min(1,b.dairy.cows/3);
export const dairyInputCapacity=b=>({reed:b.dairy?.shortage===undefined?3:9,water:12});
export function dairyNeeds(b){
 const ration=dairyRation(b),d=b.dairy;
 if(d?.shortage!==undefined&&d.cows+d.calves===0)return {reed:0,water:0};
 return {reed:Math.max(0,ration+3-n(d?.reed)),water:Math.max(0,12-n(d?.water))};
}
export function settleManagedDairy(s,pasture){
 for(const b of s.buildings){
  const d=b.dairy;
  if(b.type!=='cowshed'||!isOperational(b)||d?.shortage===undefined)continue;
  const water=dairyRation(b),reed=Math.max(0,water-(pasture.get(b)||0));
  d.pasture=pasture.get(b)||0;
  const fed=d.reed+1e-7>=reed&&d.water+1e-7>=water;
  d.reed=Math.max(0,d.reed-reed);d.water=Math.max(0,d.water-water);
  if(fed){
   d.shortage=0;d.cows+=d.calves;d.calves=0;
   if(s.season===0&&d.cows>=2&&d.cows<12)d.calves=1;
  }else{
   if(d.shortage){if(d.calves)d.calves--;else if(d.cows)d.cows--;}
   d.shortage=1;
  }
 }
}
// One batch per call lets the caller reserve real output room before any input is spent.
export function workDairy(b,seconds){
 const d=b.dairy;if(!d||!Number.isFinite(seconds)||seconds<=0||d.cows<1||!dairyRate(b)||d.reed<1+dairyRation(b)||d.water<4+dairyRation(b))return 0;
 d.elapsed=Math.min(8,n(d.elapsed)+seconds*dairyRate(b));if(d.elapsed<8-1e-7)return 0;
 d.reed-=1;d.water-=4;d.elapsed=0;return 3;
}
export function validateDairy(s){return (s.buildings||[]).every(b=>b.type==='cowshed'?!!b.dairy&&Object.keys(b.dairy).every(k=>['reed','water','elapsed','cows','calves','shortage','pasture'].includes(k))&&['reed','water','elapsed','cows','calves'].every(k=>Number.isFinite(b.dairy[k])&&b.dairy[k]>=0)&&b.dairy.reed<=12&&b.dairy.water<=12&&b.dairy.elapsed<=8&&Number.isInteger(b.dairy.cows)&&b.dairy.cows<=12&&Number.isInteger(b.dairy.calves)&&b.dairy.calves<=12&&b.dairy.cows+b.dairy.calves<=12&&(b.dairy.shortage===undefined?b.dairy.pasture===undefined:isStrictSumer(s)&&isOperational(b)&&[0,1].includes(b.dairy.shortage)&&[0,1].includes(b.dairy.pasture)):b.dairy===undefined);}

// Paid trade reservations and goods already being carried are outside stored milk.
export const MILK_SEASON_LOSS=.25;
export function settleMilkSpoilage(s){
 if(!isStrictSumer(s))return 0;
 let loss=0;
 if(s.resources.milk>0||s.buildings.some(b=>b.stock?.milk>0)){
  syncInventory(s);
  for(const b of stockStores(s))if(b.stock.milk>0)loss+=takeStock(s,buildingKey(b),'milk',b.stock.milk*MILK_SEASON_LOSS);
 }
 for(const b of s.buildings){
  for(const stock of [b.householdStock,b.workshopStock?.output,b.type==='dairyStore'?b.artisan:null]){
   if(!(stock?.milk>0))continue;
   const spoiled=stock.milk*MILK_SEASON_LOSS;
   stock.milk-=spoiled;loss+=spoiled;
  }
 }
 return loss;
}
