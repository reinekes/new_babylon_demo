import {noteFirstBeer} from './festival.js';
import {recordBuildingProduction} from './building-production-history.js';
import {buildingKey,isOperational,outputMultiplier} from './definitions.js';
import {weatherAt} from './environment.js';

// These quantities and durations are game balance, not a historical recipe.
export const POTTERY_RECIPE=Object.freeze({clay:4,reed:2,water:2});
export const BEER_RECIPE=Object.freeze({food:4,water:3,pottery:1});
export const isArtisan=b=>['pottery','brewery'].includes(b?.type);
export const artisanOutput=b=>b?.type==='pottery'?'pottery':'beer';
export const artisanRecipe=b=>b?.type==='pottery'?POTTERY_RECIPE:BEER_RECIPE;
const fields=['clay','reed','water','food','pottery','vesselUses','stage','elapsed','ready'];
const durations={forming:5,drying:12,firing:12,cooling:6,brewing:15};
const empty=()=>({clay:0,reed:0,water:0,food:0,pottery:0,vesselUses:0,stage:'idle',elapsed:0,ready:0});
function valid(b){
 const v=b?.artisan;if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==fields.length||fields.some(k=>!Object.hasOwn(v,k)))return false;
 if(fields.filter(k=>k!=='stage').some(k=>!Number.isFinite(v[k])||v[k]<0))return false;
 const pottery=b.type==='pottery',recipe=artisanRecipe(b),stages=pottery?['idle','forming','drying','firing','cooling','ready']:['idle','brewing','ready'];
 if(!stages.includes(v.stage)||!Number.isInteger(v.vesselUses)||v.vesselUses>3||pottery&&v.vesselUses!==0)return false;
 for(const k of ['clay','reed','water','food','pottery'])if(v[k]>(recipe[k]||0)||v.stage!=='idle'&&v[k]!==0)return false;
 if(v.pottery&&v.vesselUses)return false;
 if(v.stage==='ready')return v.ready===(pottery?2:3)&&v.elapsed===0;
 if(v.ready!==0)return false;
 return v.stage==='idle'?v.elapsed===0:v.elapsed<durations[v.stage];
}
export function initializeArtisans(s){for(const b of s.buildings||[])if(isArtisan(b)&&b.artisan===undefined)b.artisan=empty();}
export function artisanNeeds(b){
 const recipe=artisanRecipe(b),v=b?.artisan;
 return Object.fromEntries(Object.entries(recipe).map(([k,n])=>[k,isArtisan(b)&&isOperational(b)&&valid(b)&&v.stage==='idle'?Math.max(0,n-(k==='pottery'&&v.vesselUses?1:v[k])):0]));
}
export function workArtisan(b,seconds,s=null){
 if(!isArtisan(b)||!isOperational(b)||!valid(b)||!Number.isFinite(seconds)||seconds<=0)return;
 const v=b.artisan;
 if(v.stage==='idle'){
  if(Object.values(artisanNeeds(b)).some(n=>n>1e-8))return;
  // Physical transfers can leave a rounding-size deficit. Accept the same
  // tolerance as the needs check while keeping the consumed buffers canonical.
  const consume=(k,n)=>{v[k]=Math.max(0,v[k]-n);};
  if(b.type==='pottery'){consume('clay',4);consume('reed',2);consume('water',2);v.stage='forming';}
  else{consume('food',4);consume('water',3);if(!v.vesselUses){consume('pottery',1);v.vesselUses=4;}v.vesselUses--;v.stage='brewing';}
 }
 if(!['forming','brewing'].includes(v.stage))return;
 v.elapsed=Math.min(durations[v.stage],v.elapsed+seconds*outputMultiplier(b));
 if(v.elapsed>=durations[v.stage]){v.elapsed=0;if(v.stage==='forming')v.stage='drying';else{v.stage='ready';v.ready=3;if(s){recordBuildingProduction(s,b,'beer',3);noteFirstBeer(s,b);}}}
}
export function advanceArtisans(s,seconds){
 if(!Number.isFinite(seconds)||seconds<=0)return;
 const rate={sunny:1,cloudy:.6,wind:.85,rain:0}[weatherAt(s).type]??0;
 for(const b of s.buildings||[]){if(b.type!=='pottery'||!isOperational(b)||!valid(b))continue;const v=b.artisan;let remaining=seconds;
  for(let i=0;i<3&&remaining>0&&['drying','firing','cooling'].includes(v.stage);i++){
   const speed=v.stage==='drying'?rate:1;if(!speed)break;
   const used=Math.min(remaining,(durations[v.stage]-v.elapsed)/speed);v.elapsed+=used*speed;remaining-=used;
   if(v.elapsed+1e-8>=durations[v.stage]){v.elapsed=0;v.stage={drying:'firing',firing:'cooling',cooling:'ready'}[v.stage];if(v.stage==='ready'){v.ready=2;recordBuildingProduction(s,b,'pottery',2);}}
  }
 }
}
export function collectArtisan(b){if(!isArtisan(b)||!isOperational(b)||!valid(b)||b.artisan.stage!=='ready')return 0;const n=b.artisan.ready;b.artisan.ready=0;b.artisan.stage='idle';return n;}
export function validateArtisans(s){
 return Array.isArray(s.buildings)&&s.buildings.every(b=>{
  if(!isArtisan(b))return !Object.hasOwn(b,'artisan');if(!valid(b))return false;
  const v=b.artisan,recipe=artisanRecipe(b),incoming={};
  for(const c of s.citizens||[])if(c.craftSite===buildingKey(b)&&c.craftMaterial&&(c.craftAmount||0)>0)incoming[c.craftMaterial]=(incoming[c.craftMaterial]||0)+c.craftAmount;
  if(v.stage!=='idle'&&Object.values(incoming).some(n=>n>0))return false;
  for(const [k,n]of Object.entries(incoming))if(!(k in recipe)||k==='water'||v[k]+n>recipe[k]+1e-7)return false;
  return isOperational(b)||v.stage==='idle'&&['clay','reed','water','food','pottery','vesselUses'].every(k=>v[k]===0);
 });
}
export function artisanSummary(b){const v=b?.artisan;if(!isArtisan(b)||!valid(b))return null;return {...v,output:artisanOutput(b),needs:artisanNeeds(b),laborMultiplier:outputMultiplier(b),duration:durations[v.stage]||0};}
