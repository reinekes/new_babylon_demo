import {SEED_COST} from './food-planning.js';
import {isOperational,outputMultiplier} from './definitions.js';
import {fieldWater} from './irrigation.js';
const empty=year=>({year,sown:0,growth:0,remaining:0,total:0,harvested:0,spoiled:0,seedStock:0,seedUsed:0,sheaves:0,threshed:0});
export function cropFor(s,b){const c=b.crop??=empty(s.year);c.seedStock??=0;c.seedUsed??=c.sown*SEED_COST;c.sheaves??=0;c.threshed??=0;return c;}
export function initializeCrops(s,{legacy=false}={}){
 for(const b of s.buildings.filter(b=>b.type==='field')){if(b.crop)continue;const c=cropFor(s,b);if(legacy&&isOperational(b)&&s.season>0){c.sown=1;c.growth=s.season===1?s.seasonElapsed/45:1;c.legacyYear=s.year;if(s.season===2)c.total=c.remaining=84*outputMultiplier(b);}c.seedUsed=c.sown*SEED_COST;}
}
export function fieldActive(s,b){const c=cropFor(s,b);return isOperational(b)&&(s.season===0&&c.sown<1-1e-8||s.season===2&&c.remaining>1e-8||c.sheaves>1e-8);}
export function workField(s,b,seconds){
 const c=cropFor(s,b);if(!isOperational(b)||seconds<=0)return 0;
 if(c.sheaves>1e-8){const amount=Math.min(c.sheaves,7*outputMultiplier(b));c.sheaves=Math.max(0,c.sheaves-amount);c.threshed+=amount;return amount;}
 if(s.season===0){const delta=Math.max(0,Math.min(1-c.sown,seconds/12,c.seedStock/SEED_COST));c.sown+=delta;if(c.sown>=1-1e-8)c.sown=1;c.seedStock=Math.max(0,c.seedStock-delta*SEED_COST);c.seedUsed=c.sown*SEED_COST;return 0;}
 if(s.season!==2||c.remaining<=0)return 0;
 const amount=Math.min(c.remaining,7*outputMultiplier(b));c.remaining=Math.max(0,c.remaining-amount);c.harvested+=amount;c.sheaves+=amount;return 0;
}
export function advanceCrops(s,dt){
 if(s.season!==1)return;const water=s.buildings.some(b=>b.type==='canal'&&isOperational(b));
 for(const b of s.buildings){if(b.type!=='field'||!isOperational(b))continue;const c=cropFor(s,b);if(c.sown<=0)continue;
  if(s.rain>0||water&&fieldWater(s,b).canal||c.legacyYear===s.year&&fieldWater(s,b).natural)c.growth=Math.min(1,c.growth+dt/45);
 }
}
export function changeCropSeason(s,previous){
 let lost=0,ready=0;for(const b of s.buildings){if(b.type!=='field')continue;const c=cropFor(s,b);
  if(s.season===0){b.crop={...empty(s.year),seedStock:c.seedStock,sheaves:c.sheaves,threshed:c.threshed};continue;}
  if(previous===1){c.total=c.remaining=84*outputMultiplier(b)*c.sown*c.growth*(s.buffs?.fertility?1.6:1);c.harvested=0;ready+=c.remaining;}
  if(previous===2){c.spoiled+=c.remaining;lost+=c.remaining;c.remaining=0;}
 }
 if(ready||lost){s.news.unshift({title:lost?'Несобранный ячмень испортился':'Ячмень созрел',text:lost?`На полях потеряно ${Math.round(lost)} еды. Закрепи работников для осеннего сбора.`:`На полях до ${Math.round(ready)} еды. Нужны работники и доставка до зимы.`,kind:lost?'bad':'good',year:s.year,season:s.season,tick:s.tick});s.news=s.news.slice(0,80);}
}
export function cropSummary(s,b){const c=cropFor(s,b);return s.season===0?`Посев ${Math.round(c.sown*100)}% · семена на поле ${c.seedStock.toFixed(1)} · использовано ${c.seedUsed.toFixed(1)}/4`:s.season===1?`Засеяно ${Math.round(c.sown*100)}% · рост ${Math.round(c.growth*100)}% · ${fieldWater(s,b).canal||s.rain>0?'вода есть':c.legacyYear===s.year&&fieldWater(s,b).natural?'переходный полив старого поля':'нужен наполненный канал'}`:s.season===2?`В поле ${c.remaining.toFixed(1)} · снопы на току ${c.sheaves.toFixed(1)} · обмолочено ${c.threshed.toFixed(1)} еды`:`Обмолот: ${c.sheaves.toFixed(1)} снопов · испортилось в поле ${c.spoiled.toFixed(1)}`;
}
export function validateCrops(s){return s.buildings.every(b=>{if(b.type!=='field')return b.crop===undefined;const c=b.crop;if(!c)return true;const finite=(n,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=max;return Number.isInteger(c.year)&&c.year===s.year&&finite(c.sown,1)&&finite(c.growth,1)&&['remaining','total','harvested','spoiled'].every(k=>finite(c[k],1e6))&&Math.abs(c.total-c.remaining-c.harvested-c.spoiled)<1e-6&&['seedStock','seedUsed','sheaves','threshed'].every(k=>Number.isFinite(c[k])&&c[k]>=-1e-8&&c[k]<=1e6)&&c.seedStock<=4.000001&&Math.abs(c.seedUsed-c.sown*SEED_COST)<1e-6&&(c.legacyYear===undefined||c.legacyYear===s.year);});}
