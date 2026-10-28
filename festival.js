import {relicCommandReason} from './city-command-lock.js';
// A festival is an order with local reservations and citizen-owned trips, never a flat exchange.
import {buildingKey,isOperational} from './definitions.js';
import {refundSources,takeReserved,stockStores,syncInventory,foodAvailability,takeStock,putRecoveryStock} from './inventory.js';
import {seedTarget,foodForecast} from './food-planning.js';
import {mealRation,hourOf,affectResidents} from './wellbeing.js';
import {canWork} from './demography.js';
import {networkFor,routeBetween,invalidateAssignments} from './workforce.js';
import {navigationGridStep} from './navigation.js';
import {roadSpeed} from './roads.js';
import {festivalCourtLayout,festivalTorchContact} from './festival-layout.js';
export const FESTIVAL_COST=Object.freeze({food:12,beer:6,prestige:15});
export const festivalInvitation=()=>`Закажи общинный праздник: ${FESTIVAL_COST.prestige} престижа, ${FESTIVAL_COST.food} еды и ${FESTIVAL_COST.beer} пива. Жители доставят угощение к храму и соберутся после вечернего ужина.`;
export const FESTIVAL_SECONDS=90;
export const FIRST_BEER_COST=Object.freeze({food:0,beer:1,prestige:0});
const occasion=q=>q?.occasion||'nightLights',firstBeer=q=>occasion(q)==='firstBeer',costFor=q=>firstBeer(q)?FIRST_BEER_COST:FESTIVAL_COST;
const completedBrewery=b=>b?.type==='brewery'&&isOperational(b);
const readyBrewery=b=>completedBrewery(b)&&!b.construction;
const readyVenue=(b,q)=>firstBeer(q)?readyBrewery(b):readyTemple(b);
const keys=['food','beer'],sum=o=>Object.values(o||{}).reduce((n,v)=>n+v,0),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const readyTemple=b=>['shrine','ziggurat'].includes(b.type)&&isOperational(b)&&!b.construction;
export function initializeFestival(s,{legacy=false}={}){
 if(s.festival===undefined)s.festival=null;
 // A pre-feature brewery has no complete lifetime history. Suppress an
 // ambiguous replay rather than infer an achievement from purchased stock.
 if(s.firstBeerFeast===undefined)s.firstBeerFeast={version:1,status:legacy&&(s.buildings||[]).some(completedBrewery)?'legacy':'unbrewed',brewery:null,producedAt:null};
}
export function noteFirstBeer(s,b){
 initializeFestival(s);const q=s.firstBeerFeast;if(q.status!=='unbrewed'||!completedBrewery(b))return false;
 Object.assign(q,{status:'pending',brewery:buildingKey(b),producedAt:s.simTime});
 s.news??=[];s.news.unshift({title:'Первая партия пива выпущена',text:`Пивоварня (${b.x+1}, ${b.y+1}) впервые сварила пиво. Одну настоящую кружку принесут на небольшой пир у пивоварни: взрослые соберутся, когда освободятся. Если сейчас идёт другое событие, праздник дождётся его окончания.`,kind:'good',year:s.year,season:s.season,tick:s.tick});s.news=s.news.slice(0,80);return true;
}
function beginFirstBeer(s){
 const pending=s.firstBeerFeast;
 if(pending?.status!=='pending'||s.festival||s.funeral||s.lost||s.event||relicCommandReason(s))return false;
 const breweries=s.buildings.filter(readyBrewery).sort((a,b)=>(buildingKey(a)===pending.brewery?-1:buildingKey(b)===pending.brewery?1:0));
 for(const b of breweries){
  const venue=buildingKey(b),destination=port(s,venue);if(!destination||!s.citizens.some(c=>eligibleFor(c,{occasion:'firstBeer',temple:venue})&&canCarry(c,{occasion:'firstBeer',temple:venue})&&['home','working','resting'].includes(c.phase)&&route(s,c,venue)))continue;
  let source=null,local=false;
  if((b.workshopStock?.output?.beer||0)>=1){source=venue;local=true;}
  else for(const store of stockStores(s)){const key=buildingKey(store),origin=port(s,key);if((store.stock?.beer||0)>=1&&origin&&routeBetween(s,origin.key,destination.key)){source=key;break;}}
  if(!source)continue;
  const sources={[source]:{beer:1}};
  s.festival={occasion:'firstBeer',temple:venue,stage:'supplying',sources,allocations:structuredClone(sources),delivered:{food:0,beer:0},actors:[],rewarded:[],consumed:false,started:null,elapsed:0,ordered:s.simTime,...local?{sourceKinds:{[source]:'output'}}:{}};
  if(local)b.workshopStock.output.beer-=1;else takeStock(s,source,'beer',1);
  invalidateAssignments(s);return true;
 }
 return false;
}
function refundFestival(s,q){
 const regular={};
 for(const [key,materials]of Object.entries(q.allocations)){
  if(q.sourceKinds?.[key]!=='output'){regular[key]=materials;continue;}
  const b=s.buildings.find(b=>buildingKey(b)===key&&readyBrewery(b)),amount=materials.beer||0;
  if(b&&amount>0){const output=b.workshopStock.output,room=Math.max(0,24*(b.level||1)-(output.beer||0)),accepted=Math.min(room,amount);output.beer=(output.beer||0)+accepted;if(accepted<amount)putRecoveryStock(s,key,'beer',amount-accepted);}
  else if(amount>0)refundSources(s,{[key]:{beer:amount}});
 }
 refundSources(s,regular);
}

