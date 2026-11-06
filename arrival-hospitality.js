import {usesCatDiscovery} from './scenario-profiles.js';
import {buildingKey,capacityOf,isOperational} from './definitions.js';
import {foodAvailability,reserveStock} from './inventory.js';
import {navigationSegmentClear,nearestWalkingNode,shortestWalkingPath} from './navigation.js';
import {floodedSegment,floodMapView} from './river-flood.js';
import {waterDemand} from './water.js';
import {isDryPoint,signedRiverDistance,worldHeight,worldWidth} from './world.js';

const kinds=['artisan','envoy','pilgrim'];
const needed=2;
export const newArrivalHospitality=()=>({version:1,receipts:[]});

export function recordArrivalHospitality(s,kind,guest){
 const journal=s.arrivalHospitality;
 if(!journal||!kinds.includes(kind)||guest.phase!=='departed'||journal.receipts.some(r=>r.kind===kind))return;
 if(kind==='artisan'?guest.outcome!=='taught'||!guest.fed:guest.outcome!=='accepted')return;
 journal.receipts.push({kind,place:kind==='artisan'?guest.home:guest.destination,at:s.simTime});
}

const cell=(s,key)=>{
 const point=typeof key==='string'&&/^(\d+),(\d+)$/.exec(key);
 return point&&Number(point[1])<worldWidth(s)&&Number(point[2])<worldHeight(s)?[Number(point[1]),Number(point[2])]:null;
};
function differentBanks(s,from,to){
 const a=cell(s,from),b=cell(s,to);
 return a&&b&&signedRiverDistance(...a,s)*signedRiverDistance(...b,s)<0;
}

export function recordArrivalShelter(s,house,guest,served){
 const journal=s.arrivalHospitality;
 if(!journal||!(served>1e-9)||journal.shelters?.length>=needed||
  house.type!=='house'||!isOperational(house)||!guest.floodShelter||guest.routeIndex<guest.route.length)return;
 const host=buildingKey(house),origin=guest.home;
 if(guest.floodShelter!==host||!differentBanks(s,origin,host)||
  journal.shelters?.some(row=>row.host===host||row.origin===origin)||
  !s.citizens.some(c=>c.home===host&&!c.floodShelter&&['home','resting'].includes(c.phase)))return;
 (journal.shelters??=[]).push({host,origin,at:s.simTime});
}

export function arrivalHospitalityView(s){
 const journal=s.arrivalHospitality;
 if(!journal)return null;
 const visits=journal.receipts.length,shelters=journal.shelters?.length||0;
 return {visits,shelters,needed,qualified:visits>=needed||shelters>=needed};
}

export function arrivalHousing(s,{includeReserved=false}={}){
 const flood=floodMapView(s);
 const flooded=new Set(flood?.phase==='active'?flood.tiles.map(buildingKey):[]);
 const vacancies=new Map();
 for(const b of s.buildings){
  const beds=capacityOf(b),home=buildingKey(b);
  if(beds&&!flooded.has(home))vacancies.set(home,beds);
 }
 for(const c of s.citizens){
  if(vacancies.has(c.home))vacancies.set(c.home,vacancies.get(c.home)-1);
  if(c.floodShelter!==c.home&&vacancies.has(c.floodShelter))
   vacancies.set(c.floodShelter,vacancies.get(c.floodShelter)-1);
 }
 const group=s.arrivalGroup;
 if(!includeReserved&&group&&vacancies.has(group.home))vacancies.set(group.home,vacancies.get(group.home)-group.count);
 return [...vacancies].filter(([,beds])=>beds>0).map(([home,beds])=>({home,beds}));
}

export function arrivalRoute(s,network,limit=(_port,beds)=>beds){
 const vacancies=new Map(arrivalHousing(s).map(row=>[row.home,Math.min(6,row.beds)]));
 if(!vacancies.size)return null;
 const east=worldWidth(s)-.5,south=worldHeight(s)-.5,entries=new Map();
 for(const p of network.nodes.values()){
  if(p.x!==-.5&&p.y!==-.5&&p.x!==east&&p.y!==south)continue;
  const component=network.components.get(p.key);
  if(component===undefined||!isDryPoint(s,p.x,p.y))continue;
  if(!entries.has(component))entries.set(component,[]);
  entries.get(component).push(p);
 }
 let best=null;
 for(const port of network.ports){
  const home=buildingKey(port.building),vacant=vacancies.get(home);
  if(!vacant)continue;
  const beds=limit(port,vacant);
  if(!beds||best&&beds<best.beds)continue;
  for(const entry of entries.get(network.components.get(port.key))||[]){
   const distance=Math.hypot(port.x-entry.x,port.y-entry.y);
   if(!best||beds>best.beds||distance<best.distance)best={home,beds,entry,port,distance};
  }
 }
 if(!best)return null;
 const route=shortestWalkingPath(network,best.entry.key,best.port.key);
 return route?{home:best.home,beds:best.beds,route}:null;
}

