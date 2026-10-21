import {BUILDINGS,buildingKey,isOperational,outputMultiplier,RESOURCE_NAMES} from './definitions.js';
import {generateStreets,DAY_SECONDS} from './city-life.js';
import {stockStores,storeCapacity} from './inventory.js';
import {seedReserve} from './food-planning.js';
import {fieldWater} from './irrigation.js';
import {artisanSummary} from './artisan.js';
import {mealRation,mealCycle,isDinnerTime} from './wellbeing.js';

const topologyCache=new WeakMap();
const sum=o=>Object.values(o||{}).reduce((n,v)=>n+(Number.isFinite(v)&&v>0?v:0),0);
const amount=n=>Number.isFinite(n)?Math.max(0,n):0;
const adult=c=>c.age===undefined||c.age>=16;
const hungry=(c,s)=>(c.hunger||0)>=30||((c.missedMeals||0)>0&&(c.lastMealQuality??1)<.95&&!(isDinnerTime(s.simTime||0)&&c.mealDay===mealCycle(s.simTime||0)&&c.mealEaten>=mealRation(c)*.95));
const ill=c=>(c.health??100)<60;
const reason=(code,label,detail='',target=null)=>({code,label,detail,target});
export const CITY_ROLE_NAMES={auto:'Авто',production:'Производство',carrier:'Носильщик',builder:'Строитель',healer:'Лекарь',tailor:'Мастер одежды',watercarrier:'Водонос'};

