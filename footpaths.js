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
 const key=s.buildings.map(b=>`${b.type}:${b.x},${b.y}:${b.footprint||1}:${b.construction?.kind||''}:${b.type==='cityGate'?b.rotation||0:''}`).join('|')+(flood?`/flood:${flood.along}:${flood.bank}:${floodProtectionRevision(s)}`:'');
 let view=terrainCache.get(s);
 if(view?.key!==key||view.river!==s.world?.river||view.lakes!==s.world?.lakes||view.lakeCount!==s.world?.lakes?.length){
  view={key,river:s.world?.river,lakes:s.world?.lakes,lakeCount:s.world?.lakes?.length,obstacles:obstacleIndex(s.buildings),flooded:flood&&floodFootprint(s,flood),controls:new Map()};
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
  const dry=!(navigation.flooded&&floodedSegment(navigation.flooded,a,b))&&!onBridge(s.buildings,x,y,s)&&navigationSegmentClear(s,a,b,navigation.obstacles);
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

function footpathControl(s,view,id,from,to){
 if(view.controls.has(id))return view.controls.get(id);
 const [a,b]=from.x<to.x||from.x===to.x&&from.y<to.y?[from,to]:[to,from];
 const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
 // Adjacent stretches on a straight run bend to alternating sides so their
 // tangents lead into one another. Opposite trips share the same control.
 const along=Math.floor(dx?mx:my),across=Math.floor(dx?my-dy*mx:mx);
 const line=Math.imul(across+3,374761393)^(s.world?.seed||0),shape=(Math.imul(along+2,1274126177)^line)>>>0;
 const side=((along+line)&1)?1:-1,bend=.38+(shape%29)/200;
 const clear=(p,q)=>isDryPoint(s,p.x,p.y)&&isDryPoint(s,q.x,q.y)&&!(view.flooded&&floodedSegment(view.flooded,p,q))&&navigationSegmentClear(s,p,q,view.obstacles);
 let control=null;
 if(len>EPSILON&&cachedFootpathAccess(s,view)(id,a,b))for(const offset of [side*bend,-side*bend,side*bend*.5,-side*bend*.5]){
  const candidate={x:mx-dy/len*offset,y:my+dx/len*offset};
  let previous=a,safe=true;
  for(let i=1;i<=8;i++){
   const point=footpathRibbonPoint(a,b,candidate,i/8);
   if(!clear(previous,point)){safe=false;break;}
   previous=point;
  }
  if(safe){control=candidate;break;}
 }
 view.controls.set(id,control);
 return control;
}

export function residentFootpathPositions(s){
 let view;
 return c=>{
  if(c.waterTrip||c.floodShelter||c.fireShelter||c.controlled||c.eventContact||c.festivalContact||c.funeralContact)return null;
  const a=c.route?.[c.routeIndex-1],b=c.route?.[c.routeIndex];
  if(!a||!b)return null;
  if(!view){
   view=terrainAccess(s);
   if(view.roads!==s.roads||view.roadCount!==s.roads?.length){
    view.roads=s.roads;view.roadCount=s.roads?.length;
    view.roadById=new Map((s.roads||[]).map(r=>[r.id,r]));
   }
  }
  let edge=residentEdges.get(b);
  if(edge?.start!==a||edge.view!==view){
   const origin=routeStart(a,b),grid=origin&&Math.abs(origin.x-a.x)<EPSILON&&Math.abs(origin.y-a.y)<EPSILON;
   const id=grid&&footpathId(a,b);
   edge={start:a,view,id,control:id?footpathControl(s,view,id,a,b):null};
   residentEdges.set(b,edge);
  }
  if(!edge.control)return null;
  const road=view.roadById?.get(edge.id);
  if(road&&(road.construction||road.level>1||road.built!==false))return null;
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
 const rest=1-t;
 return control
  ?{x:rest*rest*a.x+2*rest*t*control.x+t*t*b.x,y:rest*rest*a.y+2*rest*t*control.y+t*t*b.y}
  :{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
}
