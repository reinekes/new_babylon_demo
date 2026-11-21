import {MATERIALS} from './definitions.js';
import {footprintSize} from './footprints.js';
import {irrigationFor} from './irrigation.js';
import {isDryPoint} from './world.js';

// Coordinates are metres from the building origin. The chair/bowl positions
// follow the actual fittings drawn in workshop-architecture.js.
export const freightCourts=new Set(['granary','depot','market','harbor']);
const receivingPhases=new Set(['toStore','toDistrictStore','toSaleMarket']);
const collectingPhases=new Set(['toMarket','toDistrictSupply','toSaleSupply','toSupply','toCraftSupply','toClothesSupply','toPantrySupply','toCommonMeal']);
const quarter=[[1,0],[0,1],[-1,0],[0,-1]];
function worldPoint(b,x,z){
 const m=(footprintSize(b)-1)*3,[c,s]=quarter[(b.rotation||0)%4];
 return {x:b.x+(m+(x-m)*c+(z-m)*s)/6,y:b.y+(m-(x-m)*s+(z-m)*c)/6};
}
// The same temple mesh can rotate without moving the city's receiving corner.
export function templeStoreBaskets(b){
 const n=footprintSize(b),m=(n-1)*3,offset=n*3-.60;
 return [[1,1],[1,-1],[-1,1],[-1,-1]].map(([sx,sz])=>({x:m+sx*offset,z:m+sz*offset,height:.83}));
}
function templeStoreStation(b,port){
 const n=footprintSize(b),cx=b.x+(n-1)/2,cy=b.y+(n-1)/2,dx=port.x-cx,dy=port.y-cy;
 if(Math.abs(Math.abs(dx)-n/2)>.001||Math.abs(Math.abs(dy)-n/2)>.001)return null;
 return {stand:port,target:{x:port.x-Math.sign(dx)*.07,y:port.y-Math.sign(dy)*.07,height:.83}};
}
export function offeringBowl(b,slot=0){
 if(b.type==='shrine')return {x:-1.57,z:1.94,base:.36,scale:.60};
 const large=footprintSize(b)===2;
 return {x:(large?5.25:1.72)+(slot%2?.30:-.30),z:large?7.55:2.16,base:.31,scale:.79};
}
function approachFixture(b,mode,slot){
 if(mode==='study'){
  const bowl=offeringBowl(b,0);
  return {x:bowl.x+(b.type==='shrine'?1.15:-1.18)+(slot%2)*.72,z:bowl.z+.08,height:1.05,side:0,reach:.40};
 }
 if(mode==='service'){
  const bowl=offeringBowl(b,slot),side=b.type==='shrine'?(slot%2?.36:-.28):0;
  return {x:bowl.x,z:bowl.z,height:bowl.base+.27*bowl.scale,side,reach:.48};
 }
 switch(b.type){
  case 'granary':return {x:-.77,z:1.06,height:.87,side:0,reach:.62};
  case 'depot':return {x:.63,z:.45,height:1.23,side:0,reach:.62};
  case 'market':{const wide=footprintSize(b)===2;return {x:wide?7.12:1.66,z:wide?6.84:.76,height:.61,side:0,reach:.55};}
  case 'harbor':return {x:-.71,z:1.56,height:1.00,side:0,reach:.52};
  default:return null;
 }
}
export function serviceMode(b,phase,c){
 if(!b||b.construction?.kind==='new')return null;
 if((b.type==='shrine'||b.type==='ziggurat')&&['toWork','returnWork','working'].includes(phase)&&c.work===`${b.x},${b.y}`&&!c.guarding&&!c.guardPost)return 'service';
 if(freightCourts.has(b.type)){
  if(receivingPhases.has(phase))return 'receive';
  if(phase==='toCollectCart'||phase==='toReturnCart')return 'collect';
  if(collectingPhases.has(phase))return 'collect';
 }
 return null;
}
export function serviceStation(b,mode,slot=0){
 const fixture=approachFixture(b,mode,slot);if(!fixture)return null;
 return {stand:worldPoint(b,fixture.x+fixture.side,fixture.z+fixture.reach),target:{...worldPoint(b,fixture.x,fixture.z),height:fixture.height}};
}
// From the street corner, follow the outside edge first, then enter from
// the open front. Reversing the same small path takes a worker back out.
export function serviceApproach(state,b,port,mode,slot=0){
 const fixture=approachFixture(b,mode,slot);if(!fixture)return [];
 const n=footprintSize(b),m=(n-1)*3,half=n*3,[co,si]=quarter[(b.rotation||0)%4];
 const ox=(port.x-b.x)*6-m,oz=(port.y-b.y)*6-m;
 const fromX=ox*co-oz*si,fromZ=ox*si+oz*co;
 const front=m+half-.19,edge=m+Math.sign(fromX||1)*(half-.12);
 const path=[];let previous=port;
 const add=p=>{if(Math.hypot(previous.x-p.x,previous.y-p.y)>.002){path.push(p);previous=p;}};
 if(fromZ<0)add(worldPoint(b,edge,front));
 add(worldPoint(b,fixture.x+fixture.side,front));
 add(serviceStation(b,mode,slot).stand);
 previous=port;
 for(const point of path){
  for(const t of [.25,.5,.75,1])if(!isDryPoint(state,previous.x+(point.x-previous.x)*t,previous.y+(point.y-previous.y)*t)){
   // A moored boat is served on the wooden deck inside its own square.
   if(b.type!=='harbor')return [];
  }
  previous=point;
 }
 return path;
}
export function freightGesture(c,buildings,districtJobs){
 const seedPickup=c.phase==='toStore'&&c.seedField&&!c.carrying;
 const receiving=receivingPhases.has(c.phase)&&!seedPickup,collecting=collectingPhases.has(c.phase)||seedPickup;
 if(!c.route?.length||(!receiving&&!collecting)||c.routeIndex!==c.route.length-1)return null;
 const key=c.phase==='toCommonMeal'?c.commonMealTarget:c.phase==='toSaleMarket'?c.saleMarket:c.phase==='toMarket'?c.tradeMarket:c.phase==='toDistrictSupply'||c.phase==='toDistrictStore'?
  districtJobs?.find(j=>j.id===c.districtJob)?.[collecting?'source':'target']:c.store;
 const b=buildings.get(key);
 if(!b||c.controlled||c.swimming||(receiving?!c.carrying:c.carrying))return null;
 const end=c.route.at(-1);
 if(Math.hypot(end.x-c.x,end.y-c.y)*6>=.8)return null;
 if(receiving&&!Object.keys(c.cargo||{}).some(k=>MATERIALS.includes(k)&&c.cargo[k]>0))return null;
 const station=freightCourts.has(b.type)?serviceStation(b,receiving?'receive':'collect'):
  ['shrine','ziggurat'].includes(b.type)?templeStoreStation(b,end):null;
 if(!station||Math.hypot(station.stand.x-end.x,station.stand.y-end.y)>.002)return null;
 const progress=1-Math.min(1,Math.hypot(end.x-c.x,end.y-c.y)*6/.8);
 return progress>0?{...station,kind:receiving?'receive':'collect',progress}:null;
}

