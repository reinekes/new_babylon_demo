import {buildingKey,isOperational,levelOf,outputMultiplier} from './definitions.js';
export const WOOL_PER_CLOTH=3;
export const flockSize=b=>2+2*levelOf(b);
export const fleeceCapacity=b=>flockSize(b)*2;
export const weavingBatch=b=>WOOL_PER_CLOTH*outputMultiplier(b);
export const craftResource=b=>b?.type==='tailor'?'cloth':b?.type==='kiln'?'brick':b?.type==='brickyard'?'clay':'wool';
export const craftState=b=>b?.type==='tailor'?b.tailoring:b?.type==='kiln'?b.firing:b?.type==='brickyard'?b.brickmaking:b?.weaving;
export const craftLoad=c=>(c.craftWool||0)+(c.craftCloth||0)+(c.craftAmount||0);
export const craftBatch=b=>(b.type==='tailor'?2:3)*outputMultiplier(b);
export function makeClothing(s,b){if(b.type!=='tailor'||!isOperational(b)||!b.tailoring||b.tailoring.cloth+1e-8<craftBatch(b))return 0;b.tailoring.cloth=Math.max(0,b.tailoring.cloth-craftBatch(b));return outputMultiplier(b);}
export function initializeTextiles(s){for(const b of s.buildings){if(b.type==='sheepfold')b.flock??={fleece:4};if(b.type==='weaver')b.weaving??={wool:0};if(b.type==='tailor')b.tailoring??={cloth:0};}}
export function advanceTextiles(s,seconds){if(!Number.isFinite(seconds)||seconds<=0)return;for(const b of s.buildings)if(b.type==='sheepfold'&&isOperational(b)&&b.flock)b.flock.fleece=Math.min(fleeceCapacity(b),b.flock.fleece+seconds*fleeceCapacity(b)/180);}
export function gatherWool(s,b){if(b.type!=='sheepfold'||!isOperational(b)||!b.flock||b.flock.fleece<1-1e-8)return 0;const n=Math.min(2*outputMultiplier(b),b.flock.fleece);b.flock.fleece=Math.max(0,b.flock.fleece-n);return n;}
export function weaveCloth(s,b){if(b.type!=='weaver'||!isOperational(b)||!b.weaving||b.weaving.wool+1e-8<weavingBatch(b))return 0;b.weaving.wool=Math.max(0,b.weaving.wool-weavingBatch(b));return outputMultiplier(b);}
export function validateTextiles(s){
 const finite=(n,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=max+1e-7;
 for(const b of s.buildings){if(b.type==='sheepfold'){if(!b.flock||!finite(b.flock.fleece,fleeceCapacity(b)))return false;}else if(b.flock!==undefined)return false;if(b.type==='weaver'){if(!b.weaving||!finite(b.weaving.wool,9))return false;}else if(b.weaving!==undefined)return false;if(b.type==='tailor'){if(!b.tailoring||!finite(b.tailoring.cloth,6))return false;}else if(b.tailoring!==undefined)return false;}
 for(const c of s.citizens||[]){if(c.craftSite===undefined){if(c.craftMaterial!==undefined||c.craftAmount!==undefined||c.craftWool!==undefined||c.craftCloth!==undefined||c.phase==='toCraftSupply')return false;continue;}const b=s.buildings.find(b=>buildingKey(b)===c.craftSite);
  if(['brickyard','kiln'].includes(b?.type)){
   if(!isOperational(b)||c.work!==c.craftSite||!(b.type==='kiln'?['brick','reed']:['clay','reed']).includes(c.craftMaterial)||!finite(c.craftAmount,3)||c.craftCloth!==undefined||c.craftWool!==undefined||c.age<16||!['auto','production'].includes(c.role)||c.waterTrip||c.clothingTarget!==undefined||c.seedField||c.pantryTrip||c.districtJob||c.tradeJob||c.saleJob||c.clinic||c.school||c.site||Object.values(c.cargo||{}).some(n=>n>0)||Object.values(c.buildCargo||{}).some(n=>n>0)||!['toCraftSupply','toWork','blocked','toHome','home','resting'].includes(c.phase))return false;
   continue;
  }
  if(c.craftMaterial!==undefined||c.craftAmount!==undefined)return false;
  if(typeof c.craftSite!=='string'||!['weaver','tailor'].includes(b?.type)||!isOperational(b)||c.work!==c.craftSite||!finite(b.type==='tailor'?c.craftCloth:c.craftWool,3)||(b.type==='tailor'?c.craftWool!==undefined||c.role!=='tailor':c.craftCloth!==undefined)||c.age<16||c.clothingTarget!==undefined||c.seedField||c.pantryTrip||c.districtJob||c.tradeJob||c.saleJob||c.clinic||c.school||c.site||Object.values(c.cargo||{}).some(n=>n>0)||Object.values(c.buildCargo||{}).some(n=>n>0)||!['toCraftSupply','toWork','blocked','toHome','home','resting'].includes(c.phase))return false;}
 return true;
}
