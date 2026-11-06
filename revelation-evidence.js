import {usesCatDiscovery} from './scenario-profiles.js';
import {worldHeight,worldWidth} from './world.js';

const kinds=['family','building','food'];
export const newRevelationEvidence=()=>({version:1});

export function recordRevelationFact(s,kind,c,place){
 const evidence=s.revelationEvidence;
 if(!evidence||evidence[kind]||!kinds.includes(kind))return;
 evidence[kind]={citizenId:c.id,x:place.x,y:place.y,time:s.simTime};
}

const hasAllStories=evidence=>kinds.every(kind=>evidence[kind]);

export function revelationKnowledgeReason(s){
 const evidence=s.revelationEvidence;
 if(!evidence||evidence.opening)return '';
 if(!hasAllStories(evidence))return 'Нужны три свидетельства: помощь семье, стройка и урожай или улов';
 return 'Нужен взрослый хранитель рассказов: вдохновлённый музыкант, жрец или житель, признавший бога';
}

export function advanceRevelationEvidence(s){
 const evidence=s.revelationEvidence,g=s.godhood;
 if(!evidence||evidence.opening||!hasAllStories(evidence)||g?.stage!=='recognized'||s.funeral)return;
 const eligible=c=>c.age>=16&&c.health>0&&!c.floodShelter;
 const keeper=s.citizens.find(c=>eligible(c)&&['musician','priest'].includes(c.calling))??
  s.citizens.find(c=>eligible(c)&&g.believerIds.includes(c.id));
 if(keeper)evidence.opening={citizenId:keeper.id,time:s.simTime};
}

export function revelationEvidenceView(s){
 const evidence=s.revelationEvidence;
 if(!evidence)return null;
 const entries=kinds.map(kind=>({kind,recorded:!!evidence[kind]}));
 return {entries,count:entries.filter(entry=>entry.recorded).length,opening:evidence.opening};
}

export function validateRevelationEvidence(s){
 const evidence=s.revelationEvidence;
 if(evidence===undefined)return true;
 if(!usesCatDiscovery(s)||!evidence||evidence.version!==1||Array.isArray(evidence))return false;
 const citizenId=n=>Number.isSafeInteger(n)&&n>=0&&n<s.demography.nextId;
 const time=n=>Number.isFinite(n)&&n>=0&&n<=s.simTime;
 return Object.entries(evidence).every(([kind,fact])=>{
  if(kind==='version')return true;
  if(!fact||!citizenId(fact.citizenId)||!time(fact.time))return false;
  if(kind==='opening')return Object.keys(fact).length===2&&hasAllStories(evidence)&&
   kinds.every(kind=>evidence[kind].time<=fact.time);
  return kinds.includes(kind)&&Object.keys(fact).length===4&&
   Number.isInteger(fact.x)&&fact.x>=0&&fact.x<worldWidth(s)&&
   Number.isInteger(fact.y)&&fact.y>=0&&fact.y<worldHeight(s);
 });
}
