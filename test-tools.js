import {buildingDefinition} from './building-presentation.js';
import {BUILDINGS,MATERIALS,RESOURCE_NAMES,buildingKey,levelOf,capacityOf,isOperational} from './definitions.js';
import {stockStores,syncInventory,putStock} from './inventory.js';
import {cityCommandReason as relicCommandReason} from './city-command-lock.js';
import {syncCitizens,recoverCitizenCargo,networkFor} from './workforce.js';
import {createOrder,workRequired,finishConstruction} from './construction.js';
import {syncSacredUnlocks} from './sacred-unlocks.js';
import {mournResidents} from './wellbeing.js';
import {recordLifeDeath,snapshotLifeAnalytics} from './life-analytics.js';
import {displayName} from './citizen-epithets.js';
import {startFuneral} from './funerals.js';
import {CITY_EVENTS,createCityEvent} from './city-events.js';
import {startMiracleCelebration,miracleCelebrationTargetReason} from './miracle-celebration.js';
import {isPestStore,pestActors} from './pests.js';
import {arrivalHousing} from './arrival-hospitality.js';
import {footprintCells} from './footprints.js';
import {signedRiverDistance,terrain,worldWidth,worldHeight} from './world.js';

export const TEST_EVENTS=CITY_EVENTS;
export function testToolsReason(state){
 const controlled=relicCommandReason(state);if(controlled)return controlled;
 if(state.lost)return 'Поселение покинуто';
 if(state.event)return 'Сначала заверши текущее событие';
 if(state.funeral)return 'Дождись возвращения траурной процессии';
 if(state.festival)return 'Сначала заверши или отмени праздник';
 return '';
}
const denied=reason=>({ok:false,reason});
function note(state,text){state.news??=[];state.news.unshift({title:'Тестирование',text,kind:'info',year:state.year,season:state.season,tick:state.tick});state.news=state.news.slice(0,80);}

export function triggerTestEvent(state,id){
 const reason=testToolsReason(state);if(reason)return denied(reason);
 const event=createCityEvent(state,id);if(!event)return denied('Неизвестное событие');
 state.event=event;return {ok:true,id};
}

// Scene previews skip only miracle unlocks, payment and cooldown. They keep the
// normal ceremony, save validation and command lock; no growth buff is granted.
export function triggerTestMiracleScene(state,kind){
 const reason=testToolsReason(state);if(reason)return denied(reason);
 if(!['cat','fertility'].includes(kind))return denied('Неизвестная сцена чуда');
 const targetReason=miracleCelebrationTargetReason(state);if(targetReason)return denied(targetReason);
 if(kind==='fertility')return startMiracleCelebration(state,kind)?{ok:true,kind}:denied('Нет безопасного места для церемонии');
 const previousNextCat=state.pests.nextCat,existing=state.pests.cats[0],ports=networkFor(state).ports;
 // A new village has no shrine or granary yet. A normal unassigned yard cat is
 // already supported by pest actors/saves, so the preview needs no new building.
 const port=ports.find(p=>isPestStore(p.building))||ports[0];
 const cat=existing||{id:state.pests.nextCat++,site:buildingKey(port.building)};
 if(!existing)state.pests.cats.push(cat);
 const destination=pestActors(state).find(a=>a.id===`cat:${cat.id}`);
 if(startMiracleCelebration(state,kind,{catId:cat.id,catDestination:destination}))return {ok:true,kind};
 if(!existing){state.pests.cats.pop();state.pests.nextCat=previousNextCat;}
 return denied('Нет безопасного места для церемонии');
}

// Explicit player-invoked testing aid. It never runs on load or on a clock.
export function grantTestResources(state,key='all'){
 const reason=testToolsReason(state);if(reason)return denied(reason);
 if(key!=='all'&&!Object.hasOwn(RESOURCE_NAMES,key))return denied('Неизвестный ресурс');
 const stores=stockStores(state),store=stores[0];if(!store)return {ok:false,reason:'Нет места для тестовых запасов'};
 syncInventory(state);const added={};
 for(const resource of key==='all'?Object.keys(RESOURCE_NAMES):[key]){
  const amount=Math.min(1000,Math.max(0,1e9-state.resources[resource]));
  if(resource==='food'){
   // A debug grant should provision real stores on both banks. Households
   // still need a route and must physically carry the food home.
   let remaining=amount;added.food=0;
   for(let i=0;i<stores.length&&remaining>0;i++){
    const share=Math.min(remaining,Math.ceil(remaining/(stores.length-i))),accepted=putStock(state,buildingKey(stores[i]),'food',share,{overflow:true});
    remaining-=accepted;added.food+=accepted;
   }
  }else if(MATERIALS.includes(resource))added[resource]=putStock(state,buildingKey(store),resource,amount,{overflow:true});
  else{state.resources[resource]+=amount;added[resource]=amount;}
 }
 return {ok:true,added};
}

