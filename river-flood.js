import {riverLength,riverLocal,signedRiverDistance,terrain,worldHeight,worldWidth} from './world.js';
import {isStrictSumer} from './scenario-profiles.js';
import {isOperational} from './definitions.js';
import {canalShares} from './canal-maintenance.js';

const SPILL_REACH=5;
const BANK_WIDTH=3.5;
const tileKey=(x,y)=>`${x},${y}`;

export function floodPhase(state){
 const flood=state.riverFlood;
 if(!flood)return null;
 if(state.year===flood.year-1&&state.season===3)return 'warning';
 if(state.year===flood.year&&state.season===0)return 'active';
 return null;
}

export function changeFloodSeason(state){
 if(!isStrictSumer(state))return null;
 const current=floodPhase(state);
 if(state.riverFlood){
  if(current)return current;
  delete state.riverFlood;
  return 'ended';
 }
 if(state.season!==3||state.year%4!==3)return null;
 let closest=null,distance=Infinity;
 for(const home of state.buildings){
  if(home.type!=='house'||!isOperational(home))continue;
  const offset=signedRiverDistance(home.x,home.y,state),gap=Math.abs(offset);
  if(gap>=distance)continue;
  closest={along:riverLocal(home.x,home.y,state).along,bank:offset<0?-1:1};
  distance=gap;
 }
 if(!closest)return null;
 state.riverFlood={year:state.year+1,...closest};
 return 'warning';
}

export function validateRiverFlood(state){
 const flood=state.riverFlood;
 return flood===undefined||!!flood&&isStrictSumer(state)&&
  Number.isSafeInteger(flood.year)&&flood.year>=4&&flood.year%4===0&&
  Number.isSafeInteger(flood.along)&&flood.along>=0&&flood.along<riverLength(state)&&
  (flood.bank===-1||flood.bank===1)&&floodPhase(state)!==null;
}

const neighbors=[[1,0],[0,1],[-1,0],[0,-1]];
const openDrain=b=>b.type==='canal'&&b.drain&&isOperational(b)&&canalShares(b)>0;
export const floodProtectionRevision=state=>(state.buildings||[]).filter(b=>openDrain(b)||b.type==='levee'&&isOperational(b)).map(b=>`${b.type}:${tileKey(b.x,b.y)}`).join('|');

function drainFlood(state,flooded,along){
 const channels=new Map((state.buildings||[]).filter(openDrain).map(b=>[tileKey(b.x,b.y),b]));
 const hasSafeOutlet=b=>neighbors.some(([dx,dy])=>{
  const x=b.x+dx,y=b.y+dy;
  return Math.abs(riverLocal(x,y,state).along-along)>SPILL_REACH&&terrain(x,y,state)==='water';
 });
 const queue=[...channels.values()].filter(hasSafeOutlet);
 const seen=new Set(queue);
 for(let i=0;i<queue.length;i++){
  const b=queue[i];
  flooded.delete(tileKey(b.x,b.y));
  for(const [dx,dy] of neighbors){
   const id=tileKey(b.x+dx,b.y+dy),next=channels.get(id);
   flooded.delete(id);
   if(next&&!seen.has(next)){seen.add(next);queue.push(next);}
  }
 }
}

function protectWithLevees(state,potential){
 const walls=new Set((state.buildings||[]).filter(b=>b.type==='levee'&&isOperational(b)).map(b=>tileKey(b.x,b.y)));
 if(![...walls].some(key=>potential.has(key)))return potential;
 const exposed=new Set(),queue=[];
 for(const id of potential){
  if(walls.has(id))continue;
  const [x,y]=id.split(',').map(Number);
  if(neighbors.some(([dx,dy])=>Math.abs(signedRiverDistance(x+dx,y+dy,state))<1.1)){
   exposed.add(id);queue.push([x,y]);
  }
 }
 for(let i=0;i<queue.length;i++){
  const [x,y]=queue[i];
  for(const [dx,dy] of neighbors){
   const id=tileKey(x+dx,y+dy);
   if(!potential.has(id)||walls.has(id)||exposed.has(id))continue;
   exposed.add(id);queue.push([x+dx,y+dy]);
  }
 }
 return exposed;
}

