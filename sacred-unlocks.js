import {BUILDINGS,MIRACLES,buildingKey,isOperational} from './definitions.js';
import {affectResidents} from './wellbeing.js';
import {WIDTH,HEIGHT} from './world.js';

export const SACRED_MIRACLE_IDS=Object.freeze(['inannaProtection','relicAwakening','earthMemory']);
export function initializeSacredUnlocks(s){s.sacred??={version:1,unlocks:{}};}
/** Called after simulation construction updates, never while rendering a panel. */
export function syncSacredUnlocks(s){
 initializeSacredUnlocks(s);let changed=false;
 for(const [id,m]of Object.entries(MIRACLES)){
  if(!m.unlockBuilding||s.sacred.unlocks[id])continue;
  const source=(s.buildings||[]).find(b=>b.type===m.unlockBuilding&&isOperational(b));if(!source)continue;
  s.sacred.unlocks[id]={year:s.year,tick:s.tick,source:buildingKey(source)};changed=true;
  s.news??=[];s.news.unshift({title:`Новое чудо: ${m.name}`,text:`${BUILDINGS[source.type].name} завершены. В панели чудес появился синий дар.`,kind:'good',year:s.year,season:s.season,tick:s.tick});s.news=s.news.slice(0,80);
 }
 return changed;
}
export function miracleLockReason(s,id){
 const m=MIRACLES[id];if(m?.unlockBuilding&&!s.sacred?.unlocks?.[id])return `Сначала заверши: ${BUILDINGS[m.unlockBuilding].name}`;
 if(m?.unlockQuest==='relic'&&s.relicQuest?.phase!=='completed')return 'Сначала найди артефакт и доставь его в храм';
 if(m?.unlockQuest==='land'&&s.landRelicQuest?.phase!=='completed')return 'Сначала найди Печать земли и доставь её в храм';
 return '';
}
export const sacredMiracleUnlocked=(s,id)=>SACRED_MIRACLE_IDS.includes(id)&&!miracleLockReason(s,id);
export function applySacredMiracle(s,id){
 if(id==='inannaProtection'){s.buffs.inannaProtection=3;affectResidents(s,{mood:8});return true;}
 if(id==='earthMemory'){s.buffs.earthMemory=3;affectResidents(s,{mood:8});return true;}
 if(id==='relicAwakening'){s.rain=Math.max(s.rain||0,2);s.drought=0;affectResidents(s,{mood:6,faith:3});return true;}
 return false;
}
export function validateSacredUnlocks(s){
 const sacred=s.sacred;if(sacred===undefined)return true;
 if(!sacred||sacred.version!==1||!sacred.unlocks||typeof sacred.unlocks!=='object'||Array.isArray(sacred.unlocks))return false;
 return Object.entries(sacred.unlocks).every(([id,row])=>MIRACLES[id]?.unlockBuilding&&row&&Number.isSafeInteger(row.year)&&row.year>=1&&row.year<=s.year&&Number.isSafeInteger(row.tick)&&row.tick>=0&&row.tick<=s.tick&&row.year===1+Math.floor(row.tick/4)&&typeof row.source==='string'&&/^\d+,\d+$/.test(row.source)&&Number(row.source.split(',')[0])<WIDTH&&Number(row.source.split(',')[1])<HEIGHT);
}
