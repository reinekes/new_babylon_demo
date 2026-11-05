import {buildingKey,isOperational} from './definitions.js';
import {isStrictSumer} from './scenario-profiles.js';
import {cityCommandReason} from './city-command-lock.js';
import {marketStatus} from './trading.js';
import {networkFor,routeBetween} from './workforce.js';
import {reserveStock,refundSources} from './inventory.js';
import {navigationSegmentClear,nearestWalkingNode} from './navigation.js';
import {floodedSegment} from './river-flood.js';
import {addBuilderPractice,builderLevel,PRACTICE_PER_PROJECT} from './godhood.js';
import {worldWidth,worldHeight} from './world.js';

const NAME='Лу-Уту', ACTOR_ID=1000001, FOOD=3, WATER=2, LESSON=4, VISIT_SECONDS=90;
const learnerEligible=c=>c&&c.age>=16&&c.calling==='builder'&&c.role==='builder'&&!c.pendingRole&&builderLevel(c)<2;
const portAt=(network,key)=>network.ports.find(p=>buildingKey(p.building)===key);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const rationTotal=g=>Object.values(g.provisions).reduce((n,v)=>n+v.food,0);
const active=g=>g&&g.phase!=='departed';

export function externalMasterOffer(s){
 if(!isStrictSumer(s)||s.externalGuest||!s.trade?.caravan)return null;
 const caravan=s.trade.caravan,base={name:NAME,partner:caravan.name,food:FOOD,water:WATER};
 const reason=cityCommandReason(s)||(s.lost?'Поселение покинуто':s.event?'Сначала заверши событие':
  s.tick>=caravan.departAt?'Купцы готовятся к отъезду':marketStatus(s));
 if(reason)return {...base,reason};
 const network=networkFor(s),market=portAt(network,caravan.market);
 if(!market)return {...base,reason:'Нужен доступный торговый двор'};
 const component=network.components.get(market.key);
 for(const c of s.citizens.filter(learnerEligible).sort((a,b)=>a.id-b.id)){
  const home=portAt(network,c.home);
  if(!home||home.building.type!=='house'||!isOperational(home.building)||network.components.get(home.key)!==component)continue;
  return {...base,learner:c.id,home:c.home,market:caravan.market,
   reason:home.building.water<WATER?'В доме ученика нужно 2 воды':s.resources.food<FOOD?'Нужно 3 еды для пайка':''};
 }
 return {...base,reason:'Нужен взрослый вдохновлённый строитель I уровня с дорогой от дома до торгового двора'};
}

export function inviteExternalMaster(s){
 const offer=externalMasterOffer(s);
 if(!offer||offer.reason)return {ok:false,reason:offer?.reason||'Визит мастера уже был или пока недоступен'};
 const network=networkFor(s),market=portAt(network,offer.market),home=portAt(network,offer.home);
 const path=routeBetween(s,market.key,home.key);
 if(!path)return {ok:false,reason:'Нет пути до дома ученика'};
 const component=network.components.get(market.key);
 const eligibleStores=new Set(network.ports.filter(p=>network.components.get(p.key)===component).map(p=>buildingKey(p.building)));
 const provisions=reserveStock(s,{food:FOOD},{eligibleStores});
 if(!provisions)return {ok:false,reason:'Нужно 3 еды без семенного резерва на доступных складах'};
 s.externalGuest={name:NAME,partner:offer.partner,learner:offer.learner,home:offer.home,market:offer.market,
  x:market.x,y:market.y,phase:'arriving',route:path.map(p=>p.key),routeIndex:1,
  deadline:s.simTime+VISIT_SECONDS,progress:0,provisions,fed:false,outcome:null};
 return {ok:true};
}

function routeGuest(s,g,network,target){
 const start=nearestWalkingNode(network,g);
 const flood=network.navigation.flooded;
 const path=start&&target&&navigationSegmentClear(s,g,start,network.navigation.obstacles)&&
  !(flood&&floodedSegment(flood,g,start))&&routeBetween(s,start.key,target.key);
 g.route=path?path.map(p=>p.key):[];g.routeIndex=0;
}
function walkGuest(s,g,network,target,dt){
 if(!target)return false;
 const next=network.nodes.get(g.route[g.routeIndex]),previous=g.route[g.routeIndex-1];
 if(g.route.at(-1)!==target.key||g.routeIndex<g.route.length&&
   (!next||previous&&!network.graph.get(previous)?.has(next.key)))routeGuest(s,g,network,target);
 if(!g.route.length)return false;
 let remaining=dt*1.05;
 while(remaining>1e-8&&g.routeIndex<g.route.length){
  const p=network.nodes.get(g.route[g.routeIndex]),last=g.route[g.routeIndex-1];
  if(!p||last&&!network.graph.get(last)?.has(p.key)){g.route=[];g.routeIndex=0;return false;}
  const d=distance(g,p);
  if(d>remaining){g.x+=(p.x-g.x)*remaining/d;g.y+=(p.y-g.y)*remaining/d;return false;}
  g.x=p.x;g.y=p.y;g.routeIndex++;remaining-=d;
 }
 return g.routeIndex===g.route.length;
}

