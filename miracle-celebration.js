import {networkFor} from './workforce.js';
import {navigationSegmentClear,nearestWalkingNode,shortestWalkingPath} from './navigation.js';
import {isDryPoint,onBridge,WIDTH,HEIGHT} from './world.js';
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
export function miracleCelebrationTargetReason(s,center){if(center&&(!Number.isFinite(center.x)||!Number.isFinite(center.y)||center.x<0||center.y<0||center.x>=WIDTH||center.y>=HEIGHT||!isDryPoint(s,center.x,center.y)))return 'Выбери сухое место для чуда';return networkFor(s).ports.length?'':'Для церемонии нужен доступный вход в город';}
export function startMiracleCelebration(s,kind,{center,catId,catDestination}={}){
 if(!['cat','fertility'].includes(kind)||miracleCelebrationReason(s)||miracleCelebrationTargetReason(s,center))return false;
 const net=networkFor(s),port=net.ports.find(p=>['ziggurat','temple','shrine'].includes(p.building.type)&&isOperational(p.building))||net.ports[0];if(!port)return false;
 center=center&&Number.isFinite(center.x)&&Number.isFinite(center.y)?point(center):point(port);
 const free=p=>isDryPoint(s,p.x,p.y)&&navigationSegmentClear(s,p,p,net.navigation?.obstacles);
 const places=[];for(let ring=1;ring<=15&&places.length<s.citizens.length;ring++){const r=.4+ring*.22,count=Math.ceil(r*2*Math.PI/.22);for(let i=0;i<count;i++){const a=i*2*Math.PI/count,p={x:center.x+r*Math.cos(a),y:center.y+r*Math.sin(a)};if(free(p)&&places.every(q=>distance(p,q)>=.18))places.push(p);}}
 const participants=s.citizens.map(c=>{const origin=point(c);let path=null;for(let i=0;i<places.length;i++){const candidate=route(s,net,origin,places[i]);if(candidate&&length(candidate)<=24){path=candidate;places.splice(i,1);break;}}return {id:c.id,path:path||[origin],joined:!!path};});
 const q={kind,elapsed:0,duration:60,center,participants,cat:null};
 if(kind==='cat'){
  const cat=s.pests?.cats.find(c=>c.id===catId)||s.pests?.cats.at(-1);if(cat){const start=point(port),near=[...net.nodes.values()].filter(free).sort((a,b)=>distance(a,center)-distance(b,center)).find(p=>{const r=route(s,net,start,p);return r&&length(r)<=12;})||start;const approach=route(s,net,start,near)||[start];const yard=catDestination||net.ports.find(p=>buildingKey(p.building)===cat.site)||near;const exit=route(s,net,near,yard);const strollTarget=[...net.nodes.values()].filter(p=>free(p)&&distance(p,near)>.4&&distance(p,near)<2).sort((a,b)=>distance(a,near)-distance(b,near)).find(p=>{const r=route(s,net,near,p);return r&&length(r)<=6;});const outward=strollTarget&&route(s,net,near,strollTarget);const stroll=outward?[...outward,...outward.slice(0,-1).reverse()]:[point(near)];q.cat={id:`cat:${cat.id}`,path:approach,stroll,exit:exit&&length(exit)<=12?exit:[point(near)]};}
 }
 s.miracleCelebration=q;return true;
}
export function advanceMiracleCelebration(s,dt){if(!s.miracleCelebration||!Number.isFinite(dt)||dt<=0)return;const q=s.miracleCelebration;q.elapsed=Math.min(60,q.elapsed+dt);if(q.elapsed>=60-1e-7)s.miracleCelebration=null;}
export function miracleCelebrationView(s){const q=s.miracleCelebration;if(!q)return null;const t=q.elapsed;const participants=q.participants.map(a=>{const returning=t>=45,walking=a.joined&&(t<15||returning),p=sample(returning?[...a.path].reverse():a.path,returning?(t-45)/15:t/15);return {id:a.id,...p,walking,celebrating:t>=15&&t<45,step:t*7};});let cat;
 if(q.cat){const exiting=t>=45,p=sample(exiting?q.cat.exit:t>=15?q.cat.stroll:q.cat.path,exiting?(t-45)/15:t>=15?(t-15)/30:t/15);cat={id:q.cat.id,kind:'cat',...p,walking:length(exiting?q.cat.exit:t>=15?q.cat.stroll:q.cat.path)>0,step:t*6,behavior:t<15?'arriving':'wandering'};}
 for(const actor of participants)if(actor.celebrating){const focus=cat||q.center;actor.yaw=Math.atan2(focus.x-actor.x,focus.y-actor.y);}return {kind:q.kind,elapsed:t,duration:60,center:q.center,participants,...(cat?{cat}:{})};}
export function validateMiracleCelebration(s){const q=s.miracleCelebration;if(q==null)return true;const finite=n=>typeof n==='number'&&Number.isFinite(n),validPoint=p=>p&&finite(p.x)&&finite(p.y)&&p.x>=0&&p.y>=0&&p.x<WIDTH&&p.y<HEIGHT,path=p=>Array.isArray(p)&&p.length>0&&p.length<10000&&p.every(validPoint);if(s.funeral||s.festival||!['cat','fertility'].includes(q.kind)||q.duration!==60||!finite(q.elapsed)||q.elapsed<0||q.elapsed>=60||!validPoint(q.center)||!Array.isArray(q.participants)||q.participants.length!==s.citizens.length)return false;const net=networkFor(s),safePath=p=>p.every((v,i)=>!i||((isDryPoint(s,v.x,v.y)||onBridge(s.buildings,v.x,v.y))&&navigationSegmentClear(s,p[i-1],v,net.navigation?.obstacles)));const ids=new Set();for(const a of q.participants){if(ids.has(a.id)||!s.citizens.some(c=>c.id===a.id)||typeof a.joined!=='boolean'||!path(a.path)||length(a.path)>24.00001||!safePath(a.path))return false;const citizen=s.citizens.find(c=>c.id===a.id);if(distance(a.path[0],citizen)>1e-7)return false;ids.add(a.id);}return !q.cat||q.kind==='cat'&&s.pests.cats.some(c=>`cat:${c.id}`===q.cat.id)&&path(q.cat.path)&&path(q.cat.stroll)&&path(q.cat.exit)&&safePath(q.cat.path)&&safePath(q.cat.stroll)&&safePath(q.cat.exit)&&length(q.cat.path)<=12.00001&&length(q.cat.exit)<=12.00001&&length(q.cat.stroll)<=12.00001&&distance(q.cat.path.at(-1),q.cat.stroll[0])<1e-7&&distance(q.cat.stroll.at(-1),q.cat.exit[0])<1e-7;}
