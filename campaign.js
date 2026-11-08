import {vowNameEvidence} from './supply-vow.js';
import {isMemoryKeeper,isVotiveTemple} from './votive-offerings.js';
import {floodPhase} from './river-flood.js';
import {matchesCraftEndingLesson,matchesProjectWaterReceipt,waterNameEvidence} from './causal-facts.js';
import {earnedResultNames,RESULT_NAMES} from './divinity.js';
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
 {title:'IV · Бог города',condition:'Прими и запиши дар паломника. Дождись вести от купцов из следующего визита.'},
 {title:'V · Имя за рекой',condition:'Купцы подтвердили, что паломник хранит имя в своём городе.'}
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
 if(rank===4&&s.foreignName?.reportedAt!=null)rank++;
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
 return valid(a)&&valid(b)&&a.homeId!==b.homeId&&a.home!==b.home&&
  ending.deliveries.every(row=>matchesProjectWaterReceipt(s.causalFacts,ending.station,ending.stationId,row));
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
 s.craftEnding={...offer,at:s.simTime,version:1};
 s.news.unshift({title:'Бог мастерства',text:'Ученик продолжил дело наставника. Город выполнил договор и принял лес.',kind:'good',year:s.year,season:s.season,tick:s.tick});
 s.news=s.news.slice(0,80);
 return {ok:true};
}

export function validateCraftEnding(s){
 const ending=s.craftEnding;
 if(ending===undefined)return true;
 if(!usesCampaign(s)||!ending||Object.keys(ending).length!==(ending.version===undefined?6:7)||
  ending.version!==undefined&&ending.version!==1||!Number.isSafeInteger(ending.visit)||
  !Number.isFinite(ending.at)||ending.at>s.simTime||!Number.isFinite(ending.trainedAt)||ending.trainedAt<0||ending.trainedAt>ending.at||
  !Array.isArray(ending.site)||ending.site.length!==2||!ending.site.every((n,i)=>Number.isFinite(n)&&n>=-.5&&n<=(i===0?worldWidth(s):worldHeight(s))-.5))return false;
 const people=s.lifeAnalytics?.people||[];
 const pupil=people.find(c=>c.id===ending.pupilId),mentor=people.find(c=>c.id===ending.mentorId);
 const archive=s.causalFacts;
 const lessonExists=rows=>rows?.some(lesson=>matchesCraftEndingLesson(ending,lesson));
 return !!pupil&&!!mentor&&pupil.generation>mentor.generation&&!!completedTimberContract(s,ending.visit)&&
  (ending.version===undefined||!!(lessonExists(archive?.craftSuccession)||lessonExists(archive?.craft)));
}

export function cityEndingOffer(s){
 if(!usesCampaign(s)||s.cityEnding||s.lost||s.event||s.funeral||cityCommandReason(s)||s.godhood.stage!=='recognized')return null;
 const vows=vowNameEvidence(s),name=earnedResultNames(s).at(-1);
 if(!vows||!name||!s.divinity.names.includes(name))return null;
 const temples=s.buildings.filter(b=>isVotiveTemple(b)&&!b.floodDamage);
 for(const temple of temples){
  const key=buildingKey(temple),keeper=s.citizens.find(c=>isMemoryKeeper(c,key));
  const offering=s.votiveOfferings?.find(item=>item.temple===key&&item.memory&&item.receivedTick!==null);
  if(keeper&&offering)return {name,temple:key,keeperId:keeper.id,offeringId:offering.id,
   vows:vows.map(({vowId,target})=>({id:vowId,home:target.home}))};
 }
 return null;
}

export function recordCityEnding(s){
 const offer=cityEndingOffer(s);
 if(!offer)return {ok:false,reason:'Нужны признанное имя, работающий храм и исполненные обеты двух дворов'};
 s.cityEnding={...offer,at:s.simTime};
 s.news.unshift({title:'Бог города',text:'Храм хранит имена, а дворы помнят исполненные обещания. Город продолжает жить.',kind:'good',year:s.year,season:s.season,tick:s.tick});
 s.news=s.news.slice(0,80);
 return {ok:true};
}

