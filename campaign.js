import {waterNameEvidence} from './causal-facts.js';
import {earnedResultNames} from './divinity.js';
import {familyMemorialsAt} from './life-analytics.js';
import {cityCommandReason} from './city-command-lock.js';
import {buildingKey,isOperational} from './definitions.js';
import {homeMealFood} from './households.js';
import {isStrictSumer} from './scenario-profiles.js';
import {mealRation} from './wellbeing.js';
import {waterSummary} from './water.js';
import {worldWidth,worldHeight} from './world.js';

const usesCampaign=s=>isStrictSumer(s)&&s.godhood?.mode==='awakening';

const CHAPTERS=[
 {title:'Неуслышанный',condition:'Дождись, пока первый житель откликнется на знак или поможет соседям.'},
 {title:'I · Чаша у порога',condition:'Добейся подтверждённого результата для двух независимых дворов.'},
 {title:'II · Имя двора',condition:'Доставь воду из общего водозабора в разные дворы и дай укрытие соседям при разливе.'},
 {title:'III · Покровитель квартала',condition:'Передай семейную память следующему поколению и исполни обет снабжения.'},
 {title:'IV · Бог города',condition:'Прими дар паломника и дождись, пока хранитель внесёт его в память храма.'},
 {title:'V · Имя за рекой',condition:'Гость принёс дар, и его сохранили в храмовой памяти.'}
];

function inheritedMemory(s){
 const people=s.lifeAnalytics?.people||[];
 if(people.some(p=>p.waterStory))return true;
 const followers=new Set(s.godhood.believerIds);
 const descendants=s.citizens.filter(c=>c.parents?.some(id=>followers.has(id)));
 if(!descendants.length)return false;
 const homes=new Map(s.buildings.filter(b=>b.type==='house'&&isOperational(b)).map(b=>[buildingKey(b),b]));
 return descendants.some(c=>{
  const home=homes.get(c.home);
  return home&&familyMemorialsAt(s,home).some(p=>c.parents.includes(p.id)&&followers.has(p.id));
 });
}

export function advanceCampaignChapter(s){
 if(!usesCampaign(s)||s.lost||s.godhood.namelessEndingAt!==undefined)return false;
 const start=s.campaignChapter||0;
 let rank=start;
 if(rank===0&&Number.isFinite(s.godhood.recognitionAt))rank++;
 if(rank===1&&earnedResultNames(s).length)rank++;
 if(rank===2&&s.causalFacts?.water?.length&&waterNameEvidence(s)&&s.arrivalHospitality?.shelters?.length)rank++;
 if(rank===3&&s.supplyVows?.history?.some(v=>v.outcome==='fulfilled')&&inheritedMemory(s))rank++;
 if(rank===4&&s.votiveOfferings?.some(item=>item.visitorKind==='pilgrim'&&Number.isSafeInteger(item.receivedTick)&&item.memory))rank++;
 if(rank===start)return false;
 s.campaignChapter=rank;
 return true;
}

export function campaignChapterView(s){
 if(!usesCampaign(s))return null;
 const rank=s.campaignChapter||0;
 return {rank,title:CHAPTERS[rank].title,condition:CHAPTERS[rank].condition};
}

export function validateCampaignChapter(s){
 const rank=s.campaignChapter;
 return rank===undefined||usesCampaign(s)&&Number.isSafeInteger(rank)&&rank>=1&&rank<CHAPTERS.length&&Number.isFinite(s.godhood.recognitionAt);
}

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
