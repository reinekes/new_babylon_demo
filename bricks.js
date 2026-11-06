import {creatorReady} from './creator-materials.js';
import {recordBuildingProduction} from './building-production-history.js';
import {buildingKey,isOperational} from './definitions.js';
import {weatherAt} from './environment.js';

export const BRICK_RECIPE=Object.freeze({clay:4,reed:1,water:2});
export const BRICK_BATCH=4;
export const BRICK_DRYING_TIME=30;
const fields=['clay','reed','water','wet','drying','ready'];
const empty=()=>({clay:0,reed:0,water:0,wet:0,drying:0,ready:0});
function validBuffer(v,dedicated=false){
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==fields.length||fields.some(k=>!Number.isFinite(v[k])||v[k]<0))return false;
 if(Object.entries(BRICK_RECIPE).some(([k,n])=>v[k]>n))return false;
 if(![0,BRICK_BATCH].includes(v.wet)||!([0,BRICK_BATCH].includes(v.ready)||dedicated&&v.ready===BRICK_BATCH-1)||v.wet&&v.ready)return false;
 return v.drying<BRICK_DRYING_TIME&&(v.wet>0||v.drying===0);
}
export function initializeBricks(s){
 for(const b of s.buildings||[])if(b.type==='brickyard'&&b.brickmaking===undefined)b.brickmaking=empty();
}
export function brickNeeds(b){
 const v=b.brickmaking;
 if(b.type!=='brickyard'||!isOperational(b)||!validBuffer(v,b.creatorDedication)||v.wet||v.ready)return {clay:0,reed:0,water:0};
 return Object.fromEntries(Object.entries(BRICK_RECIPE).map(([k,n])=>[k,n-v[k]]));
}
// The caller invokes forming only when an actual worker completes their task.
export function formBricks(b){
 const v=b.brickmaking;
 if(b.type!=='brickyard'||!isOperational(b)||!validBuffer(v,b.creatorDedication)||v.wet||v.ready||Object.entries(BRICK_RECIPE).some(([k,n])=>v[k]<n))return 0;
 for(const [k,n] of Object.entries(BRICK_RECIPE))v[k]-=n;
 v.wet=BRICK_BATCH;v.drying=0;return BRICK_BATCH;
}
export function advanceBricks(s,dt){
 if(!Number.isFinite(dt)||dt<=0)return;
 const rate={sunny:1,cloudy:.6,wind:.85,rain:0}[weatherAt(s).type]??0;
 for(const b of s.buildings||[]){
  const v=b.brickmaking;
  if(b.type!=='brickyard'||!isOperational(b)||!validBuffer(v,b.creatorDedication)||!v.wet)continue;
  v.drying=Math.min(BRICK_DRYING_TIME,v.drying+dt*rate);
  if(v.drying<BRICK_DRYING_TIME)continue;
  v.ready=v.wet;v.wet=0;v.drying=0;
  recordBuildingProduction(s,b,'brick',v.ready);
  if(creatorReady(s)&&s.creatorMaterials.dedication===undefined){
   s.creatorMaterials.dedication=buildingKey(b);
   b.creatorDedication=true;
   v.ready--;
  }
 }
}
export function collectBricks(b){
 if(b.type!=='brickyard'||!isOperational(b)||!validBuffer(b.brickmaking,b.creatorDedication))return 0;
 const n=b.brickmaking.ready;b.brickmaking.ready=0;return n;
}
export function validateBricks(s){
 return Array.isArray(s.buildings)&&s.buildings.every(b=>b.type==='brickyard'?validBuffer(b.brickmaking,b.creatorDedication):!Object.hasOwn(b,'brickmaking'));
}
