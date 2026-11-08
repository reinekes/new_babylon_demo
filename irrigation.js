import {terrain,signedRiverDistance} from './world.js';
import {isOperational} from './definitions.js';
import {allocateCanalWater} from './canal-flow.js';
import {canalMaintenanceEnabled,canalShares,nextCanalSilt} from './canal-maintenance.js';
export const CARDINAL=[[1,0],[0,1],[-1,0],[0,-1]];
const cache=new WeakMap(),crossingCache=new WeakMap(),key=(x,y)=>`${x},${y}`;
// Derived topology only: water is never a second stock saved alongside buildings.
export const lowWaterYear=s=>canalMaintenanceEnabled(s)&&s.year%3===2;
export const riverIsLow=s=>lowWaterYear(s)&&s.season===1;
export function depthCanalTarget(s,target){
 if(!s.depthSupply||!canalMaintenanceEnabled(s)||!Number.isInteger(target?.x)||!Number.isInteger(target?.y))return null;
 const network=irrigationFor(s),id=key(target.x,target.y);
 if(!network.wet.has(id))return null;
 return s.buildings.find(b=>b.type==='canal'&&b.x===target.x&&b.y===target.y&&isOperational(b))||null;
}
export function irrigationFor(s,{lowRiver=riverIsLow(s)}={}){
 const pressure=s.depthSupply?.pressure;
 const anchor=pressure&&pressure.tick===s.tick?key(pressure.x,pressure.y):'';
 const limited=canalMaintenanceEnabled(s),canals=s.buildings.filter(b=>b.type==='canal'),fields=new Set(s.buildings.filter(b=>b.type==='field'&&(!limited||isOperational(b))).map(b=>key(b.x,b.y))),lakes=(s.world?.lakes||[]).map(l=>l.cells.map(c=>key(c.x,c.y)).join(';')).join('|'),signature=canals.map(b=>`${b.x},${b.y}:${isOperational(b)?1:0}:${limited?canalShares(b):'-'}:${b.drain?1:0}`).join('|')+';'+[...fields].join('|')+';lakes:'+lakes+';river:'+JSON.stringify(s.world?.river)+';low:'+lowRiver+';depth:'+anchor;
 let variants=cache.get(s);if(!variants){variants=new Map();cache.set(s,variants);}
 const old=variants.get(lowRiver);if(old?.signature===signature)return old;
 const cells=new Map(canals.filter(isOperational).map(b=>[key(b.x,b.y),b])),wet=new Set(),arms=new Map();
 const waterAt=(x,y)=>terrain(x,y,s)==='water';
 for(const [id,b]of cells){
  arms.set(id,CARDINAL.filter(([dx,dy])=>{
   const x=b.x+dx,y=b.y+dy,k=key(x,y),other=cells.get(k);
   return other&&(!limited||!!other.drain===!!b.drain)||fields.has(k)||waterAt(x,y);
  }));
  if(CARDINAL.some(([dx,dy])=>waterAt(b.x+dx,b.y+dy)))wet.add(id);
 }
 const drained=new Set(),outlets=new Set([...wet].filter(id=>cells.get(id).drain&&canalShares(cells.get(id))>0)),drainQueue=[...outlets];
 for(let i=0;i<drainQueue.length;i++){
  const b=cells.get(drainQueue[i]);
  for(const [dx,dy] of CARDINAL){
   const id=key(b.x+dx,b.y+dy),next=cells.get(id);
   if(fields.has(id))drained.add(id);
   if(next?.drain&&canalShares(next)>0&&!outlets.has(id)){outlets.add(id);drainQueue.push(id);}
  }
 }
 for(const id of [...wet])if(cells.get(id).drain)wet.delete(id);
 const heads=[...wet],adjacent=new Map(),capacity=new Map(),intakeLimits=new Map();
 if(limited&&lowRiver)for(const id of heads){
  const b=cells.get(id);
  const lake=CARDINAL.some(([dx,dy])=>(s.world?.lakes||[]).some(l=>l.cells.some(c=>c.x===b.x+dx&&c.y===b.y+dy&&Math.abs(signedRiverDistance(c.x,c.y,s))>=1.1)));
  if(!lake)intakeLimits.set(id,1);
 }
 for(const [id,b] of cells){
  adjacent.set(id,CARDINAL.map(([dx,dy])=>key(b.x+dx,b.y+dy)).filter(next=>cells.has(next)));
  if(limited)capacity.set(id,b.drain?0:canalShares(b));
 }
 if(limited)for(const id of heads)if(!capacity.get(id))wet.delete(id);
 const queue=[...wet];for(let i=0;i<queue.length;i++)for(const next of adjacent.get(queue[i])){
  if(wet.has(next)||limited&&!capacity.get(next))continue;
  wet.add(next);queue.push(next);
 }
 let depthWave=null;
 if(limited&&wet.has(anchor)){
  const supported=new Map([[anchor,0]]),edges=[];
  for(const [id,distance] of supported){
   capacity.set(id,capacity.get(id)+1);
   if(intakeLimits.has(id))intakeLimits.set(id,intakeLimits.get(id)+1);
   for(const next of adjacent.get(id))if(wet.has(next)&&!supported.has(next)){
    supported.set(next,distance+1);
    edges.push({from:cells.get(id),to:cells.get(next),distance:distance+1});
   }
  }
  depthWave={point:cells.get(anchor),edges};
 }
 const reachableFields=new Map();
 for(const id of wet){
  const b=cells.get(id);
  for(const [dx,dy] of CARDINAL){
   const field=key(b.x+dx,b.y+dy);
   if(!reachableFields.has(field))reachableFields.set(field,[]);
   reachableFields.get(field).push(id);
  }
 }
 const flow=limited?allocateCanalWater({adjacent,heads,capacity,intakeLimits,fields:new Map([...reachableFields].filter(([id])=>fields.has(id)))}):null;
 const irrigated=new Set(flow?flow.routes.keys():reachableFields.keys());
 const result={signature,cells,wet,arms,irrigated,reachableFields,flow,fields,heads,adjacent,drained,outlets,intakeLimits,depthWave};variants.set(lowRiver,result);return result;
}
export function canalSiltingForecast(s){
 if(!canalMaintenanceEnabled(s))return [];
 const {cells,wet,outlets}=irrigationFor(s),risks=[];
 for(const [id,b] of cells){
  if(!wet.has(id)&&!outlets.has(id))continue;
  const current=canalShares(b),next=canalShares({silt:nextCanalSilt(b)});
  if(next<current)risks.push({x:b.x,y:b.y,current,next,queued:b.canalCleaning===true});
 }
 return risks.sort((a,b)=>a.next-b.next||a.y-b.y||a.x-b.x);
}

