import {isOperational} from './definitions.js';
import {isStrictSumer} from './scenario-profiles.js';
import {fieldWater} from './irrigation.js';

export const soilCareEnabled=isStrictSumer;
export const fieldResting=(state,field,year=state.year)=>soilCareEnabled(state)&&field.soil?.restYear===year;
export const saltYieldFactor=(state,field)=>soilCareEnabled(state)?1-Math.max(0,(field.soil?.salt||0)-.25)*.8:1;
export function nextFieldSalt(state,field,water){
 const salt=field.soil?.salt||0;
 if(!soilCareEnabled(state))return salt;
 let next=salt;
 if(fieldResting(state,field))next-=water.drained?.28:.18;
 else if((field.crop?.sown||0)>0&&water.canal)next+=water.drained?-.09:.12;
 return Math.min(1,Math.max(0,Math.round(next*100)/100));
}
export const nextSaltYieldFactor=(state,field,water)=>1-Math.max(0,nextFieldSalt(state,field,water)-.25)*.8;

// One update after the growing season. Keep the first two irrigated harvests
// at full yield, giving players time to see salt rise and plan a rotation.
export function settleFieldSoil(state,previous){
 if(previous!==1||!soilCareEnabled(state))return;
 for(const field of state.buildings){
  if(field.type!=='field'||!isOperational(field))continue;
  const salt=nextFieldSalt(state,field,fieldWater(state,field));
  if(salt!==(field.soil?.salt||0))field.soil={...field.soil,salt};
 }
}

export function validateFieldSoil(state){
 return state.buildings.every(field=>{
  const soil=field.soil;
  if(soil===undefined)return true;
  return soilCareEnabled(state)&&field.type==='field'&&soil&&Number.isFinite(soil.salt)&&soil.salt>=0&&soil.salt<=1
   &&(soil.restYear===undefined||Number.isSafeInteger(soil.restYear)&&soil.restYear>=1&&soil.restYear<=state.year+1);
 });
}
