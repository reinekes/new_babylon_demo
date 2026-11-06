import {isStrictSumer} from './scenario-profiles.js';
import {AUTUMN_CROPS,fieldCalendar} from './crop-calendar.js';
import {fieldResting,saltYieldFactor,settleFieldSoil} from './field-soil.js';
import {SEED_COST} from './food-planning.js';
import {isOperational,outputMultiplier} from './definitions.js';
import {fieldWater} from './irrigation.js';
export const SICKLE_EDGE=42;
export const sickleBlunt=b=>b.sickle?.edge===0;
const empty=year=>({year,sown:0,growth:0,remaining:0,total:0,harvested:0,spoiled:0,seedStock:0,seedUsed:0,sheaves:0,threshed:0});
export function cropFor(s,b){const c=b.crop??=empty(s.year);c.seedStock??=0;c.seedUsed??=c.sown*SEED_COST;c.sheaves??=0;c.threshed??=0;return c;}
export function enableAutumnCrops(state){
 if(!isStrictSumer(state)||state.cropCalendar===AUTUMN_CROPS)return false;
 for(const field of state.buildings){
  if(field.type!=='field')continue;
  const crop=cropFor(state,field);
  if(state.season!==3&&crop.sown>0)crop.springCycle=true;
  else field.crop={...empty(state.year),seedStock:crop.seedStock,sheaves:crop.sheaves,threshed:crop.threshed};
 }
 state.cropCalendar=AUTUMN_CROPS;
 return true;
}
export function initializeCrops(s,{legacy=false}={}){
 for(const b of s.buildings.filter(b=>b.type==='field')){if(b.crop)continue;const c=cropFor(s,b);if(legacy&&isOperational(b)&&s.season>0){c.sown=1;c.growth=s.season===1?s.seasonElapsed/45:1;c.legacyYear=s.year;if(s.season===2)c.total=c.remaining=84*outputMultiplier(b);}c.seedUsed=c.sown*SEED_COST;}
}
export function fieldActive(s,b){const c=cropFor(s,b),calendar=fieldCalendar(s,b);return isOperational(b)&&(s.season===calendar.sow&&!fieldResting(s,b)&&c.sown<1-1e-8||s.season===calendar.harvest&&c.remaining>1e-8||c.sheaves>1e-8);}
export function workField(s,b,seconds){
 const c=cropFor(s,b),calendar=fieldCalendar(s,b);if(!isOperational(b)||seconds<=0)return 0;
 if(c.sheaves>1e-8){const amount=Math.min(c.sheaves,7*outputMultiplier(b));c.sheaves=Math.max(0,c.sheaves-amount);c.threshed+=amount;return amount;}
 if(s.season===calendar.sow&&!fieldResting(s,b)){const delta=Math.max(0,Math.min(1-c.sown,seconds/12,c.seedStock/SEED_COST));c.sown+=delta;if(c.sown>=1-1e-8)c.sown=1;c.seedStock=Math.max(0,c.seedStock-delta*SEED_COST);c.seedUsed=c.sown*SEED_COST;return 0;}
 if(s.season!==calendar.harvest||c.remaining<=0)return 0;
 const tool=b.sickle;
 if(sickleBlunt(b)&&tool.pottery>=1-1e-8){tool.pottery=0;tool.edge=SICKLE_EDGE;return 0;}
 const batch=7*outputMultiplier(b);
 const amount=Math.min(c.remaining,tool?(tool.edge>0?Math.min(batch,tool.edge):batch/2):batch);
 if(tool)tool.edge=Math.max(0,tool.edge-amount);
 c.remaining=Math.max(0,c.remaining-amount);c.harvested+=amount;c.sheaves+=amount;return 0;
}
export function advanceCrops(s,dt){
 if(s.season!==1&&s.season!==3)return;const water=s.buildings.some(b=>b.type==='canal'&&isOperational(b));
 for(const b of s.buildings){if(b.type!=='field'||!isOperational(b)||s.season!==fieldCalendar(s,b).grow)continue;const c=cropFor(s,b);if(c.sown<=0)continue;
  if(s.rain>0||water&&fieldWater(s,b).canal||c.legacyYear===s.year&&fieldWater(s,b).natural)c.growth=Math.min(1,c.growth+dt/45);
 }
}
export function changeCropSeason(s,previous){
 settleFieldSoil(s,previous);
 let lost=0,ready=0;
 for(const b of s.buildings){
  if(b.type!=='field')continue;
  const c=cropFor(s,b),calendar=fieldCalendar(s,b);
  const reset=()=>{b.crop={...empty(s.year),seedStock:c.seedStock,sheaves:c.sheaves,threshed:c.threshed};};
  if(s.season===calendar.sow){reset();continue;}
  c.year=s.year;
  if(previous===calendar.grow){
   c.total=c.remaining=84*outputMultiplier(b)*saltYieldFactor(s,b)*c.sown*c.growth*(s.buffs?.fertility?1.6:1);
   c.harvested=0;ready+=c.remaining;
  }
  if(previous===calendar.harvest){
   c.spoiled+=c.remaining;lost+=c.remaining;c.remaining=0;
   if(c.springCycle)reset();
  }
 }
 if(ready||lost){
  s.news.unshift({title:lost?'Несобранный ячмень испортился':'Ячмень созрел',text:lost?`На полях потеряно ${Math.round(lost)} еды. Закрепи работников на время жатвы.`:`На полях до ${Math.round(ready)} еды. Нужны работники и доставка до конца сезона.`,kind:lost?'bad':'good',year:s.year,season:s.season,tick:s.tick});
  s.news=s.news.slice(0,80);
 }
}
export function cropSummary(s,b){
 const c=cropFor(s,b),calendar=fieldCalendar(s,b);
 if(s.season===calendar.sow)return fieldResting(s,b)?'Поле отдыхает до следующего посева':`Посев ${Math.round(c.sown*100)}% · семена на поле ${c.seedStock.toFixed(1)} · использовано ${c.seedUsed.toFixed(1)}/4`;
 if(s.season===calendar.grow)return `Засеяно ${Math.round(c.sown*100)}% · рост ${Math.round(c.growth*100)}% · ${fieldWater(s,b).canal||s.rain>0?'вода есть':c.legacyYear===s.year&&fieldWater(s,b).natural?'переходный полив старого поля':'нужен наполненный канал'}`;
 if(s.season===calendar.harvest)return `В поле ${c.remaining.toFixed(1)} · снопы на току ${c.sheaves.toFixed(1)} · обмолочено ${c.threshed.toFixed(1)} еды`;
 return `Обмолот: ${c.sheaves.toFixed(1)} снопов · испортилось в поле ${c.spoiled.toFixed(1)}`;
}
export function validateCrops(s){return s.buildings.every(b=>{
 const tool=b.sickle;
 if(tool!==undefined&&(!isStrictSumer(s)||b.type!=='field'||!isOperational(b)||!tool||Object.keys(tool).length!==2||!Number.isFinite(tool.edge)||tool.edge<0||tool.edge>SICKLE_EDGE||!Number.isFinite(tool.pottery)||tool.pottery<0||tool.pottery>1+1e-7))return false;
 if(b.type!=='field')return b.crop===undefined;const c=b.crop;if(!c)return true;const finite=(n,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=max;return (c.springCycle===undefined||c.springCycle===true&&s.cropCalendar===AUTUMN_CROPS&&s.season!==3)&&Number.isInteger(c.year)&&c.year===s.year&&finite(c.sown,1)&&finite(c.growth,1)&&['remaining','total','harvested','spoiled'].every(k=>finite(c[k],1e6))&&Math.abs(c.total-c.remaining-c.harvested-c.spoiled)<1e-6&&['seedStock','seedUsed','sheaves','threshed'].every(k=>Number.isFinite(c[k])&&c[k]>=-1e-8&&c[k]<=1e6)&&c.seedStock<=4.000001&&Math.abs(c.seedUsed-c.sown*SEED_COST)<1e-6&&(c.legacyYear===undefined||c.legacyYear===s.year);});}