export function fieldWater(s,b,options){
 const network=irrigationFor(s,options),id=key(b.x,b.y),natural=terrain(b.x,b.y,s)==='fertile';
 let canal=network.irrigated.has(id);
 if(network.flow&&!network.fields.has(id)&&network.reachableFields.has(id)){
  canal=allocateCanalWater({adjacent:network.adjacent,heads:network.heads,capacity:network.flow.residual,intakeLimits:network.flow.intakeRemaining,fields:new Map([[id,network.reachableFields.get(id)]])}).routes.has(id);
 }
 return {canal,natural,drained:network.drained.has(id),productive:canal||natural,label:canal?'Вода из канала · защита от засухи':network.flow&&network.reachableFields.has(id)?'Канал рядом, свободной доли воды нет':natural?'Приречная земля · естественная влага':'Нет воды · работа приостановлена'};
}
export function lowWaterForecast(s){
 if(!lowWaterYear(s)||s.season>1)return null;
 const normal=irrigationFor(s,{lowRiver:false}),low=irrigationFor(s,{lowRiver:true});
 return {active:riverIsLow(s),fields:s.buildings.filter(b=>b.type==='field'&&normal.irrigated.has(key(b.x,b.y))&&!low.irrigated.has(key(b.x,b.y)))};
}
// Shallow channels leave road geometry intact; short built crossings span road edges.
export function drawCanal(r,b,s,{progress=1,dry=false,crossings=false,network=irrigationFor(s)}={}){
 const id=key(b.x,b.y),wet=!dry&&network.wet.has(id),arms=network.arms.get(id)||CARDINAL.filter(([dx,dy])=>s.buildings.some(v=>v.type==='canal'&&v.x===b.x+dx&&v.y===b.y+dy)||terrain(b.x+dx,b.y+dy,s)==='water');
 const directions=arms.length?arms:[[1,0],[-1,0]],p=r.point(b.x,b.y);
 for(const [dx,dy]of directions){const end=r.point(b.x+dx*.5*progress,b.y+dy*.5*progress);if(!crossings){r.line([p,end],'#b79662',11*r.s);r.line([p,end],'#745e42',7*r.s);r.line([p,end],wet?(b.silt>=.5?'#868b69':'#6eaaa6'):b.drain?'#746851':'#a6885b',4*r.s);if(wet&&!(b.silt>=.5))r.line([p,end],'#afcdb988',r.s);}else{
  const x=b.x+dx*.5,y=b.y+dy*.5;
  let layout=crossingCache.get(network);
  if(!layout||layout.streets!==r.streets){
   const points=new Set();for(const [id,cell]of network.cells)for(const [ax,ay]of network.arms.get(id)||[]){const px=cell.x+ax*.5,py=cell.y+ay*.5;
    if((r.streets?.edges||[]).some(([a,z])=>Math.abs((px-a.x)*(z.y-a.y)-(py-a.y)*(z.x-a.x))<1e-7&&px>=Math.min(a.x,z.x)&&px<=Math.max(a.x,z.x)&&py>=Math.min(a.y,z.y)&&py<=Math.max(a.y,z.y)))points.add(key(px,py));
   }layout={streets:r.streets,points};crossingCache.set(network,layout);
  }
  const road=layout.points.has(key(x,y));
  if(road)for(const offset of [-.06,0,.06])r.line([r.point(x-dy*.13+dx*offset,y+dx*.13+dy*offset),r.point(x+dy*.13+dx*offset,y-dx*.13+dy*offset)],'#c5ad7d',2*r.s);
 }}
}