export function arrivalOffer(s,network){
 const food=foodAvailability(s,{reconcile:false}),storesByComponent=new Map(),waterNeeds=new Map();
 for(const c of s.citizens){
  const home=c.floodShelter||c.home;
  waterNeeds.set(home,(waterNeeds.get(home)||0)+waterDemand(c));
 }
 for(const port of network.ports){
  const component=network.components.get(port.key),home=buildingKey(port.building);
  if(component===undefined||!(food.get(home)>0))continue;
  if(!storesByComponent.has(component))storesByComponent.set(component,new Map());
  storesByComponent.get(component).set(home,food.get(home));
 }
 const provisions=new Map([...storesByComponent].map(([component,stores])=>[
  component,Math.floor([...stores.values()].reduce((n,amount)=>n+amount,0))
 ]));
 const offer=arrivalRoute(s,network,(port,beds)=>{
  const surplus=(port.building.water||0)-(waterNeeds.get(buildingKey(port.building))||0);
  return Math.max(0,Math.min(beds,Math.floor(surplus),provisions.get(network.components.get(port.key))||0));
 });
 if(!offer)return null;
 const component=network.components.get(offer.route.at(-1).key);
 return {...offer,food:offer.beds,water:offer.beds,eligibleStores:new Set(storesByComponent.get(component).keys())};
}

export function arrivalKnowledgeReason(s){
 if(!s.arrivalHospitality)return '';
 if(s.godhood.stage!=='recognized')return 'Пока никто не признал твоё присутствие';
 if(s.blessingDiscovery?.qualifiedAt==null)return 'Сначала открой «Благословение»';
 return arrivalHospitalityView(s).qualified?'':'Нужны два подтверждения гостеприимства одного вида';
}

export function reserveArrival(s,network,expected){
 if(!s.arrivalHospitality||s.arrivalGroup)return false;
 const offer=arrivalOffer(s,network);
 if(!offer||expected&&(expected.count!==offer.beds||expected.home!==offer.home))return false;
 const home=s.buildings.find(b=>buildingKey(b)===offer.home),giftReserve={};
 const provisions=reserveStock(s,{food:offer.food},{eligibleStores:offer.eligibleStores,giftReserve});
 if(!provisions)return false;
 home.water-=offer.water;
 const start=offer.route[0];
 s.arrivalGroup={home:offer.home,count:offer.beds,water:offer.water,provisions,
  x:start.x,y:start.y,route:offer.route.map(p=>p.key),routeIndex:1,
  ...Object.keys(giftReserve).length?{giftReserve}:{}};
 return true;
}

export const reservedArrivalBeds=(s,home)=>s.arrivalGroup?.home===home?s.arrivalGroup.count:0;

export function createArrivalFamily(s,home,count){
 const first=s.demography.nextId;
 const host=s.citizens.find(c=>c.home===home&&!c.floodShelter&&c.age>=16)?.id??null;
 const family=Array.from({length:count},(_,i)=>({
  id:first+i,home,age:i===0?30:i===1?28:i+3,sex:i%2?'f':'m',
  parents:i<2?[]:[first,first+1],partner:i<2&&count>1?first+1-i:null,generation:i<2?1:2,faith:20
 }));
 s.demography.nextId+=count;
 const welcomes=s.arrivalHospitality.welcomes??=[];
 welcomes.push({home,host,members:family.map(c=>c.id),at:s.simTime});
 if(welcomes.length>80)welcomes.shift();
 return family;
}

export function lastArrivalWelcome(s,home){
 return s.arrivalHospitality?.welcomes?.findLast(row=>row.home===home)||null;
}

export function advanceArrivalGroup(s,dt,network){
 const g=s.arrivalGroup;
 if(!g)return false;
 const target=network.ports.find(p=>buildingKey(p.building)===g.home);
 const component=target&&network.components.get(target.key);
 if(component===undefined||!network.nodes.has(target.key))return false;
 const clear=p=>navigationSegmentClear(s,g,p,network.navigation.obstacles)&&
  !(network.navigation.flooded&&floodedSegment(network.navigation.flooded,g,p));
 const next=network.nodes.get(g.route[g.routeIndex]),previous=g.route[g.routeIndex-1];
 if(g.route.at(-1)!==target.key||g.routeIndex<g.route.length&&
  (!next||previous&&!network.graph.get(previous)?.has(next.key)||!previous&&!clear(next))){
  const node=nearestWalkingNode(network,g,p=>Math.hypot(p.x-g.x,p.y-g.y)<=Math.SQRT2&&
   network.components.get(p.key)===component&&clear(p));
  const route=node&&shortestWalkingPath(network,node.key,target.key);
  if(!route)return false;
  g.route=route.map(p=>p.key);g.routeIndex=0;
 }
 let remaining=dt;
 while(remaining>1e-8&&g.routeIndex<g.route.length){
  const p=network.nodes.get(g.route[g.routeIndex]),last=g.route[g.routeIndex-1];
  if(!p||last&&!network.graph.get(last)?.has(p.key))return false;
  const distance=Math.hypot(g.x-p.x,g.y-p.y);
  if(distance>remaining){g.x+=(p.x-g.x)*remaining/distance;g.y+=(p.y-g.y)*remaining/distance;return false;}
  g.x=p.x;g.y=p.y;g.routeIndex++;remaining-=distance;
 }
 return g.routeIndex===g.route.length&&Math.hypot(g.x-target.x,g.y-target.y)<1e-8&&
  arrivalHousing(s,{includeReserved:true}).some(row=>row.home===g.home&&row.beds>=g.count);
}

