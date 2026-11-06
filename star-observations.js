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

export function validateStarObservations(s){
 const journal=s.starObservations;
 if(journal===undefined)return true;
 if(!usesCatDiscovery(s)||!journal||journal.version!==1||Object.keys(journal).length!==2||
  !Array.isArray(journal.nights)||journal.nights.length>STAR_NIGHTS_REQUIRED)return false;
 return journal.nights.every((n,i)=>n&&Object.keys(n).length===5&&
  Number.isFinite(n.at)&&n.at>=(s.revelationEvidence?.opening?.time??Infinity)&&n.at<=s.simTime&&nightAt(n.at)&&
  n.day===Math.floor(n.at/DAY_SECONDS)&&n.day>(journal.nights[i-1]?.day??-1)&&
  Number.isSafeInteger(n.observer)&&n.observer>=0&&n.observer<s.demography.nextId&&
  Number.isInteger(n.x)&&n.x>=0&&n.x<worldWidth(s)&&Number.isInteger(n.y)&&n.y>=0&&n.y<worldHeight(s));
}
