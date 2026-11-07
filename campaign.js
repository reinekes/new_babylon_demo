import {cityCommandReason} from './city-command-lock.js';
import {buildingKey,isOperational} from './definitions.js';
import {homeMealFood} from './households.js';
import {isStrictSumer} from './scenario-profiles.js';
import {mealRation} from './wellbeing.js';
import {waterSummary} from './water.js';
import {worldWidth,worldHeight} from './world.js';

const usesCampaign=s=>isStrictSumer(s)&&s.godhood?.mode==='awakening';

export function hearthEndingOffer(s){
 if(!usesCampaign(s)||s.hearthEnding||s.lost||s.event||s.funeral||cityCommandReason(s))return null;
 const people=s.lifeAnalytics?.people||[];
 if(!Number.isFinite(s.godhood.firstWaterHelp?.deliveredAt))return null;
 const residents=new Map(s.citizens.map(c=>[c.id,c]));
 const dead=new Set(people.filter(p=>p.diedTick!==null).map(p=>p.id));
 for(const p of people){
  if(!p.waterStory||!dead.has(p.waterStory.tellerId))continue;
  const listener=residents.get(p.id);
  if(!listener||listener.floodShelter)continue;
  const home=s.buildings.find(b=>b.type==='house'&&isOperational(b)&&buildingKey(b)===listener.home);
  if(!home)continue;
  const family=s.citizens.filter(c=>c.home===listener.home&&!c.floodShelter);
  const water=waterSummary(s,home);
  if(family.length<2||homeMealFood(home)+1e-7<family.reduce((n,c)=>n+mealRation(c),0)||water.stock+1e-7<water.demand)continue;
  return {listenerId:p.id,tellerId:p.waterStory.tellerId,home:listener.home};
 }
 return null;
}

export function recordHearthEnding(s){
 const offer=hearthEndingOffer(s);
 if(!offer)return {ok:false,reason:'Для финала нужна живая семейная память и обеспеченный двор'};
 s.hearthEnding={...offer,at:s.simTime};
 s.news.unshift({title:'Бог очагов',text:'Семья сохранила рассказ о первой помощи. Город продолжает жить.',kind:'good',year:s.year,season:s.season,tick:s.tick});
 s.news=s.news.slice(0,80);
 return {ok:true};
}

export function validateHearthEnding(s){
 const ending=s.hearthEnding;
 if(ending===undefined)return true;
 if(!usesCampaign(s)||!ending||Object.keys(ending).length!==4||!Number.isFinite(ending.at)||ending.at>s.simTime||
  typeof ending.home!=='string'||!/^\d+,\d+$/.test(ending.home))return false;
 const [x,y]=ending.home.split(',').map(Number);
 if(x>=worldWidth(s)||y>=worldHeight(s))return false;
 const listener=s.lifeAnalytics?.people.find(p=>p.id===ending.listenerId),teller=s.lifeAnalytics?.people.find(p=>p.id===ending.tellerId);
 return !!listener?.waterStory&&!!teller&&teller.diedTick!==null&&listener.waterStory.tellerId===teller.id&&ending.at>=listener.waterStory.time;
}
