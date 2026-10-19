import {ROLES,inspirationChance,newMedicalSkill} from './education.js';
import {affectResidents} from './wellbeing.js';
import {canWork} from './demography.js';
import {registerInspiration} from './divinity.js';
import {BUILDINGS,buildingKey,capacityOf,housingOf,storageOf,levelOf,MATERIALS} from './definitions.js';
import {isComplete,constructionEntities} from './construction.js';
import {syncCitizens,invalidateAssignments,rerouteCitizens,networkFor} from './workforce.js';
import {bridgeSpan,onBridge,WIDTH,HEIGHT} from './world.js';
const roles=ROLES;
const hasLoad=c=>c.pantryFood>0||Object.values(c.cargo||{}).some(v=>v>0)||Object.values(c.buildCargo||{}).some(v=>v>0);
const find=(s,x,y)=>constructionEntities(s).find(b=>b.x===x&&b.y===y);
const blocked=s=>s.funeral?'Жители прощаются с умершими':s.lost?'Поселение покинуто':s.event?'Сначала заверши событие':'';
const upgradePrice=(b,level)=>({...level===2?(b.type==='house'?{wood:4,hides:2}:b.type!=='bridge'?{stone:8}:{}):{},clay:Math.ceil(BUILDINGS[b.type].clay*(level===1?1.5:2.5)),reed:Math.max(4,Math.ceil(BUILDINGS[b.type].reed*(level===1?1.5:2.5)))});
function note(s,title,text){s.news.unshift({title,text,kind:'build',tick:s.tick,year:s.year,season:s.season});s.news=s.news.slice(0,80);}
export function cancellationRefund(b){const q=b?.construction;return q?{...q.required,faith:q.kind==='new'?(BUILDINGS[b.type]?.faith||0):0}:{clay:0,reed:0,faith:0};}
export function demolitionRefund(b){
 if(!b||!isComplete(b))return {clay:0,reed:0};
 const total=Object.fromEntries(MATERIALS.map(k=>[k,BUILDINGS[b.type][k]||0]));
 for(let level=1;level<levelOf(b);level++){const cost=upgradePrice(b,level);for(const k of MATERIALS)total[k]+=cost[k]||0;}
 return Object.fromEntries(Object.entries(total).filter(([,n])=>n>0).map(([k,n])=>[k,Math.floor(n/2)]));
}
export function setPriority(s,x,y,priority){
 const b=find(s,x,y),reason=blocked(s);if(reason)return {ok:false,reason};
 if(!b?.construction||![0,1,2].includes(priority))return {ok:false,reason:'Выбери стройку и её приоритет'};
 b.construction.priority=priority;invalidateAssignments(s);syncCitizens(s);return {ok:true};
}
export function setCitizenRole(s,id,role){
 const reason=blocked(s);if(reason)return {ok:false,reason};const c=s.citizens.find(c=>c.id===id);
 if(!c||!roles.includes(role))return {ok:false,reason:'Неизвестный житель или роль'};if(!canWork(c))return {ok:false,reason:'Дети начинают работать с 16 лет'};
 if(hasLoad(c)){if(role===(c.role||'auto'))delete c.pendingRole;else c.pendingRole=role;}
 else{c.role=role;delete c.pendingRole;}
 invalidateAssignments(s);syncCitizens(s);return {ok:true};
}
function rememberApproaches(s,b){
 s.roadAnchors??=[];
 const anchors=b.type==='bridge'?[bridgeSpan(b.y).left,bridgeSpan(b.y).right].map(x=>({type:'road',x:x-.5,y:b.y})):[{type:'road',x:b.x,y:b.y}];
 // Preserve the removed doorstep and the nodes currently occupied by residents.
 const old=networkFor(s);
 for(const c of s.citizens){let nearest=null,d=Infinity;for(const p of old.nodes.values()){const n=Math.abs(p.x-c.x)+Math.abs(p.y-c.y);if(n<d){d=n;nearest=p;}}
  if(nearest){const x=nearest.x-.5,y=nearest.y-.5;if(x>=0&&y>=0&&x<WIDTH&&y<HEIGHT)anchors.push({type:'road',x,y});}
 }
 for(const a of anchors)if(!s.roadAnchors.some(p=>p.x===a.x&&p.y===a.y))s.roadAnchors.push(a);
}
function refundOrder(s,b){
 const refund=cancellationRefund(b),key=buildingKey(b);for(const [k,n]of Object.entries(refund))s.resources[k]+=n;
 for(const c of s.citizens)if(c.site===key)c.buildCargo={};
 delete b.construction;return refund;
}
export function cancelConstruction(s,x,y){
 const b=find(s,x,y),reason=blocked(s);if(reason)return {ok:false,reason};if(!b?.construction)return {ok:false,reason:'Здесь нет незавершённой стройки'};
 const fresh=b.construction.kind==='new';if(fresh)rememberApproaches(s,b);
 const refund=refundOrder(s,b);if(fresh)s.buildings=s.buildings.filter(v=>v!==b);
 s.capacity=housingOf(s);rerouteCitizens(s);note(s,`Отменено: ${(BUILDINGS[b.type]?.name||'Дорога')}`,'Зарезервированная цена полностью возвращена, включая доставленные материалы и груз в пути.');return {ok:true,refund};
}
function ports(s){const net=networkFor(s),map=new Map(net.ports.filter(p=>!p.building.siteKey).map(p=>[buildingKey(p.building),p]));for(const p of net.ports.filter(p=>p.building.siteKey))map.set(`site:${p.building.siteKey}:${p.building.side}`,p);return {net,map};}
function relocations(s,b){
 if(b.type!=='house')return new Map();
 const {net,map}=ports(s),source=map.get(buildingKey(b)),residents=s.citizens.filter(c=>c.home===buildingKey(b));
 const beds=s.buildings.filter(h=>h!==b&&h.type==='house'&&isComplete(h)).map(h=>({key:buildingKey(h),free:capacityOf(h)-s.citizens.filter(c=>c.home===buildingKey(h)).length}));
 const result=new Map();
 for(const c of residents){const target=beds.find(h=>h.free>0&&source&&map.get(h.key)&&net.components.get(source.key)===net.components.get(map.get(h.key).key));if(!target)return null;target.free--;result.set(c.id,target.key);}
 return result;
}
export function canDemolish(s,b){
 const reason=blocked(s);if(reason)return reason;if(!b||!s.buildings.includes(b))return 'Выбери здание';if(b.type==='market'&&(((s.trade?.deliveries||[]).some(q=>q.market===buildingKey(b)&&q.delivered<q.amount)||(s.trade?.sales||[]).some(q=>q.market===buildingKey(b)&&q.loaded+q.cancelled<q.amount))||s.trade?.caravan?.market===buildingKey(b)))return 'Рынок занят караваном или оплаченными покупками';if(!isComplete(b))return 'Незавершённую стройку можно отменить с полным возвратом';
 if(b.type==='healer'&&s.citizens.some(c=>c.clinic===buildingKey(b)))return 'Дождись возвращения пациентов домой';
 const future={...s,buildings:s.buildings.filter(v=>v!==b)};
 if(housingOf(future)<s.population||!relocations(s,b))return 'Нет доступного жилья для переселения жителей';
 if(['shrine','granary'].includes(b.type)&&s.buildings.filter(v=>isComplete(v)&&['shrine','granary'].includes(v.type)).length<=1)return 'Нельзя снести последнее готовое хранилище';
 if(storageOf(future)<storageOf(s)&&MATERIALS.some(k=>storageOf(future)<(s.resources[k]||0)))return 'Сначала освободи еду: оставшихся амбаров недостаточно';
 if(['bridge','shrine','granary'].includes(b.type)){
  const {net,map}=ports(future);
  for(const q of [...s.trade?.deliveries||[],...s.trade?.sales||[]]){if((q.delivered??((q.loaded||0)+(q.cancelled||0)))>=q.amount)continue;const market=map.get(q.market),component=market&&net.components.get(market.key);if(!market||!future.buildings.some(store=>['shrine','granary'].includes(store.type)&&isComplete(store)&&map.get(buildingKey(store))&&net.components.get(map.get(buildingKey(store)).key)===component))return 'На рынке ждут оплаченные покупки: нужен доступный склад';}
  for(const c of s.citizens.filter(hasLoad)){
   let nearest=null,min=Infinity;for(const p of net.nodes.values()){const d=Math.abs(c.x-p.x)+Math.abs(c.y-p.y);if(d<min){min=d;nearest=p;}}
   const component=nearest&&net.components.get(nearest.key);
   const stores=future.buildings.filter(v=>isComplete(v)&&['shrine','granary'].includes(v.type));
   if(!stores.some(v=>map.get(buildingKey(v))&&net.components.get(map.get(buildingKey(v)).key)===component))return 'Есть грузы в пути: нужен другой доступный склад на этом берегу';
   if(c.tradeJob||c.saleJob){const market=map.get(c.tradeMarket||c.saleMarket);if(!market||net.components.get(market.key)!==component)return 'Дождись доставки покупок: снос перекроет путь к рынку';}
   if(Object.values(c.buildCargo||{}).some(n=>n>0)&&c.site!==buildingKey(b)){
    const target=map.get(c.sitePort);if(!target||net.components.get(target.key)!==component)return 'Сначала дождись доставки материалов: снос перекроет их путь к стройке';
   }
  }
 }
 if(b.type==='bridge'){
  const caravan=s.trade?.caravan;if(caravan&&caravan.x!==null){if(onBridge([b],caravan.x,caravan.y))return 'Дождись, пока караван сойдёт с моста';const net=networkFor(future),near=[...net.nodes.values()].sort((a,b)=>Math.abs(a.x-caravan.x)+Math.abs(a.y-caravan.y)-Math.abs(b.x-caravan.x)-Math.abs(b.y-caravan.y))[0],market=net.ports.find(p=>buildingKey(p.building)===caravan.market);if(near&&(!net.nodes.has(caravan.entry)||net.components.get(near.key)!==net.components.get(caravan.entry)||market&&net.components.get(near.key)!==net.components.get(market.key)))return 'Снос перекроет путь каравана';}
  if(s.citizens.some(c=>onBridge([b],c.x,c.y)))return 'Дождись, пока все жители сойдут с моста';
  const {net,map}=ports(future);
  for(const c of s.citizens){let nearest=null,min=Infinity;for(const p of net.nodes.values()){const d=Math.abs(c.x-p.x)+Math.abs(c.y-p.y);if(d<min){min=d;nearest=p;}}
   const home=map.get(c.home);if(!nearest||!home||net.components.get(nearest.key)!==net.components.get(home.key))return 'Снос отрежет жителей от их домов';
  }
 }
 return '';
}
export function demolish(s,x,y){
 const b=find(s,x,y),reason=canDemolish(s,b);if(reason)return {ok:false,reason};
 const homes=relocations(s,b),refund=demolitionRefund(b);rememberApproaches(s,b);if(b.pantry)s.resources.food+=b.pantry;
 if(b.construction){const cancelled=refundOrder(s,b);for(const [k,n]of Object.entries(cancelled))refund[k]=(refund[k]||0)+n;}
 for(const [k,n]of Object.entries(demolitionRefund(b)))s.resources[k]+=n;
 for(const c of s.citizens){if(homes.has(c.id))c.home=homes.get(c.id);if(c.work===buildingKey(b))c.work=null;if(c.store===buildingKey(b))c.store=null;}
 s.buildings=s.buildings.filter(v=>v!==b);s.capacity=housingOf(s);rerouteCitizens(s);
 note(s,`Снесено: ${(BUILDINGS[b.type]?.name||'Дорога')}`,'Половина вложенной глины и тростника возвращена. Жители получили новые маршруты.');return {ok:true,refund};
}

