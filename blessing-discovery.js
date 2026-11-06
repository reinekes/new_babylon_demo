import {buildingKey,isOperational} from './definitions.js';
import {homeMealFood,ration} from './households.js';
import {usesCatDiscovery} from './scenario-profiles.js';
import {waterDemand} from './water.js';

const HOMES_REQUIRED=3;
const HELP_REQUIRED=2;

export const newBlessingDiscovery=()=>({version:1,qualifiedAt:null});

function aidCount(s){
 return (s.causalFacts?.neighborWater?.length||0)+(s.causalFacts?.neighborFood?.length||0);
}

function suppliedHomes(s){
 const needs=new Map();
 for(const person of s.citizens){
  if(!person.home||person.floodShelter)continue;
  const demand=needs.get(person.home)||{food:0,water:0};
  demand.food+=ration(person)*4/3;
  demand.water+=waterDemand(person);
  needs.set(person.home,demand);
 }
 return s.buildings.filter(b=>{
  if(b.type!=='house'||!isOperational(b))return false;
  const demand=needs.get(buildingKey(b));
  return demand&&homeMealFood(b)+1e-8>=demand.food&&(b.water||0)+1e-8>=demand.water;
 }).length;
}

export function advanceBlessingDiscovery(s){
 const milestone=s.blessingDiscovery;
 if(!milestone||milestone.qualifiedAt!==null||aidCount(s)<HELP_REQUIRED||suppliedHomes(s)<HOMES_REQUIRED)return false;
 milestone.qualifiedAt=s.simTime;
 return true;
}

export function blessingDiscoveryView(s){
 const milestone=s.blessingDiscovery;
 if(!milestone)return null;
 return {qualified:milestone.qualifiedAt!==null,homes:Math.min(HOMES_REQUIRED,suppliedHomes(s)),aid:Math.min(HELP_REQUIRED,aidCount(s)),homesRequired:HOMES_REQUIRED,aidRequired:HELP_REQUIRED};
}

export function validateBlessingDiscovery(s){
 const milestone=s.blessingDiscovery;
 if(milestone===undefined)return true;
 return usesCatDiscovery(s)&&!!milestone&&Object.keys(milestone).length===2&&milestone.version===1&&
  (milestone.qualifiedAt===null||Number.isFinite(milestone.qualifiedAt)&&milestone.qualifiedAt>=0&&milestone.qualifiedAt<=s.simTime&&aidCount(s)>=HELP_REQUIRED);
}
