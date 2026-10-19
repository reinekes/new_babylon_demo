import {terrain} from './world.js';
import {isOperational} from './definitions.js';
export const CARDINAL=[[1,0],[0,1],[-1,0],[0,-1]];
const cache=new WeakMap(),crossingCache=new WeakMap(),key=(x,y)=>`${x},${y}`;
// Derived topology only: water is never a second stock saved alongside buildings.
export function irrigationFor(s){
 const canals=s.buildings.filter(b=>b.type==='canal'),fields=new Set(s.buildings.filter(b=>b.type==='field').map(b=>key(b.x,b.y))),signature=canals.map(b=>`${b.x},${b.y}:${isOperational(b)?1:0}`).join('|')+';'+[...fields].join('|');
 const old=cache.get(s);if(old?.signature===signature)return old;
 const cells=new Map(canals.filter(isOperational).map(b=>[key(b.x,b.y),b])),wet=new Set(),arms=new Map();
 const riverAt=(x,y)=>terrain(x,y)==='water';
 for(const [id,b]of cells){arms.set(id,CARDINAL.filter(([dx,dy])=>(cells.has(key(b.x+dx,b.y+dy))||fields.has(key(b.x+dx,b.y+dy)))||riverAt(b.x+dx,b.y+dy)));if(CARDINAL.some(([dx,dy])=>riverAt(b.x+dx,b.y+dy)))wet.add(id);}
 const queue=[...wet];for(let i=0;i<queue.length;i++){const b=cells.get(queue[i]);for(const [dx,dy]of CARDINAL){const next=key(b.x+dx,b.y+dy);if(cells.has(next)&&!wet.has(next)){wet.add(next);queue.push(next);}}}
 const irrigated=new Set();for(const id of wet){const b=cells.get(id);for(const [dx,dy]of CARDINAL)irrigated.add(key(b.x+dx,b.y+dy));}
 const result={signature,cells,wet,arms,irrigated};cache.set(s,result);return result;
}
export function fieldWater(s,b){
 const canal=irrigationFor(s).irrigated.has(key(b.x,b.y)),natural=terrain(b.x,b.y,s)==='fertile';
 return {canal,natural,productive:canal||natural,label:canal?'Вода из канала · защита от засухи':natural?'Приречная земля · естественная влага':'Нет воды · работа приостановлена'};
}
// Shallow channels leave road geometry intact; short built crossings span road edges.
export function drawCanal(r,b,s,{progress=1,dry=false,crossings=false,network=irrigationFor(s)}={}){
 const id=key(b.x,b.y),wet=!dry&&network.wet.has(id),arms=network.arms.get(id)||CARDINAL.filter(([dx,dy])=>s.buildings.some(v=>v.type==='canal'&&v.x===b.x+dx&&v.y===b.y+dy)||terrain(b.x+dx,b.y+dy)==='water');
 const directions=arms.length?arms:[[1,0],[-1,0]],p=r.point(b.x,b.y);
 for(const [dx,dy]of directions){const end=r.point(b.x+dx*.5*progress,b.y+dy*.5*progress);if(!crossings){r.line([p,end],'#b79662',11*r.s);r.line([p,end],'#745e42',7*r.s);r.line([p,end],wet?'#6eaaa6':'#a6885b',4*r.s);if(wet)r.line([p,end],'#afcdb988',r.s);}else{
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