export function floodFootprint(state,{along,bank},{withDrainage=true,withLevees=true}={}){
 const flooded=new Set();
 for(let y=0;y<worldHeight(state);y++)for(let x=0;x<worldWidth(state);x++){
  const distanceAlong=Math.abs(riverLocal(x,y,state).along-along);
  if(distanceAlong>SPILL_REACH)continue;
  const distanceFromBank=signedRiverDistance(x,y,state)*bank;
  const width=BANK_WIDTH-distanceAlong*.35;
  if(distanceFromBank>=1.1&&distanceFromBank<width&&terrain(x,y,state)!=='water')flooded.add(tileKey(x,y));
 }
 const exposed=withLevees?protectWithLevees(state,flooded):flooded;
 if(withDrainage)drainFlood(state,exposed,along);
 return exposed;
}

export const JAR_FOOD_CAPACITY=8;

export function storageJarCover(building){
 const food=building.stock?.food||0;
 const jars=Math.min(Math.floor(building.stock?.pottery||0),Math.ceil(food/JAR_FOOD_CAPACITY));
 return {jars,covered:Math.min(food,jars*JAR_FOOD_CAPACITY)};
}

// Only unprotected food still physically in flooded warehouses can spoil.
export function floodStorageRisk(state,footprint){
 return state.buildings.filter(b=>['granary','depot'].includes(b.type)&&isOperational(b)&&b.stock?.food>0&&footprint.has(tileKey(b.x,b.y)))
  .map(building=>{
   const {jars,covered}=storageJarCover(building);
   return {building,key:tileKey(building.x,building.y),jars,covered,loss:(building.stock.food-covered)/(building.joineryLevels?.length?8:4)};
  });
}

function intersectsTile(a,b,x,y){
 let enter=0,leave=1;
 for(const [start,end,center] of [[a.x,b.x,x],[a.y,b.y,y]]){
  const delta=end-start,min=center-.5,max=center+.5;
  if(delta===0){
   if(start<min||start>max)return false;
   continue;
  }
  const first=(min-start)/delta,last=(max-start)/delta;
  enter=Math.max(enter,Math.min(first,last));
  leave=Math.min(leave,Math.max(first,last));
  if(enter>leave)return false;
 }
 return true;
}

export function floodedSegment(footprint,a,b){
 for(let y=Math.ceil(Math.min(a.y,b.y)-.5);y<=Math.floor(Math.max(a.y,b.y)+.5);y++){
  for(let x=Math.ceil(Math.min(a.x,b.x)-.5);x<=Math.floor(Math.max(a.x,b.x)+.5);x++){
   if(footprint.has(tileKey(x,y))&&intersectsTile(a,b,x,y))return true;
  }
 }
 return false;
}

export function floodedRoads(state,footprint){
 return (state.roads||[]).filter(road=>floodedSegment(footprint,road.a,road.b));
}

// A resident already inside the spill can leave along ordinary walkable
// ground. Once outside, all subsequent steps use the dry network.
export function floodEscapeRoute(normal,restricted,origin,shelters){
 if(!normal.nodes.has(origin))return null;
 const previous=new Map([[origin,null]]),queue=[origin];
 for(let i=0;i<queue.length;i++){
  const key=queue[i],isDry=restricted.nodes.has(key);
  if(isDry&&shelters.has(key)){
   const path=[];
   for(let step=key;step!==null;step=previous.get(step))path.push(normal.nodes.get(step));
   return path.reverse();
  }
  const graph=isDry?restricted.graph:normal.graph;
  for(const next of graph.get(key)||[]){
   if(previous.has(next))continue;
   previous.set(next,key);
   queue.push(next);
  }
 }
 return null;
}

const mapViews=new WeakMap();
export function floodMapView(state){
 const phase=floodPhase(state);
 if(!phase)return null;
 const {along,bank}=state.riverFlood;
 const signature=`${phase}:${along},${bank}:${floodProtectionRevision(state)}`;
 const cached=mapViews.get(state);
 if(cached?.signature===signature&&cached.world===state.world&&cached.lakes===state.world?.lakes)return cached.view;
 const tiles=[...floodFootprint(state,state.riverFlood)].map(key=>{
  const [x,y]=key.split(',').map(Number);
  return {x,y};
 });
 const view={phase,tiles};
 mapViews.set(state,{signature,world:state.world,lakes:state.world?.lakes,view});
 return view;
}
