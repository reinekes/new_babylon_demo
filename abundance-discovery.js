import {giftAmount} from './abundance-origin.js';
import {buildingKey,isOperational} from './definitions.js';
import {seedTarget} from './food-planning.js';
import {stockStores} from './inventory.js';
import {usesCatDiscovery} from './scenario-profiles.js';
import {mealRation} from './wellbeing.js';
import {worldHeight,worldWidth} from './world.js';

const EPS=1e-8;
export const ABUNDANCE_HOMES=3;
export const newAbundanceDiscovery=()=>({version:1,homes:[]});

export function abundanceReserveReady(s){
 if(!s.foodPlan?.protectSeeds)return false;
 const gifts=stockStores(s).reduce((n,b)=>n+giftAmount(b.giftStock),0);
 const giftedSeeds=s.buildings.reduce((n,b)=>n+giftAmount(b.giftSeedStock),0)+
  s.citizens.reduce((n,c)=>n+giftAmount(c.giftSeed),0);
 return s.resources.food-gifts+EPS>=seedTarget(s)+giftedSeeds+s.citizens.reduce((n,c)=>n+mealRation(c),0);
}

export function abundanceKnowledgeReason(s){
 return s.abundanceDiscovery&&s.abundanceDiscovery.homes.length<ABUNDANCE_HOMES?
  'Нужны защищённые семена, запас на ужин и раздача обычной еды трём домам':'';
}

export function recordAbundanceHome(s,home,c,source,accepted,gift){
 const q=s.abundanceDiscovery;
 if(!q||q.homes.length>=ABUNDANCE_HOMES||accepted-gift<=EPS||home?.type!=='house'||!isOperational(home)||
  !source?.stock||source.stock.food+EPS<(source.stockMinimum?.food??(source.type==='depot'?12*(source.level||1):0)))return;
 const key=buildingKey(home);
 if(q.homes.includes(key)||!s.citizens.some(p=>p.home===key))return;
 const trained=['carrier','farmer'].includes(c.calling),sourceKey=buildingKey(source);
 const keeper=s.godhood?.believerIds?.includes(c.id)&&['granary','depot','shrine'].includes(source.type)&&
  (c.work===sourceKey||c.workplace===sourceKey);
 if(q.homes.length===ABUNDANCE_HOMES-1&&!trained&&!keeper||!abundanceReserveReady(s))return;
 q.homes.push(key);
}

export function validateAbundanceDiscovery(s){
 const q=s.abundanceDiscovery;
 if(q===undefined)return true;
 return !!s.abundanceGift&&usesCatDiscovery(s)&&q?.version===1&&Object.keys(q).length===2&&
  Array.isArray(q.homes)&&q.homes.length<=ABUNDANCE_HOMES&&new Set(q.homes).size===q.homes.length&&q.homes.every(key=>{
   const cell=typeof key==='string'&&/^(\d+),(\d+)$/.exec(key);
   return !!cell&&Number(cell[1])<worldWidth(s)&&Number(cell[2])<worldHeight(s);
  });
}