export function validateCityEnding(s){
 const ending=s.cityEnding;
 if(ending===undefined)return true;
 if(!usesCampaign(s)||!ending||Object.keys(ending).length!==6||!Number.isFinite(ending.at)||ending.at<0||ending.at>s.simTime||
  !Object.values(RESULT_NAMES).includes(ending.name)||!s.divinity.names.includes(ending.name)||
  !Number.isSafeInteger(ending.keeperId)||ending.keeperId<0||ending.keeperId>=s.demography.nextId||
  !Array.isArray(ending.vows)||ending.vows.length!==2||ending.vows[0]?.home===ending.vows[1]?.home)return false;
 const offering=s.votiveOfferings?.find(item=>item.id===ending.offeringId&&item.temple===ending.temple);
 if(!offering?.memory)return false;
 const recipients=ending.vows.map(row=>{
  if(!row||Object.keys(row).length!==2)return undefined;
  const vow=s.supplyVows?.history?.find(v=>v.id===row.id&&v.outcome==='fulfilled'&&v.ended<=ending.at);
  return vow?.targets.find(target=>target.home===row.home)?.delivery?.recipient;
 });
 return recipients.every(Number.isSafeInteger)&&recipients[0]!==recipients[1];
}

function activeMonument(s){
 return s.buildings.find(b=>b.type==='ziggurat'&&isOperational(b));
}
function currentMonumentLife(s){
 const b=activeMonument(s),life=s.monumentLife;
 return b&&life&&buildingKey(b)===life.temple&&(b.built?.order??null)===life.buildOrder?life:null;
}
export function retireMonumentLife(s,b){
 const life=s.monumentLife;
 if(b.type==='ziggurat'&&life?.temple===buildingKey(b)&&(b.built?.order??null)===life.buildOrder)delete s.monumentLife;
}
export function advanceMonumentLife(s){
 if(!usesCampaign(s)||s.godhood.namelessEndingAt!==undefined||currentMonumentLife(s))return false;
 const b=activeMonument(s);
 if(!b)return false;
 s.monumentLife={temple:buildingKey(b),buildOrder:b.built?.order??null,openedAt:s.simTime,nextOfferingId:s.district.nextId,
  nextVowId:(s.supplyVows?.history.length??0)+(s.supplyVows?.active?2:1)};
 return true;
}

export function monumentLifeView(s){
 if(!usesCampaign(s))return null;
 const life=currentMonumentLife(s);
 if(!life)return null;
 return {temple:life.temple,
  dedication:!!s.votiveOfferings?.some(item=>item.id>=life.nextOfferingId&&item.temple===life.temple&&item.memory),
  vow:!!s.supplyVows?.history?.some((v,i,history)=>{
   if(v.outcome!=='fulfilled')return false;
   const original=v.previous==null?v:history[i-1];
   return original?.start>=life.openedAt&&(life.nextVowId===undefined||original.id>=life.nextVowId);
  })};
}

export function validateMonumentLife(s){
 const life=s.monumentLife;
 if(life===undefined)return true;
 if(!usesCampaign(s)||!life||Object.keys(life).length!==(life.nextVowId===undefined?4:5)||typeof life.temple!=='string'||!/^\d+,\d+$/.test(life.temple)||
  !Number.isFinite(life.openedAt)||life.openedAt<0||life.openedAt>s.simTime||
  !Number.isSafeInteger(life.nextOfferingId)||life.nextOfferingId<1||life.nextOfferingId>s.district?.nextId||
  life.buildOrder!==null&&(!Number.isSafeInteger(life.buildOrder)||life.buildOrder<0))return false;
 if(life.nextVowId!==undefined&&(!Number.isSafeInteger(life.nextVowId)||life.nextVowId<1||
  life.nextVowId>(s.supplyVows?.history.length??0)+(s.supplyVows?.active?2:1)))return false;
 const [x,y]=life.temple.split(',').map(Number);
 return x<worldWidth(s)&&y<worldHeight(s);
}