export function inspirationReason(s,id,role){const reason=blocked(s);if(reason)return reason;const c=s.citizens.find(c=>c.id===id);if(!c||!roles.includes(role))return 'Неизвестный житель или роль';if(role==='auto'&&(c.role||'auto')==='auto'||c.pendingRole===role)return 'Эта профессия уже выбрана';if(c.calling===role&&((c.role||'auto')===role||c.pendingRole===role||c.futureRole===role))return 'Это призвание уже открыто';if(s.resources.faith<1)return 'Нужна 1 вера';return '';}
export function inspireCitizen(s,id,role){const reason=inspirationReason(s,id,role);if(reason)return {ok:false,reason,message:reason};s.resources.faith-=1;s.rngState=((s.rngState??117)*1664525+1013904223)>>>0;const subject=s.citizens.find(c=>c.id===id),success=s.rngState/4294967296<inspirationChance(subject,role);registerInspiration(s,success);affectResidents(s,{faith:success?6:-5,mood:success?4:-3},[id]);const c=s.citizens.find(c=>c.id===id);if(success){if(role==='healer')c.medicine??=newMedicalSkill(s.year);c.calling=role;if(canWork(c))setCitizenRole(s,id,role);else c.futureRole=role;}const message=`Житель ${id+1}: ${success?'вдохновение принято':'вдохновение не принято'}`;note(s,'Вдохновение',message);return {ok:true,success,message};}