// Only immutable derived navigation is cached. Do not use networkFor/syncInventory:
// those simulation helpers initialise roads, stores, and assignment state.
function topology(s){
 const signature=JSON.stringify([...(s.buildings||[]),...(s.roadAnchors||[])].map(b=>[buildingKey(b),b.type,b.x,b.y,b.construction?.kind||'']).concat([(s.roads||[]).map(r=>[r.a,r.b]),s.world?.lakes||[]]));
 const old=topologyCache.get(s);if(old?.signature===signature)return old;
 const network=generateStreets([...(s.buildings||[]),...(s.roadAnchors||[])],s);
 const components=new Map(network.ports.filter(p=>!p.building.siteKey).map(p=>[buildingKey(p.building),network.components.get(p.key)]));
 const result={signature,components};topologyCache.set(s,result);return result;
}
function cargoAmount(c){
 return sum(c.cargo)+sum(c.buildCargo)+amount(c.waterTrip?.load)+amount(c.pantryFood)+amount(c.seedFood)+amount(c.clothingLoad)+amount(c.craftAmount)+amount(c.craftWool)+amount(c.craftCloth);
}
function localFood(s,stores){
 let reserve=seedReserve({...s,resources:{...s.resources,food:amount(s.resources?.food)}});
 const food=new Map();for(const b of stores){const n=amount(b.stock?.food),protectedFood=Math.min(reserve,n);food.set(buildingKey(b),n-protectedFood);reserve-=protectedFood;}return food;
}
const homeDemand=(people,s)=>people.reduce((n,c)=>n+(isDinnerTime(s.simTime||0)?Math.max(0,mealRation(c)-(c.mealDay===mealCycle(s.simTime||0)?amount(c.mealEaten):0)):mealRation(c)),0);
const waterDemand=people=>people.reduce((n,c)=>n+(adult(c)?1:.5),0);
function productionReason(s,b,workers,connected,hasHomes,isDay){
 const key=buildingKey(b),def=BUILDINGS[b.type]||{},buffer=b.brickmaking||b.firing,artisan=artisanSummary(b);
 if(b.construction){
  const q=b.construction,missing=Object.keys(q.required||{}).filter(k=>amount(q.delivered?.[k])<amount(q.required[k])-1e-7);
  const builders=workers.filter(c=>c.site===key&&c.siteDuty==='builder'),carriers=workers.filter(c=>c.site===key&&c.siteDuty==='carrier'),active=builders.filter(c=>c.phase==='constructing');
  return reason('construction',missing.length?'Ждёт стройматериалы':active.length?'Строится':builders.length?'Строители идут / заняты':'Нужны строители',missing.length?missing.map(k=>`${RESOURCE_NAMES[k]||k}: ${Math.max(0,q.required[k]-amount(q.delivered?.[k])).toFixed(1)}`).join(' · ')+` · носильщиков: ${carriers.length}`:`Материалы доставлены · строителей: ${builders.length} · работают: ${active.length}`,key);
 }
 if(b.brickmaking?.wet)return reason('drying','Сушка на дворе','Дождь приостанавливает сушку',key);
 if(b.firing?.hot)return reason('firing',b.firing.time<20?'Обжиг':'Остывание','Загруженная печь продолжает цикл ночью',key);
 if(artisan&&['drying','firing','cooling'].includes(artisan.stage))return reason(artisan.stage==='drying'?'drying':'firing',{drying:'Сушка керамики',firing:'Обжиг керамики',cooling:'Остывание керамики'}[artisan.stage],artisan.stage==='drying'?'Дождь приостанавливает сушку':'Загруженная партия продолжает цикл ночью',key);
 if(!isDay)return reason('night','Ночной отдых','Рабочий день с 06:00 до 19:00',key);
 if(!connected.length||!hasHomes)return reason('path','Нет пути','Нужна общая дорожная сеть с населённым домом и складом',key);
 if(b.type==='field'){
  const crop=b.crop||{};
  if(s.season===1&&crop.sown>0&&!fieldWater(s,b).canal&&!(s.rain>0)&&!(crop.legacyYear===s.year&&fieldWater(s,b).natural))return reason('water','Нужен полив','Соедини наполненный канал с полем',key);
  if(!(crop.sheaves>0)&&!(s.season===0&&(crop.sown||0)<1)&&!(s.season===2&&crop.remaining>0))return reason('season','Сезонное ожидание',s.season===1?'Ячмень растёт; жатва осенью':'Сейчас нет посева, срезки или снопов для обмолота',key);
 }
 if(!workers.length)return reason('worker','Нет работника',b.type==='tailor'?'Нужен взрослый мастер одежды':b.type==='healer'?'Нужен обученный лекарь':b.type==='waterpoint'?'Нужен водонос':'Назначь взрослого или освободи рабочие руки',key);
 if(workers.some(c=>c.phase==='blocked'))return reason('path','Маршрут заблокирован','Проверь дорогу и пункт назначения груза',key);
 if(artisan?.stage==='idle'){
  const missing=Object.entries(artisan.needs).filter(([k,n])=>k!=='water'&&n>1e-7);
  if(missing.length)return reason('input',missing.some(([k])=>k==='pottery')?'Ждёт керамический сосуд':'Ждёт сырьё',missing.map(([k,n])=>`${RESOURCE_NAMES[k]||k}: ${n}`).join(' · ')+(b.type==='brewery'?' · еда без защищённых семян':''),key);
  if(artisan.needs.water>1e-7)return reason('water','Ждёт воду',`Нужно воды: ${artisan.needs.water}`,key);
 }
 if(b.brickmaking&&!buffer.wet&&!buffer.ready){
  if(buffer.clay<4||buffer.reed<1)return reason('input','Ждёт глину / тростник','Для партии: 4 глины + 1 тростник',key);
  if(buffer.water<2)return reason('water','Ждёт воду','В кирпичном дворе нужно 2 воды',key);
 }
 if(b.firing&&!buffer.hot&&!buffer.ready&&(buffer.brick<4||buffer.reed<3))return reason('input','Ждёт сырец / топливо','Для партии: 4 сырца + 3 тростника',key);
 if(b.type==='weaver'&&amount(b.weaving?.wool)<3*outputMultiplier(b))return reason('input','Ждёт шерсть','Работник приносит шерсть со склада',key);
 if(b.type==='tailor'&&amount(b.tailoring?.cloth)<2*outputMultiplier(b))return reason('input','Ждёт ткань','Мастер приносит ткань со склада',key);
 if(b.type==='sheepfold'&&amount(b.flock?.fleece)<1)return reason('input','Шерсть отрастает','Стадо восстанавливает руно',key);
 const output=Object.keys(def.output||{}).filter(k=>!['faith','prestige'].includes(k));
 if(output.some(k=>connected.every(st=>amount(st.stock?.[k])>=storeCapacity(st)-1e-7)))return reason('storage','Склад заполнен','Нет места для следующего груза; освободи местный склад',buildingKey(connected[0]));
 if(workers.some(c=>cargoAmount(c)>0||['toStore','toCraftSupply','toWork','returnWork'].includes(c.phase)))return reason('delivery','Доставка / дорога','Работник несёт груз или идёт к месту работы',key);
 if(workers.some(c=>c.phase==='working'))return reason('working','Работа идёт','Работник находится на месте',key);
 return reason('away','Работник занят','Дом, вода, семейная еда, лечение или другой личный уход',key);
}

