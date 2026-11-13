import {worldWidth,worldHeight,isDryPoint,riverAxis,signedRiverDistance,onBridge} from './world.js';
import {networkFor,rerouteCitizens} from './workforce.js';
import {footprintSize} from './footprints.js';
const copy=p=>({x:p.x,y:p.y}),key=p=>`${p.x},${p.y}`,distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const navigation=new WeakMap(),ritualLayouts=new WeakMap();
function navigator(s,gather,clearance=0,blockGather=false){
 const solids=blockGather?s.buildings.filter(b=>!['field','garden','bridge'].includes(b.type)):[];
 const bridges=s.buildings.filter(b=>b.type==='bridge'),blocked=new Set(s.buildings.filter(b=>!['field','garden','bridge'].includes(b.type)&&distance(b,gather)>.01).map(key)),baseFree=p=>p.x>=-.5&&p.x<=worldWidth(s)-.5&&p.y>=-.5&&p.y<=worldHeight(s)-.5&&(isDryPoint(s,p.x,p.y)||onBridge(bridges,p.x,p.y,s))&&!(Math.abs(p.x-Math.round(p.x))<.38&&Math.abs(p.y-Math.round(p.y))<.38&&blocked.has(`${Math.round(p.x)},${Math.round(p.y)}`))&&!solids.some(b=>{const size=footprintSize(b);return Math.abs(p.x-b.x-(size-1)/2)<size/2-.04&&Math.abs(p.y-b.y-(size-1)/2)<size/2-.04;});
 const free=p=>baseFree(p)&&(!clearance||[-clearance,clearance].every(dx=>[-clearance,clearance].every(dy=>baseFree({x:p.x+dx,y:p.y+dy}))));
 const clear=(a,b)=>{const n=Math.max(1,Math.ceil(distance(a,b)*8));for(let i=0;i<=n;i++)if(!free({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n}))return false;return true;};
 function nearest(p){for(let r=0;r<=8;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;const q={x:Math.round(p.x*2)/2+dx*.5,y:Math.round(p.y*2)/2+dy*.5};if(free(q)&&clear(p,q))return q;}return null;}
 const paths=new Map();
 function route(from,to){const a=nearest(from),b=nearest(to);if(!a||!b)return [];const id=`${key(a)}>${key(b)}`;let path=paths.get(id);
 if(!paths.has(id)){const open=[{...a,cost:0,score:distance(a,b)}],best=new Map([[key(a),0]]),previous=new Map(),points=new Map([[key(a),a]]);let end=null;
 while(open.length){open.sort((a,b)=>b.score-a.score);const p=open.pop(),pk=key(p);if(p.cost!==best.get(pk))continue;if(pk===key(b)){end=pk;break;}
 for(const [dx,dy]of [[-.5,0],[.5,0],[0,-.5],[0,.5],[-.5,-.5],[.5,-.5],[-.5,.5],[.5,.5]]){const q={x:p.x+dx,y:p.y+dy},qk=key(q),cost=p.cost+Math.hypot(dx,dy);if(cost>=(best.get(qk)??Infinity)||!clear(p,q))continue;best.set(qk,cost);previous.set(qk,pk);points.set(qk,q);open.push({...q,cost,score:cost+Math.hypot(q.x-b.x,q.y-b.y)});}}
 path=[];if(end){for(let k=end;k!==undefined;k=previous.get(k))path.push(copy(points.get(k)));path.reverse();}paths.set(id,path);}
 return path.length?[copy(from),...path.map(copy),copy(to)]:[];
 }
 return {free,clear,nearest,route,state:s};
}
function move(entity,actor,dt){let remaining=dt*(actor.id===undefined?.85:.72+((actor.id*.61803398875)%1)*.22);while(remaining>1e-8){const target=actor.route[actor.routeIndex];if(!target)return true;const d=distance(entity,target);if(d<=remaining+1e-8){entity.x=target.x;entity.y=target.y;actor.routeIndex++;remaining-=d;}else{entity.x+=(target.x-entity.x)*remaining/d;entity.y+=(target.y-entity.y)*remaining/d;return false;}}return actor.routeIndex>=actor.route.length;}
function boundary(nav,gather,lane=0){const s=nav.state;const bank=signedRiverDistance(gather.x,gather.y,s)<0,left=riverAxis(s)==='x'?gather.x<worldWidth(s)/2:bank,x=left?0:worldWidth(s)-1;for(let r=0;r<worldHeight(s);r++)for(const sign of r?[1,-1]:[1]){const y=Math.max(0,Math.min(worldHeight(s)-1,Math.round((gather.y+lane+r*sign)*2)/2)),p={x,y};if((signedRiverDistance(p.x,p.y,s)<0)===bank&&nav.free(p)&&nav.route(gather,p).length)return p;}return copy(gather);}
function startLegacyDesertFuneral(s,deceased,{family=false}={}){
 if(s.funeral||!deceased?.length)return false;
 const host=['ziggurat','shrine','house'].map(type=>s.buildings.find(b=>b.type===type&&b.construction?.kind!=='new')).find(Boolean),gather=host?{x:host.x,y:host.y}:copy(deceased[0]),nav=navigator(s,gather),edge=boundary(nav,gather);
 const dead=deceased.map((d,i)=>({id:d.id??i,name:String(d.name||`Житель ${1+(d.id??i)}`).slice(0,100),x:d.x,y:d.y}));
 const relatives=new Set(deceased.map(d=>d.id)),eligible=s.citizens.filter(c=>c.age>=16&&c.clothingTarget===undefined&&!c.waterTrip&&!c.craftSite&&!c.seedField&&!c.pantryTrip&&!Object.values(c.cargo||{}).some(n=>n>0)&&!Object.values(c.buildCargo||{}).some(n=>n>0)),participants=family?eligible.sort((a,b)=>Number(b.parents?.some(id=>relatives.has(id))||relatives.has(b.partner))-Number(a.parents?.some(id=>relatives.has(id))||relatives.has(a.partner))).slice(0,4):s.citizens;
 const f=s.funeral={...family?{scope:'family'}:{},style:'desert',stage:'gathering',deceased:dead,actors:participants.map(c=>({id:c.id,route:nav.route(c,gather),routeIndex:0,delay:0,departure:null,pending:false})),coffin:copy(gather),gather,boundary:edge,procession:nav.route(gather,edge),bierRouteIndex:0,timer:0};
 if(!f.procession.length)f.procession=[copy(gather)];navigation.set(f,nav);return true;
}
function advanceLegacyDesertFuneral(s,dt){const f=s.funeral;if(!f)return false;if(!Number.isFinite(dt)||dt<=0)return true;f.timer+=dt;
 let nav=navigation.get(f);if(!nav){nav=navigator(s,f.gather);navigation.set(f,nav);}
 const citizens=new Map(s.citizens.map(c=>[c.id,c]));
 if(f.stage==='gathering'||f.stage==='returning'){
 // Prepare only a few independent paths per simulation step, never one large crowd spike.
 let budget=1;const side=f.boundary.x<f.gather.x?-1:1;
 for(const [i,a]of f.actors.entries()){
  if(!budget)break;
  if(f.stage==='gathering'&&a.departure===null){budget--;a.departure=[];
   const lane=((i*.61803398875)%1-.5)*5,end=boundary(nav,f.gather,lane),middle={x:f.gather.x+side*Math.min(3,Math.abs(f.boundary.x-f.gather.x)/2),y:Math.max(.5,Math.min(worldHeight(s)-1.5,f.gather.y+lane))};
   if(nav.free(middle)){const first=nav.route(f.gather,middle),last=nav.route(middle,end);if(first.length&&last.length)a.departure=[...first,...last.slice(1)];}if(!a.departure.length)a.departure=nav.route(f.gather,end);
  }else if(f.stage==='returning'&&a.pending){budget--;const c=citizens.get(a.id),net=networkFor(s),home=c&&net.ports.find(p=>`${p.building.x},${p.building.y}`===c.home&&!p.building.siteKey);a.route=c&&home?nav.route(c,home):[];a.routeIndex=0;a.pending=false;}
 }
 let done=true;for(const a of f.actors){const c=citizens.get(a.id);if(a.pending||f.stage==='gathering'&&a.departure===null)done=false;if(c&&!a.pending&&!move(c,a,dt))done=false;}
 if(done&&f.timer>=1){if(f.stage==='returning'){s.funeral=null;if(f.scope==='family'){for(const a of f.actors){const c=citizens.get(a.id);if(c){c.phase='home';c.route=[];c.routeIndex=0;}}}else rerouteCitizens(s);}else{f.stage='procession';f.timer=0;for(const a of f.actors){const c=citizens.get(a.id);a.route=c&&distance(c,f.gather)<.01?a.departure:[];a.departure=null;a.routeIndex=0;a.delay=0;}}}
 }else if(f.stage==='procession'){
 const bier={route:f.procession,routeIndex:f.bierRouteIndex};let done=move(f.coffin,bier,dt);f.bierRouteIndex=bier.routeIndex;for(const a of f.actors){const c=citizens.get(a.id);if(c&&!move(c,a,dt))done=false;}if(done){f.stage='jackals';f.timer=0;}
 }else if(f.stage==='jackals'){
 const side=f.boundary.x<worldWidth(s)/2?-1:1,t=Math.max(0,Math.min(1,(f.timer-2)/4));f.coffin.x=f.boundary.x+side*3*t;f.coffin.y=f.boundary.y;
 if(f.timer>=6){f.stage='returning';f.timer=0;for(const a of f.actors){a.route=[];a.routeIndex=0;a.delay=0;a.pending=true;}}}
 return true;
}
function legacyDesertFuneralView(s){const f=s.funeral;if(!f)return null;const side=f.boundary.x<worldWidth(s)/2?-1:1,t=Math.min(1,f.timer/2);return {stage:f.stage,torches:true,gather:f.gather,coffin:f.stage==='returning'?null:{kind:'bier',...f.coffin,count:f.deceased.length},mourners:f.actors.filter(a=>{const c=s.citizens.find(c=>c.id===a.id);return c&&(f.stage!=='gathering'||distance(c,f.gather)>.05);}).map(a=>a.id),jackals:f.stage==='jackals'?[0,1,2].map(i=>({id:`funeral-jackal-${i}`,kind:'jackal',x:f.timer<2?f.boundary.x+side*(3*(1-t)+.4*i):f.coffin.x+side*.3*i,y:f.boundary.y+(i-1)*.18})):[]};}
function validateLegacyDesertFuneral(s){
 const f=s.funeral,exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).filter(k=>o!==f||k!=='scope').length===keys.length&&keys.every(k=>k in o),point=p=>exact(p,['x','y'])&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-.5&&p.x<=worldWidth(s)-.5&&p.y>=-.5&&p.y<=worldHeight(s)-.5;
 if(!exact(f,['style','stage','deceased','actors','coffin','gather','boundary','procession','bierRouteIndex','timer'])||f.style!=='desert'||!['gathering','procession','jackals','returning'].includes(f.stage)||!point(f.gather)||!point(f.boundary)||!Array.isArray(f.deceased)||!f.deceased.length||f.deceased.length>1000||new Set(f.deceased.map(d=>d.id)).size!==f.deceased.length||f.deceased.some(d=>!exact(d,['id','name','x','y'])||!Number.isSafeInteger(d.id)||d.id<0||typeof d.name!=='string'||!d.name||d.name.length>100||!point({x:d.x,y:d.y}))||!Number.isFinite(f.timer)||f.timer<0||f.timer>1e6||!exact(f.coffin,['x','y'])||!Number.isFinite(f.coffin.x)||!Number.isFinite(f.coffin.y)||f.coffin.x< -3.5||f.coffin.x>worldWidth(s)+2.5||f.coffin.y<-.5||f.coffin.y>worldHeight(s)-.5||!Array.isArray(f.actors)||(f.scope==='family'?f.actors.length>4:f.actors.length!==s.citizens.length)||f.scope!==undefined&&f.scope!=='family')return false;
 const nav=navigator(s,f.gather),route=r=>Array.isArray(r)&&r.length<=worldWidth(s)*worldHeight(s)*4&&r.every((p,i)=>point(p)&&nav.free(p)&&(!i||nav.clear(r[i-1],p))),index=(v,r)=>Number.isSafeInteger(v)&&v>=0&&v<=r.length;
 if(!route(f.procession)||!f.procession.length||distance(f.procession[0],f.gather)>.001||distance(f.procession.at(-1),f.boundary)>.001||!index(f.bierRouteIndex,f.procession))return false;
 const ids=new Set();for(const a of f.actors){if(!exact(a,['id','route','routeIndex','delay','departure','pending'])||ids.has(a.id)||!s.citizens.some(c=>c.id===a.id)||!route(a.route)||!index(a.routeIndex,a.route)||a.delay!==0||typeof a.pending!=='boolean'||a.departure!==null&&!route(a.departure))return false;ids.add(a.id);}navigation.set(f,nav);return true;
}

