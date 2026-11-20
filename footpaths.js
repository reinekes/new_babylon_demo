import {isDryPoint,onBridge,worldWidth,worldHeight} from './world.js';
import {navigationSegmentClear,obstacleIndex} from './navigation.js';
import {floodFootprint,floodPhase,floodProtectionRevision,floodedSegment} from './river-flood.js';

const EPSILON=1e-6;
const MAX_WEAR=8;
const DECAY_SECONDS=36;
const LEVEL_THRESHOLD=[1.6,2.8,4.4,6.2];
const cache=new WeakMap(),terrainCache=new WeakMap();
const residentEdges=new WeakMap();

export function footpathId(a,b){
 const key=p=>`${p.x+.5},${p.y+.5}`;
 const from=key(a),to=key(b);
 return `road:${from<to?`${from}|${to}`:`${to}|${from}`}`;
}
function wearAt(path,time){return Math.max(0,path.wear-Math.max(0,time-path.at)/DECAY_SECONDS);}
function routeStart(from,to){
 if(Math.abs(to.x+.5-Math.round(to.x+.5))>EPSILON||Math.abs(to.y+.5-Math.round(to.y+.5))>EPSILON)return null;
 const dx=to.x-from.x,dy=to.y-from.y,absX=Math.abs(dx),absY=Math.abs(dy);
 if(absX>1+EPSILON||absY>1+EPSILON||Math.max(absX,absY)<EPSILON)return null;
 if(absX>EPSILON&&absY>EPSILON&&Math.abs(absX-absY)>EPSILON)return null;
 return {x:to.x-(absX>EPSILON?Math.sign(dx):0),y:to.y-(absY>EPSILON?Math.sign(dy):0)};
}
function terrainAccess(s){
 const flood=floodPhase(s)==='active'?s.riverFlood:null;
 const buildings=s.buildings||[],key=buildings.map(b=>`${b.type}:${b.x},${b.y}:${b.footprint||1}:${b.construction?.kind||''}:${b.type==='cityGate'?b.rotation||0:''}`).join('|')+(flood?`/flood:${flood.along}:${flood.bank}:${floodProtectionRevision(s)}`:'');
 let view=terrainCache.get(s);
 if(view?.key!==key||view.river!==s.world?.river||view.lakes!==s.world?.lakes||view.lakeCount!==s.world?.lakes?.length){
  view={key,river:s.world?.river,lakes:s.world?.lakes,lakeCount:s.world?.lakes?.length,obstacles:obstacleIndex(buildings),flooded:flood&&floodFootprint(s,flood),controls:new Map(),offsets:new Map(),bridges:buildings.filter(b=>b.type==='bridge')};
  terrainCache.set(s,view);
 }
 return view;
}
function footpathAccess(s,navigation){
 const passability=new Map();
 return (id,a,b)=>{
  if(passability.has(id))return passability.get(id);
  const x=(a.x+b.x)/2,y=(a.y+b.y)/2;
  // Walking uses its existing obstacle and terrain rules. Bridges have their
  // own surface and must never acquire a dirt overlay.
  const dry=!(navigation.flooded&&floodedSegment(navigation.flooded,a,b))&&!onBridge(navigation.bridges||s.buildings||[],x,y,s)&&navigationSegmentClear(s,a,b,navigation.obstacles);
  passability.set(id,dry);
  return dry;
 };
}
const accessByTopology=new WeakMap();
function cachedFootpathAccess(s,navigation=terrainAccess(s)){
 let access=accessByTopology.get(navigation);
 if(!access){access=footpathAccess(s,navigation);accessByTopology.set(navigation,access);}
 return access;
}
function pathIndex(s,time){
 let index=cache.get(s);
 if(index?.paths!==s.footpaths||!index){
  const paths=s.footpaths??=[];
  index={paths,byId:new Map(paths.map(path=>[footpathId(path.a,path.b),path])),nextCleanup:Math.floor(time/DECAY_SECONDS)*DECAY_SECONDS};
  cache.set(s,index);
 }
 if(time>=index.nextCleanup){
  const cleanupAt=Math.floor(time/DECAY_SECONDS)*DECAY_SECONDS;
  index.nextCleanup=cleanupAt+DECAY_SECONDS;
  for(let i=index.paths.length-1;i>=0;i--){
   const path=index.paths[i];
   if(wearAt(path,cleanupAt)>0)continue;
   index.byId.delete(footpathId(path.a,path.b));
   index.paths.splice(i,1);
  }
 }
 return index;
}

