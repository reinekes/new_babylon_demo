import {WIDTH,HEIGHT,isDryPoint,river,onBridge} from './world.js';
import {networkFor,rerouteCitizens} from './workforce.js';
import {footprintSize} from './footprints.js';
const copy=p=>({x:p.x,y:p.y}),key=p=>`${p.x},${p.y}`,distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const navigation=new WeakMap(),ritualLayouts=new WeakMap();
function navigator(s,gather,clearance=0,blockGather=false){
 const solids=blockGather?s.buildings.filter(b=>!['field','garden','bridge'].includes(b.type)):[];
 const bridges=s.buildings.filter(b=>b.type==='bridge'),blocked=new Set(s.buildings.filter(b=>!['field','garden','bridge'].includes(b.type)&&distance(b,gather)>.01).map(key)),baseFree=p=>p.x>=-.5&&p.x<=WIDTH-.5&&p.y>=-.5&&p.y<=HEIGHT-.5&&(isDryPoint(s,p.x,p.y)||onBridge(bridges,p.x,p.y))&&!(Math.abs(p.x-Math.round(p.x))<.38&&Math.abs(p.y-Math.round(p.y))<.38&&blocked.has(`${Math.round(p.x)},${Math.round(p.y)}`))&&!solids.some(b=>{const size=footprintSize(b);return Math.abs(p.x-b.x-(size-1)/2)<size/2-.04&&Math.abs(p.y-b.y-(size-1)/2)<size/2-.04;});
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
 return {free,clear,nearest,route};
}
function move(entity,actor,dt){let remaining=dt*(actor.id===undefined?.85:.72+((actor.id*.61803398875)%1)*.22);while(remaining>1e-8){const target=actor.route[actor.routeIndex];if(!target)return true;const d=distance(entity,target);if(d<=remaining+1e-8){entity.x=target.x;entity.y=target.y;actor.routeIndex++;remaining-=d;}else{entity.x+=(target.x-entity.x)*remaining/d;entity.y+=(target.y-entity.y)*remaining/d;return false;}}return actor.routeIndex>=actor.route.length;}
function boundary(nav,gather,lane=0){const x=gather.x<river(gather.y)?0:WIDTH-1;for(let r=0;r<HEIGHT;r++)for(const sign of r?[1,-1]:[1]){const y=Math.max(0,Math.min(HEIGHT-1,Math.round((gather.y+lane+r*sign)*2)/2)),p={x,y};if(nav.free(p)&&nav.route(gather,p).length)return p;}return copy(gather);}
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
   const lane=((i*.61803398875)%1-.5)*5,end=boundary(nav,f.gather,lane),middle={x:f.gather.x+side*Math.min(3,Math.abs(f.boundary.x-f.gather.x)/2),y:Math.max(.5,Math.min(HEIGHT-1.5,f.gather.y+lane))};
   if(nav.free(middle)){const first=nav.route(f.gather,middle),last=nav.route(middle,end);if(first.length&&last.length)a.departure=[...first,...last.slice(1)];}if(!a.departure.length)a.departure=nav.route(f.gather,end);
  }else if(f.stage==='returning'&&a.pending){budget--;const c=citizens.get(a.id),net=networkFor(s),home=c&&net.ports.find(p=>`${p.building.x},${p.building.y}`===c.home&&!p.building.siteKey);a.route=c&&home?nav.route(c,home):[];a.routeIndex=0;a.pending=false;}
 }
 let done=true;for(const a of f.actors){const c=citizens.get(a.id);if(a.pending||f.stage==='gathering'&&a.departure===null)done=false;if(c&&!a.pending&&!move(c,a,dt))done=false;}
 if(done&&f.timer>=1){if(f.stage==='returning'){s.funeral=null;if(f.scope==='family'){for(const a of f.actors){const c=citizens.get(a.id);if(c){c.phase='home';c.route=[];c.routeIndex=0;}}}else rerouteCitizens(s);}else{f.stage='procession';f.timer=0;for(const a of f.actors){const c=citizens.get(a.id);a.route=c&&distance(c,f.gather)<.01?a.departure:[];a.departure=null;a.routeIndex=0;a.delay=0;}}}
 }else if(f.stage==='procession'){
 const bier={route:f.procession,routeIndex:f.bierRouteIndex};let done=move(f.coffin,bier,dt);f.bierRouteIndex=bier.routeIndex;for(const a of f.actors){const c=citizens.get(a.id);if(c&&!move(c,a,dt))done=false;}if(done){f.stage='jackals';f.timer=0;}
 }else if(f.stage==='jackals'){
 const side=f.boundary.x<WIDTH/2?-1:1,t=Math.max(0,Math.min(1,(f.timer-2)/4));f.coffin.x=f.boundary.x+side*3*t;f.coffin.y=f.boundary.y;
 if(f.timer>=6){f.stage='returning';f.timer=0;for(const a of f.actors){a.route=[];a.routeIndex=0;a.delay=0;a.pending=true;}}}
 return true;
}
function legacyDesertFuneralView(s){const f=s.funeral;if(!f)return null;const side=f.boundary.x<WIDTH/2?-1:1,t=Math.min(1,f.timer/2);return {stage:f.stage,torches:true,gather:f.gather,coffin:f.stage==='returning'?null:{kind:'bier',...f.coffin,count:f.deceased.length},mourners:f.actors.filter(a=>{const c=s.citizens.find(c=>c.id===a.id);return c&&(f.stage!=='gathering'||distance(c,f.gather)>.05);}).map(a=>a.id),jackals:f.stage==='jackals'?[0,1,2].map(i=>({id:`funeral-jackal-${i}`,kind:'jackal',x:f.timer<2?f.boundary.x+side*(3*(1-t)+.4*i):f.coffin.x+side*.3*i,y:f.boundary.y+(i-1)*.18})):[]};}
function validateLegacyDesertFuneral(s){
 const f=s.funeral,exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).filter(k=>o!==f||k!=='scope').length===keys.length&&keys.every(k=>k in o),point=p=>exact(p,['x','y'])&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-.5&&p.x<=WIDTH-.5&&p.y>=-.5&&p.y<=HEIGHT-.5;
 if(!exact(f,['style','stage','deceased','actors','coffin','gather','boundary','procession','bierRouteIndex','timer'])||f.style!=='desert'||!['gathering','procession','jackals','returning'].includes(f.stage)||!point(f.gather)||!point(f.boundary)||!Array.isArray(f.deceased)||!f.deceased.length||f.deceased.length>1000||new Set(f.deceased.map(d=>d.id)).size!==f.deceased.length||f.deceased.some(d=>!exact(d,['id','name','x','y'])||!Number.isSafeInteger(d.id)||d.id<0||typeof d.name!=='string'||!d.name||d.name.length>100||!point({x:d.x,y:d.y}))||!Number.isFinite(f.timer)||f.timer<0||f.timer>1e6||!exact(f.coffin,['x','y'])||!Number.isFinite(f.coffin.x)||!Number.isFinite(f.coffin.y)||f.coffin.x< -3.5||f.coffin.x>WIDTH+2.5||f.coffin.y<-.5||f.coffin.y>HEIGHT-.5||!Array.isArray(f.actors)||(f.scope==='family'?f.actors.length>4:f.actors.length!==s.citizens.length)||f.scope!==undefined&&f.scope!=='family')return false;
 const nav=navigator(s,f.gather),route=r=>Array.isArray(r)&&r.length<=WIDTH*HEIGHT*4&&r.every((p,i)=>point(p)&&nav.free(p)&&(!i||nav.clear(r[i-1],p))),index=(v,r)=>Number.isSafeInteger(v)&&v>=0&&v<=r.length;
 if(!route(f.procession)||!f.procession.length||distance(f.procession[0],f.gather)>.001||distance(f.procession.at(-1),f.boundary)>.001||!index(f.bierRouteIndex,f.procession))return false;
 const ids=new Set();for(const a of f.actors){if(!exact(a,['id','route','routeIndex','delay','departure','pending'])||ids.has(a.id)||!s.citizens.some(c=>c.id===a.id)||!route(a.route)||!index(a.routeIndex,a.route)||a.delay!==0||typeof a.pending!=='boolean'||a.departure!==null&&!route(a.departure))return false;ids.add(a.id);}navigation.set(f,nav);return true;
}

