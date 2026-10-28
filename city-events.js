import {affectResidents} from './wellbeing.js';
import {availableFood} from './food-planning.js';
import {syncInventory} from './inventory.js';
import {RESOURCE_NAMES} from './definitions.js';

// Narrative decisions are game abstractions, distinct from workshop production.
export const CITY_EVENTS=Object.freeze([
 {id:'festival',name:'Ночь огней',title:'Ночь тысячи огней',text:'Подготовь общинный пир: 15 престижа, 12 еды и 6 напитков. Носильщики доставят угощение к храму; сытые взрослые соберутся после ужина.',acceptLabel:'Подготовить праздник',skipLabel:'Сохранить запасы',music:'nightLights',effectId:'blessing'},
 {id:'caravan',name:'Торговые гости',title:'Караван у переправы',text:'Гости предлагают 25 глины и 20 тростника за 35 еды.',acceptLabel:'Обменять еду',skipLabel:'Отказаться от обмена',music:'grown',effectId:'abundance'},
 {id:'refugees',name:'Новые семьи',title:'Люди у городских ворот',text:'Прими до шести жителей за 20 еды — если для них найдётся жильё.',acceptLabel:'Принять людей',skipLabel:'Сохранить запасы',music:'grown',effectId:'newLife'},
 {id:'riverGift',name:'Дар разлива',title:'Река оставила дары',text:'После малой воды на берегу остались тростник и пригодная глина. Собрать их: +24 тростника, +12 глины и +3 престижа.',acceptLabel:'Собрать дары берега',skipLabel:'Оставить берег в покое',cost:{},gain:{reed:24,clay:12,prestige:3},music:'grown',effectId:'rain'},
 {id:'potterVisit',name:'Странствующий гончар',title:'Мастер с соседнего берега',text:'Гончар предлагает шесть новых сосудов в обмен на 12 еды. Обмен принесёт ещё 4 престижа.',acceptLabel:'Обменять 12 еды',skipLabel:'Проводить мастера',cost:{food:12},gain:{pottery:6,prestige:4},music:'nightLights',effectId:'craft'},
 {id:'wellRepair',name:'Забота об источнике',title:'Община чистит водозабор',text:'Выдели 8 еды и 6 тростника для общего дня у воды. Участие поднимет настроение на 4 и здоровье на 3.',acceptLabel:'Поддержать общину',skipLabel:'Отложить сбор',cost:{food:8,reed:6},gain:{},residents:{mood:4,health:3},music:'night',effectId:'rain'},
 {id:'harvestThanks',name:'Благодарность за урожай',title:'Колосья у порога',text:'Семьи предлагают разделить 8 еды и 2 напитка. Настроение +8, личная вера +3, престиж +6.',acceptLabel:'Разделить угощение',skipLabel:'Сберечь припасы',cost:{food:8,beer:2},gain:{prestige:6},residents:{mood:8,faith:3},music:'nightLights',effectId:'abundance'},
 {id:'storyteller',name:'Певец у вечернего огня',title:'История, которую запомнят',text:'Угости гостя 6 едой. Его вечерняя песня поднимет настроение жителей на 5 и принесёт 4 престижа.',acceptLabel:'Угостить певца',skipLabel:'Пожелать доброго пути',cost:{food:6},gain:{prestige:4},residents:{mood:5},music:'nightLights',effectId:'blessing'}
]);
export const cityEventDefinition=id=>CITY_EVENTS.find(e=>e.id===id)||null;
export const createCityEvent=(_s,id)=>{const d=cityEventDefinition(id);return d?{id:d.id,title:d.title,text:d.text}:null;};
export const isAdditionalCityEvent=id=>!!cityEventDefinition(id)?.cost;
export function cityEventReason(s,id=s.event?.id){
 const d=cityEventDefinition(id);if(!d?.cost)return '';
 syncInventory(s);
 for(const [key,amount]of Object.entries(d.cost))if((key==='food'?availableFood(s):s.resources[key]||0)<amount)return `Нужно ${amount} ${RESOURCE_NAMES[key]||key}`;
 return '';
}
export function applyCityEvent(s,id,choice){
 const d=cityEventDefinition(id);if(!d?.cost||!['accept','skip'].includes(choice))return {ok:false,reason:'Нет такого решения'};
 if(choice==='skip')return {ok:true};const reason=cityEventReason(s,id);if(reason)return {ok:false,reason};
 for(const [key,amount]of Object.entries(d.cost))s.resources[key]-=amount;
 for(const [key,amount]of Object.entries(d.gain))s.resources[key]=Math.min(1e9,(s.resources[key]||0)+amount);
 if(d.residents)affectResidents(s,d.residents);syncInventory(s);return {ok:true};
}
