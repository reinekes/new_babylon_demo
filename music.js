import {BUILDINGS,buildingKey,isOperational,outputMultiplier} from './definitions.js';
import {recordBuildingProduction} from './building-production-history.js';

export const MUSIC_RANGE=2.8;
const carrying=c=>[c.cargo,c.buildCargo].some(goods=>Object.values(goods||{}).some(n=>n>0))||!!(c.waterTrip||c.pantryTrip||c.craftSite||c.seedField||c.clothingLoad);
const daylight=s=>{const hour=((8+(s.simTime||0)*.4)%24+24)%24;return hour>=6&&hour<19;};

/** Shared simulation/audio/pose gate: assignment alone never makes music. */
export function musicWorking(s,b,c){
 const key=b&&buildingKey(b);
 return !!(b?.type==='musicHouse'&&isOperational(b)&&daylight(s)&&c&&c.age>=16&&c.role==='production'&&c.calling==='musician'&&c.work===key&&c.workplace===key&&c.phase==='working'&&!c.clinic&&!c.school&&!c.site&&!carrying(c)&&!s.funeral?.actors?.some(a=>a.id===c.id)&&Math.hypot(c.x-(b.x+.5),c.y-(b.y+.5))<=1.15);
}
export function musicPerformance(s,b){
 const performers=(s.citizens||[]).filter(c=>musicWorking(s,b,c)).sort((a,c)=>a.id-c.id);
 return {playing:performers.length>0,musician:performers[0]||null,performers,range:MUSIC_RANGE};
}
export const musicPlaying=(s,b)=>musicPerformance(s,b).playing;

/** This branch consumes real on-site labour, never cargo or imaginary inputs.
 * Partial playing uses the resident's existing, saved workElapsed counter. */
export function workMusic(s,b,c,dt){
 if(!musicWorking(s,b,c)||!Number.isFinite(dt)||dt<=0||dt>3600)return 0;
 b.music??={seconds:0,performances:0};b.music.seconds+=dt;
 const duration=BUILDINGS.musicHouse.workTime,elapsed=(c.workElapsed||0)+dt,batches=Math.floor((elapsed+1e-9)/duration);c.workElapsed=Math.max(0,elapsed-batches*duration);
 for(const person of s.citizens||[])if(Math.hypot(person.x-c.x,person.y-c.y)<=MUSIC_RANGE)person.mood=Math.min(100,(person.mood??75)+dt*.012);
 if(!batches)return 0;
 const prestige=batches*BUILDINGS.musicHouse.output.prestige*outputMultiplier(b);b.music.performances+=batches;s.resources.prestige=(s.resources.prestige||0)+prestige;recordBuildingProduction(s,b,'prestige',prestige);return prestige;
}
export function validateMusic(s){
 const finite=n=>Number.isFinite(n)&&n>=0&&n<=1e9;
 return (s.buildings||[]).every(b=>b.music===undefined||b.type==='musicHouse'&&b.music&&typeof b.music==='object'&&!Array.isArray(b.music)&&finite(b.music.seconds)&&Number.isSafeInteger(b.music.performances)&&finite(b.music.performances));
}
