import {isOperational,outputMultiplier} from './definitions.js';
import {mealRation,mealCycle,isDinnerTime,hourOf} from './wellbeing.js';
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
export function foodForecast(s,{includeCrops=true}={}){
 const time=s.simTime||0;let harvestAt=Math.floor(time/180)*180+90;if(harvestAt<=time+1e-7)harvestAt+=180;const secondsToHarvest=harvestAt-time;
 const daily=s.citizens.reduce((n,c)=>n+mealRation(c),0);let meals=0;for(let at=30+Math.floor((time-30)/60+1)*60;at<=harvestAt+1e-7;at+=60)meals++;
 const outstanding=isDinnerTime(time)?s.citizens.reduce((n,c)=>n+Math.max(0,mealRation(c)-(c.mealDay===mealCycle(time)?c.mealEaten:0)),0):0;
 const homes=s.buildings.reduce((n,b)=>n+(b.pantry||0),0),inTransit=s.citizens.reduce((n,c)=>n+(c.pantryFood||0)+(!c.saleJob?(c.cargo?.food||0):0),0),reserve=seedReserve(s),ready=availableFood(s)+homes+inTransit;
 let unthreshed=0,standing=0,cropPotential=0,seedAtFields=0;for(const b of s.buildings){if(b.type!=='field'||!isOperational(b))continue;const c=b.crop||{},water=includeCrops?fieldWater(s,b):null;unthreshed+=c.sheaves||0;standing+=c.remaining||0;seedAtFields+=c.seedStock||0;
  if(includeCrops&&s.season<2){const wet=water.canal||s.rain>0||c.legacyYear===s.year&&water.natural,growth=s.season===0?(wet?1:0):Math.min(1,(c.growth||0)+(wet?(45-s.seasonElapsed)/45:0));cropPotential+=84*outputMultiplier(b)*(c.sown||0)*growth*(s.buffs?.fertility?1.6:1);}
 }
 const sites=s.pests?.sites||[],rate=sites.length?.036:0,pestRisk=Math.min(s.resources.food,rate*secondsToHarvest),demand=daily*meals+outstanding;
 return {ready,reserve,target:seedTarget(s),homes,inTransit,seedAtFields,unthreshed,standing,cropPotential,secondsToHarvest,meals,demand,pestRisk,balance:ready-demand-pestRisk,protected:s.foodPlan?.protectSeeds!==false};
}
export function validateFoodPlan(s){return !!s.foodPlan&&typeof s.foodPlan.protectSeeds==='boolean';}

// Read-only diagnostics: no news, save fields, route searches or simulation mutations.
export function foodWarnings(s,forecast=foodForecast(s,{includeCrops:false})){
 const night=isDinnerTime(s.simTime),day=mealCycle(s.simTime),nearDinner=hourOf(s.simTime)>=16||night,byHome=new Map(),byTarget=new Map(),noFood=availableFood(s)<=1e-7;
 for(const c of s.citizens){if(c.pantryTrip){const key=c.pantryTarget||c.home;if(!byTarget.has(key))byTarget.set(key,[]);byTarget.get(key).push(c);}if(!byHome.has(c.home))byHome.set(c.home,[]);byHome.get(c.home).push(c);}
 const houses=[];
 for(const b of s.buildings){if(b.type!=='house'||!isOperational(b))continue;const key=`${b.x},${b.y}`,residents=byHome.get(key)||[],couriers=byTarget.get(key)||[];if(!residents.length)continue;
  const hungryResidents=residents.filter(c=>(c.hunger||0)>=30||((c.missedMeals||0)>0&&(c.lastMealQuality??1)<.95&&!(night&&c.mealDay===day&&c.mealEaten>=mealRation(c)*.95)));
  const need=residents.reduce((n,c)=>n+(night?Math.max(0,mealRation(c)-(c.mealDay===day?c.mealEaten:0)):mealRation(c)),0),food=b.pantry||0,inTransit=couriers.reduce((n,c)=>n+(c.pantryFood||0),0),deliverable=couriers.reduce((n,c)=>n+(c.phase!=='blocked'?c.pantryFood||0:0),0),blockedDelivery=couriers.some(c=>c.phase==='blocked'),shortfall=Math.max(0,need-food-deliverable),atRisk=shortfall>1e-7&&(nearDinner||noFood);
  houses.push({key,x:b.x,y:b.y,residents,hungryResidents,hungry:hungryResidents.length,hungryChildren:hungryResidents.filter(c=>c.age<16).length,severe:hungryResidents.some(c=>(c.hunger||0)>=70),need,food,inTransit,shortfall,atRisk,blockedDelivery,awaitingDelivery:need>food+1e-7&&deliverable>0});
 }
 houses.sort((a,b)=>Number(b.severe)-Number(a.severe)||b.hungry-a.hungry||Number(b.atRisk)-Number(a.atRisk)||b.shortfall-a.shortfall||a.y-b.y||a.x-b.x);
 const hungry=houses.reduce((n,h)=>n+h.hungry,0),riskFamilies=houses.filter(h=>h.hungry||h.atRisk),target=forecast.target,seeds={target,protected:forecast.protected,missing:Math.max(0,target-Math.min(s.resources.food,target)),unprotected:target>1e-7&&!forecast.protected},alerts=[];
 if(!s.lost&&s.citizens.length){
  if(forecast.balance < -1e-7)alerts.push({id:'food',severity:forecast.ready<Math.min(forecast.demand,s.citizens.reduce((n,c)=>n+mealRation(c),0))-1e-7?'danger':'warning',title:'Риск голода до жатвы',text:`По прогнозу недостаёт ${Math.ceil(-forecast.balance)} еды. ${forecast.unthreshed>0?'Обмолоти снопы и доставь еду на склад.':'Нужны новые поставки еды: промыслы или торговля.'}`});
  if(seeds.missing>1e-7||seeds.unprotected)alerts.push({id:'seeds',severity:seeds.missing>1e-7&&s.season===0?'danger':'warning',title:seeds.missing>1e-7?'Не хватает семян':'Семена не защищены',text:seeds.missing>1e-7?`Для посева не хватает ${Math.ceil(seeds.missing*10)/10} еды на семена. Пополни общий запас.`:'Резерв открыт для еды и продажи. Защити семена перед следующим посевом.'});
  if(riskFamilies.length)alerts.push({id:'families',severity:houses.some(h=>h.severe)?'danger':'warning',title:hungry?`Недоедают жители: ${hungry}`:`Без ужина рискуют остаться семьи: ${riskFamilies.length}`,text:hungry?`Семей с недоеданием: ${houses.filter(h=>h.hungry).length}. Проверь домашнюю еду и доставку.`:'Домашней еды и груза в пути недостаточно. Проверь путь к складу и взрослых поставщиков.'});
 }
 return {forecast,seeds,houses,hungry,riskFamilies,alerts};
}
