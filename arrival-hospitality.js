import {householdAwaitingFamily} from './household-initiative.js';
import {cityCommandReason} from './city-command-lock.js';
import {affectResidents} from './wellbeing.js';
import {ensureHouseEntityId} from './causal-facts.js';
import {isStrictSumer,usesCatDiscovery} from './scenario-profiles.js';
import {buildingKey,capacityOf,isOperational} from './definitions.js';
import {foodAvailability,reserveStock} from './inventory.js';
import {supplyHome} from './households.js';
import {navigationSegmentClear,nearestWalkingNode,shortestWalkingPath} from './navigation.js';
import {floodedSegment,floodMapView} from './river-flood.js';
import {waterDemand,waterSummary} from './water.js';
import {isDryPoint,signedRiverDistance,worldHeight,worldWidth} from './world.js';

const kinds=['artisan','envoy','pilgrim'];
const needed=2;
const customWater=custom=>custom==='libation'?1:0;
export const newArrivalHospitality=()=>({version:1,receipts:[]});

function completedVisitPlace(kind,guest){
 if(guest.phase!=='departed')return null;
 if(kind==='artisan')return guest.outcome==='taught'&&guest.fed?guest.home:null;
 return guest.outcome==='accepted'?guest.destination:null;
}
export function recordArrivalHospitality(s,kind,guest){
 const journal=s.arrivalHospitality;
 if(!journal||!kinds.includes(kind)||journal.receipts.some(r=>r.kind===kind))return;
 const place=completedVisitPlace(kind,guest);
 if(place)journal.receipts.push({kind,place,at:s.simTime});
}

const cell=(s,key)=>{
 const point=typeof key==='string'&&/^(\d+),(\d+)$/.exec(key);
 return point&&Number(point[1])<worldWidth(s)&&Number(point[2])<worldHeight(s)?[Number(point[1]),Number(point[2])]:null;
};
function differentBanks(s,from,to){
 const a=cell(s,from),b=cell(s,to);
 return a&&b&&signedRiverDistance(...a,s)*signedRiverDistance(...b,s)<0;
}

const separateShelters=(a,b)=>a.host!==b.host&&a.origin!==b.origin;

export function recordArrivalShelter(s,house,guest,served){
 const journal=s.arrivalHospitality;
 if(!journal||!(served>1e-9)||journal.shelters?.length>=needed||
  house.type!=='house'||!isOperational(house)||!guest.floodShelter||guest.routeIndex<guest.route.length)return;
 const host=buildingKey(house),origin=guest.home;
 if(guest.floodShelter!==host||!differentBanks(s,origin,host)||
  !s.citizens.some(c=>atUnshelteredHome(c,host)))return;
 const source=s.buildings.find(b=>b.type==='house'&&buildingKey(b)===origin);
 if(!source)return;
 const first=journal.shelters?.[0],alternate=journal.shelterAlternate;
 const pair={host,origin};
 if(first?.host===host&&first.origin===origin)return;
 const prior=!first||separateShelters(first,pair)?first:
  alternate&&separateShelters(alternate,pair)?alternate:null;
 if(prior===null&&alternate)return;
 const ids=isStrictSumer(s)?{hostId:ensureHouseEntityId(s,house),originId:ensureHouseEntityId(s,source)}:{};
 const receipt={...pair,at:s.simTime,...ids};
 if(prior===null)journal.shelterAlternate=receipt;
 else if(prior){
  journal.shelters=[prior,receipt];
  delete journal.shelterAlternate;
 }else journal.shelters=[receipt];
}

export function arrivalHospitalityView(s){
 const journal=s.arrivalHospitality;
 if(!journal)return null;
 const visits=journal.receipts.length,shelters=journal.shelters?.length||0;
 return {visits,shelters,needed,qualified:visits>=needed||shelters>=needed};
}