function port(s,key){return networkFor(s).ports.find(p=>!p.building.siteKey&&buildingKey(p.building)===key);}
const guestLimit=(s,q)=>Math.min(firstBeer(q)?8:24,festivalCourtLayout(s,networkFor(s),q.temple)?.places.length||0);
function route(s,c,key){const net=networkFor(s),target=port(s,key);if(!target)return null;let near=null,d=Infinity;for(const n of net.nodes.values()){const v=distance(c,n);if(v<d){near=n;d=v;}}return near&&routeBetween(s,near.key,target.key)?.map(p=>({x:p.x,y:p.y,key:p.key}));}
const busy=c=>!!c.waterTrip||c.clothingTarget!==undefined||!!c.craftSite||!!c.seedField||!!c.pantryTrip||!!c.clinic||!!c.school||!!c.districtJob||!!c.saleJob||!!c.tradeJob||sum(c.cargo)>0||sum(c.buildCargo)>0;
const freeAdult=c=>canWork(c)&&c.age>=16&&(c.health??100)>=60&&!c.recovering&&!c.site&&!busy(c)&&!c.pendingRole&&!c.guardPost;
const eligible=c=>freeAdult(c)&&!c.workplace;
const eligibleFor=(c,q)=>eligible(c)||firstBeer(q)&&freeAdult(c)&&c.workplace===q.temple;
// A permanent daytime job is not a reason to miss the feast after work.
const eligibleGuest=(c,q)=>firstBeer(q)?eligibleFor(c,q):freeAdult(c);
const canCarry=(c,q)=>['auto','carrier'].includes(c.role||'auto')||firstBeer(q)&&c.workplace===q.temple;
function templeFor(s){return s.buildings.find(b=>readyTemple(b)&&s.citizens.some(c=>eligible(c)&&['auto','carrier'].includes(c.role||'auto')&&route(s,c,buildingKey(b))));}
function festivalSources(s,temple){
 const food=foodAvailability(s),destination=port(s,temple),sources={};
 for(const material of keys){let remaining=FESTIVAL_COST[material];for(const b of stockStores(s)){const key=buildingKey(b),origin=port(s,key);if(!origin||!destination||!routeBetween(s,origin.key,destination.key))continue;const n=Math.min(remaining,material==='food'?food.get(key)||0:b.stock?.[material]||0);if(n>0){(sources[key]??={})[material]=n;remaining-=n;}if(remaining<=1e-7)break;}if(remaining>1e-7)return null;}
 return sources;
}
export function festivalReason(s,{ignoreEvent=false}={}){
 const lock=relicCommandReason(s);if(lock)return lock;if(s.festival)return 'Праздник уже заказан';if(s.funeral)return 'Сначала проводи умерших';if(s.event&&!ignoreEvent||s.lost)return 'Сначала заверши событие';
 if(!s.buildings.some(readyTemple))return 'Нужен готовый храм или зиккурат';if(!templeFor(s))return 'Нужен свободный взрослый носильщик (авто/носильщик) и дорога к храму';
 syncInventory(s);if(s.resources.prestige<15)return 'Нужно 15 престижа';if(s.resources.beer<6)return 'Нужно 6 пива';
 // Even opening the seed reserve for emergency food does not authorize spending it on a feast.
 const reserve=seedTarget(s),meal=s.citizens.reduce((n,c)=>n+mealRation(c),0);
 if(s.resources.food-12<reserve+meal-1e-7)return 'Нужно 12 еды сверх семенного резерва и еды на сезон (один полный ужин)';
 if(!festivalSources(s,buildingKey(templeFor(s))))return 'Нет безопасной дороги от запасов еды и пива к храму';
 return '';
}
export function orderFestival(s){
 const reason=festivalReason(s);if(reason)return {ok:false,reason};const temple=templeFor(s),sources=festivalSources(s,buildingKey(temple));if(!sources)return {ok:false,reason:'Не хватает доступных незарезервированных запасов'};
 // Attach references before withdrawing: reconciliation must retain even an emptied household source.
 s.festival={occasion:'nightLights',temple:buildingKey(temple),stage:'supplying',sources,allocations:structuredClone(sources),delivered:{food:0,beer:0},actors:[],rewarded:[],consumed:false,started:null,elapsed:0,ordered:s.simTime};
 for(const [key,materials]of Object.entries(sources))for(const [material,n]of Object.entries(materials))takeStock(s,key,material,n);
 s.resources.prestige-=15;invalidateAssignments(s);
 return {ok:true,warning:festivalSummary(s).warning};
}
function release(s,a){const c=s.citizens.find(c=>c.id===a.id);if(!c)return;if(c.phase==='festival'){const path=route(s,c,c.home);c.route=path?.map(p=>({x:p.x,y:p.y}))||[];c.routeIndex=0;c.phase=path?'toHome':'blocked';}invalidateAssignments(s);}
export function cancelFestival(s){const lock=relicCommandReason(s);return lock?{ok:false,reason:lock}:finishFestival(s);}
function finishFestival(s){
 const q=s.festival;if(!q)return {ok:false,reason:'Нет заказанного праздника'};
 if(!q.consumed){refundFestival(s,q);s.resources.prestige+=costFor(q).prestige;}
 for(const a of q.actors)release(s,a);s.festival=null;invalidateAssignments(s);return {ok:true,refunded:!q.consumed};
}
// Death/role change gives a festival load back to its original reserved ledger, never ordinary cargo.
export function recoverFestivalCitizen(s,id){const q=s.festival,a=q?.actors.find(a=>a.id===id);if(!a)return false;if(a.load>0)(q.sources[a.source]??={})[a.material]=(q.sources[a.source]?.[a.material]||0)+a.load;release(s,a);q.actors=q.actors.filter(v=>v!==a);return true;}
function enlist(s,q,c,kind,target,source=null,material=null){
 if(kind==='guest'&&q.actors.filter(a=>a.kind==='guest').length>=guestLimit(s,q))return false;
 const path=route(s,c,target);if(!path)return false;
 if(kind==='guest'){const net=networkFor(s),center=festivalCourtLayout(s,net,target)?.center,approach=center&&routeBetween(s,path.at(-1).key,center.key);if(!approach)return false;path.push(...approach.slice(1).map(p=>({x:p.x,y:p.y,key:p.key})));}
 q.actors.push({id:c.id,kind,stage:kind==='carrier'?'pickup':'arriving',source,material,load:0,route:path,routeIndex:0,role:c.role||'auto'});c.phase='festival';c.route=[];c.routeIndex=0;invalidateAssignments(s);return true;}
