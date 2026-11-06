import {usesCatDiscovery} from './scenario-profiles.js';
import {worldHeight,worldWidth} from './world.js';

const kinds=['family','building','food'];
export const newRevelationEvidence=()=>({version:1});

export function recordRevelationFact(s,kind,c,place){
 const evidence=s.revelationEvidence;
 if(!evidence||evidence[kind]||!kinds.includes(kind))return;
 evidence[kind]={citizenId:c.id,x:place.x,y:place.y,time:s.simTime};
}

export function revelationEvidenceView(s){
 const evidence=s.revelationEvidence;
 if(!evidence)return null;
 const entries=kinds.map(kind=>({kind,recorded:!!evidence[kind]}));
 return {entries,count:entries.filter(entry=>entry.recorded).length};
}

export function validateRevelationEvidence(s){
 const evidence=s.revelationEvidence;
 if(evidence===undefined)return true;
 if(!usesCatDiscovery(s)||!evidence||evidence.version!==1||Array.isArray(evidence))return false;
 return Object.entries(evidence).every(([kind,fact])=>kind==='version'||(
  kinds.includes(kind)&&fact&&Object.keys(fact).length===4&&
  Number.isSafeInteger(fact.citizenId)&&fact.citizenId>=0&&fact.citizenId<s.demography.nextId&&
  Number.isInteger(fact.x)&&fact.x>=0&&fact.x<worldWidth(s)&&
  Number.isInteger(fact.y)&&fact.y>=0&&fact.y<worldHeight(s)&&
  Number.isFinite(fact.time)&&fact.time>=0&&fact.time<=s.simTime));
}
