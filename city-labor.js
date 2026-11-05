import {DAY_SECONDS} from './city-life.js';
import {buildingKey,isOperational} from './definitions.js';

const foodWork=new Set(['field','fishing','hunting','garden','cowshed']);
export const isSupplyWorker=(citizen,building)=>citizen.role==='watercarrier'||foodWork.has(building?.type);
export const harvestNeedsHands=building=>building?.type==='field'&&isOperational(building)
 &&((building.crop?.remaining||0)>1e-8||(building.crop?.sheaves||0)>1e-8);

export function harvestCallActive(state){
 const policy=state.cityLabor;
 return policy?.kind==='harvest'&&policy.year===state.year&&state.season===2&&state.simTime<policy.started+DAY_SECONDS;
}

export function validateCityLabor(state){
 const policy=state.cityLabor;
 return policy===undefined||(policy?.kind==='harvest'
  &&Number.isSafeInteger(policy.year)&&policy.year>=1&&policy.year<=state.year
  &&Number.isFinite(policy.started)&&policy.started>=0&&policy.started<=state.simTime);
}

// Household reserves are local. A district with many adults cannot replace a
// lone adult who has to fetch meals and water across an unconnected bank.
export function harvestCandidates(citizens,buildings){
 const protectedIds=new Set(),byHome=new Map();
 for(const c of citizens){
  if(c.age<16)continue;
  if(!byHome.has(c.home))byHome.set(c.home,[]);
  byHome.get(c.home).push(c);
  if(isSupplyWorker(c,buildings.get(c.work))||c.pantryTrip||c.waterTrip)protectedIds.add(c.id);
 }
 for(const family of byHome.values()){
  const adult=[...family].sort((a,b)=>Number(!!a.workplace)-Number(!!b.workplace)||a.id-b.id)[0];
  protectedIds.add(adult.id);
 }
 return citizens.filter(c=>c.age>=16&&['auto','production'].includes(c.role)&&!protectedIds.has(c.id)
  &&!c.workplace&&!c.guardPost&&!c.tradeJob&&!c.saleJob&&!c.districtJob
  &&!c.seedField&&!c.craftSite&&c.clothingTarget===undefined&&!c.clothingLoad
  &&!c.pantryFood&&!Object.values(c.cargo||{}).some(n=>n>0)&&!Object.values(c.buildCargo||{}).some(n=>n>0))
  .sort((a,b)=>Number(!!a.work||!!a.site)-Number(!!b.work||!!b.site)||a.id-b.id);
}

export function harvestDemand(state){
 const fields=state.season===2?state.buildings.filter(harvestNeedsHands):[];
 const ripe=fields.reduce((sum,b)=>sum+(b.crop?.remaining||0),0);
 const sheaves=fields.reduce((sum,b)=>sum+(b.crop?.sheaves||0),0);
 return {fields,ripe,sheaves,slots:fields.length*2,keys:new Set(fields.map(buildingKey))};
}

export function planHarvestAssignments(state,citizens,buildings,{locked,reserved,access}){
 const assignments=new Map(),counts=new Map(),{fields,keys}=harvestDemand(state);
 if(!fields.length)return assignments;
 const mark=(key)=>counts.set(key,(counts.get(key)||0)+1);
 for(const c of citizens){
  if(c.workplace)mark(c.workplace);
  if(locked.has(c.id)&&c.work&&c.work!==c.workplace&&!c.guardPost){mark(c.work);continue;}
  if(c.workplace)continue;
  if(!c.work||!isSupplyWorker(c,buildings.get(c.work)))continue;
  if(locked.has(c.id))continue;
  if(reserved.has(c.id))continue;
  const store=access(c,c.work);
  if(store){assignments.set(c.id,{work:c.work,store});mark(c.work);}
 }
 for(const c of harvestCandidates(citizens,buildings)){
  if(locked.has(c.id)||reserved.has(c.id)||assignments.has(c.id))continue;
  for(const key of keys){
   if((counts.get(key)||0)>=2)continue;
   const store=access(c,key);
   if(!store)continue;
   assignments.set(c.id,{work:key,store});mark(key);break;
  }
 }
 return assignments;
}