function connected(s,a){const net=networkFor(s);return a.route.every((p,i)=>net.nodes.has(p.key)&&(!i||net.graph.get(a.route[i-1].key)?.has(p.key)));}
function walk(s,c,a,dt){let remaining=dt;while(remaining>1e-8){const target=a.route[a.routeIndex];if(!target)return true;const d=distance(c,target),speed=1.05*roadSpeed(s,c,target),travel=d/speed;if(travel<=remaining+1e-8){c.x=target.x;c.y=target.y;a.routeIndex++;remaining-=travel;}else{c.x+=(target.x-c.x)*remaining/travel;c.y+=(target.y-c.y)*remaining/travel;return false;}}return a.routeIndex>=a.route.length;}
const eveningAt=t=>hourOf(t)>=21||hourOf(t)<3;
const elapsedFestival=(s,q)=>q.started===null?0:Math.max(q.elapsed||0,s.simTime-q.started);
export function advanceFestival(s,dt,{ceremony=false}={}){
 initializeFestival(s);if(!Number.isFinite(dt)||dt<=0)return;beginFirstBeer(s);const q=s.festival;if(!q)return;const cost=costFor(q),gatheringAt=t=>firstBeer(q)||eveningAt(t),gathering=()=>gatheringAt(s.simTime);
 const stores=new Set(stockStores(s).map(buildingKey));for(const [key,kind]of Object.entries(q.sourceKinds||{}))if(kind==='output'&&s.buildings.some(b=>buildingKey(b)===key&&readyBrewery(b)))stores.add(key);
 if(s.funeral||s.lost||!s.buildings.some(b=>buildingKey(b)===q.temple&&readyVenue(b,q))||Object.keys(q.allocations).some(k=>!stores.has(k))){finishFestival(s);return;}
 for(const a of [...q.actors]){const c=s.citizens.find(c=>c.id===a.id);if(!c||!canWork(c)||c.pendingRole||(c.role||'auto')!==a.role||c.phase!=='festival'){recoverFestivalCitizen(s,a.id);continue;}if(!connected(s,a)){finishFestival(s);return;}}
 // The ceremony may run while the city calendar is frozen. Keep its own saved
 // clock; old saves without it continue from their original simulation stamp.
 if(q.stage==='celebrating')q.elapsed=elapsedFestival(s,q)+dt;
 // Close the gathering window before moving or rewarding any late guests.
 if(q.stage==='celebrating'&&(q.elapsed>=FESTIVAL_SECONDS||!gathering())){finishFestival(s);return;}
 if(q.stage==='waiting'&&!gathering()){for(const a of q.actors)release(s,a);q.actors=[];return;}
 if(q.stage==='waiting'){const limit=guestLimit(s,q),guests=q.actors.filter(a=>a.kind==='guest');for(const a of guests.slice(limit)){release(s,a);q.actors=q.actors.filter(v=>v!==a);}}
 if(q.stage==='supplying'){
  for(const c of s.citizens){if(q.actors.length>=(firstBeer(q)?1:2))break;if(!eligibleFor(c,q)||!canCarry(c,q)||!['home','working','resting'].includes(c.phase))continue;
   const entry=Object.entries(q.sources).find(([key,v])=>keys.some(k=>v[k]>1e-7)&&route(s,c,key)&&routeBetween(s,port(s,key)?.key,port(s,q.temple)?.key));if(!entry)continue;
   const [source,materials]=entry,material=keys.find(k=>materials[k]>1e-7);enlist(s,q,c,'carrier',source,source,material);
  }
 }
 if((q.stage==='waiting'||firstBeer(q)&&q.stage==='celebrating')&&gathering()){
  const limit=guestLimit(s,q);for(const c of s.citizens)if(q.actors.length<limit&&!q.rewarded.includes(c.id)&&eligibleGuest(c,q)&&(firstBeer(q)?['home','working','resting'].includes(c.phase)&&(c.hunger||0)<30:['home','resting'].includes(c.phase)&&c.mealEaten>=mealRation(c)*.95))enlist(s,q,c,'guest',q.temple);
 }
 for(const a of [...q.actors]){
  const c=s.citizens.find(c=>c.id===a.id);if(!c)continue;if(a.stage==='dancing')continue;if(!walk(s,c,a,dt))continue;
  if(a.kind==='carrier'){
   if(a.stage==='pickup'){
    a.load=takeReserved(s,q.sources,a.source,a.material,6);if(a.load<=1e-7){release(s,a);q.actors=q.actors.filter(v=>v!==a);continue;}
    const path=route(s,c,q.temple);if(!path){finishFestival(s);return;}a.route=path;a.routeIndex=0;a.stage='delivery';
   }else{q.delivered[a.material]+=a.load;a.load=0;q.actors=q.actors.filter(v=>v!==a);
    // The first-cup server stays at the brewery instead of missing the entire
    // short gathering while walking home and immediately starting another job.
    if(firstBeer(q)&&keys.every(k=>Math.abs(q.delivered[k]-cost[k])<1e-7)&&(c.hunger||0)<30){q.stage='waiting';if(!enlist(s,q,c,'guest',q.temple))release(s,a);}else release(s,a);
   }
  }else{
   if(!gatheringAt(s.simTime+(ceremony?0:dt))){release(s,a);q.actors=q.actors.filter(v=>v!==a);continue;}
   a.stage='dancing';if(!q.consumed){q.consumed=true;q.stage='celebrating';q.started=s.simTime;q.elapsed=0;if(firstBeer(q))s.firstBeerFeast.status='done';}
   if(!q.rewarded.includes(c.id)){affectResidents(s,{mood:8,faith:4},[c.id]);q.rewarded.push(c.id);}
  }
 }
 if(q.stage==='supplying'&&keys.every(k=>Math.abs(q.delivered[k]-cost[k])<1e-7)&&!q.actors.length)q.stage='waiting';
 if(q.stage==='celebrating'&&(elapsedFestival(s,q)>=FESTIVAL_SECONDS||!gathering()))finishFestival(s);
}
function festivalProgress(s,q,{paused=false}={}){
 const status=(code,text)=>({code,text});
 if(!q)return status('none','Закажи праздник: угощение зарезервируется на складах, а жители сами доставят его к месту сбора.');
 if(paused)return status('paused','Игра на паузе. Запусти время: носильщики доставят угощение автоматически, вручную наполнять храм не нужно.');
 if(s.event)return status('event','Заверши текущее событие, чтобы жители продолжили подготовку.');
 if(q.stage==='celebrating')return status('celebrating',`Идёт праздник. До конца обряда: ${Math.max(0,Math.ceil(FESTIVAL_SECONDS-elapsedFestival(s,q)))} с; городское время остановлено.`);
 if(q.actors.some(a=>!connected(s,a)))return status('roadBlocked','Путь перекрыт. Нужен свободный проход от склада к месту праздника; отмена вернёт неиспользованное угощение.');
 if(q.stage==='supplying'){
  const carriers=q.actors.filter(a=>a.kind==='carrier');
  if(carriers.some(a=>a.load>0))return status('delivering',`Носильщики доставляют зарезервированное угощение: ${carriers.length}. Припасы появятся у места праздника после их прибытия.`);
  if(carriers.length)return status('collecting',`Носильщики идут за угощением на склады: ${carriers.length}. Ресурсы уже зарезервированы, повторно покупать их не нужно.`);
  const candidates=s.citizens.filter(c=>canWork(c)&&c.age>=16&&(c.health??100)>=60&&!c.recovering&&!c.guardPost&&(!c.workplace||firstBeer(q)&&c.workplace===q.temple)&&canCarry(c,q));
  if(!candidates.length)return status('noCarrier','Нет свободного взрослого носильщика. Освободи здорового взрослого от постоянного рабочего места и выбери «Авто» или «Носильщик». Припасы уже зарезервированы.');
  const ready=candidates.filter(c=>eligibleFor(c,q)&&['home','working','resting'].includes(c.phase));
  if(!ready.length)return status('busyCarriers','Носильщики заняты едой, водой, грузами или другими походами. Они возьмут угощение, когда освободятся; можно освободить ещё одного взрослого.');
  const reachable=ready.some(c=>Object.entries(q.sources).some(([key,v])=>keys.some(k=>v[k]>1e-7)&&route(s,c,key)&&routeBetween(s,port(s,key)?.key,port(s,q.temple)?.key)));
  if(!reachable)return status('roadBlocked','Нет прохода от свободного носильщика через склад к месту праздника. Проверь свободные берега и мосты.');
  return status('dispatching','Угощение уже зарезервировано. Свободные носильщики отправятся за ним автоматически на следующем шаге времени.');
 }
 if(!guestLimit(s,q))return status('noCourtyard','Нужна свободная сухая площадка рядом с местом праздника: сейчас двору мешают здания или вода. Угощение сохранено; отмена вернёт неиспользованные припасы.');
 if(!firstBeer(q)&&!eveningAt(s.simTime))return status('evening','Угощение доставлено. Ждём 21:00: сытые взрослые соберутся после ужина; вручную заполнять храм больше не нужно.');
 if(q.actors.some(a=>a.kind==='guest'))return status('gathering','Угощение доставлено, гости идут к месту праздника. Пир начнётся, когда первый гость подойдёт.');
 const guests=s.citizens.filter(c=>eligibleGuest(c,q)&&(firstBeer(q)?['home','working','resting'].includes(c.phase):['home','resting'].includes(c.phase)));
 if(!guests.length)return status('busyGuests','Угощение доставлено. Ждём здоровых взрослых, которые закончат работу и семейные походы. Постоянное рабочее место не мешает прийти после работы.');
 const fed=guests.filter(c=>firstBeer(q)?(c.hunger||0)<30:c.mealEaten>=mealRation(c)*.95);
 if(!fed.length)return status('meal','Угощение доставлено. Сначала взрослые должны поужинать дома: проверь домашнюю еду и её доставку, общий склад сам по себе ужин не заменяет.');
 if(!fed.some(c=>route(s,c,q.temple)))return status('roadBlocked','Угощение доставлено, но сытые гости не могут пройти к месту праздника. Проверь проходы и мосты.');
 return status('gathering','Угощение доставлено. Сытые взрослые отправятся к месту праздника на следующем шаге времени.');
}
export function festivalSummary(s,options={}){
 const q=s.festival,cost=costFor(q),which=occasion(q),venueLabel=firstBeer(q)?'у пивоварни':'у храма',title=firstBeer(q)?'Первая кружка пива':'Ночь огней',forecast=foodForecast(s,{includeCrops:false}),warning=cost.food>0&&forecast.balance-(q?0:cost.food)<0?'После заказа прогнозируется нехватка еды до жатвы':'';
 const reserved=Object.fromEntries(keys.map(k=>[k,Object.values(q?.sources||{}).reduce((n,v)=>n+(v[k]||0),0)])),inTransit=Object.fromEntries(keys.map(k=>[k,(q?.actors||[]).reduce((n,a)=>n+(a.material===k?a.load:0),0)]));
 return {active:!!q,occasion:which,title,venueLabel,stage:q?.stage||'none',label:!q?'Общинный праздник':q.stage==='supplying'?'Жители несут угощение':q.stage==='waiting'?(firstBeer(q)?'Жители собираются у пивоварни':'Ждём вечера и сытых взрослых'):`Праздник ${venueLabel}`,cost,delivered:q?{...q.delivered}:{food:0,beer:0},reserved,inTransit,progress:festivalProgress(s,q,options),participants:q?.actors.filter(a=>a.kind==='guest').length||0,warning,reason:festivalReason(s)};
}
export function festivalView(s){const q=s.festival;if(!q)return null;const b=s.buildings.find(b=>buildingKey(b)===q.temple),court=festivalCourtLayout(s,networkFor(s),q.temple)?.center;return {occasion:occasion(q),title:firstBeer(q)?'Первая кружка пива':'Ночь огней',stage:q.stage,temple:q.temple,x:b?.x,y:b?.y,court:court?{...court}:null,consumed:q.consumed,participants:q.actors.filter(a=>a.kind==='guest').map(a=>a.id),dancing:q.actors.filter(a=>a.stage==='dancing').map(a=>a.id),carriers:q.actors.filter(a=>a.kind==='carrier').map(a=>({id:a.id,load:a.load,material:a.material})),elapsed:elapsedFestival(s,q)};}
export function validateFirstBeerFeast(s){
 const q=s.firstBeerFeast;if(q===undefined)return true;
 if(!q||typeof q!=='object'||Array.isArray(q)||Object.keys(q).length!==4||q.version!==1||!['unbrewed','pending','done','legacy'].includes(q.status)||!['version','status','brewery','producedAt'].every(k=>k in q))return false;
 if(['unbrewed','legacy'].includes(q.status))return q.brewery===null&&q.producedAt===null&&!firstBeer(s.festival);
 if(typeof q.brewery!=='string'||!/^\d+,\d+$/.test(q.brewery)||!Number.isFinite(q.producedAt)||q.producedAt<0||q.producedAt>s.simTime)return false;
 return !firstBeer(s.festival)||(s.festival.consumed?q.status==='done':q.status==='pending');
}
export function validateFestival(s){
 if(!validateFirstBeerFeast(s))return false;const q=s.festival;if(q===null||q===undefined)return !s.citizens?.some(c=>c.phase==='festival');const cost=costFor(q);
 const exact=(o,list)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===list.length&&list.every(k=>k in o),finite=(n,max=1e9)=>Number.isFinite(n)&&n>=0&&n<=max,id=n=>Number.isSafeInteger(n)&&n>=0;
 const required=['temple','stage','sources','allocations','delivered','actors','rewarded','consumed','started','ordered'];if(!q||typeof q!=='object'||Array.isArray(q)||!required.every(k=>k in q)||Object.keys(q).some(k=>!required.includes(k)&&!['occasion','sourceKinds','elapsed'].includes(k))||q.elapsed!==undefined&&(!finite(q.elapsed,FESTIVAL_SECONDS)||!q.consumed&&q.elapsed!==0)||q.occasion!==undefined&&!['firstBeer','nightLights'].includes(q.occasion)||q.sourceKinds!==undefined&&(!firstBeer(q)||!exact(q.sourceKinds,[q.temple])||q.sourceKinds[q.temple]!=='output'))return false;
 if(!s.buildings.some(b=>buildingKey(b)===q.temple&&readyVenue(b,q))||!['supplying','waiting','celebrating'].includes(q.stage)||!exact(q.delivered,keys)||!keys.every(k=>finite(q.delivered[k],cost[k]))||!finite(q.ordered,s.simTime)||typeof q.consumed!=='boolean'||(q.consumed?(q.stage!=='celebrating'||!finite(q.started,s.simTime)||q.started<q.ordered):(q.started!==null||q.stage==='celebrating'))||!Array.isArray(q.actors)||q.actors.length>24||!Array.isArray(q.rewarded)||q.rewarded.length>24||new Set(q.rewarded).size!==q.rewarded.length||!q.rewarded.every(id)||(!q.consumed&&q.rewarded.length))return false;
 const stores=new Set(stockStores(s).map(buildingKey));for(const key of Object.keys(q.sourceKinds||{}))if(s.buildings.some(b=>buildingKey(b)===key&&readyBrewery(b)))stores.add(key);const totals={food:0,beer:0},left={food:0,beer:0};
 for(const [map,total]of [[q.allocations,totals],[q.sources,left]]){if(!map||typeof map!=='object'||Array.isArray(map))return false;for(const [key,v]of Object.entries(map)){if(!stores.has(key)||!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))return false;for(const [k,n]of Object.entries(v)){if(!finite(n,cost[k]))return false;total[k]+=n;if(map===q.sources&&n>(q.allocations[key]?.[k]||0)+1e-7)return false;}}}
 const ids=new Set();for(const a of q.actors){const c=s.citizens.find(c=>c.id===a.id);if(!exact(a,['id','kind','stage','source','material','load','route','routeIndex','role'])||!c||!id(a.id)||ids.has(a.id)||c.phase!=='festival'||!canWork(c)||busy(c)||typeof a.role!=='string'||!finite(a.load,6)||!Array.isArray(a.route)||!a.route.length||a.route.length>4096||!id(a.routeIndex)||a.routeIndex>a.route.length||a.route.some((p,i)=>!exact(p,['x','y','key'])||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.key!==`${p.x+.5},${p.y+.5}`||i&&!navigationGridStep(p,a.route[i-1]))||!connected(s,a))return false;ids.add(a.id);
  if(a.kind==='carrier'){if(q.stage!=='supplying'||!['pickup','delivery'].includes(a.stage)||!stores.has(a.source)||!keys.includes(a.material)||!(q.allocations[a.source]?.[a.material]>0)||a.stage==='pickup'&&a.load!==0||a.stage==='delivery'&&a.load<=0||a.route.at(-1)?.key!==port(s,a.stage==='pickup'?a.source:q.temple)?.key)return false;left[a.material]+=a.load;
  }else if(a.kind==='guest'){if(q.stage==='supplying'||a.source!==null||a.material!==null||a.load!==0||!['arriving','dancing'].includes(a.stage)||a.stage==='dancing'&&!q.rewarded.includes(a.id)||distance(a.route.at(-1),port(s,q.temple))>2)return false;}else return false;
 }
 if(s.citizens.some(c=>c.phase==='festival'&&!ids.has(c.id))||q.stage==='waiting'&&q.rewarded.length)return false;
 return keys.every(k=>Math.abs(totals[k]-cost[k])<1e-7&&Math.abs(left[k]+q.delivered[k]-cost[k])<1e-7)&&(q.stage==='supplying'||keys.every(k=>Math.abs(q.delivered[k]-cost[k])<1e-7));
}

