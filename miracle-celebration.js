import {inannaReadinessReason} from './inanna-discovery.js';
import {syncSacredUnlocks} from './sacred-unlocks.js';
import {relicControlActive} from './city-command-lock.js';
import {usesCatDiscovery} from './scenario-profiles.js';
import {networkFor} from './workforce.js';
import {navigationSegmentClear,nearestWalkingNode,shortestWalkingPath} from './navigation.js';
import {isDryPoint,onBridge,worldWidth,worldHeight} from './world.js';
import {isOperational,buildingKey} from './definitions.js';
const point=p=>({x:p.x,y:p.y}),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const length=path=>path.reduce((n,p,i)=>n+(i?distance(path[i-1],p):0),0);
const routeCaches=new WeakMap();
function route(s,net,from,to){
 const clear=(a,b)=>navigationSegmentClear(s,a,b,net.navigation?.obstacles);
 if(clear(from,to))return [point(from),point(to)];
 let cache=routeCaches.get(s);if(!cache||cache.net!==net){cache={net,connections:new Map(),paths:new Map()};routeCaches.set(s,cache);}
 const connection=p=>{const key=`${p.x},${p.y}`;if(!cache.connections.has(key)){const near=nearestWalkingNode(net,p),choices=near?[near,...[...net.graph.get(near.key)||[]].map(k=>net.nodes.get(k))]:[];cache.connections.set(key,choices.filter(n=>clear(p,n)).sort((a,b)=>distance(a,p)-distance(b,p))[0]||null);}return cache.connections.get(key);};
 const a=connection(from),b=connection(to);if(!a||!b)return null;
 const key=`${a.key}>${b.key}`;if(!cache.paths.has(key))cache.paths.set(key,shortestWalkingPath(net,a.key,b.key));const path=cache.paths.get(key);
 return path?[point(from),...path.map(point),point(to)]:null;
}
function sample(path,progress){let d=length(path)*Math.max(0,Math.min(1,progress));for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],n=distance(a,b);if(d<=n&&n>1e-8)return {x:a.x+(b.x-a.x)*d/n,y:a.y+(b.y-a.y)*d/n,yaw:Math.atan2(b.x-a.x,b.y-a.y)};d-=n;}return {...point(path.at(-1)),yaw:0};}
export function miracleCelebrationReason(s){return s.miracleCelebration||s.funeral||s.festival?'Дождись завершения городской церемонии':'';}
export function miracleCelebrationTargetReason(s,center){if(center&&(!Number.isFinite(center.x)||!Number.isFinite(center.y)||center.x<0||center.y<0||center.x>=worldWidth(s)||center.y>=worldHeight(s)||!isDryPoint(s,center.x,center.y)))return 'Выбери сухое место для чуда';return networkFor(s).ports.length?'':'Для церемонии нужен доступный вход в город';}
const inannaGate=s=>s.buildings.find(b=>b.type==='ishtarGate'&&isOperational(b));
export function inannaMeetingReason(s){
 if(!s.inannaDiscovery||s.sacred?.unlocks?.inannaProtection)return 'Встреча защиты уже не требуется';
 if(s.event||s.lost||relicControlActive(s))return 'Сначала заверши текущее событие';
 if(miracleCelebrationReason(s))return miracleCelebrationReason(s);
 if(!inannaGate(s))return 'Сначала заверши Врата Инанны';
 return inannaReadinessReason(s);
}

