import {onBridge,worldWidth,worldHeight} from './world.js';
import {navigationSegmentClear,obstacleIndex} from './navigation.js';

const EPSILON=1e-6;
const MAX_WEAR=8;
const DECAY_SECONDS=36;
const LEVEL_THRESHOLD=[1.6,2.8,4.4,6.2];
const cache=new WeakMap(),terrainCache=new WeakMap();

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
 const key=s.buildings.map(b=>`${b.type}:${b.x},${b.y}:${b.footprint||1}:${b.construction?.kind||''}:${b.type==='cityGate'?b.rotation||0:''}`).join('|');
 let view=terrainCache.get(s);
 if(view?.key===key&&view.river===s.world?.river&&view.lakes===s.world?.lakes&&view.lakeCount===s.world?.lakes?.length)return view;
 view={key,river:s.world?.river,lakes:s.world?.lakes,lakeCount:s.world?.lakes?.length,obstacles:obstacleIndex(s.buildings)};
 terrainCache.set(s,view);
 return view;
}
function footpathAccess(s,navigation){
 const passability=new Map();
 return (id,a,b)=>{
  if(passability.has(id))return passability.get(id);
  const x=(a.x+b.x)/2,y=(a.y+b.y)/2;
  // Walking uses its existing obstacle and terrain rules. Bridges have their
  // own surface and must never acquire a dirt overlay.
  const dry=!onBridge(s.buildings,x,y,s)&&navigationSegmentClear(s,a,b,navigation.obstacles);
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
 const access=cachedFootpathAccess(s);
 for(const path of s.footpaths||[]){
  const wear=wearAt(path,s.simTime||0);
  if(wear<LEVEL_THRESHOLD[0])continue;
  const id=footpathId(path.a,path.b);
  if(finishedIds?.has(id)||!access(id,path.a,path.b))continue;
  const level=LEVEL_THRESHOLD.filter(threshold=>wear>=threshold).length;
  result.push({id,a:path.a,b:path.b,level});
 }
 return result;
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

// Round only a simple worn corner. At branch points the visible paths keep
// their original ends, and the curve stays within the walked corridor.
export function footpathRibbons(paths,canJoin=()=>true){
 const ribbons=paths.map(path=>({...path})),at=new Map(),corners=[];
 for(const ribbon of ribbons)for(const [end,other] of [['a','b'],['b','a']]){
  const point=ribbon[end],key=`${point.x},${point.y}`;
  if(!at.has(key))at.set(key,[]);
  at.get(key).push({ribbon,end,other:ribbon[other],point});
 }
 for(const edges of at.values()){
  if(edges.length!==2)continue;
  const [left,right]=edges,p=left.point;
  const dx=left.other.x-p.x,dy=left.other.y-p.y,ex=right.other.x-p.x,ey=right.other.y-p.y;
  if(Math.abs(dx*ey-dy*ex)<EPSILON||dx*ex+dy*ey>EPSILON)continue;
  const inset=(x,y)=>{const distance=.22/Math.hypot(x,y);return {x:p.x+x*distance,y:p.y+y*distance};};
  const a=inset(dx,dy),b=inset(ex,ey);
  const samples=[a,...[.25,.5,.75].map(t=>footpathRibbonPoint(a,b,p,t)),b];
  if(samples.some((sample,i)=>i>0&&!canJoin(samples[i-1],sample)))continue;
  left.ribbon[left.end]=a;
  right.ribbon[right.end]=b;
  corners.push({a,b,control:p,level:Math.min(left.ribbon.level,right.ribbon.level)});
 }
 return [...ribbons,...corners];
}

export function footpathRibbonPoint(a,b,control,t){
 const rest=1-t;
 return control
  ?{x:rest*rest*a.x+2*rest*t*control.x+t*t*b.x,y:rest*rest*a.y+2*rest*t*control.y+t*t*b.y}
  :{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
}