// v2 adds ceremony progress inside the existing v27 save envelope. Old desert
// payloads keep their original validator and progression, including road migration.
const riteStages=['gathering','procession','farewell','collecting','receding','jackals','returning'];
function transporters(s,f){return f.actors.map(a=>s.citizens.find(c=>c.id===a.id)).filter(c=>c&&c.age>=16&&!Object.values(c.cargo||{}).some(n=>n>0)&&!Object.values(c.buildCargo||{}).some(n=>n>0));}
function capacity(s,f){const n=transporters(s,f).length;return Math.max(1,Math.min(4,Math.floor(n/4)||1));}
function ritualEnd(nav,gather){const edge=boundary(nav,gather),inland={x:edge.x<WIDTH/2?2:WIDTH-3,y:edge.y};return nav.free(inland)&&nav.route(gather,inland).length?inland:nav.nearest(inland)||copy(gather);}
export function startDesertFuneral(s,deceased,options={}){
 if(!startLegacyDesertFuneral(s,deceased,options))return false;
 const f=s.funeral,nav=navigator(s,s.funeral.gather,.19);navigation.set(f,nav);f.ritualVersion=2;f.batch=0;f.laid=0;
 f.boundary=ritualEnd(nav,f.gather);f.procession=nav.route(f.gather,f.boundary);if(!f.procession.length)f.procession=[copy(f.gather)];
 return true;
}
function beginRiteStage(f,stage){f.stage=stage;f.timer=0;}
function finishRite(s,f){s.funeral=null;if(f.scope==='family'){for(const a of f.actors){const c=s.citizens.find(c=>c.id===a.id);if(c){c.phase='home';c.route=[];c.routeIndex=0;}}}else rerouteCitizens(s);}
function prepareReturn(s,f,nav,toGather=false){
 const net=networkFor(s);for(const a of f.actors){const c=s.citizens.find(c=>c.id===a.id),home=c&&net.ports.find(p=>`${p.building.x},${p.building.y}`===c.home&&!p.building.siteKey);a.route=c?nav.route(c,toGather?f.gather:home||f.gather):[];if(c&&!a.route.length)a.route=nav.route(c,f.gather);a.routeIndex=0;a.pending=false;}
}
export function advanceDesertFuneral(s,dt){
 const f=s.funeral;if(!f||f.ritualVersion!==2)return advanceLegacyDesertFuneral(s,dt);if(!Number.isFinite(dt)||dt<=0)return true;
 f.timer+=dt;let nav=navigation.get(f);if(!nav){nav=navigator(s,f.gather,.19);navigation.set(f,nav);}const citizens=new Map(s.citizens.map(c=>[c.id,c]));
 if(['gathering','collecting','receding','returning'].includes(f.stage)){
  let done=true,budget=1;
  for(const [i,a]of f.actors.entries()){
   const c=citizens.get(a.id);if(f.stage==='gathering'&&a.departure===null&&budget){budget--;const lane=((i*.61803398875)%1-.5)*2,end=nav.nearest({x:f.boundary.x+(f.boundary.x<f.gather.x?.45:-.45),y:Math.max(.5,Math.min(HEIGHT-1.5,f.boundary.y+lane))});a.departure=end?nav.route(f.gather,end):[];}
   if(f.stage==='gathering'&&a.departure===null)done=false;
   if(c&&!move(c,a,dt))done=false;
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
  if(done||f.timer>=160){f.coffin=copy(f.boundary);beginRiteStage(f,'farewell');}
 }else if(f.stage==='farewell'){
  if(f.timer>=5){f.laid=Math.min(f.deceased.length,(f.batch+1)*capacity(s,f));if(f.laid<f.deceased.length){beginRiteStage(f,'collecting');prepareReturn(s,f,nav,true);}else{beginRiteStage(f,'receding');prepareReturn(s,f,nav);}}
 }else if(f.stage==='jackals'&&f.timer>=7){beginRiteStage(f,'returning');}
 return true;
}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function riteSlot(origin,index){const rows=Math.floor((HEIGHT-2)/.43),start=clamp(Math.round((origin.y-.5)/.43),0,rows-1),row=(start+index%rows)%rows,col=Math.floor(index/rows),inward=origin.x<WIDTH/2?1:-1;return {x:clamp(origin.x+inward*col*.50,.5,WIDTH-1.5),y:.5+row*.43};}
function ritualLayout(s,f){let result=ritualLayouts.get(f);if(result)return result;const nav=navigator(s,f.gather,.19,true),bank=f.gather.x<river(f.gather.y),points=[];
 for(let y=.5;y<HEIGHT-1;y+=.5)for(let x=.5;x<WIDTH-1;x+=.5){const p={x,y};if((x<river(y))!==bank||!nav.free(p)||![-.22,.22].every(dx=>[-.22,.22].every(dy=>nav.free({x:x+dx,y:y+dy}))))continue;points.push(p);}
 const slots=origin=>[...points].sort((a,b)=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y)||a.y-b.y||a.x-b.x).slice(0,f.deceased.length);
 result={gather:slots(f.gather),laid:slots(f.boundary),routes:new Map(),crowds:new Map(),points,nav};ritualLayouts.set(f,result);return result;
}
function routeLength(route){let n=0;for(let i=1;i<route.length;i++)n+=Math.hypot(route[i].x-route[i-1].x,route[i].y-route[i-1].y);return n;}
function routePoint(route,progress){let remaining=routeLength(route)*progress;for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],length=Math.hypot(b.x-a.x,b.y-a.y);if(remaining<=length&&length>.00001)return {x:a.x+(b.x-a.x)*remaining/length,y:a.y+(b.y-a.y)*remaining/length,yaw:Math.atan2(b.x-a.x,b.y-a.y)};remaining-=length;}const end=route.at(-1),previous=[...route].reverse().find(p=>distance(p,end)>.001);return {...end,yaw:previous?Math.atan2(end.x-previous.x,end.y-previous.y):0};}
function farewellStations(layout,f,first){
 const key=`${first}:${f.actors.length}`;if(layout.crowds.has(key))return layout.crowds.get(key);
 const base=layout.laid[first]||f.boundary,inward=f.boundary.x<f.gather.x?1:-1,occupied=layout.laid.slice(0,Math.min(f.deceased.length,first+4));
 // Reuse the clearance-tested dry grid, rather than projecting a rectangular
 // crowd into whatever houses happen to occupy the edge of the settlement.
 const stations=layout.points.filter(p=>(p.x-base.x)*inward>=.30&&occupied.every(b=>Math.hypot(p.x-b.x,p.y-b.y)>=.45)).sort((a,b)=>Math.hypot(a.x-base.x,a.y-base.y)-Math.hypot(b.x-base.x,b.y-base.y)||a.y-b.y||a.x-b.x).slice(0,f.actors.length);
 layout.crowds.set(key,stations);return stations;
}
export function desertFuneralView(s){
 const f=s.funeral;if(!f)return null;if(f.ritualVersion!==2)return legacyDesertFuneralView(s);
 const layout=ritualLayout(s,f),adults=transporters(s,f),size=capacity(s,f),first=f.batch*size,last=Math.min(f.deceased.length,first+size),moving=f.stage==='procession',farewell=f.stage==='farewell';
 const dx=f.boundary.x-f.gather.x,dy=f.boundary.y-f.gather.y;let yaw=Math.atan2(dx,dy);
 if(moving){const target=f.procession[f.bierRouteIndex];if(target&&distance(target,f.coffin)>.001)yaw=Math.atan2(target.x-f.coffin.x,target.y-f.coffin.y);}else if(farewell){const end=f.procession.at(-1),previous=[...f.procession].reverse().find(p=>distance(p,end)>.001);if(previous)yaw=Math.atan2(end.x-previous.x,end.y-previous.y);}
 const forward={x:Math.sin(yaw),y:Math.cos(yaw)},right={x:Math.cos(yaw),y:-Math.sin(yaw)};
 const biers=f.deceased.map((d,i)=>{
  const active=i>=first&&i<last,laid=i<f.laid||active&&farewell;let slot=laid?layout.laid[i]||riteSlot(f.boundary,i):layout.gather[i]||riteSlot(f.gather,i),bierYaw=yaw;
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
 const stations=farewell?farewellStations(layout,f,first):null;let torchCount=0;const assigned=new Map(biers.flatMap(b=>b.carriers.map(c=>[c.id,c]))),participants=f.actors.map((a,i)=>{
  const c=s.citizens.find(c=>c.id===a.id);if(!c)return null;const carrier=assigned.get(a.id);if(carrier)return {...carrier,role:'carrier',walking:moving,bow:farewell?.25:0,torch:false};
  const station=stations?.[i];
  return {id:c.id,x:station?station.x:c.x,y:station?station.y:c.y,yaw,role:'mourner',walking:!farewell&&['gathering','procession','collecting','receding'].includes(f.stage),bow:farewell?.32+.18*Math.sin(clamp(f.timer/5,0,1)*Math.PI):0,torch:c.age>=16&&torchCount++<8};
 }).filter(Boolean);
 const side=dx<0?-1:1,waveSeconds=7/Math.ceil(f.deceased.length/3),waveTime=(f.timer%waveSeconds)/waveSeconds*7,t=clamp(waveTime/4,0,1),jackals=f.stage==='jackals'?biers.filter(b=>b.visible).slice(0,3).map((b,i)=>({id:`funeral-jackal-${i}`,kind:'jackal',x:clamp(b.x+side*(1.4*(1-t)+.22+Math.max(0,waveTime-4)*.06),.1,WIDTH-.6),y:b.y,yaw:Math.atan2(-side,0),faceX:b.x,faceY:b.y,behavior:waveTime<4?'approaching':'pulling',walking:true,pulling:waveTime>=4,bundleId:b.id})):[];
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