export const shelterHome=c=>c.floodShelter||c.fireShelter?.host;
const atUnshelteredHome=(c,home)=>c.home===home&&!shelterHome(c)&&['home','resting'].includes(c.phase);

export function arrivalHousing(s,{includeReserved=false}={}){
 const flood=floodMapView(s);
 const flooded=new Set(flood?.phase==='active'?flood.tiles.map(buildingKey):[]);
 const vacancies=new Map(),group=s.arrivalGroup;
 for(const b of s.buildings){
  const beds=capacityOf(b),home=buildingKey(b);
  if(beds&&!flooded.has(home)&&(includeReserved&&group?.home===home||!householdAwaitingFamily(s,b)))vacancies.set(home,beds);
 }
 for(const c of s.citizens){
  if(vacancies.has(c.home))vacancies.set(c.home,vacancies.get(c.home)-1);
  const shelter=shelterHome(c);
  if(shelter!==c.home&&vacancies.has(shelter))vacancies.set(shelter,vacancies.get(shelter)-1);
 }
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
  const reachable=entries.get(network.components.get(port.key));
  if(!reachable)continue;
  const beds=limit(port,vacant);
  if(!beds||best&&beds<best.beds)continue;
  for(const entry of reachable){
   const distance=Math.hypot(port.x-entry.x,port.y-entry.y);
   if(!best||beds>best.beds||distance<best.distance)best={home,beds,entry,port,distance};
  }
 }
 if(!best)return null;
 const route=shortestWalkingPath(network,best.entry.key,best.port.key);
 return route?{home:best.home,beds:best.beds,route}:null;
}

