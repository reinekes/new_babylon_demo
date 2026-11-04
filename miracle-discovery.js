import {usesCatDiscovery} from './scenario-profiles.js';

// Historical caller identity survives death; eligibility can pass to a survivor.
export function initializeCatDiscovery(s){if(usesCatDiscovery(s))s.catDiscovery??={version:1,firstCallingId:null};}
export function preparedFisherInspiration(s,c,profession){
 if(!usesCatDiscovery(s)||profession!=='fisher'||!c||c.age<16||s.godhood?.stage!=='recognized'||s.catFishing?.lessons?.[c.id]!==3||!s.catDiscovery)return false;
 const first=s.catDiscovery.firstCallingId;
 return first===null||!s.citizens.some(v=>v.id===first);
}
export function acceptFisherInspiration(s,c,profession){
 if(!preparedFisherInspiration(s,c,profession))return;
 s.catDiscovery.firstCallingId=c.id;
 if(!s.godhood.believerIds.includes(c.id))s.godhood.believerIds.push(c.id);
 c.faith=Math.max(c.faith,55);
}
export function validateCatDiscovery(s){
 if(!usesCatDiscovery(s))return s.catDiscovery===undefined;
 const q=s.catDiscovery;
 return !!q&&typeof q==='object'&&!Array.isArray(q)&&q.version===1&&Object.keys(q).length===2&&Object.hasOwn(q,'firstCallingId')&&(q.firstCallingId===null||Number.isSafeInteger(q.firstCallingId)&&q.firstCallingId>=0&&q.firstCallingId<s.demography.nextId);
}
