import {terrain} from './world.js';
import {isOperational} from './definitions.js';
import {allocateCanalWater} from './canal-flow.js';
import {canalMaintenanceEnabled,canalShares} from './canal-maintenance.js';
export const CARDINAL=[[1,0],[0,1],[-1,0],[0,-1]];
const cache=new WeakMap(),crossingCache=new WeakMap(),key=(x,y)=>`${x},${y}`;
// Derived topology only: water is never a second stock saved alongside buildings.
export function irrigationFor(s){
 const limited=canalMaintenanceEnabled(s),canals=s.buildings.filter(b=>b.type==='canal'),fields=new Set(s.buildings.filter(b=>b.type==='field'&&(!limited||isOperational(b))).map(b=>key(b.x,b.y))),lakes=(s.world?.lakes||[]).map(l=>l.cells.map(c=>key(c.x,c.y)).join(';')).join('|'),signature=canals.map(b=>`${b.x},${b.y}:${isOperational(b)?1:0}:${limited?canalShares(b):'-'}`).join('|')+';'+[...fields].join('|')+';lakes:'+lakes+';river:'+JSON.stringify(s.world?.river);
 const old=cache.get(s);if(old?.signature===signature)return old;
 const cells=new Map(canals.filter(isOperational).map(b=>[key(b.x,b.y),b])),wet=new Set(),arms=new Map();
 const waterAt=(x,y)=>terrain(x,y,s)==='water';
 for(const [id,b]of cells){arms.set(id,CARDINAL.filter(([dx,dy])=>(cells.has(key(b.x+dx,b.y+dy))||fields.has(key(b.x+dx,b.y+dy)))||waterAt(b.x+dx,b.y+dy)));if(CARDINAL.some(([dx,dy])=>waterAt(b.x+dx,b.y+dy)))wet.add(id);}
 const heads=[...wet],adjacent=new Map(),capacity=new Map();
 for(const [id,b] of cells){
  adjacent.set(id,CARDINAL.map(([dx,dy])=>key(b.x+dx,b.y+dy)).filter(next=>cells.has(next)));
  if(limited)capacity.set(id,canalShares(b));
 }
 if(limited)for(const id of heads)if(!capacity.get(id))wet.delete(id);
 const queue=[...wet];for(let i=0;i<queue.length;i++)for(const next of adjacent.get(queue[i])){
  if(wet.has(next)||limited&&!capacity.get(next))continue;
  wet.add(next);queue.push(next);
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
 const flow=limited?allocateCanalWater({adjacent,heads,capacity,fields:new Map([...reachableFields].filter(([id])=>fields.has(id)))}):null;
 const irrigated=new Set(flow?flow.routes.keys():reachableFields.keys());
 const result={signature,cells,wet,arms,irrigated,reachableFields,flow,fields,heads,adjacent};cache.set(s,result);return result;
}
export function fieldWater(s,b){
 const network=irrigationFor(s),id=key(b.x,b.y),natural=terrain(b.x,b.y,s)==='fertile';
 let canal=network.irrigated.has(id);
 if(network.flow&&!network.fields.has(id)&&network.reachableFields.has(id)){
  canal=allocateCanalWater({adjacent:network.adjacent,heads:network.heads,capacity:network.flow.residual,fields:new Map([[id,network.reachableFields.get(id)]])}).routes.has(id);
 }
 return {canal,natural,productive:canal||natural,label:canal?'Вода из канала · защита от засухи':network.flow&&network.reachableFields.has(id)?'Канал рядом, свободной доли воды нет':natural?'Приречная земля · естественная влага':'Нет воды · работа приостановлена'};
}
// Shallow channels leave road geometry intact; short built crossings span road edges.
export function drawCanal(r,b,s,{progress=1,dry=false,crossings=false,network=irrigationFor(s)}={}){
 const id=key(b.x,b.y),wet=!dry&&network.wet.has(id),arms=network.arms.get(id)||CARDINAL.filter(([dx,dy])=>s.buildings.some(v=>v.type==='canal'&&v.x===b.x+dx&&v.y===b.y+dy)||terrain(b.x+dx,b.y+dy,s)==='water');
 const directions=arms.length?arms:[[1,0],[-1,0]],p=r.point(b.x,b.y);
 for(const [dx,dy]of directions){const end=r.point(b.x+dx*.5*progress,b.y+dy*.5*progress);if(!crossings){r.line([p,end],'#b79662',11*r.s);r.line([p,end],'#745e42',7*r.s);r.line([p,end],wet?(b.silt>=.5?'#868b69':'#6eaaa6'):'#a6885b',4*r.s);if(wet&&!(b.silt>=.5))r.line([p,end],'#afcdb988',r.s);}else{
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
