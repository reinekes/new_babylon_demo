import {bindWaterProject,recordProjectWaterFact} from './causal-facts.js';
import {BUILDINGS,buildingKey,isOperational} from './definitions.js';
import {isStrictSumer} from './scenario-profiles.js';
import {build,canBuild} from './engine.js';
import {canLeadConstruction} from './godhood.js';
import {networkFor} from './workforce.js';
import {stockStores} from './inventory.js';
import {waterDemand,waterSummary} from './water.js';
import {supplyHome} from './households.js';

const projectType='waterpoint';
function awaitingWaterProject(s,b){
 return s.buildings.some(site=>{
  const p=site.humanWaterProject;
  return p?.home===buildingKey(b)&&!p.delivery&&(p.homeId===undefined||p.homeId===b.waterEntityId);
 });
}
function waterRequest(s,b,requester,demand){
 const shortage=demand-(b.water||0);
 if(!requester||shortage<=1e-7||awaitingWaterProject(s,b))return null;
 return {home:buildingKey(b),requesterId:requester.id,shortage,cost:BUILDINGS[projectType]};
}
export function householdWaterRequest(s,b){
 if(!isStrictSumer(s)||b.type!=='house'||!isOperational(b))return null;
 const requester=s.citizens.find(c=>c.home===buildingKey(b)&&c.age>=16&&!c.floodShelter);
 return waterRequest(s,b,requester,waterSummary(s,b).demand);
}
export function cityWaterRequest(s){
 if(!isStrictSumer(s))return null;
 const demand=new Map(),requesters=new Map();
 for(const c of s.citizens){
  const home=supplyHome(c);
  demand.set(home,(demand.get(home)||0)+waterDemand(c));
  if(c.age>=16&&!c.floodShelter&&!requesters.has(c.home))requesters.set(c.home,c);
 }
 let request=null;
 for(const b of s.buildings){
  if(b.type!=='house'||!isOperational(b))continue;
  const home=buildingKey(b),candidate=waterRequest(s,b,requesters.get(home),demand.get(home)||0);
  if(candidate&&(!request||candidate.shortage>request.shortage))request=candidate;
 }
 return request;
}
export function waterProjectOrganizerReason(s,organizer){
 if(!organizer||organizer.age<16||!['auto','builder'].includes(organizer.role)||!canLeadConstruction(s,organizer,{type:projectType,level:1}))return 'Нужен взрослый организатор, который может строить';
 if(organizer.hunger>=30)return 'Организатор голоден и пока откладывает стройку';
 if(organizer.health<60||organizer.clinic)return 'Организатор сначала восстанавливает здоровье';
 const organizerHome=s.buildings.find(b=>b.type==='house'&&buildingKey(b)===organizer.home);
 if(!organizerHome)return 'Организатору нужен дом';
 const ownWater=waterSummary(s,organizerHome);
 if(ownWater.stock<ownWater.demand)return 'Организатор сначала снабжает водой свой двор';
 if(organizer.site||organizer.workplace||organizer.waterTrip||organizer.pantryTrip||organizer.districtJob||organizer.saleJob||organizer.tradeJob||
  Object.values(organizer.cargo||{}).some(n=>n>0)||Object.values(organizer.buildCargo||{}).some(n=>n>0))return 'Организатор занят текущей работой или доставкой';
 return null;
}
export function waterProjectProposal(s,organizerId,requesterId,x,y){
 const refuse=reason=>({ok:false,reason});
 if(!isStrictSumer(s))return refuse('Инициатива доступна в Южном Шумере');
 if(s.buildings.some(b=>b.humanWaterProject&&b.construction?.kind==='new'))return refuse('Один водозабор уже строится по инициативе жителей');
 const organizer=s.citizens.find(c=>c.id===organizerId),requester=s.citizens.find(c=>c.id===requesterId);
 const home=s.buildings.find(b=>b.type==='house'&&isOperational(b)&&buildingKey(b)===requester?.home);
 if(!home||requester.floodShelter)return refuse('Нужен населённый двор, которому не хватает воды');
 const water=waterSummary(s,home);
 if(water.stock>=water.demand)return refuse('У двора есть запас воды на день');
 const organizerReason=waterProjectOrganizerReason(s,organizer);
 if(organizerReason)return refuse(organizerReason);
 const reason=canBuild(s,projectType,x,y);
 if(reason)return refuse(reason);
 const site={type:projectType,x,y,level:1},preview={...s,buildings:[...s.buildings,site],roads:[...s.roads]};
 const network=networkFor(preview),ports=new Map(network.ports.filter(p=>!p.building.siteKey).map(p=>[buildingKey(p.building),p.key]));
 const component=key=>network.components.get(ports.get(key)),group=component(buildingKey(site));
 if(group===undefined||component(buildingKey(home))!==group||component(organizer.home)!==group)return refuse('Нет прохода между водозабором, двором и организатором');
 const eligibleStores=new Set(stockStores(s).filter(b=>component(buildingKey(b))===group).map(buildingKey));
 if(!eligibleStores.size)return refuse('На этом берегу нет доступного склада');
 return {ok:true,key:buildingKey(site),eligibleStores,project:{organizerId,requesterId,home:buildingKey(home),startedAt:s.simTime},cost:BUILDINGS[projectType]};
}

export function approveWaterProject(s,organizerId,requesterId,x,y){
 const offer=waterProjectProposal(s,organizerId,requesterId,x,y);
 if(!offer.ok)return offer;
 const result=build(s,projectType,x,y,0,{eligibleStores:offer.eligibleStores,humanWaterProject:offer.project});
 if(!result.ok)return result;
 const station=s.buildings.find(b=>buildingKey(b)===offer.key),home=s.buildings.find(b=>buildingKey(b)===offer.project.home);
 bindWaterProject(s,station,home);
 return {ok:true,key:offer.key};
}

export function confirmProjectWater(s,c,station,home,amount){
 if(!station||amount<=1e-7)return;
 const b=s.buildings.find(b=>b.type===projectType&&buildingKey(b)===station&&isOperational(b));
 const p=b?.humanWaterProject;
 if(!p||p.delivery||p.home!==buildingKey(home)||p.homeId!==undefined&&p.homeId!==home.waterEntityId||!s.citizens.some(r=>r.id===p.requesterId&&r.home===p.home))return;
 p.delivery={courierId:c.id,time:s.simTime,amount};
 recordProjectWaterFact(s,b,home,p.delivery);
}
export function validateHumanProjects(s){
 const id=n=>Number.isSafeInteger(n)&&n>=0&&n<s.demography.nextId;
 return s.buildings.every(b=>{
  const p=b.humanWaterProject;
  if(p===undefined)return true;
  return isStrictSumer(s)&&b.type===projectType&&p&&id(p.organizerId)&&id(p.requesterId)&&typeof p.home==='string'&&/^\d+,\d+$/.test(p.home)&&
   Number.isFinite(p.startedAt)&&p.startedAt>=0&&p.startedAt<=s.simTime&&
   (p.delivery===undefined||isOperational(b)&&p.delivery&&id(p.delivery.courierId)&&Number.isFinite(p.delivery.time)&&
    p.delivery.time>=p.startedAt&&p.delivery.time<=s.simTime&&Number.isFinite(p.delivery.amount)&&p.delivery.amount>0&&p.delivery.amount<=12);
 });
}