export function canalWorkContact(state,b,c){
 if(c.activity?.task!=='canal-cleaning'||c.activity.stage!=='working')return null;
 const links=irrigationFor(state).arms.get(`${b.x},${b.y}`);
 let best=null,bestDistance=Infinity;
 for(const [dx,dy] of links?.length?links:[[1,0],[-1,0]])for(const side of [-1,1]){
  const along={x:b.x+dx*.30,y:b.y+dy*.30},nx=-dy*side,ny=dx*side;
  const stand={x:along.x+nx*.19,y:along.y+ny*.19};
  const distance=Math.hypot(stand.x-c.x,stand.y-c.y);
  if(distance>=bestDistance||!isDryPoint(state,stand.x,stand.y))continue;
  bestDistance=distance;
  best={kind:'farming',task:'canal-cleaning',building:b,stand,via:[stand],target:{x:along.x+nx*.049,y:along.y+ny*.049,height:-.07}};
 }
 return best;
}

export function serviceWorkContact(state,b,c,slot=0){
 const studying=c.phase==='studying'&&c.activity?.task==='school-tablet';
 if(c.carrying||c.walking||!studying&&(c.activity?.task!=='offering'||serviceMode(b,c.phase,c)!=='service'))return null;
 const mode=studying?'study':'service',station=serviceStation(b,mode,slot);
 const via=serviceApproach(state,b,c,mode,slot);
 if(!via.length&&Math.hypot(c.x-station.stand.x,c.y-station.stand.y)>=.04)return null;
 return {...station,kind:studying?'study':'offering',task:c.activity.task,building:b,...(studying?{}:{seatHeight:.41}),via};
}
export function routeThroughCourt(s,c,b,port,phase,ctx){
 const mode=serviceMode(b,phase,c);if(!mode||mode==='service')return [];
 const key=`${port.key}/${b.x},${b.y}/${b.type}/${b.rotation||0}`;
 ctx.servicePaths??=new Map();
 if(!ctx.servicePaths.has(key))ctx.servicePaths.set(key,serviceApproach(s,b,port,mode));
 return ctx.servicePaths.get(key);
}
export function serviceExit(s,c,ctx){
 // Locate by the worker's position so restoring a saved game does not require
 // transient service state. Interior points always belong to the serviced plot.
 if(!Number.isFinite(c.x)||!Number.isFinite(c.y)||Number.isInteger(c.x+.5)&&Number.isInteger(c.y+.5))return null;
 const x=Math.floor(c.x+.5),y=Math.floor(c.y+.5);
 for(let dx=0;dx<=1;dx++)for(let dy=0;dy<=1;dy++){
  const key=`${x-dx},${y-dy}`,b=ctx.buildings.get(key),port=ctx.ports.get(key);
  if(!b||!port||!freightCourts.has(b.type))continue;
  const stand=serviceStation(b,'collect').stand;
  if(Math.hypot(c.x-stand.x,c.y-stand.y)>.003)continue;
  return {port,path:serviceApproach(s,b,port,'collect').slice(0,-1).reverse()};
 }
 return null;
}