function inannaMeetingSpots(s,net,center){
 const spots=[];
 for(let i=0;i<12;i++){
  const angle=i*Math.PI/6,p={x:center.x+.8*Math.cos(angle),y:center.y+.8*Math.sin(angle)};
  if(p.x>=0&&p.y>=0&&p.x<worldWidth(s)&&p.y<worldHeight(s)&&isDryPoint(s,p.x,p.y)&&navigationSegmentClear(s,p,p,net.navigation?.obstacles))spots.push(p);
 }
 return spots;
}
export function startInannaMeeting(s){
 const reason=inannaMeetingReason(s);
 if(reason)return {ok:false,reason};
 const gate=inannaGate(s),net=networkFor(s),port=net.ports.find(p=>p.building===gate);
 if(!port)return {ok:false,reason:'У порога нужен доступный вход'};
 const center=point(port),spots=inannaMeetingSpots(s,net,center);
 const candidates=s.citizens.filter(c=>c.age>=16&&c.health>0&&distance(c,center)<=24)
  .sort((a,b)=>distance(a,center)-distance(b,center)||a.id-b.id);
 const paths=new Map();
 function invite(citizen){
  const origin=point(citizen);
  for(const [i,spot] of spots.entries()){
   const path=route(s,net,origin,spot);
   if(!path||length(path)>24||path.some(p=>p.x<0||p.y<0||p.x>=worldWidth(s)||p.y>=worldHeight(s)))continue;
   paths.set(citizen.id,path);spots.splice(i,1);return true;
  }
  return false;
 }
 const priest=candidates.find(c=>c.calling==='priest'&&invite(c));
 if(!priest)return {ok:false,reason:'Жрецу нужен свободный путь к порогу'};
 const believers=new Set(s.godhood.believerIds);
 const guests=candidates.filter(c=>c!==priest).sort((a,b)=>Number(believers.has(a.id))-Number(believers.has(b.id)));
 const guest=guests.find(invite);
 if(!guest)return {ok:false,reason:'Гостю нужен свободный путь к порогу'};
 for(const c of candidates)if(paths.size<6&&!paths.has(c.id))invite(c);
 s.miracleCelebration={kind:'inanna',elapsed:0,duration:60,center,cat:null,
  inanna:{gate:buildingKey(gate),priest:priest.id,guest:guest.id},
  participants:s.citizens.map(c=>({id:c.id,path:paths.get(c.id)||[point(c)],joined:paths.has(c.id)}))};
 return {ok:true};
}
export function freeCeremonyGuest(c,time){
 return c.age>=16&&c.health>=60&&['home','resting'].includes(c.phase)&&
  !c.recovering&&!c.floodShelter&&!(c.diningUntil>time)&&!c.pendingRole&&!c.guardPost&&!c.site&&!c.clinic&&!c.school&&
  !c.waterTrip&&!c.pantryTrip&&!c.craftSite&&!c.seedField&&c.clothingTarget===undefined&&
  !c.tradeJob&&!c.saleJob&&!c.districtJob&&
  !Object.values(c.cargo||{}).some(n=>n>0)&&!Object.values(c.buildCargo||{}).some(n=>n>0);
}

