import {cityCommandReason} from './city-command-lock.js';
import {mealCycle} from './wellbeing.js';
import {bindWaterProject,ensureHouseEntityId,recordProjectWaterFact,recordProjectWaterWitness} from './causal-facts.js';
import {BUILDINGS,MATERIALS,RESOURCE_NAMES,buildingKey,isOperational} from './definitions.js';
import {isStrictSumer} from './scenario-profiles.js';
import {build,canBuild} from './engine.js';
import {canLeadConstruction,isAwakening} from './godhood.js';
import {networkFor} from './workforce.js';
import {stockStores} from './inventory.js';
import {dispatchNeighborWater,waterDemand,waterSummary} from './water.js';
import {supplyHome} from './households.js';
import {worldWidth,worldHeight} from './world.js';
import {DAY_SECONDS} from './city-life.js';

const projectType='waterpoint';
export const WATER_DREAM_COST=3;
const dawnOffset=DAY_SECONDS*22/24;
const nextDawn=time=>(Math.floor((time-dawnOffset)/DAY_SECONDS)+1)*DAY_SECONDS+dawnOffset;
const validParticipants=(ids,organizerId)=>Array.isArray(ids)&&ids.length<=3&&new Set(ids).size===ids.length&&!ids.includes(organizerId);
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
 const requester=s.citizens.find(c=>c.home===buildingKey(b)&&c.age>=16&&!c.floodShelter&&!c.fireShelter);
 return waterRequest(s,b,requester,waterSummary(s,b).demand);
}
export function smallWaterResponseReason(s){
 if(!isStrictSumer(s)||!isAwakening(s)||s.godhood.stage!=='recognized'||!s.citizens.some(c=>s.godhood.believerIds.includes(c.id)))return 'Нужен живой последователь';
 if(s.resources.faith>=1)return 'У тебя есть вера для обычного обращения';
 const lock=cityCommandReason(s);
 if(lock||s.event||s.funeral||s.lost)return lock||'Дождись завершения события';
 const cycle=mealCycle(s.simTime);
 if((s.godhood.lastPrayerCycle??-Infinity)>=cycle-1)return 'Недавно город получил веру от молитв';
 if(s.godhood.smallWaterResponse?.cycle===cycle)return 'Малый ответ уже использован в этом цикле';
 return '';
}

export function answerWaterRequest(s,b){
 const reason=smallWaterResponseReason(s);
 if(reason)return {ok:false,reason};
 const request=s.buildings.includes(b)&&householdWaterRequest(s,b);
 if(!request)return {ok:false,reason:'У двора сейчас нет просьбы о воде'};
 const helper=s.citizens.find(c=>dispatchNeighborWater(s,c,b));
 if(!helper)return {ok:false,reason:'Нужен свободный взрослый сосед с доступным берегом и путём к двору'};
 s.godhood.smallWaterResponse={cycle:mealCycle(s.simTime),home:request.home,requesterId:request.requesterId,helperId:helper.id};
 return {ok:true,helperId:helper.id};
}

