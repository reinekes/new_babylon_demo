import {appendFish,takeFish} from './fish-provenance.js';

export const addGiftFood=(holder,key,parts,before)=>appendFish(holder,key,parts,before,Infinity);
export const takeGiftFood=takeFish;

export function moveGiftFood(from,fromKey,to,toKey,amount,before,targetBefore){
 if(from[fromKey])addGiftFood(to,toKey,takeGiftFood(from,fromKey,amount,before),targetBefore);
}

export function validateAbundanceOrigin(s){
 const valid=(parts,physical)=>parts===undefined||!!s.abundanceGift&&Array.isArray(parts)&&parts.length>0&&
  parts.at(-1)>0&&parts.every((n,i)=>Number.isFinite(n)&&n!==0&&(!i||Math.sign(n)!==Math.sign(parts[i-1])))&&
  parts.reduce((n,part)=>n+Math.abs(part),0)<=(physical||0)+1e-8;
 return s.buildings.every(b=>valid(b.giftStock,b.stock?.food)&&valid(b.giftHome,b.pantry))&&
  s.citizens.every(c=>valid(c.giftCargo,c.cargo?.food)&&valid(c.giftPantry,c.pantryFood));
}
