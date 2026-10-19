import {river,HEIGHT,terrain} from './world.js';
export const isTradePort=b=>['market','harbor'].includes(b?.type);
export function isRiverBank(s,x,y){return !['water','void'].includes(terrain(x,y,s))&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>terrain(x+dx,y+dy)==='water');}
export function riverRoute(from,to){const route=[];const direction=to>=from?1:-1;for(let y=from;direction*(to-y)>.001;y+=direction*.5){const x=river(y);route.push({x,y,key:`${x+.5},${y+.5}`});}const x=river(to);route.push({x,y:to,key:`${x+.5},${to+.5}`});return route;}
export function routeBoat(c,target,phase){c.route=riverRoute(c.y,target);c.routeIndex=0;c.phase=phase;}
export function moveBoat(c,dt){let left=dt*1.25;while(left>1e-8){const p=c.route[c.routeIndex];if(!p)return true;const distance=Math.hypot(p.x-c.x,p.y-c.y);if(distance<=left){c.x=p.x;c.y=p.y;c.routeIndex++;left-=distance;}else{const y=c.y+(p.y-c.y)*left/distance;c.y=y;c.x=river(y);return false;}}return false;}
export const riverEntry=()=>({x:river(-.5),y:-.5});
export function validBoatPoint(p){return p&&Number.isFinite(p.y)&&p.y>=-.5&&p.y<=HEIGHT-.5&&Number.isFinite(p.x)&&Math.abs(p.x-river(p.y))<1e-6;}