function finishLesson(s,g,outcome){
 if(rationTotal(g)>0)refundSources(s,g.provisions);
 g.provisions={};g.phase='returning';g.outcome=outcome;g.route=[];g.routeIndex=0;
}
export function advanceExternalGuest(s,dt,network){
 const g=s.externalGuest;
 if(!active(g))return;
 const pupil=s.citizens.find(c=>c.id===g.learner),home=portAt(network,g.home);
 if(g.phase!=='returning'&&(s.simTime>=g.deadline||!learnerEligible(pupil)||pupil.home!==g.home||!home))finishLesson(s,g,'interrupted');
 if(g.phase==='returning'){
  if(walkGuest(s,g,network,portAt(network,g.market),dt)){
   g.phase='departed';g.route=[];g.routeIndex=0;
   const title=g.outcome==='taught'?'Приглашённый мастер передал навык':'Визит мастера прерван';
   s.news.unshift({title,text:`${g.name} покинул город. ${g.outcome==='taught'?'Практика осталась у ученика.':'Занятие не состоялось.'}`,
    kind:'trade',year:s.year,season:s.season,tick:s.tick});
   s.news=s.news.slice(0,80);
  }
  return;
 }
 if(g.phase==='arriving'){
  if(walkGuest(s,g,network,home,dt)){g.phase='staying';g.route=[];g.routeIndex=0;}
  return;
 }
 if(!['home','resting'].includes(pupil.phase)||distance(pupil,home)>1.15)return;
 if(!g.fed){
  if(home.building.water<WATER)return;
  home.building.water-=WATER;g.provisions={};g.fed=true;
 }
 g.progress=Math.min(LESSON,g.progress+dt);
 if(g.progress>=LESSON-1e-8){
  g.progress=LESSON;addBuilderPractice(pupil,PRACTICE_PER_PROJECT,2);finishLesson(s,g,'taught');
 }
}

export function externalGuestView(s){
 const g=s.externalGuest;
 return active(g)?{id:ACTOR_ID,name:g.name,age:43,sex:'m',lifeStage:'adult',kind:'person',visitor:true,
  x:g.x,y:g.y,phase:'guest',walking:g.phase!=='staying'&&g.routeIndex<g.route.length,step:s.simTime*4,
  robe:'#b37b51',carrying:false,cargo:{}}:null;
}
export function protectsGuestBuilding(s,key){
 const g=s.externalGuest;
 return active(g)&&(key===g.market||key===g.home||Object.hasOwn(g.provisions,key));
}

export function validateExternalGuest(s){
 const g=s.externalGuest;
 if(g===undefined)return true;
 if(!g||!isStrictSumer(s)||g.name!==NAME||typeof g.partner!=='string'||!g.partner||g.partner.length>100||
  !Number.isSafeInteger(g.learner)||g.learner<0||g.learner>=s.demography.nextId||
  ![g.home,g.market].every(k=>typeof k==='string'&&/^\d+,\d+$/.test(k))||
  !Number.isFinite(g.deadline)||g.deadline<VISIT_SECONDS||g.deadline>s.simTime+VISIT_SECONDS||
  !Number.isFinite(g.x)||!Number.isFinite(g.y)||g.x<-.5||g.y<-.5||g.x>worldWidth(s)-.5||g.y>worldHeight(s)-.5||
  !Number.isFinite(g.progress)||g.progress<0||g.progress>LESSON||typeof g.fed!=='boolean'||
  !['arriving','staying','returning','departed'].includes(g.phase)||
  !Array.isArray(g.route)||g.route.length>(worldWidth(s)+1)*(worldHeight(s)+1)||
  !Number.isInteger(g.routeIndex)||g.routeIndex<0||g.routeIndex>g.route.length||
  !g.provisions||typeof g.provisions!=='object'||Array.isArray(g.provisions))return false;
 const beforeReturn=['arriving','staying'].includes(g.phase);
 if(beforeReturn?g.outcome!==null:!['taught','interrupted'].includes(g.outcome))return false;
 if((g.outcome==='taught')!==(g.progress===LESSON)||g.progress>0&&!g.fed)return false;
 if(!g.route.every((key,i)=>{
  if(typeof key!=='string'||!/^\d+,\d+$/.test(key))return false;
  const [x,y]=key.split(',').map(Number);
  if(x>worldWidth(s)||y>worldHeight(s))return false;
  if(!i)return true;
  const [a,b]=g.route[i-1].split(',').map(Number);
  return key!==g.route[i-1]&&Math.abs(a-x)<=1&&Math.abs(b-y)<=1;
 }))return false;
 if(active(g)&&!s.buildings.some(b=>buildingKey(b)===g.market&&['market','harbor'].includes(b.type)&&isOperational(b)))return false;
 if(!Object.entries(g.provisions).every(([key,v])=>v&&Object.keys(v).length===1&&Number.isFinite(v.food)&&v.food>0&&
  s.buildings.some(b=>buildingKey(b)===key&&b.stock)))return false;
 return Math.abs(rationTotal(g)-(beforeReturn&&!g.fed?FOOD:0))<1e-7;
}
