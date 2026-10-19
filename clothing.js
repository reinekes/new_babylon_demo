import {weatherAt} from './environment.js';
export const CLOTHING_LIFE=540;
export const REPLACE_CLOTHING_AT=25;
export const clothingStatus=c=>c.clothing<=0?'Износилась':c.clothing<=25?'Ветхая · нужна замена':c.clothing<=50?'Поношенная':'Добротная';
export function initializeClothing(s){for(const c of s.citizens||[])c.clothing??=100;}
export function advanceClothing(s,dt){
 const exposed=s.season===3||weatherAt(s).type==='rain';
 for(const c of s.citizens){c.clothing=Math.max(0,(c.clothing??100)-dt*100/CLOTHING_LIFE);if(c.clothing>REPLACE_CLOTHING_AT)continue;const lack=1-c.clothing/REPLACE_CLOTHING_AT;c.mood=Math.max(0,c.mood-dt*.04*lack);c.health=Math.max(0,c.health-dt*(exposed?.035:.01)*lack);}
}
export function equipClothing(c){c.clothing=100;c.mood=Math.min(100,c.mood+4);}
export function validateClothing(s){
 const targets=new Set(),phases=['toClothesSupply','toClothesHome','blocked'];
 for(const c of s.citizens){if(s.buildings.some(b=>`${b.x},${b.y}`===c.work&&b.type==='tailor')&&c.role!=='tailor')return false;if(!Number.isFinite(c.clothing)||c.clothing<0||c.clothing>100)return false;
  if(c.clothingTarget===undefined){if(c.clothingLoad!==undefined||phases.slice(0,2).includes(c.phase))return false;continue;}
  const target=s.citizens.find(p=>p.id===c.clothingTarget);
  if(!Number.isSafeInteger(c.clothingTarget)||!target||target.home!==c.home||c.age<16||targets.has(c.clothingTarget)||![0,1].includes(c.clothingLoad)||!phases.includes(c.phase)||c.phase==='toClothesSupply'&&c.clothingLoad!==0||c.phase==='toClothesHome'&&c.clothingLoad!==1||c.craftSite||c.seedField||c.pantryTrip||c.districtJob||c.saleJob||c.tradeJob||c.school||c.clinic||Object.values(c.cargo||{}).some(n=>n>0)||Object.values(c.buildCargo||{}).some(n=>n>0))return false;
  targets.add(c.clothingTarget);
 }
 return true;
}
