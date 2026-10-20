import {storeStock,takeStock} from './inventory.js';
import {buildingKey,isOperational} from './definitions.js';
import {WIDTH,HEIGHT,isDryPoint,terrain} from './world.js';
import {safeLoop,loopMotion} from './local-motion.js';
import {generateStreets} from './city-life.js';
const layouts=new WeakMap(),roaming=new WeakMap();
export const isPestStore=b=>['shrine','granary','depot'].includes(b?.type)&&isOperational(b);
export function initializePests(s){s.pests??={cats:[],sites:[],nextCat:0,totalLoss:0};}
function yards(s){
 const signature=s.pests?.cats.map(c=>c.site).join(';')+';'+s.buildings.map(b=>`${b.type}:${b.x},${b.y}:${isOperational(b)}`).join('|'),old=layouts.get(s);if(old?.signature===signature)return old.map;
 const map=new Map(),occupied=new Set(s.buildings.map(buildingKey));
 const stores=s.buildings.filter(isPestStore),ghosts=(s.pests?.cats||[]).filter(c=>!stores.some(b=>buildingKey(b)===c.site)).map(c=>{const [x,y]=c.site.split(',').map(Number);return {x,y};});
 for(const b of [...stores,...ghosts]){const choices=[];for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const x=b.x+dx,y=b.y+dy;if(!occupied.has(`${x},${y}`)&&isDryPoint(s,x,y)&&terrain(x,y,s)!=='water')choices.push({x,y,d:Math.abs(dx)+Math.abs(dy)});}choices.sort((a,b)=>a.d-b.d||(b.x+b.y)-(a.x+a.y)||a.y-b.y||a.x-b.x);if(choices[0])map.set(buildingKey(b),safeLoop(s,choices[0],.32,true));}
 layouts.set(s,{signature,map});return map;
}
// Read-only visual routes use the existing street graph; no cat changes a resident's work.
function roamingRoutes(s){
 const signature=JSON.stringify([s.buildings.map(b=>[b.type,b.x,b.y,b.construction?.kind]),s.pests?.cats,s.world?.lakes]);
 const old=roaming.get(s);if(old?.signature===signature)return old.routes;
 const routes=new Map(),network=generateStreets(s.buildings,s),local=yards(s);
 const free=p=>isDryPoint(s,p.x,p.y)&&!s.buildings.some(b=>!['field','garden','bridge'].includes(b.type)&&Math.abs(b.x-p.x)<.48&&Math.abs(b.y-p.y)<.48);
 const clear=(a,b)=>{for(let i=0;i<=16;i++)if(!free({x:a.x+(b.x-a.x)*i/16,y:a.y+(b.y-a.y)*i/16}))return false;return true;};
 for(const cat of s.pests?.cats||[]){
  if(routes.has(cat.site))continue;const yard=local.get(cat.site);if(!yard)continue;const start=yard[0];
  const nodes=[...network.nodes.values()].filter(p=>Math.hypot(p.x-start.x,p.y-start.y)<2&&clear(start,p)).sort((a,b)=>Math.hypot(a.x-start.x,a.y-start.y)-Math.hypot(b.x-start.x,b.y-start.y));
  if(!nodes.length){routes.set(cat.site,safeLoop(s,start,1.1,true));continue;}
  const entry=nodes[0],queue=[entry.key],prev=new Map([[entry.key,null]]),depth=new Map([[entry.key,0]]);let target=entry.key;
  for(let i=0;i<queue.length;i++){const key=queue[i];if(depth.get(key)>depth.get(target))target=key;if(depth.get(key)>=4)continue;
   for(const next of network.graph.get(key)||[])if(!prev.has(next)&&clear(network.nodes.get(key),network.nodes.get(next))){prev.set(next,key);depth.set(next,depth.get(key)+1);queue.push(next);}
  }
  const path=[];for(let key=target;key!==null;key=prev.get(key))path.push(network.nodes.get(key));path.reverse();
  const outbound=[start,...path];routes.set(cat.site,[...outbound,...outbound.slice(0,-1).reverse()]);
 }
 roaming.set(s,{signature,routes});return routes;
}
export function syncPestSites(s){
 initializePests(s);const keys=new Set(s.buildings.filter(isPestStore).map(buildingKey));
 s.pests.sites=s.pests.sites.filter(q=>keys.has(q.key));
 for(const key of keys)if(!s.pests.sites.some(q=>q.key===key))s.pests.sites.push({key,mice:(s.inventory?s.buildings.find(b=>buildingKey(b)===key)?.stock?.food:s.resources.food)>0?1:0,clock:0,spawn:0,hunt:0,guardTime:0,loss:0,caught:0,scared:0,reported:0,flash:null});
 // Cats keep their old yard when its store is removed; a later miracle can call a cat to a new store.
}
export function catReason(s){initializePests(s);const routes=yards(s);return s.buildings.some(b=>isPestStore(b)&&routes.has(buildingKey(b))&&!s.pests.cats.some(c=>c.site===buildingKey(b)))?'':'Все доступные хранилища уже под защитой кошек';}
export function bringCat(s){syncPestSites(s);const routes=yards(s),site=s.pests.sites.filter(q=>routes.has(q.key)&&!s.pests.cats.some(c=>c.site===q.key)).sort((a,b)=>b.mice-a.mice)[0];if(!site)return false;s.pests.cats.push({id:s.pests.nextCat++,site:site.key});return true;}
const note=(s,title,text,kind)=>{s.news.unshift({title,text,kind,year:s.year,season:s.season,tick:s.tick});s.news=s.news.slice(0,80);};
export function advancePests(s,dt){
 syncPestSites(s);const routes=yards(s),activeGuards=new Set(s.citizens.filter(c=>c.guardPost&&c.work===c.guardPost&&c.phase==='working'&&!s.funeral?.actors.some(a=>a.id===c.id)).map(c=>c.guardPost));
 const exposed=s.pests.sites.filter(q=>routes.has(q.key)),cap=exposed.length?1/exposed.length:0;
 for(const q of exposed){q.clock+=dt;const guarded=activeGuards.has(q.key),cat=s.pests.cats.some(c=>c.site===q.key);
  q.spawn+=dt;if(q.spawn>=45){q.spawn%=45;if(storeStock(s,q.key,'food')>0)q.mice=Math.min(3,q.mice+1);}
  if(q.mice>0){const amount=takeStock(s,q.key,'food',.012*q.mice*dt*cap*(guarded?.15:1));q.loss+=amount;s.pests.totalLoss+=amount;}
  const resting=q.flash&&q.clock-q.flash.time<2;
  if(q.mice>0&&!resting){q.hunt=cat?q.hunt+dt:0;q.guardTime=guarded?q.guardTime+dt:0;
   if(q.hunt>=10||q.guardTime>=8){const by=cat&&q.hunt>=10?'cat':'guard';const phase=q.clock+(q.mice-1)*2.2;q.mice--;q[by==='cat'?'caught':'scared']++;q.flash={time:q.clock,phase,by};q.hunt=0;q.guardTime=0;if(q.caught+q.scared===1)note(s,by==='cat'?'Кошка поймала мышь':'Сторож прогнал мышь',`У хранилища ${q.key} запасы стали безопаснее.`, 'good');}
  }else if(!q.mice){q.hunt=0;q.guardTime=0;}
  if(q.loss-q.reported>=1){q.reported=q.loss;note(s,'Мыши портят запасы',`У хранилища ${q.key} потеряно ${q.loss.toFixed(1)} еды за всё время. Назначь сторожа: жители пока защищают запасы своими силами.`, 'bad');}
 }
 if(s.pests.nextCat===0&&s.pests.totalLoss>=3&&bringCat(s))note(s,'Неожиданный гость','После долгой борьбы с мышами бог послал к амбарам маленького охотника. Люди впервые увидели, как кошка ловит мышь.','good');
}
export function pestActors(s){
 if(!s.pests)return [];const routes=yards(s),wander=roamingRoutes(s),result=[];
 for(const q of s.pests.sites){const route=routes.get(q.key);if(!route)continue;const flash=q.flash&&q.clock-q.flash.time<2;
  for(let i=0;i<q.mice;i++)result.push({id:`mouse:${q.key}:${i}`,kind:'mouse',...loopMotion(route,q.clock+i*2.2,.42,0),step:q.clock*8,behavior:'foraging'});
  for(const cat of s.pests.cats.filter(c=>c.site===q.key)){const hunting=q.mice>0&&!flash,motion=hunting?loopMotion(route,q.clock+(q.mice-1)*2.2-Math.max(0,2*(1-q.hunt/10)),.42,0):flash?loopMotion(route,q.flash.phase,.42,0):loopMotion(wander.get(cat.site)||route,(s.simTime||0)+cat.id*3.7,.18,1.2);result.push({id:`cat:${cat.id}`,kind:'cat',...motion,walking:hunting||!flash&&motion.walking,step:q.clock*9,behavior:hunting?'hunting':flash?'resting':motion.walking?'wandering':'looking'});}
  if(flash)result.push({id:`catch:${q.key}`,kind:'pestCatch',...loopMotion(route,q.flash.phase,.42,0),progress:(q.clock-q.flash.time)/2,by:q.flash.by});
 }
 for(const cat of s.pests.cats)if(!s.pests.sites.some(q=>q.key===cat.site)&&routes.has(cat.site))result.push({id:`cat:${cat.id}`,kind:'cat',...loopMotion(wander.get(cat.site)||routes.get(cat.site),s.simTime||0,.18,1.2),step:(s.simTime||0)*5,behavior:'wandering'});
 return result;
}
/** Brief deterministic visual affection; no resident movement, cargo, jobs or protection change. */
export function catPettingPairs(s,citizens=s.citizens||[]){
 const time=s.simTime||0,result=[],used=new Set();
 for(const cat of pestActors(s)){
  if(cat.kind!=='cat'||cat.behavior==='hunting'||cat.behavior==='resting')continue;
  const catNumber=Number(String(cat.id).split(':')[1])||0;if((time+catNumber*3.7)%14>3)continue;
  const eligible=citizens.filter(c=>!used.has(c.id)&&!c.walking&&!c.carrying&&!Object.values(c.cargo||{}).some(n=>n>0)&&!Object.values(c.buildCargo||{}).some(n=>n>0)&&!s.funeral?.actors?.some(a=>a.id===c.id)&&((c.age>=3&&c.age<16&&['home','playing'].includes(c.phase))||(c.guardPost&&c.work===c.guardPost&&c.phase==='working'))&&Math.hypot(c.x-cat.x,c.y-cat.y)<.35).sort((a,b)=>Math.hypot(a.x-cat.x,a.y-cat.y)-Math.hypot(b.x-cat.x,b.y-cat.y)||a.id-b.id);
  if(eligible[0]){used.add(eligible[0].id);result.push({catId:cat.id,citizenId:eligible[0].id,x:cat.x,y:cat.y});}
 }
 return result;
}
export function pestReport(s,key){const q=s.pests?.sites.find(q=>q.key===key);if(!q)return 'Мыши пока не замечены';const cat=s.pests.cats.some(c=>c.site===key),guard=s.citizens.find(c=>c.guardPost===key),onDuty=guard?.work===key&&guard?.phase==='working'&&!s.funeral?.actors.some(a=>a.id===guard.id);return `Мыши: ${q.mice} · ${cat?(q.mice?'Кошка охотится':'Кошка отдыхает · защита есть'):onDuty?'Сторож на посту':guard?'Сторож назначен · сейчас отсутствует':'Нет защиты'} · потеряно ${q.loss.toFixed(1)} еды · поймано ${q.caught} · прогнано ${q.scared}`;}
export function validatePests(s){
 const p=s.pests,finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1e9,int=(n,max=1e6)=>Number.isInteger(n)&&n>=0&&n<=max;
 if(!p||!Array.isArray(p.cats)||!Array.isArray(p.sites)||p.cats.length>1280||p.sites.length>1280||!int(p.nextCat)||!finite(p.totalLoss))return false;
 const ids=new Set(),keys=new Set(),catSites=new Set(),validKey=key=>typeof key==='string'&&/^[0-9]+,[0-9]+$/.test(key)&&Number(key.split(',')[0])<WIDTH&&Number(key.split(',')[1])<HEIGHT;for(const c of p.cats){if(!int(c.id)||c.id>=p.nextCat||ids.has(c.id)||!validKey(c.site)||catSites.has(c.site))return false;ids.add(c.id);catSites.add(c.site);}
 for(const q of p.sites){if(typeof q.key!=='string'||keys.has(q.key)||!s.buildings.some(b=>buildingKey(b)===q.key&&isPestStore(b))||!int(q.mice,3)||!['clock','spawn','hunt','guardTime','loss','reported'].every(k=>finite(q[k]))||q.spawn>=45||q.hunt>10.1||q.guardTime>8.1||q.reported>q.loss||!int(q.caught)||!int(q.scared)||q.flash!==null&&(!q.flash||!finite(q.flash.time)||!finite(q.flash.phase)||q.flash.phase>q.flash.time+4.400001||q.flash.phase<q.flash.time||q.flash.time>q.clock||!['cat','guard'].includes(q.flash.by)))return false;keys.add(q.key);}
 return p.sites.reduce((n,q)=>n+q.loss,0)<=p.totalLoss+1e-6;
}
