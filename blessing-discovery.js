import {ensureHouseEntityId} from './causal-facts.js';
import {buildingKey,isOperational} from './definitions.js';
import {homeMealFood,ration,supplyHome} from './households.js';
import {usesCatDiscovery} from './scenario-profiles.js';
import {floodFootprint,floodPhase} from './river-flood.js';
import {waterDemand} from './water.js';

const HOMES_REQUIRED=3;
const HELP_REQUIRED=2;

const FAMILY_SUPPORT_VERSION=2;
const TRIAL_VERSION=3;
export const FAMILY_BLESSING_DESCRIPTION='Повышает довольство города до 15 пунктов и улучшает настроение жителей. Новых жителей приводит «Зов».';
export const newBlessingDiscovery=()=>({version:TRIAL_VERSION,qualifiedAt:null});
export const blessingUsesTrial=s=>s.blessingDiscovery?.version===TRIAL_VERSION;
export const blessingSupportsFamilies=s=>blessingUsesTrial(s)||s.blessingDiscovery?.version===FAMILY_SUPPORT_VERSION;
export const blessingTrialReady=s=>blessingUsesTrial(s)&&s.blessingDiscovery.qualifiedAt!==null&&s.blessingDiscovery.trialUsedAt===undefined;

function aidCount(s){
 return (s.causalFacts?.neighborWater?.length||0)+(s.causalFacts?.neighborFood?.length||0);
}

function suppliedHomes(s){
 const needs=new Map();
 for(const person of s.citizens){
  const home=supplyHome(person,{arrived:true});
  if(!home)continue;
  const demand=needs.get(home)||{food:0,water:0};
  demand.food+=ration(person)*4/3;
  demand.water+=waterDemand(person);
  needs.set(home,demand);
 }
 const flooded=floodPhase(s)==='active'?floodFootprint(s,s.riverFlood):null;
 return s.buildings.filter(b=>{
  const key=buildingKey(b);
  if(b.type!=='house'||!isOperational(b)||flooded?.has(key))return false;
  const demand=needs.get(key);
  return demand&&homeMealFood(b)+1e-8>=demand.food&&(b.water||0)+1e-8>=demand.water;
 });
}

export function advanceBlessingDiscovery(s){
 const milestone=s.blessingDiscovery;
 if(!milestone||milestone.qualifiedAt!==null||aidCount(s)<HELP_REQUIRED)return false;
 const supplied=suppliedHomes(s);
 if(supplied.length<HOMES_REQUIRED)return false;
 const byKey=new Map(supplied.map(home=>[buildingKey(home),home]));
 const recent=(s.causalFacts.neighborWater||[]).concat(s.causalFacts.neighborFood||[])
  .filter(fact=>byKey.get(fact.home)?.waterEntityId===fact.homeId)
  .reduce((latest,fact)=>!latest||fact.time>=latest.time?fact:latest,null);
 const home=byKey.get(recent?.home)??supplied[0];
 milestone.qualifiedAt=s.simTime;
 milestone.cup={home:buildingKey(home),homeId:ensureHouseEntityId(s,home)};
 milestone.openingPending=true;
 return true;
}

export function blessingDiscoveryView(s){
 const milestone=s.blessingDiscovery;
 if(!milestone)return null;
 return {qualified:milestone.qualifiedAt!==null,homes:Math.min(HOMES_REQUIRED,suppliedHomes(s).length),aid:Math.min(HELP_REQUIRED,aidCount(s)),homesRequired:HOMES_REQUIRED,aidRequired:HELP_REQUIRED};
}

export function blessingCupAt(s,home){
 const cup=s?.blessingDiscovery?.cup;
 return !!cup&&home.type==='house'&&home.waterEntityId===cup.homeId&&buildingKey(home)===cup.home;
}

export function validateBlessingDiscovery(s){
 const milestone=s.blessingDiscovery;
 if(milestone===undefined)return true;
 const trial=milestone?.trialUsedAt,record=s.miracleHistory?.trials?.bless,paid=s.miracleHistory?.paid?.bless;
 if(blessingUsesTrial(s)){
  if(trial===undefined){if(record||paid)return false;}
  else if(!Number.isFinite(trial)||milestone.qualifiedAt===null||trial<milestone.qualifiedAt||trial>s.simTime||
   record?.at!==trial||paid&&(paid.at<trial||paid.number<=record.number))return false;
 }else if(trial!==undefined||record)return false;
 return usesCatDiscovery(s)&&!!milestone&&Object.keys(milestone).length===2+Number(milestone.cup!==undefined)+Number(milestone.openingPending!==undefined)+Number(trial!==undefined)&&[1,FAMILY_SUPPORT_VERSION,TRIAL_VERSION].includes(milestone.version)&&
  (milestone.openingPending===undefined||milestone.openingPending===true&&!!milestone.cup)&&
  (milestone.cup===undefined||milestone.qualifiedAt!==null&&milestone.cup&&Object.keys(milestone.cup).length===2&&
   Number.isSafeInteger(milestone.cup.homeId)&&milestone.cup.homeId>0&&/^\d+,\d+$/.test(milestone.cup.home))&&
  (milestone.qualifiedAt===null||Number.isFinite(milestone.qualifiedAt)&&milestone.qualifiedAt>=0&&milestone.qualifiedAt<=s.simTime&&aidCount(s)>=HELP_REQUIRED);
}