// v2 adds ceremony progress inside the existing v27 save envelope. Old desert
// payloads keep their original validator and progression, including road migration.
const riteStages=['gathering','procession','farewell','collecting','receding','jackals','returning'];
function transporters(s,f){return f.actors.map(a=>s.citizens.find(c=>c.id===a.id)).filter(c=>c&&c.age>=16&&!Object.values(c.cargo||{}).some(n=>n>0)&&!Object.values(c.buildCargo||{}).some(n=>n>0));}
function capacity(s,f){const n=transporters(s,f).length;return Math.max(1,Math.min(4,Math.floor(n/4)||1));}
function ritualDestination(nav,gather){
 const s=nav.state,w=worldWidth(s),h=worldHeight(s),bank=signedRiverDistance(gather.x,gather.y,s)<0;
 const buildings=s.buildings.filter(b=>!['road','bridge'].includes(b.type)).map(b=>{
  const size=footprintSize(b);return {left:b.x-.5,right:b.x+size-.5,top:b.y-.5,bottom:b.y+size-.5};
 });
 const points=[];
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
  const fromGather=Math.hypot(x-gather.x,y-gather.y);
  if(fromGather<3||Math.abs(signedRiverDistance(x,y,s))<2.5||(signedRiverDistance(x,y,s)<0)!==bank)continue;
  let clearance=Infinity;
  for(const b of buildings){
   clearance=Math.min(clearance,Math.hypot(Math.max(0,b.left-x,x-b.right),Math.max(0,b.top-y,y-b.bottom)));
   if(clearance<1)break;
  }
  if(clearance<1)continue;
  // Keep a buffer from the whole built area, and prefer the nearest point
  // beyond that buffer over an unnecessarily long walk across the map.
  points.push({x,y,clearance,score:fromGather+(Math.min(x,w-1-x)<2?2:0)});
 }
 for(const minClearance of [5,3,1]){
  const ranked=points.filter(p=>p.clearance>=minClearance).sort((a,b)=>a.score-b.score||b.clearance-a.clearance||a.y-b.y||a.x-b.x);
  for(const p of ranked.slice(0,12)){
   const end=copy(p);
   if(!nav.free(end))continue;
   const route=nav.route(gather,end);
   if(route.length)return {end,route};
  }
 }
 const edge=boundary(nav,gather),route=nav.route(gather,edge);
 return route.length?{end:edge,route}:{end:copy(gather),route:[copy(gather)]};
}
export function startDesertFuneral(s,deceased,options={}){
 if(!startLegacyDesertFuneral(s,deceased,options))return false;
 const f=s.funeral,nav=navigator(s,s.funeral.gather,.19);navigation.set(f,nav);f.ritualVersion=2;f.batch=0;f.laid=0;
 const destination=ritualDestination(nav,f.gather);f.boundary=destination.end;f.procession=destination.route;
 return true;
}
function beginRiteStage(f,stage){f.stage=stage;f.timer=0;}
function finishRite(s,f){s.funeral=null;if(f.scope==='family'){for(const a of f.actors){const c=s.citizens.find(c=>c.id===a.id);if(c){c.phase='home';c.route=[];c.routeIndex=0;}}}else rerouteCitizens(s);}
// Small cohorts leave over the first few seconds of the same saved stage.
function dispersalDelay(index,count){
 const groups=Math.min(8,Math.ceil(count/3));
 return (index%groups)*.85+(Math.floor(index/groups)%3)*.16;
}
function prepareFarewell(s,f,nav,citizens){
 const stations=farewellStations(ritualLayout(s,f),f,f.batch*capacity(s,f),s);
 for(const [index,a] of f.actors.entries()){
  const c=citizens.get(a.id),station=stations[index];
  a.route=c&&station?nav.route(c,station):[];
  a.routeIndex=0;
  // This existing route flag also lets a saved farewell resume the approach.
  a.pending=true;
 }
}
function prepareReturn(s,f,nav,toGather=false){
 const net=networkFor(s);
 const exits=new Map();
 function returnApproaches(home){
  if(!exits.has(home)){
   const candidates=[];
   for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
    const point={x:home.x+dx*.5,y:home.y+dy*.5};
    if(nav.free(point))candidates.push(point);
   }
   exits.set(home,candidates.sort((a,b)=>distance(a,home)-distance(b,home)));
  }
  return exits.get(home);
 }
 for(const a of f.actors){
  const c=s.citizens.find(c=>c.id===a.id);
  const home=c&&net.ports.find(p=>`${p.building.x},${p.building.y}`===c.home&&!p.building.siteKey);
  const destination=toGather?f.gather:home||f.gather;
  a.route=c?nav.route(c,destination):[];
  if(c&&!a.route.length){
   for(const approach of returnApproaches(destination)){
    a.route=nav.route(c,approach);
    if(a.route.length)break;
   }
   if(!a.route.length)a.route=nav.route(c,f.gather);
  }
  a.routeIndex=0;a.pending=false;
 }
}
export function advanceDesertFuneral(s,dt){
 const f=s.funeral;if(!f||f.ritualVersion!==2)return advanceLegacyDesertFuneral(s,dt);if(!Number.isFinite(dt)||dt<=0)return true;
 f.timer+=dt;let nav=navigation.get(f);if(!nav){nav=navigator(s,f.gather,.19);navigation.set(f,nav);}const citizens=new Map(s.citizens.map(c=>[c.id,c]));
 if(['gathering','collecting','receding','returning'].includes(f.stage)){
  let done=true,budget=1;
  for(const [i,a]of f.actors.entries()){
   const c=citizens.get(a.id);if(f.stage==='gathering'&&a.departure===null&&budget){budget--;const lane=((i*.61803398875)%1-.5)*2,end=nav.nearest({x:f.boundary.x+(f.boundary.x<f.gather.x?.45:-.45),y:Math.max(.5,Math.min(worldHeight(s)-1.5,f.boundary.y+lane))});a.departure=end?nav.route(f.gather,end):[];}
   if(f.stage==='gathering'&&a.departure===null)done=false;
   const delay=f.stage==='receding'?dispersalDelay(i,f.actors.length):0;
   if(c&&a.routeIndex<a.route.length){
    const time=Math.min(dt,Math.max(0,f.timer-delay));
    if(!time||!move(c,a,time))done=false;
   }
  }
  // A disconnected household must never hold the whole city indefinitely.
  if((done&&f.timer>=1)||f.timer>=160){
   if(f.stage==='returning'){finishRite(s,f);return true;}
   if(f.stage==='receding'){beginRiteStage(f,'jackals');return true;}
   if(f.stage==='collecting'){f.batch++;f.coffin=copy(f.gather);f.bierRouteIndex=0;}
   beginRiteStage(f,'procession');for(const a of f.actors){a.route=a.departure?.map(copy)||f.procession.map(copy);a.routeIndex=0;a.delay=0;}
  }
 }else if(f.stage==='procession'){
  const actor={route:f.procession,routeIndex:f.bierRouteIndex};const done=move(f.coffin,actor,dt);f.bierRouteIndex=actor.routeIndex;
  for(const a of f.actors){const c=citizens.get(a.id);if(c)move(c,a,dt);}
  if(done||f.timer>=160){f.coffin=copy(f.boundary);beginRiteStage(f,'farewell');prepareFarewell(s,f,nav,citizens);}
 }else if(f.stage==='farewell'){
  if(f.actors.some(a=>!a.pending))prepareFarewell(s,f,nav,citizens);
  let settled=true;
  for(const a of f.actors){const c=citizens.get(a.id);if(c&&!move(c,a,dt))settled=false;}
  if(f.timer>=5&&(settled||f.timer>=12)){f.laid=Math.min(f.deceased.length,(f.batch+1)*capacity(s,f));if(f.laid<f.deceased.length){beginRiteStage(f,'collecting');prepareReturn(s,f,nav,true);}else{beginRiteStage(f,'receding');prepareReturn(s,f,nav);}}
 }else if(f.stage==='jackals'&&f.timer>=7){beginRiteStage(f,'returning');}
 return true;
}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function riteSlot(origin,index,s){const rows=Math.floor((worldHeight(s)-2)/.43),start=clamp(Math.round((origin.y-.5)/.43),0,rows-1),row=(start+index%rows)%rows,col=Math.floor(index/rows),inward=origin.x<worldWidth(s)/2?1:-1;return {x:clamp(origin.x+inward*col*.50,.5,worldWidth(s)-1.5),y:.5+row*.43};}
function ritualLayout(s,f){let result=ritualLayouts.get(f);if(result)return result;const nav=navigator(s,f.gather,.19,true),bank=signedRiverDistance(f.gather.x,f.gather.y,s)<0,points=[];
 for(let y=.5;y<worldHeight(s)-1;y+=.5)for(let x=.5;x<worldWidth(s)-1;x+=.5){const p={x,y};if((signedRiverDistance(x,y,s)<0)!==bank||!nav.free(p)||![-.22,.22].every(dx=>[-.22,.22].every(dy=>nav.free({x:x+dx,y:y+dy}))))continue;points.push(p);}
 const slots=origin=>[...points].sort((a,b)=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y)||a.y-b.y||a.x-b.x).slice(0,f.deceased.length);
 result={gather:slots(f.gather),laid:slots(f.boundary),routes:new Map(),crowds:new Map(),points,nav};ritualLayouts.set(f,result);return result;
}
function routeLength(route){let n=0;for(let i=1;i<route.length;i++)n+=Math.hypot(route[i].x-route[i-1].x,route[i].y-route[i-1].y);return n;}
function routePoint(route,progress){let remaining=routeLength(route)*progress;for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],length=Math.hypot(b.x-a.x,b.y-a.y);if(remaining<=length&&length>.00001)return {x:a.x+(b.x-a.x)*remaining/length,y:a.y+(b.y-a.y)*remaining/length,yaw:Math.atan2(b.x-a.x,b.y-a.y)};remaining-=length;}const end=route.at(-1),previous=[...route].reverse().find(p=>distance(p,end)>.001);return {...end,yaw:previous?Math.atan2(end.x-previous.x,end.y-previous.y):0};}
function processionPath(route){
 const segments=[];
 let length=0;
 for(let i=1;i<route.length;i++){
  const a=route[i-1],b=route[i],distance=Math.hypot(b.x-a.x,b.y-a.y);
  if(distance>1e-7){segments.push({a,b,distance,start:length});length+=distance;}
 }
 function at(offset){
  const segment=segments.find(p=>offset<p.start+p.distance)||segments.at(-1);
  if(!segment)return route[0];
  const f=clamp((offset-segment.start)/segment.distance,0,1);
  return {x:segment.a.x+(segment.b.x-segment.a.x)*f,y:segment.a.y+(segment.b.y-segment.a.y)*f};
 }
 return {at,length};
}
function processionCrowd(s,f,layout,assigned,biers){
 const path=layout.procession??=processionPath(f.procession);
 const travelled=clamp(path.length-routeLength([f.coffin,...f.procession.slice(f.bierRouteIndex)]),0,path.length);
 const activeBiers=biers.filter(b=>b.visible&&b.carriers.length),used=new Map(),positions=new Map();
 const key=(x,y)=>x+','+y;
 const reserved=p=>{
  if(activeBiers.some(b=>Math.hypot(p.x-b.x,p.y-b.y)<.30))return true;
  const x=Math.floor(p.x/.18),y=Math.floor(p.y/.18);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)
   if(used.get(key(x+dx,y+dy))?.some(other=>Math.hypot(p.x-other.x,p.y-other.y)<.17))return true;
  return false;
 };
 const citizens=new Map(s.citizens.map(c=>[c.id,c]));
 let index=0;
 for(const actor of f.actors){
  const citizen=citizens.get(actor.id);
  if(!citizen||assigned.has(actor.id))continue;
  const sideIndex=index%5,row=Math.floor(index/5);
  const variation=(citizen.id*.61803398875)%1;
  const shift=(sideIndex-2)*.21+(variation-.5)*.13;
  const offset=travelled-(.47+row*.24+variation*.21);
  const center=path.at(Math.max(0,offset));
  const front=path.at(Math.max(.12,offset+.15)),back=path.at(Math.max(0,offset-.15));
  const yaw=Math.atan2(front.x-back.x,front.y-back.y);
  const axis={x:Math.sin(yaw),y:Math.cos(yaw)},side={x:Math.cos(yaw),y:-Math.sin(yaw)};
  const origin={x:center.x+axis.x*Math.min(0,offset),y:center.y+axis.y*Math.min(0,offset)};
  const nudge=(p,dx,dy)=>({x:p.x+side.x*dx+axis.x*dy,y:p.y+side.y*dx+axis.y*dy});
  const alternatives=[nudge(origin,shift,0),nudge(origin,shift*.60,-.16),nudge(origin,-shift,-.09),nudge(citizen,shift*.66,-.08),nudge(citizen,-shift*.66,.10)];
  const point=alternatives.find(p=>!reserved(p)&&layout.nav.clear(offset<0?citizen:center,p))||citizen;
  const id=key(Math.floor(point.x/.18),Math.floor(point.y/.18));
  if(!used.has(id))used.set(id,[]);
  used.get(id).push(point);
  positions.set(actor.id,{x:point.x,y:point.y,yaw});
  index++;
 }
 return positions;
}
function farewellStations(layout,f,first,s){
 const key=`${first}:${f.actors.length}`;if(layout.crowds.has(key))return layout.crowds.get(key);
 const base=layout.laid[first]||f.boundary,inward=f.boundary.x<f.gather.x?1:-1,occupied=layout.laid.slice(0,Math.min(f.deceased.length,first+4));
 // A half-tile navigation grid is three metres wide in the 3D view. Use a
 // closer standing grid for the farewell, while retaining dry-ground and
 // building clearance checks and a clear space around every laid bier.
 let candidates=[];const bank=signedRiverDistance(f.gather.x,f.gather.y,s)<0,limit=Math.hypot(worldWidth(s),worldHeight(s));
 for(let reach=Math.max(1.2,Math.sqrt(f.actors.length)*.22);;reach=Math.min(limit,reach*2)){
  candidates=[];
  for(let y=Math.max(.5,base.y-reach);y<Math.min(worldHeight(s)-1,base.y+reach);y+=.18)for(let x=Math.max(.5,base.x-reach);x<Math.min(worldWidth(s)-1,base.x+reach);x+=.18){
   const p={x,y};if((signedRiverDistance(x,y,s)<0)!==bank||(p.x-base.x)*inward<.22||!layout.nav.free(p)||occupied.some(b=>Math.hypot(p.x-b.x,p.y-b.y)<.32))continue;
   candidates.push(p);
  }
  if(candidates.length>=f.actors.length||reach>=limit)break;
 }
 const stations=candidates.sort((a,b)=>Math.hypot(a.x-base.x,a.y-base.y)-Math.hypot(b.x-base.x,b.y-base.y)||a.y-b.y||a.x-b.x).slice(0,f.actors.length);
 layout.crowds.set(key,stations);return stations;
}
export function desertFuneralView(s){
 const f=s.funeral;if(!f)return null;if(f.ritualVersion!==2)return legacyDesertFuneralView(s);
 const layout=ritualLayout(s,f),adults=transporters(s,f),size=capacity(s,f),first=f.batch*size,last=Math.min(f.deceased.length,first+size),moving=f.stage==='procession',farewell=f.stage==='farewell';
 const dx=f.boundary.x-f.gather.x,dy=f.boundary.y-f.gather.y;let yaw=Math.atan2(dx,dy);
 if(moving){const target=f.procession[f.bierRouteIndex];if(target&&distance(target,f.coffin)>.001)yaw=Math.atan2(target.x-f.coffin.x,target.y-f.coffin.y);}else if(farewell){const end=f.procession.at(-1),previous=[...f.procession].reverse().find(p=>distance(p,end)>.001);if(previous)yaw=Math.atan2(end.x-previous.x,end.y-previous.y);}
 const forward={x:Math.sin(yaw),y:Math.cos(yaw)},right={x:Math.cos(yaw),y:-Math.sin(yaw)};
 const biers=f.deceased.map((d,i)=>{
  const active=i>=first&&i<last,laid=i<f.laid||active&&farewell;let slot=laid?layout.laid[i]||riteSlot(f.boundary,i,s):layout.gather[i]||riteSlot(f.gather,i,s),bierYaw=yaw;
  if(active&&(moving||farewell)){let route=layout.routes.get(i);if(!route){route=layout.nav.route(layout.gather[i]||f.gather,layout.laid[i]||f.boundary);layout.routes.set(i,route);}if(route.length){const total=routeLength(f.procession),remaining=routeLength([f.coffin,...f.procession.slice(f.bierRouteIndex)]),point=routePoint(route,farewell?1:total?clamp(1-remaining/total,0,1):1);slot={x:point.x,y:point.y};bierYaw=point.yaw;}}
  const direction={x:Math.sin(bierYaw),y:Math.cos(bierYaw)},lateral={x:Math.cos(bierYaw),y:-Math.sin(bierYaw)},height=active&&farewell&&adults.length>=2?1.12-.96*clamp(f.timer/1.2,0,1):laid?.16:active&&moving&&adults.length>=2?1.12:.16;
  const group=active&&(moving||farewell&&f.timer<1.2)?adults.slice((i-first)*(adults.length>=4?4:Math.max(1,adults.length)),(i-first+1)*(adults.length>=4?4:Math.max(1,adults.length))):[];
  const carriers=group.map((c,k)=>{const side=k%2?-1:1,long=group.length>=4?(k<2?-.13:.13):0,x=slot.x+lateral.x*side*.09+direction.x*long,y=slot.y+lateral.y*side*.09+direction.y*long,grip={x:slot.x+lateral.x*side*.063+direction.x*long,y:slot.y+lateral.y*side*.063+direction.y*long,height};
   if(group.length===1){const stand={x:slot.x+direction.x*.30,y:slot.y+direction.y*.30},handle={x:slot.x+direction.x*.22,y:slot.y+direction.y*.22,height:.90};return {id:c.id,...stand,yaw:bierYaw,hands:{left:{...handle,x:handle.x-lateral.x*.025,y:handle.y-lateral.y*.025},right:{...handle,x:handle.x+lateral.x*.025,y:handle.y+lateral.y*.025}}};}
   return {id:c.id,x,y,yaw:bierYaw,hands:{left:{x:grip.x-direction.x*.025,y:grip.y-direction.y*.025,height},right:{x:grip.x+direction.x*.025,y:grip.y+direction.y*.025,height}}};});
  const waveSize=3,waveSeconds=7/Math.ceil(f.deceased.length/waveSize),wave=Math.min(Math.ceil(f.deceased.length/waveSize)-1,Math.floor(f.timer/waveSeconds));
  const visible=f.stage==='jackals'?i>=wave*waveSize&&i<(wave+1)*waveSize:f.deceased.length<=24||active||i>=Math.max(0,f.laid-8)&&i<Math.max(last+8,f.laid);
  return {id:`funeral-bier-${d.id}`,deceasedId:d.id,visible,...slot,yaw:bierYaw,height,shroud:'#f4f0e5',carriers,laid,transport:adults.length<2?'sledge':'carried'};
 });
 const stations=farewell?farewellStations(layout,f,first,s):null,laidBiers=biers.filter(b=>b.laid&&b.visible!==false);
 const assigned=new Map(biers.flatMap(b=>b.carriers.map(c=>[c.id,c]))),citizens=new Map(s.citizens.map(c=>[c.id,c]));
 const crowd=moving?processionCrowd(s,f,layout,assigned,biers):null;
 let torchCount=0;
 const participants=f.actors.map((a,i)=>{
  const c=citizens.get(a.id);if(!c)return null;const carrier=assigned.get(a.id);if(carrier)return {...carrier,role:'carrier',walking:moving,bow:farewell?.25:0,torch:false};
  const station=stations?.[i],approaching=farewell&&a.pending&&a.routeIndex<a.route.length;
  const position=crowd?.get(a.id)||(a.pending?c:station)||c,{x,y}=position;
  const nearest=station&&!approaching&&laidBiers.reduce((near,b)=>!near||Math.hypot(b.x-x,b.y-y)<Math.hypot(near.x-x,near.y-y)?b:near,null);
  const target=nearest||a.route[a.routeIndex];
  const heading=crowd?.get(a.id)?.yaw??(target&&Math.hypot(target.x-x,target.y-y)>.001?Math.atan2(target.x-x,target.y-y):yaw);
  const waiting=f.stage==='receding'&&f.timer<dispersalDelay(i,f.actors.length);
  const walking=moving||approaching||!waiting&&['gathering','collecting','receding'].includes(f.stage)&&a.routeIndex<a.route.length;
  return {id:c.id,x,y,yaw:heading,role:'mourner',walking,bow:farewell&&!walking?.10+.05*Math.sin(clamp(f.timer/5,0,1)*Math.PI):0,torch:c.age>=16&&torchCount++<8};
 }).filter(Boolean);
 const side=dx<0?-1:1,waveSeconds=7/Math.ceil(f.deceased.length/3),waveTime=(f.timer%waveSeconds)/waveSeconds*7,t=clamp(waveTime/4,0,1),jackals=f.stage==='jackals'?biers.filter(b=>b.visible).slice(0,3).map((b,i)=>({id:`funeral-jackal-${i}`,kind:'jackal',x:clamp(b.x+side*(1.4*(1-t)+.22+Math.max(0,waveTime-4)*.06),.1,worldWidth(s)-.6),y:b.y,yaw:Math.atan2(-side,0),faceX:b.x,faceY:b.y,behavior:waveTime<4?'approaching':'pulling',walking:true,pulling:waveTime>=4,bundleId:b.id})):[];
 return {stage:f.stage,torches:true,gather:f.gather,coffin:null,biers,participants,mourners:participants.map(p=>p.id),jackals};
}
export function validateDesertFuneral(s){
 const f=s.funeral;if(f?.ritualVersion!==2)return validateLegacyDesertFuneral(s);
 if(!Array.isArray(f.actors)||!Array.isArray(f.deceased)||!riteStages.includes(f.stage)||!Number.isSafeInteger(f.batch)||f.batch<0||f.batch>=f.deceased?.length||!Number.isSafeInteger(f.laid)||f.laid<0||f.laid>f.deceased.length)return false;
 const size=capacity(s,f),expectedLaid=['receding','jackals','returning'].includes(f.stage)?f.deceased.length:Math.min(f.deceased.length,(f.batch+(f.stage==='collecting'?1:0))*size);if(f.batch>=Math.ceil(f.deceased.length/size)||f.laid!==expectedLaid)return false;
 const legacy={...f};delete legacy.ritualVersion;delete legacy.batch;delete legacy.laid;legacy.stage=['gathering','procession','jackals','returning'].includes(f.stage)?f.stage:'procession';
 // The legacy structural validator also checks every route and deceased identity.
 const valid=validateLegacyDesertFuneral({...s,funeral:legacy});if(valid)navigation.set(f,navigator(s,f.gather,.19));return valid;
}
