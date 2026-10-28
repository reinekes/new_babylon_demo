import {buildingKey} from './definitions.js';
import {navigationSegmentClear,nearestWalkingNode,shortestWalkingPath,navigationDistance} from './navigation.js';
import {isDryPoint} from './world.js';

// A ceremony owns a real walking-grid approach. Small, stable presentation
// places surround that shared anchor; none are written into citizens or saves.
const layouts=new WeakMap(),radius=.68,separation=.15;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function ceremonyJoinPath(state,network,from,to){
 const clear=(a,b)=>navigationSegmentClear(state,a,b,network.navigation?.obstacles);
 if(clear(from,to))return [{...to}];
 const near=p=>{const n=nearestWalkingNode(network,p);return n?[n,...[...network.graph.get(n.key)||[]].map(key=>network.nodes.get(key))].filter(q=>clear(p,q)):[];};
 let best=null,length=Infinity;
 for(const a of near(from))for(const b of near(to)){
  const path=shortestWalkingPath(network,a.key,b.key);if(!path)continue;
  const cost=Math.hypot(from.x-a.x,from.y-a.y)+navigationDistance(path)+Math.hypot(to.x-b.x,to.y-b.y);
  if(cost<length){length=cost;best=[...path,{...to}];}
 }
 return best;
}
// A transient render record owns this approach, never a saved resident. Both
// views use the same safe graph corners when joining or leaving a torch patrol.
export function ceremonyJoinStep(a,state,network,target,dt,paused,speed){
 const from={x:a.lastX,y:a.lastY},join=a.ceremonyJoin;
 if(paused)return from;
 if(!join.path||Math.hypot(target.x-join.target.x,target.y-join.target.y)>.25){join.path=ceremonyJoinPath(state,network,from,target);join.target={...target};join.index=0;}
 if(!join.path)return from;
 while(join.index<join.path.length&&Math.hypot(join.path[join.index].x-from.x,join.path[join.index].y-from.y)<1e-7)join.index++;
 const waypoint=join.path[join.index];
 if(!waypoint){if(Math.hypot(target.x-from.x,target.y-from.y)<1e-6)a.ceremonyJoin=null;else join.path=null;return from;}
 const distance=Math.hypot(waypoint.x-from.x,waypoint.y-from.y),step=Math.min(distance,.30*dt*speed),next={x:from.x+(waypoint.x-from.x)*step/distance,y:from.y+(waypoint.y-from.y)*step/distance};
 // Stop at each graph corner for this frame rather than cutting its inside.
 if(step>=distance-1e-8)join.index++;
 if(join.index>=join.path.length){if(Math.hypot(target.x-next.x,target.y-next.y)<1e-6)a.ceremonyJoin=null;else join.path=null;}
 return next;
}
function dryApproach(s,a,b,obstacles){
 if(!navigationSegmentClear(s,a,b,obstacles))return false;
 const steps=Math.max(2,Math.ceil(distance(a,b)/.08));
 for(let i=0;i<=steps;i++){const t=i/steps;if(!isDryPoint(s,a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t))return false;}return true;
}
function placesAround(s,center){
 const places=[];
 // Leave the serving mat and hearths clear. The two rings have at least .15
 // cells between neighbours, even when the outer ring is partially obstructed.
 for(const [r,count]of [[.50,20],[radius,28]])for(let i=0;i<count;i++){
  const angle=i*Math.PI*2/count,p={x:center.x+Math.cos(angle)*r,y:center.y+Math.sin(angle)*r};
  if(dryApproach(s,center,p)&&places.every(q=>distance(p,q)>=separation-1e-8))places.push({...p,yaw:Math.atan2(center.x-p.x,center.y-p.y)});
 }
 return places;
}
function propsClear(s,center){
 const corners=[[-.40,-.24],[.40,-.24],[.40,.24],[-.40,.24]].map(([x,y])=>({x:center.x+x,y:center.y+y}));
 return isDryPoint(s,center.x,center.y)&&corners.every((p,i)=>dryApproach(s,center,p)&&dryApproach(s,p,corners[(i+1)%corners.length]));
}
function torchPatrol(s,network,center){
 // Walk existing dry grid edges around the gathering, keeping the serving mat
 // and the compact dancing rings clear. A built-up courtyard may have no patrol.
 const candidates=new Map([...network.nodes].filter(([,p])=>{const d=distance(p,center);return d>=.9&&d<=2.6&&isDryPoint(s,p.x,p.y);}));
 const edges=new Map(),neighbours=p=>{
  if(!edges.has(p.key))edges.set(p.key,[...network.graph.get(p.key)||[]].map(key=>candidates.get(key)).filter(q=>q&&dryApproach(s,p,q,network.navigation?.obstacles)));
  return edges.get(p.key);
 };
 const start=[...network.graph.get(center.key)||[]].map(key=>candidates.get(key)).filter(p=>p&&dryApproach(s,center,p)).sort((a,b)=>a.y-b.y||a.x-b.x)[0];if(!start)return null;
 const reachable=new Map([[start.key,start]]),queue=[start];
 for(let i=0;i<queue.length;i++)for(const p of neighbours(queue[i]))if(!reachable.has(p.key)){reachable.set(p.key,p);queue.push(p);}
 if(reachable.size<3)return null;
 const targets=[];
 for(const [dx,dy]of [[0,-1],[1,0],[0,1],[-1,0]]){
  const target={x:center.x+dx*1.8,y:center.y+dy*1.8},p=[...reachable.values()].sort((a,b)=>distance(a,target)-distance(b,target)||a.y-b.y||a.x-b.x)[0];
  if(!targets.some(q=>q.key===p.key))targets.push(p);
 }
 if(targets.length<2)return null;
 function path(from,to){
  const previous=new Map([[from.key,null]]),queue=[from];
  for(let i=0;i<queue.length&&!previous.has(to.key);i++)for(const p of neighbours(queue[i]))if(reachable.has(p.key)&&!previous.has(p.key)){previous.set(p.key,queue[i].key);queue.push(p);}
  if(!previous.has(to.key))return null;const result=[];for(let key=to.key;key!==null;key=previous.get(key))result.push(reachable.get(key));return result.reverse();
 }
 const points=[targets[0]];
 for(let i=0;i<targets.length;i++){const leg=path(targets[i],targets[(i+1)%targets.length]);if(!leg)return null;points.push(...leg.slice(1));}
 const segments=[];let length=0;
 for(let i=1;i<points.length;i++){const from=points[i-1],to=points[i],span=distance(from,to);segments.push({from,to,start:length,length:span});length+=span;}
 return length>=3?{segments,length}:null;
}
export function festivalTorchContact(layout,elapsed,slot,count){
 const patrol=layout?.torchPatrol;if(!patrol)return null;
 const walked=((Math.max(0,elapsed)*.22+slot*patrol.length/count)%patrol.length+patrol.length)%patrol.length,segment=patrol.segments.find(p=>walked<p.start+p.length)||patrol.segments.at(-1),t=(walked-segment.start)/segment.length,{from,to}=segment;
 return {x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,yaw:Math.atan2(to.x-from.x,to.y-from.y),fromKey:from.key,toKey:to.key,slot};
}
export function festivalCourtLayout(s,network,venue){
 let cache=layouts.get(network);if(!cache){cache=new Map();layouts.set(network,cache);}if(cache.has(venue))return cache.get(venue);
 const port=network.ports.find(p=>!p.building.siteKey&&buildingKey(p.building)===venue);if(!port)return null;
 const candidates=[...network.nodes.values()].filter(p=>distance(p,port)<=2&&network.components.get(p.key)===network.components.get(port.key)).sort((a,b)=>distance(a,port)-distance(b,port)||a.y-b.y||a.x-b.x);
 let best=null;
 for(const center of candidates){
  if(!propsClear(s,center))continue;
  const places=placesAround(s,center),layout={center:{x:center.x,y:center.y,key:center.key,radius,yaw:0},places};
  if(!best||places.length>best.places.length)best=layout;
  if(places.length>=24){best=layout;break;}
 }
 if(best)best.torchPatrol=torchPatrol(s,network,best.center);
 cache.set(venue,best);return best;
}
