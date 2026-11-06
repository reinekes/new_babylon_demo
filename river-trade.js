import {riverIsLow} from './irrigation.js';
import {levelOf} from './definitions.js';
import {terrain,riverLocal,riverPoint,riverLength,riverFlowSign,signedRiverDistance} from './world.js';
export const harborCargoMultiplier=(s,harbor)=>riverIsLow(s)?Math.min(3,levelOf(harbor)+(harbor.boatTender?1:0)):3;
export const isTradePort=b=>['market','harbor'].includes(b?.type);
export function isRiverBank(s,x,y){const riverOnly={world:{...s.world,lakes:[]}};return !['water','void'].includes(terrain(x,y,s))&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>terrain(x+dx,y+dy,riverOnly)==='water');}
export function riverRoute(from,to,s){const route=[],direction=to>=from?1:-1;const add=along=>{const p=riverPoint(along,s);route.push({...p,key:`${p.x+.5},${p.y+.5}`});};for(let along=from;direction*(to-along)>.001;along+=direction*.5)add(along);add(to);return route;}
export function routeBoat(c,target,phase,s){c.route=riverRoute(riverLocal(c.x,c.y,s).along,target,s);c.routeIndex=0;c.phase=phase;}
export function moveBoat(c,dt,s){let left=dt*1.25;while(left>1e-8){const p=c.route[c.routeIndex];if(!p)return true;const distance=Math.hypot(p.x-c.x,p.y-c.y);if(distance<=left){c.x=p.x;c.y=p.y;c.routeIndex++;left-=distance;}else{const from=riverLocal(c.x,c.y,s).along,to=riverLocal(p.x,p.y,s).along;Object.assign(c,riverPoint(from+(to-from)*left/distance,s));return false;}}return false;}
export const riverEntry=s=>riverPoint(riverFlowSign(s)>0?-.5:riverLength(s)-.5,s);
// Existing valleys keep their original upstream return route. New valleys
// use the saved current direction and continue downstream after trading.
export const riverExit=s=>s?.world?.generationVersion===2?riverPoint(riverFlowSign(s)>0?riverLength(s)-.5:-.5,s):riverEntry(s);
export function validBoatPoint(p,s){if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return false;const q=riverLocal(p.x,p.y,s);return q.along>=-.5&&q.along<=riverLength(s)-.5&&Math.abs(signedRiverDistance(p.x,p.y,s))<1e-6;}
