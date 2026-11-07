import {bindLandMemoryPlace} from './land-memory.js';
import {validateRevelationAdvice} from './revelation-advice.js';
import {usesCatDiscovery} from './scenario-profiles.js';
import {worldHeight,worldWidth} from './world.js';

const kinds=['family','building','food'];
export const newRevelationEvidence=()=>({version:1});

export function recordRevelationFact(s,kind,c,place){
 const evidence=s.revelationEvidence;
 if(!evidence||evidence[kind]||!kinds.includes(kind))return;
 const anchor=bindLandMemoryPlace(s,kind,place);
 evidence[kind]={citizenId:c.id,x:place.x,y:place.y,time:s.simTime,...anchor?{anchor}:{}};
}

const MAX_TRAINING_MASTERS=4;
const trainingOrder=b=>b&&b.type!=='road'&&['new','upgrade'].includes(b.construction?.kind);
const validId=(s,n)=>Number.isSafeInteger(n)&&n>=0&&n<s.demography.nextId;
const validPupils=(s,row,count)=>Array.isArray(row.pupils)&&row.pupils.length>=1&&row.pupils.length<=count&&
 new Set(row.pupils).size===row.pupils.length&&row.pupils.every(id=>id!==row.citizenId&&validId(s,id));

export function recordRevelationTraining(s,b,{mentor,pupil},shared){
 const evidence=s.revelationEvidence;
 if(!evidence||evidence.opening||evidence.apprenticeship||!trainingOrder(b)||!(shared>1e-8))return;
 const training=b.construction.revelationTraining??=[];
 let row=training.find(entry=>entry.citizenId===mentor.id);
 if(!row){
  if(training.length===MAX_TRAINING_MASTERS){
   const oldest=training.findIndex(entry=>entry.pupils.length<2);
   if(oldest<0)return;
   training.splice(oldest,1);
  }
  row={citizenId:mentor.id,pupils:[]};
  training.push(row);
 }
 if(row.pupils.length<2&&!row.pupils.includes(pupil.id))row.pupils.push(pupil.id);
}

export function validateRevelationTraining(s,b){
 const training=b.construction?.revelationTraining;
 if(training===undefined)return true;
 return !!s.revelationEvidence&&trainingOrder(b)&&b.construction.work>0&&Array.isArray(training)&&
  training.length>0&&training.length<=MAX_TRAINING_MASTERS&&
  training.every(row=>row&&Object.keys(row).length===2&&validId(s,row.citizenId)&&validPupils(s,row,2))&&
  new Set(training.map(row=>row.citizenId)).size===training.length;
}

export function recordRevelationApprenticeship(s,b){
 const evidence=s.revelationEvidence;
 if(!evidence||evidence.opening||evidence.apprenticeship||!trainingOrder(b))return;
 const row=b.construction.revelationTraining?.find(entry=>entry.pupils.length===2);
 if(row)evidence.apprenticeship={...row,x:b.x,y:b.y,time:s.simTime};
}

const hasAllStories=evidence=>kinds.every(kind=>evidence[kind]);
const hasStoryRoute=evidence=>!!evidence.apprenticeship||hasAllStories(evidence);

export function revelationKnowledgeReason(s){
 const evidence=s.revelationEvidence;
 if(!evidence||evidence.opening)return '';
 if(!hasStoryRoute(evidence))return 'Нужны три разных свидетельства или рассказы мастера и двух учеников об одной завершённой стройке';
 return 'Нужен взрослый хранитель рассказов: вдохновлённый музыкант, жрец или житель, признавший бога';
}

export function advanceRevelationEvidence(s){
 const evidence=s.revelationEvidence,g=s.godhood;
 if(!evidence||evidence.opening||!hasStoryRoute(evidence)||g?.stage!=='recognized'||s.funeral)return;
 const eligible=c=>c.age>=16&&c.health>0&&!c.floodShelter;
 const keeper=s.citizens.find(c=>eligible(c)&&['musician','priest'].includes(c.calling))??
  s.citizens.find(c=>eligible(c)&&c.id===evidence.apprenticeship?.citizenId)??
  s.citizens.find(c=>eligible(c)&&g.believerIds.includes(c.id));
 if(keeper)evidence.opening={citizenId:keeper.id,time:s.simTime};
}

export function revelationEvidenceView(s){
 const evidence=s.revelationEvidence;
 if(!evidence)return null;
 const entries=kinds.map(kind=>({kind,recorded:!!evidence[kind]}));
 return {entries,count:entries.filter(entry=>entry.recorded).length,opening:evidence.opening,apprenticeship:evidence.apprenticeship};
}

export function validateRevelationEvidence(s){
 const evidence=s.revelationEvidence;
 if(evidence===undefined)return true;
 if(!usesCatDiscovery(s)||!evidence||evidence.version!==1||Array.isArray(evidence))return false;
 const citizenId=n=>Number.isSafeInteger(n)&&n>=0&&n<s.demography.nextId;
 const time=n=>Number.isFinite(n)&&n>=0&&n<=s.simTime;
 return Object.entries(evidence).every(([kind,fact])=>{
  if(kind==='version')return true;
  if(kind==='advice')return validateRevelationAdvice(s,fact);
  if(!fact||!citizenId(fact.citizenId)||!time(fact.time))return false;
  if(kind==='opening')return Object.keys(fact).length===2&&(
   evidence.apprenticeship?.time<=fact.time||hasAllStories(evidence)&&kinds.every(kind=>evidence[kind].time<=fact.time));
  if(kind==='apprenticeship'&&(!validPupils(s,fact,2)||fact.pupils.length!==2))return false;
  if(fact.anchor!==undefined&&!['building','food'].includes(kind))return false;
  const scale=kind==='building'?2:1,minimum=kind==='building'?-.5:0;
  return (kind==='apprenticeship'?Object.keys(fact).length===5:kinds.includes(kind)&&Object.keys(fact).length===4+Number(fact.anchor!==undefined))&&
   Number.isInteger(fact.x*scale)&&typeof fact.x==='number'&&fact.x>=minimum&&fact.x<worldWidth(s)&&
   Number.isInteger(fact.y*scale)&&typeof fact.y==='number'&&fact.y>=minimum&&fact.y<worldHeight(s);
 });
}