/** Read-only snapshot. Neighbourhoods group homes by nearest same-component store
 * (geometric distance for the overview, not a promise of actual carrier routing).
 * Shared stores are counted once; pantry, stock and in-transit are separate. */
export function cityDiagnostics(s){
 const citizens=s.citizens||[],buildings=s.buildings||[],{components}=topology(s),stores=stockStores(s),food=localFood(s,stores),byHome=new Map(),byWork=new Map(),bySite=new Map(),byPantryTarget=new Map();
 const same=(a,b)=>components.has(a)&&components.get(a)!==undefined&&components.get(a)===components.get(b);
 for(const c of citizens){if(c.pantryTrip){const target=c.pantryTarget||c.home;if(!byPantryTarget.has(target))byPantryTarget.set(target,[]);byPantryTarget.get(target).push(c);}if(!byHome.has(c.home))byHome.set(c.home,[]);byHome.get(c.home).push(c);if(c.work&&adult(c)){if(!byWork.has(c.work))byWork.set(c.work,[]);byWork.get(c.work).push(c);}if(c.site&&adult(c)){if(!bySite.has(c.site))bySite.set(c.site,[]);bySite.get(c.site).push(c);}}
 const homes=buildings.filter(b=>b.type==='house'&&isOperational(b)).map(b=>{
  const key=buildingKey(b),residents=byHome.get(key)||[],couriers=byPantryTarget.get(key)||[],connected=stores.filter(st=>same(key,buildingKey(st))),demand=homeDemand(residents,s),waterNeed=waterDemand(residents),pantry=amount(b.pantry),water=amount(b.water),foodInTransit=couriers.reduce((n,c)=>n+amount(c.pantryFood),0),waterInTransit=citizens.reduce((n,c)=>n+(c.waterTrip?.target===key?amount(c.waterTrip.load):0),0),accessibleFood=connected.reduce((n,st)=>n+(food.get(buildingKey(st))||0),0),reasons=[];
  const h={key,x:b.x,y:b.y,residents:residents.map(c=>c.id),population:residents.length,adults:residents.filter(adult).length,workers:residents.filter(c=>adult(c)&&(c.work||c.site||c.districtJob||c.tradeJob||c.saleJob)).length,hungry:residents.filter(c=>hungry(c,s)).length,ill:residents.filter(ill).length,food:pantry,demand,water,waterDemand:waterNeed,foodInTransit,waterInTransit,accessibleFood,reasons};
  if(residents.length&&!connected.length)reasons.push(reason('path','Нет пути к складу','Общий запас не доступен этому дому',key));
  const deliverable=couriers.reduce((n,c)=>n+(c.phase!=='blocked'?amount(c.pantryFood):0),0),foodNeeded=pantry+1e-7<demand,canFetch=residents.some(c=>adult(c)&&!c.clinic&&!c.school)||couriers.some(c=>c.phase!=='blocked');
  h.foodStatus='ready';
  if(h.hungry)reasons.push(reason('food','Недоедание',accessibleFood>0?'Еда есть на доступном складе: нужна доставка домой':'На доступных складах нет свободной еды',key));
  if(foodNeeded){
   if(pantry+deliverable+1e-7>=demand){h.foodStatus='delivery';reasons.push(reason('delivery','Еда в пути','Припасы ещё не доставлены домой',key));}
   else if(accessibleFood>1e-7){h.foodStatus=canFetch?'delivery':'helper';reasons.push(reason(canFetch?'delivery':'helper',canFetch?'Ждёт доставку еды':'Некому принести еду',canFetch?'На доступном складе есть еда; нужен рейс домой':'Нет взрослого без лечения или учёбы; нужна помощь семье',key));}
   else{h.foodStatus='shortage';if(!h.hungry)reasons.push(reason('food','Не хватает домашней еды','На доступных складах нет свободной еды',key));}
  }
  if(water+waterInTransit<waterNeed||residents.some(c=>c.thirst>30))reasons.push(reason('water','Нужна вода','Вода хранится в доме; нужен рейс к берегу',key));
  if(h.ill)reasons.push(reason('health','Нужно лечение',`Здоровье ниже 60%: ${h.ill}`,key));
  return h;
 });
 const hour=((8+amount(s.simTime)*24/DAY_SECONDS)%24+24)%24,isDay=hour>=6&&hour<19;
 const workshops=buildings.filter(b=>b.construction||b.type!=='house'&&(Object.keys(BUILDINGS[b.type]?.output||{}).length||['healer','waterpoint','depot','pottery','brewery'].includes(b.type))).map(b=>{
  const key=buildingKey(b),workers=b.construction?(bySite.get(key)||[]):(byWork.get(key)||[]),connected=stores.filter(st=>same(key,buildingKey(st))),hasHomes=homes.some(h=>h.population&&same(key,h.key));
  const why=productionReason(s,b,workers,connected,hasHomes,isDay);
  return {key,x:b.x,y:b.y,type:b.type,name:BUILDINGS[b.type]?.name||b.type,workers:workers.map(c=>c.id),builders:workers.filter(c=>c.site===key&&c.siteDuty==='builder').map(c=>c.id),carriers:workers.filter(c=>c.site===key&&c.siteDuty==='carrier').map(c=>c.id),working:workers.filter(c=>['working','constructing'].includes(c.phase)).length,reason:why,status:(why.code==='construction'&&workers.some(c=>c.phase==='constructing')||['drying','firing','working','delivery','season','night'].includes(why.code))?'process':'attention'};
 });
 const neighborhoods=new Map();
 const groupFor=(id,label,focus)=>{if(!neighborhoods.has(id))neighborhoods.set(id,{key:id,label,focus,homeKeys:[],storeKeys:[],population:0,workers:0,cargo:0,food:0,homeFood:0,foodInTransit:0,water:0,waterInTransit:0,waterDemand:0,troubled:0,reasons:[]});return neighborhoods.get(id);};
 for(const st of stores){const key=buildingKey(st),n=groupFor(`store:${key}`,`${BUILDINGS[st.type]?.name||'Склад'} · ${st.x}, ${st.y}`,key);n.storeKeys.push(key);n.food+=food.get(key)||0;}
 for(const h of homes){const near=stores.filter(st=>same(h.key,buildingKey(st))).sort((a,b)=>Math.hypot(a.x-h.x,a.y-h.y)-Math.hypot(b.x-h.x,b.y-h.y))[0],component=components.get(h.key),n=near?neighborhoods.get(`store:${buildingKey(near)}`):groupFor(`isolated:${component??h.key}`,'Без местного склада',h.key);
  n.homeKeys.push(h.key);n.population+=h.population;n.workers+=h.workers;n.homeFood+=h.food;n.foodInTransit+=h.foodInTransit;n.water+=h.water;n.waterInTransit+=h.waterInTransit;n.waterDemand+=h.waterDemand;n.troubled+=Number(h.reasons.length>0);for(const r of h.reasons)if(!n.reasons.some(v=>v.code===r.code))n.reasons.push(r);
 }
 for(const c of citizens){const n=[...neighborhoods.values()].find(n=>n.homeKeys.includes(c.home));if(n&&cargoAmount(c)>0)n.cargo++;}
 return {hour,isDay,homes,workshops,neighborhoods:[...neighborhoods.values()].sort((a,b)=>b.troubled-a.troubled||b.population-a.population),totals:{population:citizens.length,adults:citizens.filter(adult).length,workers:citizens.filter(c=>adult(c)&&(c.work||c.site||c.districtJob||c.tradeJob||c.saleJob)).length,carrying:citizens.filter(c=>cargoAmount(c)>0).length,hungry:citizens.filter(c=>hungry(c,s)).length,ill:citizens.filter(ill).length,storedFood:stores.reduce((n,b)=>n+amount(b.stock?.food),0),availableFood:[...food.values()].reduce((a,b)=>a+b,0),homeFood:homes.reduce((n,h)=>n+h.food,0),foodInTransit:homes.reduce((n,h)=>n+h.foodInTransit,0)}};
}

/** Combines filters; never edits or renumbers the returned resident objects. */
export function filterCitizens(s,{role='all',age='all',trouble='all',home=null}={}){
 const family=trouble==='family'?new Set(cityDiagnostics(s).homes.filter(h=>h.reasons.length).map(h=>h.key)):null;
 return (s.citizens||[]).filter(c=>(role==='all'||(c.role||'auto')===role)&&(age==='all'||age==='adult'&&adult(c)||age==='child'&&!adult(c))&&(!home||c.home===home)&&(trouble==='all'||trouble==='hunger'&&hungry(c,s)||trouble==='health'&&ill(c)||trouble==='family'&&family.has(c.home)));
}
