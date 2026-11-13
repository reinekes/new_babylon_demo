import {buildingKey,isOperational} from './definitions.js';
import {isDryPoint} from './world.js';
import {workHourAt} from './work-schedule.js';

export const WATCH_SHIFTS={night:{open:21,close:5},day:{open:6.5,close:19}};
export function watchShift(s,c,post){
 if(!c.guardPost)return null;
 const building=post||s.buildings.find(b=>buildingKey(b)===c.guardPost);
 if(building?.type!=='watchHouse'||!isOperational(building))return null;
 return s.citizens.some(other=>other.guardPost===c.guardPost&&other.id<c.id)?'day':'night';
}
export function watchOnShift(shift,time){
 const {open,close}=WATCH_SHIFTS[shift],hour=workHourAt(time);
 return open<close?hour>=open&&hour<close:hour>=open||hour<close;
}
export function watchOnDuty(s,c,shift=watchShift(s,c)){
 return !!shift&&watchOnShift(shift,s.simTime)&&c.work===c.guardPost&&['working','returnWork'].includes(c.phase)&&
  !c.waterTrip&&!s.funeral?.actors.some(a=>a.id===c.id);
}

const patrols=new WeakMap();
export function watchPatrolRoute(s,network,port){
 let routes=patrols.get(network);
 if(!routes){routes=new Map();patrols.set(network,routes);}
 if(routes.has(port.key))return routes.get(port.key);
 const {nodes,graph}=network,at=(x,y)=>nodes.get(`${x+.5},${y+.5}`);
 const clear=(a,b)=>a&&b&&graph.get(a.key)?.has(b.key)&&isDryPoint(s,(a.x+b.x)/2,(a.y+b.y)/2);
 const {x,y}=port,neighbours=[[-1,1],[1,1],[1,-1],[-1,-1]];
 for(const [dx,dy] of neighbours){
  const loop=[port,at(x+dx,y),at(x+dx,y+dy),at(x,y+dy),port];
  if(!loop.slice(1).every((p,i)=>clear(loop[i],p)))continue;
  routes.set(port.key,loop);return loop;
 }
 const edge=[...graph.get(port.key)||[]].map(key=>nodes.get(key)).find(p=>clear(port,p)&&isDryPoint(s,p.x,p.y));
 const fallback=edge?[port,edge,port]:null;routes.set(port.key,fallback);return fallback;
}
