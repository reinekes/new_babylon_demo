import {WIDTH,HEIGHT,isDryPoint,river,onBridge} from './world.js';
import {networkFor,rerouteCitizens} from './workforce.js';
const copy=p=>({x:p.x,y:p.y}),key=p=>`${p.x},${p.y}`,distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const navigation=new WeakMap();
function navigator(s,gather){
 const bridges=s.buildings.filter(b=>b.type==='bridge'),blocked=new Set(s.buildings.filter(b=>!['field','garden','bridge'].includes(b.type)&&distance(b,gather)>.01).map(key)),free=p=>p.x>=-.5&&p.x<=WIDTH-.5&&p.y>=-.5&&p.y<=HEIGHT-.5&&(isDryPoint(s,p.x,p.y)||onBridge(bridges,p.x,p.y))&&!(Math.abs(p.x-Math.round(p.x))<.38&&Math.abs(p.y-Math.round(p.y))<.38&&blocked.has(`${Math.round(p.x)},${Math.round(p.y)}`));
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
export function startDesertFuneral(s,deceased,{family=false}={}){
 if(s.funeral||!deceased?.length)return false;
 const host=['ziggurat','shrine','house'].map(type=>s.buildings.find(b=>b.type===type&&b.construction?.kind!=='new')).find(Boolean),gather=host?{x:host.x,y:host.y}:copy(deceased[0]),nav=navigator(s,gather),edge=boundary(nav,gather);
 const dead=deceased.map((d,i)=>({id:d.id??i,name:String(d.name||`Житель ${1+(d.id??i)}`).slice(0,100),x:d.x,y:d.y}));
 const relatives=new Set(deceased.map(d=>d.id)),eligible=s.citizens.filter(c=>c.age>=16&&c.clothingTarget===undefined&&!c.craftSite&&!c.seedField&&!c.pantryTrip&&!Object.values(c.cargo||{}).some(n=>n>0)&&!Object.values(c.buildCargo||{}).some(n=>n>0)),participants=family?eligible.sort((a,b)=>Number(b.parents?.some(id=>relatives.has(id))||relatives.has(b.partner))-Number(a.parents?.some(id=>relatives.has(id))||relatives.has(a.partner))).slice(0,4):s.citizens;
 const f=s.funeral={...family?{scope:'family'}:{},style:'desert',stage:'gathering',deceased:dead,actors:participants.map(c=>({id:c.id,route:nav.route(c,gather),routeIndex:0,delay:0,departure:null,pending:false})),coffin:copy(gather),gather,boundary:edge,procession:nav.route(gather,edge),bierRouteIndex:0,timer:0};
 if(!f.procession.length)f.procession=[copy(gather)];navigation.set(f,nav);return true;
}
export function advanceDesertFuneral(s,dt){const f=s.funeral;if(!f)return false;if(!Number.isFinite(dt)||dt<=0)return true;f.timer+=dt;
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
export function desertFuneralView(s){const f=s.funeral;if(!f)return null;const side=f.boundary.x<WIDTH/2?-1:1,t=Math.min(1,f.timer/2);return {stage:f.stage,torches:true,gather:f.gather,coffin:f.stage==='returning'?null:{kind:'bier',...f.coffin,count:f.deceased.length},mourners:f.actors.filter(a=>{const c=s.citizens.find(c=>c.id===a.id);return c&&(f.stage!=='gathering'||distance(c,f.gather)>.05);}).map(a=>a.id),jackals:f.stage==='jackals'?[0,1,2].map(i=>({id:`funeral-jackal-${i}`,kind:'jackal',x:f.timer<2?f.boundary.x+side*(3*(1-t)+.4*i):f.coffin.x+side*.3*i,y:f.boundary.y+(i-1)*.18})):[]};}
export function validateDesertFuneral(s){
 const f=s.funeral,exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).filter(k=>o!==f||k!=='scope').length===keys.length&&keys.every(k=>k in o),point=p=>exact(p,['x','y'])&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-.5&&p.x<=WIDTH-.5&&p.y>=-.5&&p.y<=HEIGHT-.5;
 if(!exact(f,['style','stage','deceased','actors','coffin','gather','boundary','procession','bierRouteIndex','timer'])||f.style!=='desert'||!['gathering','procession','jackals','returning'].includes(f.stage)||!point(f.gather)||!point(f.boundary)||!Array.isArray(f.deceased)||!f.deceased.length||f.deceased.length>1000||new Set(f.deceased.map(d=>d.id)).size!==f.deceased.length||f.deceased.some(d=>!exact(d,['id','name','x','y'])||!Number.isSafeInteger(d.id)||d.id<0||typeof d.name!=='string'||!d.name||d.name.length>100||!point({x:d.x,y:d.y}))||!Number.isFinite(f.timer)||f.timer<0||f.timer>1e6||!exact(f.coffin,['x','y'])||!Number.isFinite(f.coffin.x)||!Number.isFinite(f.coffin.y)||f.coffin.x< -3.5||f.coffin.x>WIDTH+2.5||f.coffin.y<-.5||f.coffin.y>HEIGHT-.5||!Array.isArray(f.actors)||(f.scope==='family'?f.actors.length>4:f.actors.length!==s.citizens.length)||f.scope!==undefined&&f.scope!=='family')return false;
 const nav=navigator(s,f.gather),route=r=>Array.isArray(r)&&r.length<=WIDTH*HEIGHT*4&&r.every((p,i)=>point(p)&&nav.free(p)&&(!i||nav.clear(r[i-1],p))),index=(v,r)=>Number.isSafeInteger(v)&&v>=0&&v<=r.length;
 if(!route(f.procession)||!f.procession.length||distance(f.procession[0],f.gather)>.001||distance(f.procession.at(-1),f.boundary)>.001||!index(f.bierRouteIndex,f.procession))return false;
 const ids=new Set();for(const a of f.actors){if(!exact(a,['id','route','routeIndex','delay','departure','pending'])||ids.has(a.id)||!s.citizens.some(c=>c.id===a.id)||!route(a.route)||!index(a.routeIndex,a.route)||a.delay!==0||typeof a.pending!=='boolean'||a.departure!==null&&!route(a.departure))return false;ids.add(a.id);}navigation.set(f,nav);return true;
}
