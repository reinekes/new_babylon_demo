import {ABUNDANCE_HOMES,abundanceReserveReady} from './abundance-discovery.js';
import {giftAmount} from './abundance-origin.js';
import {creatorMaterialsView} from './creator-materials.js';
import {buildingInputRoom} from './building-inventory.js';
import {stockStores,storeCapacity} from './inventory.js';
import {WIND_DELIVERY_GOAL,WIND_DESTINATION_GOAL,windKnowledgeReason} from './wind-delivery.js';
import {fieldCalendar} from './crop-calendar.js';
import {buildingKey,isOperational} from './definitions.js';
import {worldHeight,worldWidth} from './world.js';

export const REVELATION_BRANCHES={
 rain:{label:'Небесный дождь',action:'Собери ячмень с этого поля: урожай, выросший на воде из канала, откроет первый призыв дождя.'},
 cat:{label:'Кошка — дар бога',action:'Вдохнови этого жителя рыбаком. Он уже доставил три собственных улова и может начать историю кошки.'},
 richCatch:{label:'Богатый улов',action:'Дай этому вдохновлённому рыбаку продолжить лов в его дворе. Следующий улов приблизит открытие дара.'},
 fertility:{label:'Дыхание земли',action:'Дождись приёмки зерна, которое этот житель везёт в хранилище. В грузе есть урожай, нужный для открытия дара.'},
 inspiration:{label:'Руки творца',action:'Дождись приёмки отмеченного местного материала, который несёт этот житель. Он пополнит счётчик дара.'},
 haste:{label:'Попутный ветер',action:'Дождись, пока этот носильщик сдаст отмеченный груз мастерской в месте назначения.'},
 abundance:{label:'Изобилие',action:'Дождись, пока этот житель принесёт обычную еду в указанный дом. Запас на семена и ужин уже защищён.'},
 sunlight:{label:'Золотое сияние',action:'Дай жрецу закончить рабочий цикл в этом святилище. Это подтвердит служение для «Золотого сияния».'}
};
export const REVELATION_PRICE=15;

const eligible=c=>c.age>=16&&c.health>0&&!c.floodShelter&&!c.pendingRole;
const delivering=c=>['toStore','toDistrictStore','unloading'].includes(c.phase);
const production=(c,calling)=>c.calling===calling&&c.role==='production';
const room=(b,resource)=>b&&(b.stock?.[resource]||0)<storeCapacity(b);

function receivingCheck(s){
 const stores=new Set(stockStores(s)),jobs=new Map((s.district?.jobs||[]).map(job=>[job.id,job]));
 return (c,b,resource,job=jobs.get(c.districtJob))=>!!b&&c.cargo?.[resource]>1e-8&&
  (job?.targetKind==='input'||job&&!stores.has(b)?buildingInputRoom(s,b,resource)>1e-8:stores.has(b)&&room(b,resource));
}