function pilgrimDedication(s){
 const guest=s.externalVisits?.pilgrim;
 if(guest?.phase!=='departed'||guest.outcome!=='accepted')return null;
 return s.votiveOfferings?.find(item=>item.id===guest.offeringId&&item.visitorKind==='pilgrim'&&item.memory)||null;
}

export function advanceForeignName(s){
 if(!usesCampaign(s)||s.lost||s.godhood.namelessEndingAt!==undefined)return false;
 const guest=s.externalVisits?.pilgrim,caravan=s.trade?.caravan,visit=s.trade?.visits;
 if(!guest||caravan?.phase!=='trading'||caravan.name!==guest.partner||!Number.isSafeInteger(visit)||visit<1)return false;
 const witness=s.foreignName;
 if(witness){
  if(witness.reportedAt!==null||visit<=witness.sentVisit||witness.partner!==undefined&&witness.partner!==caravan.name)return false;
  witness.reportedVisit=visit;
  witness.reportedAt=s.simTime;
  return true;
 }
 const item=pilgrimDedication(s);
 if(!item||s.godhood.recognitionAt===null||!s.divinity.names.includes(s.name))return false;
 s.foreignName={name:s.name,offeringId:item.id,partner:caravan.name,sentVisit:visit,sentAt:s.simTime,reportedVisit:null,reportedAt:null,endingAt:null};
 return true;
}

export function foreignEndingOffer(s){
 const witness=s.foreignName;
 return usesCampaign(s)&&!s.lost&&!s.event&&!s.funeral&&!cityCommandReason(s)&&
  witness?.reportedAt!=null&&witness.endingAt===null?witness:null;
}

export function recordForeignEnding(s){
 const witness=foreignEndingOffer(s);
 if(!witness)return {ok:false,reason:'Нужна весть о посвящении от купцов из следующего визита'};
 witness.endingAt=s.simTime;
 s.news.unshift({title:'Имя за рекой',text:'Купцы привезли весть: паломник хранит имя в своём городе. Долина продолжает жить.',kind:'good',year:s.year,season:s.season,tick:s.tick});
 s.news=s.news.slice(0,80);
 return {ok:true};
}

export function validateForeignName(s){
 const witness=s.foreignName;
 if(witness===undefined)return true;
 const visit=n=>Number.isSafeInteger(n)&&n>=1&&n<=s.trade?.visits;
 const time=n=>Number.isFinite(n)&&n>=0&&n<=s.simTime;
 if(!usesCampaign(s)||!witness||Object.keys(witness).length!==(witness.partner===undefined?7:8)||
  typeof witness.name!=='string'||!s.divinity.names.includes(witness.name)||pilgrimDedication(s)?.id!==witness.offeringId||
  !visit(witness.sentVisit)||!time(witness.sentAt)||s.godhood.recognitionAt===null||witness.sentAt<s.godhood.recognitionAt)return false;
 const partner=s.externalVisits.pilgrim.partner;
 if(witness.partner!==undefined&&witness.partner!==partner)return false;
 const {caravan,visits}=s.trade;
 if(caravan&&(visits===witness.sentVisit||visits===witness.reportedVisit)&&caravan.name!==partner)return false;
 if(witness.reportedAt===null)return witness.reportedVisit===null&&witness.endingAt===null;
 return visit(witness.reportedVisit)&&witness.reportedVisit>witness.sentVisit&&time(witness.reportedAt)&&witness.reportedAt>=witness.sentAt&&
  (witness.endingAt===null||time(witness.endingAt)&&witness.endingAt>=witness.reportedAt);
}
