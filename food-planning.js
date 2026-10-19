import {isOperational,outputMultiplier} from './definitions.js';
import {mealRation,mealCycle,isDinnerTime} from './wellbeing.js';
import {fieldWater} from './irrigation.js';
export const SEED_COST=4;
export function initializeFoodPlan(s){s.foodPlan??={protectSeeds:true};for(const b of s.buildings||[])if(b.type==='field'&&b.crop){b.crop.seedStock??=0;b.crop.seedUsed??=b.crop.sown*SEED_COST;b.crop.sheaves??=0;b.crop.threshed??=0;}}
export function seedTarget(s){
 let target=0;for(const b of s.buildings||[])if(b.type==='field'&&isOperational(b))target+=Math.max(0,SEED_COST-(b.crop?.seedStock||0)-(s.season===0?(b.crop?.sown||0)*SEED_COST:0));
 return Math.max(0,target-(s.citizens||[]).reduce((n,c)=>n+(c.seedFood||0),0));
}
export const seedReserve=s=>s.foodPlan?.protectSeeds===false?0:Math.min(s.resources.food,seedTarget(s));
export const availableFood=s=>Math.max(0,s.resources.food-seedReserve(s));
export function setSeedProtection(s,value){if(typeof value!=='boolean')return {ok:false,reason:'Неверное правило'};if(s.event||s.lost)return {ok:false,reason:'Сначала заверши событие'};initializeFoodPlan(s);s.foodPlan.protectSeeds=value;s.news.unshift({title:value?'Семена защищены':'Семенной резерв открыт',text:value?'Часть складской еды снова сохраняется для посева.':'Семена разрешено съесть или продать. Следующему посеву может не хватить зерна.',kind:value?'good':'bad',year:s.year,season:s.season,tick:s.tick});s.news=s.news.slice(0,80);return {ok:true};}
export function foodForecast(s){
 const time=s.simTime||0;let harvestAt=Math.floor(time/180)*180+90;if(harvestAt<=time+1e-7)harvestAt+=180;const secondsToHarvest=harvestAt-time;
 const daily=s.citizens.reduce((n,c)=>n+mealRation(c),0);let meals=0;for(let at=30+Math.floor((time-30)/60+1)*60;at<=harvestAt+1e-7;at+=60)meals++;
 const outstanding=isDinnerTime(time)?s.citizens.reduce((n,c)=>n+Math.max(0,mealRation(c)-(c.mealDay===mealCycle(time)?c.mealEaten:0)),0):0;
 const homes=s.buildings.reduce((n,b)=>n+(b.pantry||0),0),inTransit=s.citizens.reduce((n,c)=>n+(c.pantryFood||0)+(!c.saleJob?(c.cargo?.food||0):0),0),reserve=seedReserve(s),ready=availableFood(s)+homes+inTransit;
 let unthreshed=0,standing=0,cropPotential=0,seedAtFields=0;for(const b of s.buildings){if(b.type!=='field'||!isOperational(b))continue;const c=b.crop||{},water=fieldWater(s,b);unthreshed+=c.sheaves||0;standing+=c.remaining||0;seedAtFields+=c.seedStock||0;
  if(s.season<2){const wet=water.canal||s.rain>0||c.legacyYear===s.year&&water.natural,growth=s.season===0?(wet?1:0):Math.min(1,(c.growth||0)+(wet?(45-s.seasonElapsed)/45:0));cropPotential+=84*outputMultiplier(b)*(c.sown||0)*growth*(s.buffs?.fertility?1.6:1);}
 }
 const sites=s.pests?.sites||[],rate=sites.length?.036:0,pestRisk=Math.min(s.resources.food,rate*secondsToHarvest),demand=daily*meals+outstanding;
 return {ready,reserve,target:seedTarget(s),homes,inTransit,seedAtFields,unthreshed,standing,cropPotential,secondsToHarvest,meals,demand,pestRisk,balance:ready-demand-pestRisk,protected:s.foodPlan?.protectSeeds!==false};
}
export function validateFoodPlan(s){return !!s.foodPlan&&typeof s.foodPlan.protectSeeds==='boolean';}
