import {buildingKey} from './definitions.js';
import {navigationSegmentClear} from './navigation.js';
import {isDryPoint} from './world.js';

// A ceremony owns a real walking-grid approach. Small, stable presentation
// places surround that shared anchor; none are written into citizens or saves.
const layouts=new WeakMap(),radius=.68,separation=.15;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function dryApproach(s,a,b){
 if(!navigationSegmentClear(s,a,b))return false;
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
 cache.set(venue,best);return best;
}