export function startMiracleCelebration(s,kind,{center,catId,catDestination}={}){
 if(!['cat','fertility'].includes(kind)||miracleCelebrationReason(s)||miracleCelebrationTargetReason(s,center))return false;
 const net=networkFor(s),port=net.ports.find(p=>['ziggurat','temple','shrine'].includes(p.building.type)&&isOperational(p.building))||net.ports[0];if(!port)return false;
 center=center&&Number.isFinite(center.x)&&Number.isFinite(center.y)?point(center):point(port);
 const free=p=>isDryPoint(s,p.x,p.y)&&navigationSegmentClear(s,p,p,net.navigation?.obstacles);
 const smallCat=kind==='cat'&&usesCatDiscovery(s);
 const short=smallCat&&s.catDiscovery?.phase==='opened'&&s.catDiscovery.trial==='spent';
 if(short){
  const cat=s.pests?.cats.find(c=>c.id===catId)||s.pests?.cats.at(-1),yard=catDestination&&point(catDestination);
  if(!cat||!yard||!free(yard))return false;
  const entrances=net.ports.filter(p=>isOperational(p.building)).sort((a,b)=>Number(buildingKey(b.building)===cat.site)-Number(buildingKey(a.building)===cat.site)||distance(a,yard)-distance(b,yard));let arrival;
  for(const entrance of entrances){const path=route(s,net,point(entrance),yard);if(path&&length(path)<=12&&path.every(p=>p.x>=0&&p.y>=0&&p.x<worldWidth(s)&&p.y<worldHeight(s))){arrival=path;break;}}
  if(!arrival)return false;
  s.miracleCelebration={kind,elapsed:0,duration:8,center:yard,participants:s.citizens.map(c=>({id:c.id,path:[point(c)],joined:false})),cat:{id:`cat:${cat.id}`,path:arrival,stroll:[yard],exit:[yard]}};return true;
 }
 const limit=smallCat?4:s.citizens.length;
 const places=[];for(let ring=1;ring<=15&&places.length<limit;ring++){const r=.4+ring*.22,count=Math.ceil(r*2*Math.PI/.22);for(let i=0;i<count;i++){const a=i*2*Math.PI/count,p={x:center.x+r*Math.cos(a),y:center.y+r*Math.sin(a)};if(free(p)&&places.every(q=>distance(p,q)>=.18))places.push(p);}}
 let joined=0;
 const participants=s.citizens.map(c=>{const origin=point(c);
  if(joined>=limit||smallCat&&!freeCeremonyGuest(c,s.simTime))return {id:c.id,path:[origin],joined:false};
  let path=null;for(let i=0;i<places.length;i++){if(distance(origin,places[i])>24+1e-7)continue;const candidate=route(s,net,origin,places[i]);if(candidate&&length(candidate)<=24){path=candidate;places.splice(i,1);joined++;break;}}return {id:c.id,path:path||[origin],joined:!!path};});
 const q={kind,elapsed:0,duration:60,center,participants,cat:null};
 if(kind==='cat'){
  const cat=s.pests?.cats.find(c=>c.id===catId)||s.pests?.cats.at(-1);if(cat){const start=point(port),near=[...net.nodes.values()].filter(free).sort((a,b)=>distance(a,center)-distance(b,center)).find(p=>{const r=route(s,net,start,p);return r&&length(r)<=12;})||start;const approach=route(s,net,start,near)||[start];const yard=catDestination||net.ports.find(p=>buildingKey(p.building)===cat.site)||near;const exit=route(s,net,near,yard);const strollTarget=[...net.nodes.values()].filter(p=>free(p)&&distance(p,near)>.4&&distance(p,near)<2).sort((a,b)=>distance(a,near)-distance(b,near)).find(p=>{const r=route(s,net,near,p);return r&&length(r)<=6;});const outward=strollTarget&&route(s,net,near,strollTarget);const stroll=outward?[...outward,...outward.slice(0,-1).reverse()]:[point(near)];q.cat={id:`cat:${cat.id}`,path:approach,stroll,exit:exit&&length(exit)<=12?exit:[point(near)]};}
 }
 s.miracleCelebration=q;return true;
}
export function advanceMiracleCelebration(s,dt){if(!s.miracleCelebration||!Number.isFinite(dt)||dt<=0)return;const q=s.miracleCelebration;q.elapsed=Math.min(q.duration,q.elapsed+dt);if(q.elapsed>=q.duration-1e-7){s.miracleCelebration=null;if(q.kind==='inanna')syncSacredUnlocks(s,{inannaGate:q.inanna.gate});}}
export function miracleCelebrationView(s){const q=s.miracleCelebration;if(!q)return null;const t=q.elapsed;if(q.duration===8){const p=sample(q.cat.path,t/8);return {kind:q.kind,elapsed:t,duration:8,center:q.center,participants:q.participants.map(a=>({id:a.id,...a.path[0],yaw:0,walking:false,celebrating:false,step:0})),cat:{id:q.cat.id,kind:'cat',...p,walking:length(q.cat.path)>1e-8,step:t*6,behavior:'arriving'}};}const participants=q.participants.map(a=>{const returning=t>=45,walking=a.joined&&(t<15||returning),p=sample(returning?[...a.path].reverse():a.path,returning?(t-45)/15:t/15);return {id:a.id,...p,walking,celebrating:t>=15&&t<45&&(a.joined||q.kind!=='inanna'&&!(q.kind==='cat'&&usesCatDiscovery(s))),step:t*7};});let cat;
 if(q.cat){const exiting=t>=45,p=sample(exiting?q.cat.exit:t>=15?q.cat.stroll:q.cat.path,exiting?(t-45)/15:t>=15?(t-15)/30:t/15);cat={id:q.cat.id,kind:'cat',...p,walking:length(exiting?q.cat.exit:t>=15?q.cat.stroll:q.cat.path)>0,step:t*6,behavior:t<15?'arriving':'wandering'};}
 for(const actor of participants)if(actor.celebrating){const focus=cat||q.center;actor.yaw=Math.atan2(focus.x-actor.x,focus.y-actor.y);}return {kind:q.kind,elapsed:t,duration:q.duration,center:q.center,participants,...(cat?{cat}:{})};}