// Only consumed walking distance counts. Grid diagonals and cardinal edges use
// the same wear model; a walking shortcut never becomes a road in the graph.
export function recordFootsteps(s,from,to,distance,navigation){
 if(distance<=EPSILON)return;
 const origin=routeStart(from,to);
 if(!origin)return;
 const time=s.simTime||0,id=footpathId(origin,to);
 if(!cachedFootpathAccess(s,navigation)(id,origin,to))return;
 const index=pathIndex(s,time);
 let path=index.byId.get(id);
 if(!path){
  const end={x:to.x,y:to.y};
  const [a,b]=origin.x<end.x||origin.x===end.x&&origin.y<end.y?[origin,end]:[end,origin];
  path={a,b,wear:0,at:time};
  index.byId.set(id,path);
  index.paths.push(path);
 }
 path.wear=Math.min(MAX_WEAR,wearAt(path,time)+distance);
 path.at=time;
}

export function visibleFootpaths(s,finishedIds=null){
 const result=[];
 if(!s.footpaths?.length)return result;
 const view=terrainAccess(s),access=cachedFootpathAccess(s,view);
 for(const path of s.footpaths||[]){
  const wear=wearAt(path,s.simTime||0);
  if(wear<LEVEL_THRESHOLD[0])continue;
  const id=footpathId(path.a,path.b);
  if(finishedIds?.has(id)||!access(id,path.a,path.b))continue;
  const level=LEVEL_THRESHOLD.filter(threshold=>wear>=threshold).length;
  result.push({id,a:path.a,b:path.b,level,control:footpathControl(s,view,id,path.a,path.b)});
 }
 return result;
}

// All streets crossing a point share a ground offset. Coordinates vary over
// several plots, so a long street keeps its sweep through grid junctions.
function groundOffset(s,view,x,y){
 const key=x+','+y;
 if(view.offsets.has(key))return view.offsets.get(key);
 const phase=(s.world?.seed||0)*.013;
 const dx=.092*Math.sin(y*.81+x*.23-phase)+.029*Math.sin(x*.67-y*.47+phase);
 const dy=.109*Math.sin(x*.87+y*.31+phase)+.037*Math.cos(x*.39-y*.74-phase);
 let room=1;
 for(let xx=Math.floor(x);xx<=Math.ceil(x);xx++)for(let yy=Math.floor(y);yy<=Math.ceil(y);yy++){
  for(const box of view.obstacles.get(xx+','+yy)||[]){
   const clearance=Math.hypot(Math.max(box.minX-x,x-box.maxX,0),Math.max(box.minY-y,y-box.maxY,0));
   room=Math.min(room,Math.max(0,(clearance-.06)/.37));
  }
 }
 for(const [ox,oy] of [[0,0],[-.23,-.23],[-.23,.23],[.23,-.23],[.23,.23]]){
  if(!isDryPoint(s,x+ox,y+oy)||onBridge(view.bridges,x+ox,y+oy,s)){room=0;break;}
 }
 room=room*room*(3-2*room);
 const offset={x:dx*room,y:dy*room};view.offsets.set(key,offset);return offset;
}

function footpathControl(s,view,id,from,to){
 if(view.controls.has(id))return view.controls.get(id);
 const [a,b]=from.x<to.x||from.x===to.x&&from.y<to.y?[from,to]:[to,from];
 let control=null;
 if(!onBridge(view.bridges,(a.x+b.x)/2,(a.y+b.y)/2,s)&&navigationSegmentClear(s,a,b,view.obstacles)){
  const along=t=>groundOffset(s,view,a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);
  const start=along(0),end=along(1);
  // Opposite segments evaluate the same gradient at a junction. Convert it
  // to Bézier handles so their verges and walkers share the incoming heading.
  const handle=(point,t,sign)=>{
   if(!point.x&&!point.y)return point;
   const back=along(t-.25),front=along(t+.25);
   return {x:point.x+sign*(front.x-back.x)*2/3,y:point.y+sign*(front.y-back.y)*2/3};
  };
  const offsets=[start,handle(start,0,1),handle(end,1,-1),end];
  if(offsets.some(d=>d.x||d.y)){
   let prev=footpathRibbonPoint(a,b,offsets,0),clear=true;
   for(let i=1;i<=8;i++){
    const next=footpathRibbonPoint(a,b,offsets,i/8);
    if(!isDryPoint(s,next.x,next.y)||onBridge(view.bridges,next.x,next.y,s)||!navigationSegmentClear(s,prev,next,view.obstacles)){clear=false;break;}
    prev=next;
   }
   if(clear)control=offsets;
  }
 }
 view.controls.set(id,control);return control;
}