export function arrivalQuote(s,network,{custom}={}){
 const extra=customWater(custom);
 const homes=new Map(s.buildings.filter(b=>b.type==='house').map(b=>[buildingKey(b),b]));
 const food=foodAvailability(s,{reconcile:false}),storesByComponent=new Map(),waterNeeds=new Map();
 for(const c of s.citizens){
  const home=supplyHome(c);
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
 let reachable=false,waterReady=false,provisioned=false;
 const offer=arrivalRoute(s,network,(port,beds)=>{
  const key=buildingKey(port.building);
  const surplus=(homes.get(key)?.water||0)-(waterNeeds.get(key)||0);
  reachable=true;
  const supplied=Math.max(0,Math.min(beds,Math.floor(surplus-extra)));
  const count=Math.min(supplied,provisions.get(network.components.get(port.key))||0);
  waterReady||=supplied>0;
  provisioned||=count>0;
  return count;
 });
 if(!offer){
  const reason=!arrivalHousing(s).length?'Нет свободного места в сухом доме.':
   !reachable||provisioned?'Нет сухого пути от границы долины к свободному дому.':
   !waterReady?(extra?'В доступных домах не хватает воды для группы и возлияния.':'В доступных домах не хватает воды для группы.'):
   'На доступных складах не хватает пайка для группы.';
  return {offer:null,reason};
 }
 const component=network.components.get(offer.route.at(-1).key);
 return {offer:{...offer,homeRef:homes.get(offer.home),food:offer.beds,water:offer.beds+extra,
  eligibleStores:new Set(storesByComponent.get(component).keys())},reason:''};
}

export const arrivalOffer=(s,network,options)=>arrivalQuote(s,network,options).offer;

export function arrivalKnowledgeReason(s){
 if(!s.arrivalHospitality)return '';
 if(s.godhood.stage!=='recognized')return 'Пока никто не признал твоё присутствие';
 if(s.blessingDiscovery?.qualifiedAt==null)return 'Сначала открой «Благословение»';
 return arrivalHospitalityView(s).qualified?'':'Нужны два подтверждения гостеприимства одного вида';
}

export function advanceArrivalOpening(s){
 const journal=s.arrivalHospitality;
 if(!journal||journal.openedAt!==undefined||!Number.isFinite(s.godhood?.recognitionAt)||arrivalKnowledgeReason(s))return;
 journal.openedAt=s.simTime;
}

export function reserveArrival(s,network,expected){
 if(!s.arrivalHospitality||s.arrivalGroup)return false;
 const custom=expected?.custom;
 if(custom!==undefined&&custom!=='libation')return false;
 const offer=arrivalOffer(s,network,{custom});
 if(!offer||expected&&(expected.count!==offer.beds||expected.home!==offer.home||expected.homeRef!==undefined&&expected.homeRef!==offer.homeRef))return false;
 const home=offer.homeRef,giftReserve={};
 if(!home)return false;
 const provisions=reserveStock(s,{food:offer.food},{eligibleStores:offer.eligibleStores,giftReserve});
 if(!provisions)return false;
 home.water-=offer.water;
 const start=offer.route[0];
 const homeId=isStrictSumer(s)?ensureHouseEntityId(s,home):undefined;
 s.arrivalGroup={home:offer.home,...homeId===undefined?{}:{homeId},count:offer.beds,water:offer.water,provisions,...custom?{custom}:{},
  x:start.x,y:start.y,route:offer.route.map(p=>p.key),routeIndex:1,
  ...Object.keys(giftReserve).length?{giftReserve}:{}};
 return true;
}

export const reservedArrivalBeds=(s,home)=>(s.arrivalGroup?.home===home?s.arrivalGroup.count:0)+s.citizens.filter(c=>c.home!==home&&shelterHome(c)===home).length;

function welcomeEvidence(welcomes){
 const candidates=[];
 for(const row of welcomes){
  if(row.host===null)continue;
  const different=candidates.find(prior=>prior.home!==row.home&&prior.host!==row.host);
  if(different)return {pair:[different,row],keep:[different,row]};
  // Retain one alternative when earlier welcomes share the same host or address.
  if(!candidates.length||candidates.length===1&&(candidates[0].home!==row.home||candidates[0].host!==row.host))candidates.push(row);
 }
 return {pair:null,keep:candidates};
}

export function hospitalityNameEvidence(s){
 return welcomeEvidence(s.arrivalHospitality?.welcomes||[]).pair;
}

export function createArrivalFamily(s,home,count,custom){
 const first=s.demography.nextId;
 const host=s.citizens.find(c=>c.age>=16&&atUnshelteredHome(c,home))?.id??null;
 const family=Array.from({length:count},(_,i)=>({
  id:first+i,home,age:i===0?30:i===1?28:i+3,sex:i%2?'f':'m',
  parents:i<2?[]:[first,first+1],partner:i<2&&count>1?first+1-i:null,generation:i<2?1:2,faith:20
 }));
 s.demography.nextId+=count;
 const house=s.buildings.find(b=>b.type==='house'&&buildingKey(b)===home);
 const homeId=house&&isStrictSumer(s)?ensureHouseEntityId(s,house):undefined;
 const welcomes=s.arrivalHospitality.welcomes??=[];
 welcomes.push({home,...homeId===undefined?{}:{homeId},...custom?{custom}:{},host,members:family.map(c=>c.id),at:s.simTime});
 if(welcomes.length>80){
  const {keep}=welcomeEvidence(welcomes);
  welcomes.splice(welcomes.findIndex(row=>!keep.includes(row)),1);
 }
 return family;
}

export function householdWelcomeEvidence(s,residents){
 if(!residents.length||!s.arrivalHospitality?.welcomes)return null;
 const ids=new Set(residents.map(c=>c.id));
 return s.arrivalHospitality.welcomes.findLast(row=>row.host!==null&&
  (ids.has(row.host)||row.members.some(id=>ids.has(id))))||null;
}

export function arrivalWelcomeHouse(s,welcome){
 return s.buildings.find(b=>b.type==='house'&&buildingKey(b)===welcome.home&&
  (welcome.homeId===undefined||welcome.homeId===b.waterEntityId));
}

const disputeChoices=['queue','pause'];

export function householdDisputeMemory(s,residents){
 const ids=new Set(residents.map(c=>c.id));
 return s.arrivalHospitality?.welcomes?.findLast(row=>row.dispute&&(ids.has(row.host)||ids.has(row.dispute.guest)))||null;
}

export function arrivalCustomDispute(s,house,welcome){
 if(welcome?.custom!=='libation'||welcome.host===null||welcome.dispute||!isOperational(house)||
  arrivalWelcomeHouse(s,welcome)!==house||!s.arrivalHospitality.welcomes.includes(welcome))return null;
 const available=c=>c.age>=16&&c.home===welcome.home&&!c.fireShelter&&!c.floodShelter&&
  ['home','resting'].includes(c.phase)&&!c.clinic;
 const host=s.citizens.find(c=>c.id===welcome.host&&available(c));
 const guest=s.citizens.find(c=>welcome.members.includes(c.id)&&available(c));
 if(!host||!guest)return null;
 const water=waterSummary(s,house);
 return water.stock<water.demand?{host:host.id,guest:guest.id}:null;
}

export function resolveArrivalCustomDispute(s,house,welcome,choice,guestId){
 const reason=cityCommandReason(s);
 if(reason)return {ok:false,reason};
 if(!disputeChoices.includes(choice))return {ok:false,reason:'Выбери решение для семей'};
 const parties=arrivalCustomDispute(s,house,welcome);
 if(!parties||parties.guest!==guestId)return {ok:false,reason:'Условия изменились. Для разговора нужны обе стороны и нехватка воды'};
 welcome.dispute={choice,guest:parties.guest,at:s.simTime};
 if(choice==='queue')affectResidents(s,{mood:3},[parties.host,parties.guest]);
 else{affectResidents(s,{mood:2},[parties.host]);affectResidents(s,{mood:-2},[parties.guest]);}
 return {ok:true};
}

export function lastArrivalWelcome(s,home,residents){
 const ids=residents&&new Set(residents.map(c=>c.id));
 return s.arrivalHospitality?.welcomes?.findLast(row=>row.home===home&&(row.homeId===undefined||arrivalWelcomeHouse(s,row))&&
  (!ids||ids.has(row.host)||row.members.some(id=>ids.has(id))))||null;
}

export function arrivalTransitLabel(group){
 const status={route:'Ждут открытия пути',housing:'Ждут места в принимающем дворе',flood:'Ждут спада воды после разлива'}[group.waiting]||'Группа в пути';
 return `${status} · ${group.count} чел.`;
}

export function advanceArrivalGroup(s,dt,network){
 const g=s.arrivalGroup;
 if(!g)return false;
 const wait=reason=>{g.waiting=network.navigation.flooded?.has(g.home)?'flood':reason;return false;};
 const target=network.ports.find(p=>matchesArrivalHome(g,p.building));
 const component=target&&network.components.get(target.key);
 if(component===undefined||!network.nodes.has(target.key))return wait('route');
 const clear=p=>navigationSegmentClear(s,g,p,network.navigation.obstacles)&&
  !(network.navigation.flooded&&floodedSegment(network.navigation.flooded,g,p));
 const next=network.nodes.get(g.route[g.routeIndex]),previous=g.route[g.routeIndex-1];
 if(g.route.at(-1)!==target.key||g.routeIndex<g.route.length&&
  (!next||previous&&!network.graph.get(previous)?.has(next.key)||!previous&&!clear(next))){
  const node=nearestWalkingNode(network,g,p=>Math.hypot(p.x-g.x,p.y-g.y)<=Math.SQRT2&&
   network.components.get(p.key)===component&&clear(p));
  const route=node&&shortestWalkingPath(network,node.key,target.key);
  if(!route)return wait('route');
  g.route=route.map(p=>p.key);g.routeIndex=0;
 }
 delete g.waiting;
 let remaining=dt;
 while(remaining>1e-8&&g.routeIndex<g.route.length){
  const p=network.nodes.get(g.route[g.routeIndex]),last=g.route[g.routeIndex-1];
  if(!p||last&&!network.graph.get(last)?.has(p.key))return wait('route');
  const distance=Math.hypot(g.x-p.x,g.y-p.y);
  if(distance>remaining){g.x+=(p.x-g.x)*remaining/distance;g.y+=(p.y-g.y)*remaining/distance;return false;}
  g.x=p.x;g.y=p.y;g.routeIndex++;remaining-=distance;
 }
 if(g.routeIndex!==g.route.length||Math.hypot(g.x-target.x,g.y-target.y)>=1e-8)return false;
 return arrivalHousing(s,{includeReserved:true}).some(row=>row.home===g.home&&row.beds>=g.count)||wait('housing');
}

function matchesArrivalHome(group,house){
 return house.type==='house'&&buildingKey(house)===group.home&&
  (group.homeId===undefined||house.waterEntityId===group.homeId);
}

function validArrivalGroup(s){
 const g=s.arrivalGroup;
 if(g===undefined)return true;
 if(!g||!s.arrivalHospitality||g.waiting!==undefined&&!['route','housing','flood'].includes(g.waiting)||!Number.isInteger(g.count)||g.count<1||g.count>6||g.custom!==undefined&&g.custom!=='libation'||g.water!==g.count+customWater(g.custom)||
  g.homeId!==undefined&&(!isStrictSumer(s)||!Number.isSafeInteger(g.homeId)||g.homeId<1)||
  !s.buildings.some(b=>matchesArrivalHome(g,b)&&capacityOf(b)>=g.count)||
  !g.provisions||typeof g.provisions!=='object'||Array.isArray(g.provisions)||
  !Number.isFinite(g.x)||g.x<-.5||g.x>worldWidth(s)-.5||
  !Number.isFinite(g.y)||g.y<-.5||g.y>worldHeight(s)-.5||
  !Array.isArray(g.route)||!g.route.length||g.route.length>(worldWidth(s)+1)*(worldHeight(s)+1)||
  !Number.isInteger(g.routeIndex)||g.routeIndex<0||g.routeIndex>g.route.length)return false;
 const sources=Object.entries(g.provisions);
 if(!sources.every(([key,lot])=>lot&&Object.keys(lot).length===1&&Number.isFinite(lot.food)&&lot.food>0&&
  s.buildings.some(b=>buildingKey(b)===key&&b.stock))||
  Math.abs(sources.reduce((n,[,lot])=>n+lot.food,0)-g.count)>1e-7)return false;
 const validRoute=g.route.every((key,i)=>{
  if(typeof key!=='string'||!/^\d+,\d+$/.test(key))return false;
  const [x,y]=key.split(',').map(Number);
  if(x>worldWidth(s)||y>worldHeight(s))return false;
  if(!i)return true;
  const [a,b]=g.route[i-1].split(',').map(Number);
  return key!==g.route[i-1]&&Math.abs(x-a)<=1&&Math.abs(y-b)<=1;
 });
 if(!validRoute)return false;
 const point=key=>key.split(',').map(value=>Number(value)-.5);
 const distance=([x,y])=>Math.hypot(g.x-x,g.y-y);
 const tolerance=1e-7;
 if(g.routeIndex===0)return distance(point(g.route[0]))<=Math.SQRT2+tolerance;
 const start=point(g.route[g.routeIndex-1]);
 if(g.routeIndex===g.route.length)return distance(start)<=tolerance;
 const end=point(g.route[g.routeIndex]);
 return distance(start)+distance(end)<=Math.hypot(start[0]-end[0],start[1]-end[1])+tolerance;
}

export function validateArrivalHospitality(s){
 if(!validArrivalGroup(s))return false;
 const journal=s.arrivalHospitality;
 if(journal===undefined)return true;
 if(!usesCatDiscovery(s)||!journal||Object.keys(journal).length!==2+Number(journal.shelters!==undefined)+Number(journal.shelterAlternate!==undefined)+Number(journal.welcomes!==undefined)+Number(journal.sceneSeen!==undefined)+Number(journal.openedAt!==undefined)||journal.version!==1||
  (journal.sceneSeen!==undefined&&journal.sceneSeen!==true)||
  !Array.isArray(journal.receipts)||journal.receipts.length>kinds.length)return false;
 const seen=new Set();
 let previous=0;
 for(const row of journal.receipts){
  if(!row||Object.keys(row).length!==3||!kinds.includes(row.kind)||seen.has(row.kind)||
   !Number.isFinite(row.at)||row.at<previous||row.at>s.simTime)return false;
  const guest=row.kind==='artisan'?s.externalGuest:s.externalVisits?.[row.kind];
  if(!cell(s,row.place)||guest&&completedVisitPlace(row.kind,guest)!==row.place)return false;
  previous=row.at;seen.add(row.kind);
 }
 const welcomes=journal.welcomes;
 if(welcomes!==undefined){
  if(!Array.isArray(welcomes)||!welcomes.length||welcomes.length>80)return false;
  let lastTime=0,lastId=-1;
  for(const row of welcomes){
   if(!row||Object.keys(row).length!==4+Number(row.homeId!==undefined)+Number(row.custom!==undefined)+Number(row.dispute!==undefined)||row.custom!==undefined&&row.custom!=='libation'||!cell(s,row.home)||!Number.isFinite(row.at)||row.at<lastTime||row.at>s.simTime||
    !Array.isArray(row.members)||!row.members.length||row.members.length>6||
    !row.members.every((id,i)=>Number.isSafeInteger(id)&&id>lastId&&id<s.demography.nextId&&(!i||id===row.members[i-1]+1))||
    row.host!==null&&(!Number.isSafeInteger(row.host)||row.host<0||row.host>=row.members[0]))return false;
   const dispute=row.dispute;
   if(dispute!==undefined&&(!dispute||row.custom!=='libation'||row.host===null||Object.keys(dispute).length!==3||
    !disputeChoices.includes(dispute.choice)||!row.members.includes(dispute.guest)||
    !Number.isFinite(dispute.at)||dispute.at<row.at||dispute.at>s.simTime))return false;
   lastTime=row.at;lastId=row.members.at(-1);
  }
 }
 const shelters=journal.shelters,openedAt=journal.openedAt;
 if(openedAt!==undefined){
  const hospitalityAt=Math.min(journal.receipts[needed-1]?.at??Infinity,shelters?.[needed-1]?.at??Infinity);
  const blessingAt=s.blessingDiscovery?.qualifiedAt,recognizedAt=s.godhood?.recognitionAt;
  if(!Number.isFinite(openedAt)||!Number.isFinite(blessingAt)||!Number.isFinite(recognizedAt)||
   openedAt<Math.max(hospitalityAt,blessingAt,recognizedAt)||openedAt>s.simTime)return false;
 }
 const alternate=journal.shelterAlternate;
 if(shelters===undefined)return alternate===undefined;
 if(!Array.isArray(shelters)||!shelters.length||shelters.length>needed)return false;
 const validShelter=(row,earliest)=>row&&(row.hostId===undefined)===(row.originId===undefined)&&
  Object.keys(row).length===(row.hostId===undefined?3:5)&&differentBanks(s,row.origin,row.host)&&
  Number.isFinite(row.at)&&row.at>=earliest&&row.at<=s.simTime;
 if(!shelters.every((row,i)=>validShelter(row,shelters[i-1]?.at??0)))return false;
 const [first,second]=shelters;
 if(second&&!separateShelters(first,second))return false;
 return alternate===undefined||!second&&!!validShelter(alternate,first.at)&&
  (first.host===alternate.host)!==(first.origin===alternate.origin);
}