export function festivalCitizenView(s,c){
 const q=s.festival,a=q?.actors.find(a=>a.id===c.id);if(!a)return {};
 const view={walking:a.stage!=='dancing',carrying:a.load>0,cargo:a.load>0?{[a.material]:a.load}:{},celebrating:a.stage==='dancing'};
 if(a.stage==='dancing'){
  const layout=festivalCourtLayout(s,networkFor(s),q.temple),center=layout?.center;
  // Legacy parties may already be dancing two cells away. Never move those
  // people across the city just because their old save now uses a richer view.
  if(center&&a.route.at(-1)?.key===center.key&&distance(c,center)<.01){
   if(!firstBeer(q)&&q.stage==='celebrating'&&layout.torchPatrol){
    // The invitation roster is stable while guests arrive. Later arrivals
    // must not replace torchbearers or redistribute their patrol phases.
    const guests=q.actors.filter(guest=>guest.kind==='guest'),count=guests.length>=6?Math.min(3,Math.floor(guests.length/3)):0,slot=guests.slice(0,count).findIndex(guest=>guest.id===c.id);
    if(slot>=0){view.walking=true;view.celebrating=false;view.festivalTorch=true;view.eventContact=festivalTorchContact(layout,elapsedFestival(s,q),slot,count);return view;}
   }
   const slot=q.actors.filter(a=>a.kind==='guest').findIndex(a=>a.id===c.id),place=layout.places[slot];if(place)view.festivalContact={...place,center:{x:center.x,y:center.y},slot};
  }
 }
 return view;
}