export function addTestCitizens(state,count){
 const reason=testToolsReason(state);if(reason)return denied(reason);
 if(!Number.isSafeInteger(count)||count<1||count>300)return denied('Введи целое число от 1 до 300');
 if((state.demography?.nextId||0)+count>1e6)return denied('Достигнут предел номеров жителей');
 const homes=state.buildings.filter(b=>b.type==='house'&&isOperational(b));
 const camps=homes.filter(b=>b.reedCamp);
 const vacantHomes=arrivalHousing(state).reduce((n,h)=>n+h.beds,0);
 const flooded=networkFor(state,{materializeRoads:false}).navigation.flooded;
 const vacantCamps=camps.reduce((n,b)=>n+(flooded?.has(buildingKey(b))?0:Math.max(0,capacityOf(b)-state.citizens.filter(c=>c.home===buildingKey(b)).length)),0);
 const needed=Math.max(0,Math.ceil((count-vacantHomes-vacantCamps)/capacityOf({type:'house',level:1})));
 const additions=[];
 if(needed){
  const anchor=homes.find(b=>!b.reedCamp)||homes[0]||state.buildings[0];
  if(!anchor)return denied('Нет места для лагеря');
  const bank=Math.sign(signedRiverDistance(anchor.x,anchor.y,state));
  const occupied=new Set(state.buildings.flatMap(footprintCells).map(buildingKey));
  for(const road of state.roadAnchors||[])occupied.add(buildingKey(road));
  const candidates=[];
  for(let y=0;y<worldHeight(state);y++)for(let x=0;x<worldWidth(state);x++){
   const key=buildingKey({x,y});
   if(occupied.has(key)||flooded?.has(key)||terrain(x,y,state)==='water'||Math.sign(signedRiverDistance(x,y,state))!==bank)continue;
   candidates.push({type:'house',level:1,x,y,reedCamp:true});
  }
  candidates.sort((a,b)=>Math.hypot(a.x-anchor.x,a.y-anchor.y)-Math.hypot(b.x-anchor.x,b.y-anchor.y));
  if(candidates.length<needed)return denied('На этом берегу не хватает свободного места для лагеря');
  additions.push(...candidates.slice(0,needed));
 }
 state.buildings.push(...additions);
 const before=state.population;
 state.population+=count;
 syncCitizens(state);
 snapshotLifeAnalytics(state);
 const added=state.population-before, campKeys=new Set(state.buildings.filter(b=>b.reedCamp).map(buildingKey));
 const sheltered=state.citizens.filter(c=>campKeys.has(c.home)).length;
 note(state,`Добавлено жителей: ${added}. Сейчас в тростниковых шалашах: ${sheltered}.`);
 return {ok:true,count:added,sheltered};
}

export function instantTestUpgrade(state,key){
 const reason=testToolsReason(state);if(reason)return denied(reason);
 const building=state.buildings.find(b=>buildingKey(b)===key);if(!building||!BUILDINGS[building.type])return denied('Выбери здание на карте или в списке');
 if(building.reedCamp)return denied('Тростниковый шалаш — временное укрытие');
 if(building.construction)return denied('Сначала заверши текущую стройку: тест не меняет её грузы');
 if(building.type==='canal')return denied('Канал имеет один уровень');
 if(levelOf(building)>=3)return denied('Достигнут третий уровень');
 // A zero-cost explicit order uses the normal completion hooks. No reserved
 // materials, in-flight cargo or builders are fabricated by this test action.
 building.construction=createOrder({},levelOf(building)+1,'upgrade');building.construction.work=workRequired(building);finishConstruction(state);syncCitizens(state);syncSacredUnlocks(state);
 note(state,`Мгновенно улучшено: ${buildingDefinition(state,building.type).name}, уровень ${building.level}.`);return {ok:true,key,level:building.level};
}

export function killTestCitizens(state,idsOrCount=5){
 const reason=testToolsReason(state);if(reason)return denied(reason);
 const citizens=state.citizens||[],ids=Array.isArray(idsOrCount)?idsOrCount:Number.isSafeInteger(idsOrCount)&&idsOrCount>0?citizens.slice(0,idsOrCount).map(c=>c.id):null;
 if(!ids?.length||new Set(ids).size!==ids.length||ids.some(id=>!Number.isSafeInteger(id)||!citizens.some(c=>c.id===id)))return denied('Выбери живого жителя или целое число умерших');
 if(ids.length>1000)return denied('За один тест можно проводить не больше 1000 умерших');
 if(!Array.isArray(idsOrCount)&&ids.length!==idsOrCount||ids.length>=citizens.length)return denied('Оставь хотя бы одного жителя для похорон');
 // Recovery can refuse a stranded load. Probe the whole batch first so a bad
 // selection cannot return some residents’ cargo and only then fail midway.
 const trial=structuredClone(state);for(const id of ids)if(recoverCitizenCargo(trial,id)===false)return denied('Сначала верни груз жителя на доступный склад');
 const victims=ids.map(id=>citizens.find(c=>c.id===id)),deceased=victims.map(c=>({id:c.id,name:displayName(state,c).slice(0,100),x:c.x,y:c.y}));
 for(const id of ids)recoverCitizenCargo(state,id);
 mournResidents(state,ids);for(const c of victims)recordLifeDeath(state,c,'unknown');
 const removed=new Set(ids);state.citizens=citizens.filter(c=>!removed.has(c.id));state.population=state.citizens.length;state.deaths+=ids.length;syncCitizens(state);startFuneral(state,deceased);snapshotLifeAnalytics(state);
 note(state,`Тест похорон: умерло жителей — ${ids.length}. Их грузы возвращены владельцам запасов.`);return {ok:true,ids:[...ids],count:ids.length};
}