function candidateFinder(s,branch,sites){
 const at=(key,...types)=>{
  const b=sites.get(key);
  return b&&(!types.length||types.includes(b.type))?b:null;
 };
 if(branch==='rain'&&s.rainDiscovery&&!s.irrigatedHarvest)return c=>{
  if(!production(c,'farmer'))return null;
  const b=at(c.workplace||c.work,'field'),crop=b?.crop;
  return crop?.legacyYear===undefined&&crop?.sown===1&&crop.growth>=1-1e-8&&crop.canalGrowth>0&&crop.remaining>0&&
   s.season===fieldCalendar(s,b).harvest?b:null;
 };
 if(branch==='sunlight'&&s.sunlightChapter&&!s.sunlightService)return c=>production(c,'priest')?at(c.workplace,'shrine','ziggurat'):null;
 if(branch==='cat'&&s.catDiscovery?.phase==='learning'&&s.godhood?.stage==='recognized'&&
  !s.citizens.some(c=>c.id===s.catDiscovery.firstCallingId))return c=>
  c.calling!=='fisher'&&s.catFishing?.lessons?.[c.id]===3?at(c.workplace||c.work,'fishing'):null;
 if(branch==='richCatch'&&s.richCatchEvidence&&s.richCatchEvidence.fisher===undefined)return c=>
  production(c,'fisher')?at(c.workplace||c.work,'fishing'):null;
 if(branch==='fertility'&&s.earthDiscovery&&s.earthDiscovery.qualifiedAt==null){
  const fields=new Map([...sites.values()].filter(b=>b.type==='field'&&b.grainFieldId!==undefined).map(b=>[b.grainFieldId,b]));
  const stores=new Set(stockStores(s));
  return c=>{
   const mark=c.fieldGrain,field=fields.get(mark?.fieldId),target=at(c.store);
   if(!delivering(c)||!field||!stores.has(target)||!room(target,'food')||mark.amount<=1e-8||c.districtJob&&s.district.jobs.some(j=>j.id===c.districtJob&&j.targetKind==='input'))return null;
   const prior=s.earthDiscovery.receipts.find(r=>r.fieldId===mark.fieldId);
   return !prior||mark.inspired&&!prior.inspired?target:null;
  };
 }
 if(branch==='inspiration'&&s.creatorMaterials){
  const progress=creatorMaterialsView(s),canReceive=receivingCheck(s);
  return c=>{
   const mark=c.creatorCargo,target=at(c.store);
   return delivering(c)&&mark?.amount>1e-8&&!mark.stocked&&progress[mark.resource]<progress.required[mark.resource]&&canReceive(c,target,mark.resource)?target:null;
  };
 }
 if(branch==='haste'&&s.windDelivery&&windKnowledgeReason(s)){
  const progress=s.windDelivery,canReceive=receivingCheck(s),jobs=new Map((s.district?.jobs||[]).map(job=>[job.id,job]));
  return c=>{
   const job=jobs.get(c.districtJob),target=at(c.store);
   if(!delivering(c)||c.calling!=='carrier'||!(c.windCargo>1e-8)||!target||job?.target!==c.store||!canReceive(c,target,job.resource,job))return null;
   return progress.amount<WIND_DELIVERY_GOAL||progress.destinations.length<WIND_DESTINATION_GOAL&&!progress.destinations.includes(job.target)||
    !progress.path&&['road','bridge'].includes(c.windRoute)?target:null;
  };
 }
 if(branch==='abundance'&&s.abundanceDiscovery?.homes.length<ABUNDANCE_HOMES&&abundanceReserveReady(s)){
  const homes=s.abundanceDiscovery.homes,occupied=new Set(s.citizens.map(c=>c.home));
  return c=>{
   const key=c.pantryTarget||c.home,home=at(key,'house'),source=at(c.store);
   if(c.phase!=='toPantryHome'||!home||homes.includes(key)||!occupied.has(key)||
    !(c.pantryFood-giftAmount(c.giftPantry)>1e-8)||!source?.stock||
    source.stock.food+1e-8<(source.stockMinimum?.food??(source.type==='depot'?12*(source.level||1):0)))return null;
   const trained=['carrier','farmer'].includes(c.calling);
   const keeper=s.godhood?.believerIds?.includes(c.id)&&['granary','depot','shrine'].includes(source.type)&&
    (c.work===c.store||c.workplace===c.store);
   return homes.length<ABUNDANCE_HOMES-1||trained||keeper?home:null;
  };
 }
 return null;
}

function findCandidate(s,branch,note){
 const sites=new Map(s.buildings.filter(isOperational).map(b=>[buildingKey(b),b]));
 const findPlace=candidateFinder(s,branch,sites);
 if(!findPlace)return null;
 for(const person of s.citizens){
  if(!eligible(person)||note&&person.id!==note.citizenId)continue;
  const place=findPlace(person);
  if(place&&(!note||place.x===note.x&&place.y===note.y))return {person,place};
 }
 return null;
}

export function revelationAdviceQuote(s,branch){
 if(branch==='prestige')return {ok:true};
 if(!Object.hasOwn(REVELATION_BRANCHES,branch))return {ok:false,reason:'Выбери ветвь или только престиж'};
 const match=findCandidate(s,branch);
 if(!match)return {ok:false,reason:'Для этой ветви сейчас нет адресного совета. Можно выбрать другую ветвь или только +12 престижа.'};
 const {person,place}=match;
 return {ok:true,note:{branch,citizenId:person.id,x:place.x,y:place.y,time:s.simTime}};
}

export function revelationAdviceView(s){
 const note=s.revelationEvidence?.advice;
 if(!note)return null;
 const {branch}=note;
 const match=findCandidate(s,branch,note);
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
