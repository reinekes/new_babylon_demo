import {buildingKey,isOperational} from './definitions.js';
import {isStrictSumer} from './scenario-profiles.js';
import {cityCommandReason} from './city-command-lock.js';
import {foodAvailableAt,takeStock} from './inventory.js';
import {storeMinimum} from './district-logistics.js';
import {hourOf,mealCycle,COMMON_PORTION} from './wellbeing.js';

export const commonMealWindow=time=>hourOf(time)>=11&&hourOf(time)<16;
export const commonMealDay=time=>mealCycle(time)+1;
export const isMealDepot=b=>b?.type==='depot'&&isOperational(b)&&b.commonMeals===true;

export function setCommonMeals(s,key,enabled){
 const lock=cityCommandReason(s);
 if(lock||s.event||s.lost||s.funeral)return {ok:false,reason:lock||'Сначала заверши текущее событие'};
 const depot=s.buildings.find(b=>buildingKey(b)===key);
 if(!isStrictSumer(s)||depot?.type!=='depot'||!isOperational(depot)||typeof enabled!=='boolean')return {ok:false,reason:'Выбери готовый раздаточный двор'};
 if(enabled)depot.commonMeals=true;
 else delete depot.commonMeals;
 return {ok:true};
}

export function commonMealAvailable(s,b){
 return isMealDepot(b)&&b.stock?.food+1e-8>=storeMinimum(b,'food')+COMMON_PORTION&&foodAvailableAt(s,buildingKey(b))+1e-8>=COMMON_PORTION;
}

export function serveCommonMeal(s,c,b){
 const day=commonMealDay(s.simTime);
 if(!isStrictSumer(s)||c.age<16||!commonMealWindow(s.simTime)||c.commonMealDay===day||!commonMealAvailable(s,b))return false;
 if(takeStock(s,buildingKey(b),'food',COMMON_PORTION)!==COMMON_PORTION)return false;
 c.commonMealDay=day;
 c.hunger=Math.max(0,c.hunger-22.5);
 c.mood=Math.min(100,c.mood+3);
 for(const peer of s.citizens){
  if(peer.id===c.id||peer.phase!=='commonMeal'||peer.commonMealTarget!==buildingKey(b))continue;
  peer.mood=Math.min(100,peer.mood+2);
  c.mood=Math.min(100,c.mood+2);
  break;
 }
 return true;
}

export function validateCommonMeals(s){
 const strict=isStrictSumer(s);
 const depots=new Set(s.buildings.filter(b=>b.type==='depot'&&isOperational(b)).map(buildingKey));
 return s.buildings.every(b=>b.commonMeals===undefined||strict&&isMealDepot(b))&&s.citizens.every(c=>
  (c.commonMealDay===undefined||strict&&c.age>=16&&Number.isSafeInteger(c.commonMealDay)&&c.commonMealDay>=0&&c.commonMealDay<=commonMealDay(s.simTime))&&
  (c.commonMealTarget===undefined?!['toCommonMeal','commonMeal'].includes(c.phase)&&c.commonMealUntil===undefined:strict&&c.age>=16&&depots.has(c.commonMealTarget)&&['toCommonMeal','commonMeal','blocked'].includes(c.phase)&&
   (c.commonMealUntil===undefined?c.phase!=='commonMeal':Number.isFinite(c.commonMealUntil)&&c.commonMealUntil>=0&&c.commonMealUntil<=s.simTime+1.01)&&
   !c.districtJob&&!c.tradeJob&&!c.saleJob&&!c.waterTrip&&!c.pantryTrip&&!c.clinic&&!c.school&&!c.site&&!c.craftSite&&!c.seedField&&c.clothingTarget===undefined&&
   !Object.values(c.cargo||{}).some(n=>n>0)&&!Object.values(c.buildCargo||{}).some(n=>n>0)));
}
