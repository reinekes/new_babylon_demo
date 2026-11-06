import {appendFish,takeFish} from './fish-provenance.js';

export const addGiftFood=(holder,key,parts,before)=>appendFish(holder,key,parts,before,Infinity);
export const takeGiftFood=takeFish;
export const giftAmount=parts=>parts?.reduce((n,part)=>n+Math.max(0,part),0)||0;
export const giftInputFood=b=>b?.artisan?.food??b?.workshopStock?.input?.food??0;

export function moveGiftFood(from,fromKey,to,toKey,amount,before,targetBefore){
 if(!from[fromKey])return 0;
 const parts=takeGiftFood(from,fromKey,amount,before);
 addGiftFood(to,toKey,parts,targetBefore);
 return giftAmount(parts);
}

export function validateAbundanceOrigin(s){
 const valid=(parts,physical)=>parts===undefined||!!s.abundanceGift&&Array.isArray(parts)&&parts.length>0&&
  parts.at(-1)>0&&parts.every((n,i)=>Number.isFinite(n)&&n!==0&&(!i||Math.sign(n)!==Math.sign(parts[i-1])))&&
  parts.reduce((n,part)=>n+Math.abs(part),0)<=(physical||0)+1e-8;
 const reserve=(owner,physical)=>owner?.giftReserve===undefined||!!owner.giftReserve&&
  typeof owner.giftReserve==='object'&&!Array.isArray(owner.giftReserve)&&
  Object.keys(owner.giftReserve).length>0&&Object.entries(owner.giftReserve).every(([key,parts])=>valid(parts,physical?.[key]?.food));
 const guests=[s.externalGuest,...Object.values(s.externalVisits||{})];
 return reserve(s.festival,s.festival?.consumed?null:s.festival?.allocations)&&guests.every(g=>reserve(g,g?.provisions))&&
  (s.trade?.sales||[]).every(q=>reserve(q,q.sources))&&(s.trade?.deliveries||[]).every(q=>valid(q.giftFood,q.resource==='food'?q.remaining:0))&&
  valid(s.trade?.caravan?.giftFood,s.trade?.caravan?.stock?.food)&&s.buildings.every(b=>valid(b.giftStock,b.stock?.food)&&valid(b.giftHome,b.pantry)&&valid(b.giftInput,giftInputFood(b))&&valid(b.giftSeedStock,b.crop?.seedStock))&&
  s.citizens.every(c=>valid(c.giftCargo,c.cargo?.food)&&valid(c.giftPantry,c.pantryFood)&&valid(c.giftCraft,c.craftMaterial==='food'?c.craftAmount:0)&&valid(c.giftSeed,c.seedFood));
}
