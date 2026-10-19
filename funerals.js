import {startDesertFuneral,advanceDesertFuneral,desertFuneralView,validateDesertFuneral} from './desert-funeral.js';
import {registerLoss} from './divinity.js';
import {networkFor,routeBetween,rerouteCitizens} from './workforce.js';
import {WIDTH,HEIGHT} from './world.js';
const copy=p=>({x:p.x,y:p.y,key:p.key});
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
function nearest(net,p){let best=null,d=Infinity;for(const n of net.nodes.values()){const next=distance(n,p);if(next<d){d=next;best=n;}}return best;}
function path(s,a,b){return (a&&b&&routeBetween(s,a.key,b.key)||[]).map(copy);}
export function startFuneral(s,deceased){const started=startDesertFuneral(s,deceased);if(started)registerLoss(s,deceased.length);return started;}
function move(entity,actor,dt,s){
 let remaining=dt*.95;
 const net=networkFor(s);
 while(remaining>1e-8){const target=actor.route[actor.routeIndex];if(!target)return true;const prev=actor.route[actor.routeIndex-1];if(!net.nodes.has(target.key)||prev&&prev.key!==target.key&&!net.graph.get(prev.key)?.has(target.key))return false;const d=distance(entity,target);if(d<=remaining+1e-8){entity.x=target.x;entity.y=target.y;actor.routeIndex++;remaining-=d;}else{entity.x+=(target.x-entity.x)*remaining/d;entity.y+=(target.y-entity.y)*remaining/d;return false;}}
 return actor.routeIndex>=actor.route.length;
}
function returning(s,f){
 f.stage='returning';f.timer=0;const net=networkFor(s);
 for(const a of f.actors){const c=s.citizens.find(c=>c.id===a.id),home=c&&net.ports.find(p=>`${p.building.x},${p.building.y}`===c.home&&!p.building.siteKey);a.route=c&&home?path(s,nearest(net,c),home):[];a.routeIndex=0;a.delay=0;}
}
export function advanceFuneral(s,dt){
 if(s.funeral?.style==='desert')return advanceDesertFuneral(s,dt);
 const f=s.funeral;if(!f)return false;if(!Number.isFinite(dt)||dt<=0)return true;
 f.timer+=dt;
 if(f.stage==='gathering'||f.stage==='returning'){
  let done=true;for(const a of f.actors){const c=s.citizens.find(c=>c.id===a.id);if(c&&!move(c,a,dt,s))done=false;}
  if(done&&f.timer>=1){if(f.stage==='returning'){s.funeral=null;rerouteCitizens(s);}else{f.stage='procession';f.timer=0;f.bierRouteIndex=0;for(const [i,a]of f.actors.entries()){const c=s.citizens.find(c=>c.id===a.id);a.route=c&&distance(c,f.gather)<.01?f.procession.map(copy):[];a.routeIndex=0;a.delay=i*.2;}}}
 }else if(f.stage==='procession'){
  const bier={route:f.procession,routeIndex:f.bierRouteIndex};let done=move(f.coffin,bier,dt,s);f.bierRouteIndex=bier.routeIndex;
  for(const a of f.actors){const c=s.citizens.find(c=>c.id===a.id);if(c&&f.timer>=a.delay&&!move(c,a,Math.min(dt,f.timer-a.delay),s))done=false;else if(c&&f.timer<a.delay)done=false;}
  if(done){f.stage='jackals';f.timer=0;}
 }else if(f.stage==='jackals'){
  // The cloth-covered bier is carried beyond the valley; no graphic remains.
  const side=f.boundary.x<WIDTH/2?-1:1,t=Math.max(0,Math.min(1,(f.timer-2)/4));f.coffin.x=f.boundary.x+side*3*t;f.coffin.y=f.boundary.y;
  if(f.timer>=6)returning(s,f);
 }
 return true;
}
export function funeralView(s){
 if(s.funeral?.style==='desert')return desertFuneralView(s);
 const f=s.funeral;if(!f)return null;const side=f.boundary.x<WIDTH/2?-1:1,t=Math.min(1,f.timer/2);
 return {stage:f.stage,coffin:f.stage==='returning'?null:{kind:'bier',...f.coffin,count:f.deceased.length},mourners:f.actors.map(a=>a.id),jackals:f.stage==='jackals'?[0,1,2].map(i=>({id:`funeral-jackal-${i}`,kind:'jackal',x:f.timer<2?f.boundary.x+side*(3*(1-t)+.4*i):f.coffin.x+side*.3*i,y:f.boundary.y+(i-1)*.18})):[]};
}
export function validateFuneral(s){
 if(s.funeral?.style==='desert')return validateDesertFuneral(s);
 const f=s.funeral;if(f==null)return true;
 const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>k in o),point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-.5&&p.x<=WIDTH-.5&&p.y>=-.5&&p.y<=HEIGHT-.5,keyed=p=>exact(p,['x','y','key'])&&point(p)&&p.key===`${p.x+.5},${p.y+.5}`;
 const route=r=>Array.isArray(r)&&r.length<=WIDTH*HEIGHT*2&&r.every((p,i)=>keyed(p)&&(!i||Math.abs(distance(p,r[i-1])-1)<1e-7));
 if(!exact(f,['stage','deceased','actors','coffin','gather','boundary','procession','bierRouteIndex','timer'])||!['gathering','procession','jackals','returning'].includes(f.stage)||!Array.isArray(f.deceased)||!f.deceased.length||f.deceased.length>1000||f.deceased.some(d=>!exact(d,['id','name','x','y'])||!Number.isSafeInteger(d.id)||d.id<0||typeof d.name!=='string'||!d.name||d.name.length>100||!point(d))||!keyed(f.gather)||!keyed(f.boundary)||!route(f.procession)||!f.procession.length||!Number.isSafeInteger(f.bierRouteIndex)||f.bierRouteIndex<0||f.bierRouteIndex>f.procession.length||!Number.isFinite(f.timer)||f.timer<0||f.timer>1e6||!exact(f.coffin,['x','y'])||!Number.isFinite(f.coffin.x)||!Number.isFinite(f.coffin.y)||f.coffin.x< -3.5||f.coffin.x>WIDTH+2.5||f.coffin.y<-.5||f.coffin.y>HEIGHT-.5||!Array.isArray(f.actors)||f.actors.length!==s.citizens.length)return false;
 const net=networkFor(s),connected=r=>r.every((p,i)=>net.nodes.has(p.key)&&(!i||net.graph.get(r[i-1].key)?.has(p.key)));
 if(new Set(f.deceased.map(d=>d.id)).size!==f.deceased.length||!connected(f.procession)||f.procession[0].key!==f.gather.key||f.procession.at(-1).key!==f.boundary.key||!net.nodes.has(f.gather.key)||!net.nodes.has(f.boundary.key))return false;
 const ids=new Set();for(const a of f.actors){if(!exact(a,['id','route','routeIndex','delay'])||ids.has(a.id)||!s.citizens.some(c=>c.id===a.id)||!route(a.route)||!connected(a.route)||!Number.isSafeInteger(a.routeIndex)||a.routeIndex<0||a.routeIndex>a.route.length||!Number.isFinite(a.delay)||a.delay<0||a.delay>1000)return false;ids.add(a.id);}
 return true;
}
