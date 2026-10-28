import {BUILDINGS,MATERIALS,RESOURCE_NAMES,buildingKey,levelOf} from './definitions.js';
import {stockStores,syncInventory,putStock} from './inventory.js';
import {relicCommandReason} from './city-command-lock.js';
import {syncCitizens,recoverCitizenCargo} from './workforce.js';
import {createOrder,workRequired,finishConstruction} from './construction.js';
import {syncSacredUnlocks} from './sacred-unlocks.js';
import {mournResidents} from './wellbeing.js';
import {recordLifeDeath,snapshotLifeAnalytics} from './life-analytics.js';
import {displayName} from './citizen-epithets.js';
import {startFuneral} from './funerals.js';
import {CITY_EVENTS,createCityEvent} from './city-events.js';

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

// Explicit player-invoked testing aid. It never runs on load or on a clock.
export function grantTestResources(state,key='all'){
 const reason=testToolsReason(state);if(reason)return denied(reason);
 if(key!=='all'&&!Object.hasOwn(RESOURCE_NAMES,key))return denied('Неизвестный ресурс');
 const store=stockStores(state)[0];if(!store)return {ok:false,reason:'Нет места для тестовых запасов'};
 syncInventory(state);const added={};
 for(const resource of key==='all'?Object.keys(RESOURCE_NAMES):[key]){
  const amount=Math.min(1000,Math.max(0,1e9-state.resources[resource]));
  if(MATERIALS.includes(resource))added[resource]=putStock(state,buildingKey(store),resource,amount,{overflow:true});
  else{state.resources[resource]+=amount;added[resource]=amount;}
 }
 return {ok:true,added};
}

export function instantTestUpgrade(state,key){
 const reason=testToolsReason(state);if(reason)return denied(reason);
 const building=state.buildings.find(b=>buildingKey(b)===key);if(!building||!BUILDINGS[building.type])return denied('Выбери здание на карте или в списке');
 if(building.construction)return denied('Сначала заверши текущую стройку: тест не меняет её грузы');
 if(building.type==='canal')return denied('Канал имеет один уровень');
 if(levelOf(building)>=3)return denied('Достигнут третий уровень');
 // A zero-cost explicit order uses the normal completion hooks. No reserved
 // materials, in-flight cargo or builders are fabricated by this test action.
 building.construction=createOrder({},levelOf(building)+1,'upgrade');building.construction.work=workRequired(building);finishConstruction(state);syncCitizens(state);syncSacredUnlocks(state);
 note(state,`Мгновенно улучшено: ${BUILDINGS[building.type].name}, уровень ${building.level}.`);return {ok:true,key,level:building.level};
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