export function validateMiracleCelebration(s){const q=s.miracleCelebration;if(q==null)return true;const finite=n=>typeof n==='number'&&Number.isFinite(n),validPoint=p=>p&&finite(p.x)&&finite(p.y)&&p.x>=0&&p.y>=0&&p.x<worldWidth(s)&&p.y<worldHeight(s),path=p=>Array.isArray(p)&&p.length>0&&p.length<10000&&p.every(validPoint);if(s.funeral||s.festival||!['cat','fertility','inanna'].includes(q.kind)||!(q.duration===60||q.duration===8&&q.kind==='cat'&&usesCatDiscovery(s)&&s.catDiscovery?.phase==='opened'&&s.catDiscovery.trial==='spent')||!finite(q.elapsed)||q.elapsed<0||q.elapsed>=q.duration||!validPoint(q.center)||!Array.isArray(q.participants)||q.participants.length!==s.citizens.length)return false;const net=networkFor(s);
 if(q.kind==='inanna'){
  const meeting=q.inanna,gate=inannaGate(s),port=gate&&net.ports.find(p=>p.building===gate);
  if(!meeting||Object.keys(meeting).length!==3||!port||meeting.gate!==buildingKey(gate)||distance(q.center,port)>1e-7||
   q.cat!==null||meeting.priest===meeting.guest||inannaReadinessReason(s)||!s.inannaDiscovery||s.sacred?.unlocks?.inannaProtection||
   !s.citizens.some(c=>c.id===meeting.priest&&c.calling==='priest'&&c.age>=16)||
   !s.citizens.some(c=>c.id===meeting.guest&&c.age>=16)||
   ![meeting.priest,meeting.guest].every(id=>q.participants.some(p=>p?.id===id&&p.joined))||
   q.participants.filter(p=>p?.joined).length>6)return false;
  const spots=inannaMeetingSpots(s,net,q.center);
  for(const participant of q.participants){
   if(!participant?.joined)continue;
   const destination=Array.isArray(participant.path)&&participant.path.at(-1);
   const spot=destination?spots.findIndex(p=>distance(p,destination)<1e-7):-1;
   if(spot<0)return false;
   spots.splice(spot,1);
  }
 }else if(q.inanna!==undefined)return false;
 const safePath=p=>p.every((v,i)=>!i||((isDryPoint(s,v.x,v.y)||onBridge(s.buildings,v.x,v.y,s))&&navigationSegmentClear(s,p[i-1],v,net.navigation?.obstacles)));const ids=new Set();for(const a of q.participants){if(ids.has(a.id)||!s.citizens.some(c=>c.id===a.id)||typeof a.joined!=='boolean'||!path(a.path)||length(a.path)>24.00001||!safePath(a.path))return false;const citizen=s.citizens.find(c=>c.id===a.id);if(distance(a.path[0],citizen)>1e-7||q.duration===8&&(a.joined||a.path.length!==1))return false;ids.add(a.id);}const safeStart=p=>path(p)&&(isDryPoint(s,p[0].x,p[0].y)||onBridge(s.buildings,p[0].x,p[0].y,s))&&navigationSegmentClear(s,p[0],p[0],net.navigation?.obstacles);if(q.duration===8&&(!q.cat||!safeStart(q.cat.path)||!safeStart(q.cat.stroll)||!safeStart(q.cat.exit)||q.cat.stroll.length!==1||q.cat.exit.length!==1))return false;return !q.cat||q.kind==='cat'&&s.pests.cats.some(c=>`cat:${c.id}`===q.cat.id)&&path(q.cat.path)&&path(q.cat.stroll)&&path(q.cat.exit)&&safePath(q.cat.path)&&safePath(q.cat.stroll)&&safePath(q.cat.exit)&&length(q.cat.path)<=12.00001&&length(q.cat.exit)<=12.00001&&length(q.cat.stroll)<=12.00001&&distance(q.cat.path.at(-1),q.cat.stroll[0])<1e-7&&distance(q.cat.stroll.at(-1),q.cat.exit[0])<1e-7;}