export function cityWaterRequest(s){
 if(!isStrictSumer(s))return null;
 const demand=new Map(),requesters=new Map();
 for(const c of s.citizens){
  const home=supplyHome(c);
  demand.set(home,(demand.get(home)||0)+waterDemand(c));
  if(c.age>=16&&!c.floodShelter&&!c.fireShelter&&!requesters.has(c.home))requesters.set(c.home,c);
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
 if(organizer.floodShelter||organizer.fireShelter)return 'Житель ещё не вернулся домой после эвакуации';
 if(organizer.guardPost||organizer.manualGathering)return 'Житель занят охраной или ручным сбором';
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
export function waterProjectProposal(s,organizerId,requesterId,x,y,participantIds=[]){
 const refuse=reason=>({ok:false,reason});
 if(!isStrictSumer(s))return refuse('Инициатива доступна в Южном Шумере');
 if(!Number.isInteger(x)||!Number.isInteger(y))return refuse('Выберите клетку у воды');
 if(s.buildings.some(b=>b.humanWaterProject&&b.construction?.kind==='new'))return refuse('Один водозабор уже строится по инициативе жителей');
 const organizer=s.citizens.find(c=>c.id===organizerId),requester=s.citizens.find(c=>c.id===requesterId);
 const home=s.buildings.find(b=>b.type==='house'&&isOperational(b)&&buildingKey(b)===requester?.home);
 if(!home||requester.age<16)return refuse('Нужен населённый двор, которому не хватает воды');
 if(requester.floodShelter||requester.fireShelter)return refuse('Проситель ещё не вернулся домой после эвакуации');
 const water=waterSummary(s,home);
 if(water.stock>=water.demand)return refuse('У двора есть запас воды на день');
 if(awaitingWaterProject(s,home))return refuse('Двор уже ждёт доставку из своего проекта');
 const organizerReason=waterProjectOrganizerReason(s,organizer);
 if(organizerReason)return refuse(organizerReason);
 if(!validParticipants(participantIds,organizerId))return refuse('Выберите до трёх разных помощников');
 const participants=participantIds.map(id=>s.citizens.find(c=>c.id===id));
 for(const c of participants){
  const reason=waterProjectOrganizerReason(s,c);
  if(reason)return refuse(c?c.name+' · '+reason:'Помощник больше не живёт в городе');
 }

 const reason=canBuild(s,projectType,x,y);
 if(reason)return refuse(reason);
 const site={type:projectType,x,y,level:1},preview={...s,buildings:[...s.buildings,site],roads:[...s.roads]};
 const network=networkFor(preview),ports=new Map(network.ports.filter(p=>!p.building.siteKey).map(p=>[buildingKey(p.building),p.key]));
 const component=key=>network.components.get(ports.get(key)),group=component(buildingKey(site));
 if(group===undefined||component(buildingKey(home))!==group||component(organizer.home)!==group)return refuse('Нет прохода между водозабором, двором и организатором');
 if(participants.some(c=>component(c.home)!==group))return refuse('Помощник не может пройти от своего двора к водозабору');
 const stores=stockStores(s).filter(b=>component(buildingKey(b))===group);
 if(!stores.length)return refuse('На этом берегу нет доступного склада');
 const cost=BUILDINGS[projectType];
 const availableStock=Object.fromEntries(MATERIALS.filter(k=>cost[k]>0)
  .map(k=>[k,stores.reduce((sum,b)=>sum+(b.stock?.[k]||0),0)]));
 const missing=Object.keys(availableStock).filter(k=>availableStock[k]<cost[k]);
 if(missing.length)return refuse(`На доступных складах не хватает: ${missing.map(k=>RESOURCE_NAMES[k]).join(', ')}`);
 const eligibleStores=new Set(stores.map(buildingKey));
 const reachableHomes=new Set(s.buildings.filter(b=>b.type==='house'&&component(buildingKey(b))===group).map(buildingKey));
 return {ok:true,key:buildingKey(site),eligibleStores,availableStock,reachableHomes,project:{organizerId,requesterId,home:buildingKey(home),startedAt:s.simTime,...participantIds.length?{participantIds:[...participantIds]}:{}},cost};
}

export function approveWaterProject(s,organizerId,requesterId,x,y,participantIds=[]){
 const offer=waterProjectProposal(s,organizerId,requesterId,x,y,participantIds);
 if(!offer.ok)return offer;
 const result=build(s,projectType,x,y,0,{eligibleStores:offer.eligibleStores,humanWaterProject:offer.project});
 if(!result.ok)return result;
 const station=s.buildings.find(b=>buildingKey(b)===offer.key),home=s.buildings.find(b=>buildingKey(b)===offer.project.home);
 bindWaterProject(s,station,home);
 return {ok:true,key:offer.key};
}

export function sendWaterProjectDream(s,organizerId,requesterId,x,y,participantIds){
 if(s.waterProjectDream)return {ok:false,reason:'Город уже ждёт решения по общему сну'};
 if(!participantIds?.length)return {ok:false,reason:'Выберите хотя бы одного помощника для общего сна'};
 const offer=waterProjectProposal(s,organizerId,requesterId,x,y,participantIds);
 if(!offer.ok)return offer;
 if(s.resources.faith<WATER_DREAM_COST)return {ok:false,reason:`Для общего сна нужно ${WATER_DREAM_COST} веры`};
 const {home,startedAt:sentAt}=offer.project;
 const courtyard=s.buildings.find(b=>b.type==='house'&&buildingKey(b)===home);
 const homeId=ensureHouseEntityId(s,courtyard);
 s.resources.faith-=WATER_DREAM_COST;
 s.waterProjectDream={organizerId,requesterId,participantIds:[...participantIds],home,homeId,x,y,sentAt,readyAt:nextDawn(sentAt)};
 return {ok:true};
}

export function waterDreamHomeReason(s,dream){
 if(dream.homeId!==undefined&&!s.buildings.some(b=>b.type==='house'&&isOperational(b)&&buildingKey(b)===dream.home&&b.waterEntityId===dream.homeId))return 'Первоначальный двор снесён или заменён';
 if(!s.citizens.some(c=>c.id===dream.requesterId&&c.home===dream.home))return 'Проситель больше не живёт в этом дворе';
 return '';
}

export function acceptWaterProjectDream(s){
 const dream=s.waterProjectDream;
 if(!dream)return {ok:false,reason:'У города нет общего сна'};
 if(s.simTime<dream.readyAt)return {ok:false,reason:'Жители обсудят сон на рассвете'};
 const reason=waterDreamHomeReason(s,dream);
 if(reason)return {ok:false,reason};
 const result=approveWaterProject(s,dream.organizerId,dream.requesterId,dream.x,dream.y,dream.participantIds);
 if(result.ok)delete s.waterProjectDream;
 return result;
}

export function discardWaterProjectDream(s){
 if(!s.waterProjectDream)return {ok:false,reason:'У города нет общего сна'};
 delete s.waterProjectDream;
 return {ok:true};
}

export function confirmProjectWater(s,c,station,home,amount){
 if(!station||!Number.isFinite(amount)||amount<=1e-7)return;
 const b=s.buildings.find(b=>b.type===projectType&&buildingKey(b)===station&&isOperational(b));
 const p=b?.humanWaterProject;
 if(!p)return;
 if(p.home!==buildingKey(home)){
  recordProjectWaterWitness(s,b,home,{courierId:c.id,time:s.simTime,amount});
  return;
 }
 if(p.delivery||p.homeId!==undefined&&p.homeId!==home.waterEntityId||!s.citizens.some(r=>r.id===p.requesterId&&r.home===p.home))return;
 p.delivery={courierId:c.id,time:s.simTime,amount};
 recordProjectWaterFact(s,b,home,p.delivery);
}
export function validateHumanProjects(s){
 const id=n=>Number.isSafeInteger(n)&&n>=0&&n<s.demography.nextId;
 const dream=s.waterProjectDream;
 if(dream!==undefined&&(!dream||!isStrictSumer(s)||!id(dream.organizerId)||!id(dream.requesterId)||
  dream.organizerId===dream.requesterId||!validParticipants(dream.participantIds,dream.organizerId)||
  !dream.participantIds.length||!dream.participantIds.every(id)||dream.participantIds.includes(dream.requesterId)||
  typeof dream.home!=='string'||!/^\d+,\d+$/.test(dream.home)||
  !Number.isInteger(dream.x)||dream.x<0||dream.x>=worldWidth(s)||!Number.isInteger(dream.y)||dream.y<0||dream.y>=worldHeight(s)||
  !Number.isFinite(dream.sentAt)||dream.sentAt<0||dream.sentAt>s.simTime||dream.readyAt!==nextDawn(dream.sentAt)))return false;

 return s.buildings.every(b=>{
  const p=b.humanWaterProject;
  if(p===undefined)return true;
  return isStrictSumer(s)&&b.type===projectType&&p&&id(p.organizerId)&&id(p.requesterId)&&typeof p.home==='string'&&/^\d+,\d+$/.test(p.home)&&
   Number.isFinite(p.startedAt)&&p.startedAt>=0&&p.startedAt<=s.simTime&&
   (p.participantIds===undefined||Array.isArray(p.participantIds)&&p.participantIds.length<=3&&new Set(p.participantIds).size===p.participantIds.length&&p.participantIds.every(n=>id(n)&&n!==p.organizerId))&&
   (p.delivery===undefined||isOperational(b)&&p.delivery&&id(p.delivery.courierId)&&Number.isFinite(p.delivery.time)&&
    p.delivery.time>=p.startedAt&&p.delivery.time<=s.simTime&&Number.isFinite(p.delivery.amount)&&p.delivery.amount>0&&p.delivery.amount<=12);
 });
}
