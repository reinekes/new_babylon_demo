import {fieldCalendar} from './crop-calendar.js';
import {buildingKey,isOperational} from './definitions.js';
import {worldHeight,worldWidth} from './world.js';

export const REVELATION_BRANCHES={
 rain:{label:'Небесный дождь',action:'Собери ячмень с этого поля: урожай, выросший на воде из канала, откроет первый призыв дождя.'},
 sunlight:{label:'Золотое сияние',action:'Дай жрецу закончить рабочий цикл в этом святилище. Это подтвердит служение для «Золотого сияния».'}
};
export const REVELATION_PRICE=15;

function candidates(s,branch){
 const matches=branch==='rain'&&s.rainDiscovery&&!s.irrigatedHarvest?b=>{
  const c=b.crop;
  return b.type==='field'&&s.season===fieldCalendar(s,b).harvest&&c?.legacyYear===undefined&&c?.sown===1&&c.growth>=1-1e-8&&c.canalGrowth>0&&c.remaining>0;
 }:branch==='sunlight'&&s.sunlightChapter&&!s.sunlightService?b=>['shrine','ziggurat'].includes(b.type):null;
 if(!matches)return [];
 const sites=new Map(s.buildings.filter(b=>isOperational(b)&&matches(b)).map(b=>[buildingKey(b),b]));
 const calling=branch==='rain'?'farmer':'priest';
 return s.citizens.filter(c=>c.age>=16&&c.health>0&&!c.floodShelter&&c.calling===calling&&c.role==='production')
  .map(person=>({person,place:sites.get(branch==='sunlight'?person.workplace:person.workplace||person.work)}))
  .filter(row=>row.place);
}

export function revelationAdviceQuote(s,branch){
 if(branch==='prestige')return {ok:true};
 if(!Object.hasOwn(REVELATION_BRANCHES,branch))return {ok:false,reason:'Выбери ветвь или только престиж'};
 const match=candidates(s,branch)[0];
 if(!match)return {ok:false,reason:'Для этой ветви сейчас нет адресного совета. Можно выбрать другую ветвь или только +12 престижа.'};
 const {person,place}=match;
 return {ok:true,note:{branch,citizenId:person.id,x:place.x,y:place.y,time:s.simTime}};
}

export function revelationAdviceView(s){
 const note=s.revelationEvidence?.advice;
 if(!note)return null;
 const {branch,citizenId,x,y}=note;
 const match=candidates(s,branch).find(({person,place})=>person.id===citizenId&&place.x===x&&place.y===y);
 return {note,...match,...REVELATION_BRANCHES[branch],stale:!match};
}

export function validateRevelationAdvice(s,note){
 if(note===undefined)return true;
 const opening=s.revelationEvidence.opening;
 return !!opening&&!!note&&Object.keys(note).length===5&&Object.hasOwn(REVELATION_BRANCHES,note.branch)&&
  Number.isSafeInteger(note.citizenId)&&note.citizenId>=0&&note.citizenId<s.demography.nextId&&
  Number.isInteger(note.x)&&note.x>=0&&note.x<worldWidth(s)&&Number.isInteger(note.y)&&note.y>=0&&note.y<worldHeight(s)&&
  Number.isFinite(note.time)&&note.time>=opening.time&&note.time<=s.simTime;
}
