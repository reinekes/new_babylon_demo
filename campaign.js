import {floodPhase} from './river-flood.js';
import {waterNameEvidence} from './causal-facts.js';
import {earnedResultNames} from './divinity.js';
import {familyMemorialsAt} from './life-analytics.js';
import {cityCommandReason} from './city-command-lock.js';
import {buildingKey,isOperational} from './definitions.js';
import {homeMealFood} from './households.js';
import {isStrictSumer} from './scenario-profiles.js';
import {mealRation} from './wellbeing.js';
import {waterpointCanReach,waterSummary} from './water.js';
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

export function waterEndingOffer(s){
 if(!usesCampaign(s)||s.waterEnding||s.lost||s.event||s.funeral||cityCommandReason(s)||floodPhase(s)==='active')return null;
 const shelter=s.arrivalHospitality?.shelters?.[0],facts=s.causalFacts;
 if(!shelter||!facts?.waterWitnesses?.length)return null;
 const occupied=new Set(s.citizens.filter(c=>!c.floodShelter).map(c=>c.home));
 const live=new Map(s.buildings.filter(b=>b.waterEntityId&&isOperational(b)&&!b.floodDamage).map(b=>[b.waterEntityId,b]));
 const receipts=[...facts.water,...facts.waterWitnesses];
 for(const first of receipts){
  const station=live.get(first.stationId);
  if(station?.type!=='waterpoint'||!live.has(first.homeId)||!occupied.has(first.home)||!waterpointCanReach(s,first.station,first.home))continue;
  const second=receipts.find(row=>row.stationId===first.stationId&&row.homeId!==first.homeId&&row.home!==first.home&&live.has(row.homeId)&&occupied.has(row.home)&&waterpointCanReach(s,row.station,row.home));
  if(!second)continue;
  const deliveries=[first,second].map(({home,homeId,courierId,time,amount})=>({home,homeId,courierId,time,amount}));
  return {station:first.station,stationId:first.stationId,shelter:{...shelter},deliveries};
 }
 return null;
}

export function recordWaterEnding(s){
 const offer=waterEndingOffer(s);
 if(!offer)return {ok:false,reason:'Нужны помощь при разливе и подтверждённые доставки из действующего общего водозабора'};
 s.waterEnding={...offer,at:s.simTime};
 s.news.unshift({title:'Бог общей воды',text:'Дворы пережили разлив, помогая друг другу. Общий водозабор принят в летопись.',kind:'good',year:s.year,season:s.season,tick:s.tick});
 s.news=s.news.slice(0,80);
 return {ok:true};
}

export function validateWaterEnding(s){
 const ending=s.waterEnding;
 if(ending===undefined)return true;
 const entity=id=>Number.isSafeInteger(id)&&id>=1&&id<s.causalFacts?.nextEntityId;
 const point=key=>{
  if(typeof key!=='string'||!/^\d+,\d+$/.test(key))return false;
  const [x,y]=key.split(',').map(Number);
  return x<worldWidth(s)&&y<worldHeight(s);
 };
 if(!usesCampaign(s)||!ending||Object.keys(ending).length!==5||!Number.isFinite(ending.at)||ending.at<0||ending.at>s.simTime||
  !entity(ending.stationId)||!point(ending.station)||!Array.isArray(ending.deliveries)||ending.deliveries.length!==2)return false;
 const shelter=ending.shelter;
 if(!shelter||Object.keys(shelter).length!==3||shelter.at>ending.at||
  !s.arrivalHospitality?.shelters?.some(row=>row.at===shelter.at&&row.origin===shelter.origin&&row.host===shelter.host))return false;
 const valid=row=>row&&Object.keys(row).length===5&&entity(row.homeId)&&row.homeId!==ending.stationId&&point(row.home)&&row.home!==ending.station&&
  Number.isSafeInteger(row.courierId)&&row.courierId>=0&&row.courierId<s.demography.nextId&&
  Number.isFinite(row.time)&&row.time>=0&&row.time<=ending.at&&Number.isFinite(row.amount)&&row.amount>0&&row.amount<=12;
 const [a,b]=ending.deliveries;
 return valid(a)&&valid(b)&&a.homeId!==b.homeId&&a.home!==b.home;
}

function completedTimberContract(s,visit){
 return s.tradeContracts?.find(q=>q.status==='fulfilled'&&(visit===undefined||q.visit===visit)&&
  s.trade?.deliveries.some(row=>row.id===q.deliveryId&&row.resource==='wood'&&row.amount===q.wood&&row.delivered>=row.amount));
}

export function craftEndingOffer(s){
 if(!usesCampaign(s)||s.craftEnding||s.lost||s.event||s.funeral||cityCommandReason(s))return null;
 const archive=s.causalFacts;
 if(!archive?.craftSuccession?.length&&!archive?.craft?.length)return null;
 const contract=completedTimberContract(s);
 if(!contract)return null;
 const builders=new Map(s.citizens.filter(c=>c.role==='builder'&&c.calling==='builder'&&!c.pendingRole&&c.builderSkill?.level===3).map(c=>[c.id,c]));
 const people=new Map((s.lifeAnalytics?.people||[]).map(c=>[c.id,c]));
 const lesson=[...(archive.craftSuccession||[]),...(archive.craft||[])].find(f=>{
  const pupil=builders.get(f.pupilId),mentor=people.get(f.mentorId);
  return pupil&&mentor&&pupil.generation>mentor.generation;
 });
 return lesson?{pupilId:lesson.pupilId,mentorId:lesson.mentorId,site:[...lesson.site],trainedAt:lesson.time,visit:contract.visit}:null;
}

export function recordCraftEnding(s){
 const offer=craftEndingOffer(s);
 if(!offer)return {ok:false,reason:'Нужны работающий ученик следующего поколения и полученный лес по исполненному договору'};
 s.craftEnding={...offer,at:s.simTime};
 s.news.unshift({title:'Бог мастерства',text:'Ученик продолжил дело наставника. Город выполнил договор и принял лес.',kind:'good',year:s.year,season:s.season,tick:s.tick});
 s.news=s.news.slice(0,80);
 return {ok:true};
}

export function validateCraftEnding(s){
 const ending=s.craftEnding;
 if(ending===undefined)return true;
 if(!usesCampaign(s)||!ending||Object.keys(ending).length!==6||!Number.isSafeInteger(ending.visit)||
  !Number.isFinite(ending.at)||ending.at>s.simTime||!Number.isFinite(ending.trainedAt)||ending.trainedAt<0||ending.trainedAt>ending.at||
  !Array.isArray(ending.site)||ending.site.length!==2||!ending.site.every((n,i)=>Number.isFinite(n)&&n>=-.5&&n<=(i===0?worldWidth(s):worldHeight(s))-.5))return false;
 const people=s.lifeAnalytics?.people||[];
 const pupil=people.find(c=>c.id===ending.pupilId),mentor=people.find(c=>c.id===ending.mentorId);
 return !!pupil&&!!mentor&&pupil.generation>mentor.generation&&!!completedTimberContract(s,ending.visit);
}
