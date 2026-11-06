import {DAY_SECONDS} from './city-life.js';
import {buildingKey,isOperational} from './definitions.js';
import {usesCatDiscovery} from './scenario-profiles.js';
import {worldHeight,worldWidth} from './world.js';

export const STAR_NIGHTS_REQUIRED=3;
const professions=['farmer','priest','musician'];
// The simulation day begins at 08:00, so this interval spans 22:00–04:00.
const nightAt=time=>time%DAY_SECONDS>=35&&time%DAY_SECONDS<50;
export const newStarObservations=()=>({version:1,nights:[]});

export function advanceStarObservations(s){
 const journal=s.starObservations;
 if(!journal||journal.nights.length>=STAR_NIGHTS_REQUIRED||!s.revelationEvidence?.opening||s.funeral||!nightAt(s.simTime))return;
 const day=Math.floor(s.simTime/DAY_SECONDS);
 if(journal.nights.at(-1)?.day===day)return;
 const homes=new Map(s.buildings.filter(b=>b.type==='house'&&isOperational(b)&&!b.floodDamage&&b.water>=.25).map(b=>[buildingKey(b),b]));
 for(const c of s.citizens){
  if(!['home','resting'].includes(c.phase)||c.age<16||c.health<=0||c.floodShelter||
   !professions.includes(c.calling)||!s.godhood.believerIds.includes(c.id))continue;
  const home=homes.get(c.home);
  if(!home||Math.hypot(c.x-home.x,c.y-home.y)>1.5)continue;
  journal.nights.push({day,observer:c.id,x:home.x,y:home.y,at:s.simTime});
  return;
 }
}

export function recordStarHarvestDeadline(s,b){
 const journal=s.starObservations,c=b.crop;
 if(!journal||journal.harvest||!isOperational(b)||c.legacyYear!==undefined||
  c.sown!==1||c.growth<.95||!(c.total>0))return;
 journal.harvest={x:b.x,y:b.y,tick:s.tick,at:s.simTime};
}

export function starKnowledgeReason(s){
 if(!s.starObservations)return '';
 if(!s.revelationEvidence?.opening||s.godhood.stage!=='recognized')return 'Сначала открой «Откровение»';
 if(s.starObservations.nights.length<STAR_NIGHTS_REQUIRED)return 'Нужны три ночи наблюдений';
 return s.starObservations.harvest?'':'Подготовь поле к началу жатвы';
}

const validLocation=(s,p)=>Number.isInteger(p.x)&&p.x>=0&&p.x<worldWidth(s)&&
 Number.isInteger(p.y)&&p.y>=0&&p.y<worldHeight(s);

export function validateStarObservations(s){
 const journal=s.starObservations;
 if(journal===undefined)return true;
 if(!usesCatDiscovery(s)||!journal||journal.version!==1||Object.keys(journal).length!==2+Number(journal.harvest!==undefined)||
  !Array.isArray(journal.nights)||journal.nights.length>STAR_NIGHTS_REQUIRED)return false;
 const harvest=journal.harvest;
 if(harvest!==undefined&&(!harvest||Object.keys(harvest).length!==4||!validLocation(s,harvest)||
  !Number.isSafeInteger(harvest.tick)||harvest.tick<1||harvest.tick>s.tick||![0,2].includes(harvest.tick%4)||
  !Number.isFinite(harvest.at)||harvest.at<=0||harvest.at>s.simTime))return false;
 return journal.nights.every((n,i)=>n&&Object.keys(n).length===5&&
  Number.isFinite(n.at)&&n.at>=(s.revelationEvidence?.opening?.time??Infinity)&&n.at<=s.simTime&&nightAt(n.at)&&
  n.day===Math.floor(n.at/DAY_SECONDS)&&n.day>(journal.nights[i-1]?.day??-1)&&
  Number.isSafeInteger(n.observer)&&n.observer>=0&&n.observer<s.demography.nextId&&
  validLocation(s,n));
}