function validArrivalGroup(s){
 const g=s.arrivalGroup;
 if(g===undefined)return true;
 if(!g||!s.arrivalHospitality||!Number.isInteger(g.count)||g.count<1||g.count>6||g.water!==g.count||
  !s.buildings.some(b=>buildingKey(b)===g.home&&capacityOf(b)>=g.count)||
  !g.provisions||typeof g.provisions!=='object'||Array.isArray(g.provisions)||
  !Number.isFinite(g.x)||g.x<-.5||g.x>worldWidth(s)-.5||
  !Number.isFinite(g.y)||g.y<-.5||g.y>worldHeight(s)-.5||
  !Array.isArray(g.route)||g.route.length>(worldWidth(s)+1)*(worldHeight(s)+1)||
  !Number.isInteger(g.routeIndex)||g.routeIndex<0||g.routeIndex>g.route.length)return false;
 const sources=Object.entries(g.provisions);
 if(!sources.every(([key,lot])=>lot&&Object.keys(lot).length===1&&Number.isFinite(lot.food)&&lot.food>0&&
  s.buildings.some(b=>buildingKey(b)===key&&b.stock))||
  Math.abs(sources.reduce((n,[,lot])=>n+lot.food,0)-g.count)>1e-7)return false;
 return g.route.every((key,i)=>{
  if(typeof key!=='string'||!/^\d+,\d+$/.test(key))return false;
  const [x,y]=key.split(',').map(Number);
  if(x>worldWidth(s)||y>worldHeight(s))return false;
  if(!i)return true;
  const [a,b]=g.route[i-1].split(',').map(Number);
  return key!==g.route[i-1]&&Math.abs(x-a)<=1&&Math.abs(y-b)<=1;
 });
}

export function validateArrivalHospitality(s){
 if(!validArrivalGroup(s))return false;
 const journal=s.arrivalHospitality;
 if(journal===undefined)return true;
 if(!usesCatDiscovery(s)||!journal||Object.keys(journal).length!==2+Number(journal.shelters!==undefined)+Number(journal.welcomes!==undefined)||journal.version!==1||
  !Array.isArray(journal.receipts)||journal.receipts.length>kinds.length)return false;
 const seen=new Set();
 let previous=0;
 for(const row of journal.receipts){
  if(!row||Object.keys(row).length!==3||!kinds.includes(row.kind)||seen.has(row.kind)||
   !Number.isFinite(row.at)||row.at<previous||row.at>s.simTime)return false;
  if(!cell(s,row.place))return false;
  previous=row.at;seen.add(row.kind);
 }
 const welcomes=journal.welcomes;
 if(welcomes!==undefined){
  if(!Array.isArray(welcomes)||!welcomes.length||welcomes.length>80)return false;
  let lastTime=0,lastId=-1;
  for(const row of welcomes){
   if(!row||Object.keys(row).length!==4||!cell(s,row.home)||!Number.isFinite(row.at)||row.at<lastTime||row.at>s.simTime||
    !Array.isArray(row.members)||!row.members.length||row.members.length>6||
    !row.members.every((id,i)=>Number.isSafeInteger(id)&&id>lastId&&id<s.demography.nextId&&(!i||id===row.members[i-1]+1))||
    row.host!==null&&(!Number.isSafeInteger(row.host)||row.host<0||row.host>=row.members[0]))return false;
   lastTime=row.at;lastId=row.members.at(-1);
  }
 }
 const shelters=journal.shelters;
 if(shelters===undefined)return true;
 if(!Array.isArray(shelters)||!shelters.length||shelters.length>needed)return false;
 const hosts=new Set(),origins=new Set();
 previous=0;
 for(const row of shelters){
  if(!row||Object.keys(row).length!==3||!differentBanks(s,row.origin,row.host)||
   hosts.has(row.host)||origins.has(row.origin)||!Number.isFinite(row.at)||row.at<previous||row.at>s.simTime)return false;
  hosts.add(row.host);origins.add(row.origin);previous=row.at;
 }
 return true;
}