// Take the topology snapshot once for the complete Canvas or WebGL road pass.
export function streetCurveLookup(s){
 const view=terrainAccess(s);
 return (a,b,id=footpathId(a,b))=>footpathControl(s,view,id,a,b);
}

export function residentFootpathPositions(s){
 let view;
 return c=>{
  if(c.waterTrip?.fire||c.floodShelter||c.fireShelter||c.controlled||c.eventContact||c.festivalContact||c.funeralContact)return null;
  const route=c.waterTrip?.route||c.route,index=c.waterTrip?.index??c.routeIndex;
  const a=route?.[index-1],b=route?.[index];
  if(!a||!b)return null;
  view??=terrainAccess(s);
  let edge=residentEdges.get(b);
  if(edge?.start!==a||edge.view!==view){
   const origin=routeStart(a,b),grid=origin&&Math.abs(origin.x-a.x)<EPSILON&&Math.abs(origin.y-a.y)<EPSILON;
   const id=grid&&footpathId(a,b);
   edge={start:a,view,id,control:id?footpathControl(s,view,id,a,b):null};
   residentEdges.set(b,edge);
  }
  if(!edge.control)return null;
  const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((c.x-a.x)*dx+(c.y-a.y)*dy)/(dx*dx+dy*dy)));
  return {...footpathRibbonPoint(a,b,edge.control,t),followingFootpath:true};
 };
}

export function validateFootpaths(s){
 if(s.footpaths===undefined)return true;
 if(!Array.isArray(s.footpaths)||s.footpaths.length>(worldWidth(s)+1)*(worldHeight(s)+1)*4)return false;
 const seen=new Set(),validPoint=p=>p&&Number.isInteger(p.x+.5)&&Number.isInteger(p.y+.5)&&p.x>=-.5&&p.y>=-.5&&p.x<=worldWidth(s)-.5&&p.y<=worldHeight(s)-.5;
 for(const path of s.footpaths){
  if(!path||!validPoint(path.a)||!validPoint(path.b)||!routeStart(path.a,path.b)||
    !Number.isFinite(path.wear)||path.wear<=0||path.wear>MAX_WEAR||!Number.isFinite(path.at)||path.at<0||path.at>s.simTime+EPSILON)return false;
  const id=footpathId(path.a,path.b);
  if(seen.has(id))return false;
  seen.add(id);
 }
 return true;
}

export function footpathRibbonPoint(a,b,control,t){
 const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
 if(!control)return {x,y};
 const u=a.x<b.x||a.x===b.x&&a.y<b.y?t:1-t,v=1-u;
 const k0=v*v*v,k1=3*u*v*v,k2=3*u*u*v,k3=u*u*u;
 return {x:x+control[0].x*k0+control[1].x*k1+control[2].x*k2+control[3].x*k3,
  y:y+control[0].y*k0+control[1].y*k1+control[2].y*k2+control[3].y*k3};
}

export function footpathRibbonTangent(a,b,control,t){
 const dx=b.x-a.x,dy=b.y-a.y;
 if(!control)return {x:dx,y:dy};
 const sign=a.x<b.x||a.x===b.x&&a.y<b.y?1:-1,u=sign===1?t:1-t,v=1-u;
 const [a0,a1,a2,a3]=control,k0=3*sign*v*v,k1=6*sign*u*v,k2=3*sign*u*u;
 return {x:dx+(a1.x-a0.x)*k0+(a2.x-a1.x)*k1+(a3.x-a2.x)*k2,
  y:dy+(a1.y-a0.y)*k0+(a2.y-a1.y)*k1+(a3.y-a2.y)*k2};
}
