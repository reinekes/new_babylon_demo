import {DAY_SECONDS} from './city-life.js';
import {cityCommandReason} from './city-command-lock.js';
import {BUILDINGS,buildingKey,capacityOf,isOperational} from './definitions.js';
import {build,canBuild} from './engine.js';
import {stockStores} from './inventory.js';
import {floodFootprint,floodPhase} from './river-flood.js';
import {isStrictSumer} from './scenario-profiles.js';
import {networkFor} from './workforce.js';

const refuse=reason=>({ok:false,reason});
const homeKey=/^\d+,\d+$/;

function components(s){
 const network=networkFor(s);
 return new Map(network.ports.filter(p=>!p.building.siteKey).map(p=>[buildingKey(p.building),network.components.get(p.key)]));
}

export function householdInitiative(s,source){
 if(!isStrictSumer(s)||source?.type!=='house'||!isOperational(source)||!s.buildings.includes(source))return refuse('Нужен жилой двор Южного Шумера');
 const sourceKey=buildingKey(source),residents=s.citizens.filter(c=>c.home===sourceKey);
 if(!residents.length)return refuse('Во дворе пока никто не живёт');
 const occupied=new Set(s.citizens.map(c=>c.home)),byId=new Map(s.citizens.map(c=>[c.id,c]));
 const inProgress=new Set(s.buildings.flatMap(b=>b.householdInitiative&&!b.householdInitiative.settled?b.householdInitiative.members:[]));
 const families=residents.flatMap(c=>{
  const partner=byId.get(c.partner);
  if(c.age<16||!partner||partner.age<16||c.floodShelter||partner.floodShelter)return [];
  const split=c.home!==partner.home;
  const crowded=residents.some(other=>other!==c&&other!==partner&&other.partner!==null&&byId.get(other.partner)?.home===sourceKey);
  if(!split&&(!crowded||c.id>partner.id))return [];
  const mother=c.sex==='f'?c:partner;
  const family=[c,partner,...s.citizens.filter(child=>child.age<16&&child.parents.includes(mother.id))];
  if(family.length>4||family.some(member=>member.floodShelter||inProgress.has(member.id)))return [];
  return [family];
 });
 if(!families.length)return refuse('Новый двор нужен паре, которая живёт порознь или делит дом с другой семьёй');
 const current=components({...s,roads:[...s.roads]}),district=current.get(sourceKey);
 const family=families.find(group=>district!==undefined&&group.every(c=>current.get(c.home)===district));
 if(!family)return refuse('Между домами семьи нет сухого пути');
 if(s.buildings.some(b=>capacityOf(b)>=family.length&&!occupied.has(buildingKey(b))&&current.get(buildingKey(b))===district))return refuse('Семья может занять свободный дом в этом квартале');
 const flooded=floodPhase(s)==='active'?floodFootprint(s,s.riverFlood):null;
 let reason='Рядом нет свободного участка с проходом к семье и складу';
 for(let ring=1;ring<=3;ring++)for(let dx=-ring;dx<=ring;dx++){
  const dy=ring-Math.abs(dx);
  for(const offset of dy?[-dy,dy]:[0]){
   const x=source.x+dx,y=source.y+offset,key=buildingKey({x,y});
   if(flooded?.has(key)||s.roads.some(r=>[r.a,r.b].some(p=>p.x===x&&p.y===y)))continue;
   const blocked=canBuild(s,'house',x,y,true,0,{householdInitiative:true});
   if(blocked)continue;
   const site={type:'house',x,y,level:1,starterHut:true};
   const preview=components({...s,buildings:[...s.buildings,site],roads:[...s.roads]}),group=preview.get(key);
   if(group===undefined||family.some(c=>preview.get(c.home)!==group))continue;
   const stores=stockStores(s).filter(b=>preview.get(buildingKey(b))===group);
   if(!stores.length)continue;
   if(['clay','reed'].some(k=>stores.reduce((sum,b)=>sum+(b.stock?.[k]||0),0)+1e-8<BUILDINGS.house[k])){
    reason='На доступных складах мало глины или тростника';
    continue;
   }
   return {ok:true,x,y,members:family.map(c=>c.id),source:sourceKey,eligibleStores:new Set(stores.map(buildingKey)),cost:BUILDINGS.house};
  }
 }
 return refuse(reason);
}

export function approveHouseholdInitiative(s,source,offer){
 const now=householdInitiative(s,source);
 if(!now.ok)return now;
 if(!offer?.ok||offer.x!==now.x||offer.y!==now.y||offer.source!==now.source||offer.members.join()!==now.members.join())return refuse('Условия изменились. Открой предложение заново');
 return startHouseholdInitiative(s,now);
}

function startHouseholdInitiative(s,offer,autonomous=false){
 const project={source:offer.source,members:offer.members,startedAt:s.simTime,...autonomous?{autonomous:true}:{}};
 const result=build(s,'house',offer.x,offer.y,0,{eligibleStores:offer.eligibleStores,householdInitiative:project});
 if(result.ok&&autonomous){
  s.news.unshift({title:'Семья начала строить малый двор',text:`Семья из двора ${offer.source} зарезервировала материалы для участка ${offer.x}, ${offer.y}.`,kind:'build',year:s.year,season:s.season,tick:s.tick});
  s.news=s.news.slice(0,80);
 }
 return result.ok?{ok:true,key:buildingKey(offer)}:result;
}

export function setAutonomousHousing(s,enabled){
 if(!isStrictSumer(s)||typeof enabled!=='boolean')return refuse('Настройка доступна в Южном Шумере');
 const reason=cityCommandReason(s);
 if(reason)return refuse(reason);
 if(!enabled&&!s.householdBuildingPolicy)return {ok:true};
 s.householdBuildingPolicy??={enabled:false,lastDay:-1};
 s.householdBuildingPolicy.enabled=enabled;
 return {ok:true};
}

const housingDay=s=>Math.floor((s.simTime+1e-8)/DAY_SECONDS);
export function autonomousHousingBoundary(s){
 return s.householdBuildingPolicy?.enabled?(housingDay(s)+1)*DAY_SECONDS-s.simTime:Infinity;
}

export function advanceAutonomousHousing(s){
 const policy=s.householdBuildingPolicy;
 if(!policy?.enabled||!isStrictSumer(s)||s.event||s.funeral||s.lost||cityCommandReason(s))return;
 const day=housingDay(s);
 if(policy.lastDay===day)return;
 policy.lastDay=day;
 if(s.buildings.some(b=>b.householdInitiative&&b.construction?.kind==='new')||
  s.resources.clay<BUILDINGS.house.clay||s.resources.reed<BUILDINGS.house.reed)return;
 for(const home of s.buildings){
  if(home.type!=='house'||!isOperational(home))continue;
  const offer=householdInitiative(s,home);
  if(offer.ok&&startHouseholdInitiative(s,offer,true).ok)return;
 }
}

export function validateHouseholdInitiatives(s){
 const policy=s.householdBuildingPolicy;
 if(policy!==undefined&&(!isStrictSumer(s)||!policy||Object.keys(policy).length!==2||typeof policy.enabled!=='boolean'||
  !Number.isSafeInteger(policy.lastDay)||policy.lastDay< -1||policy.lastDay>housingDay(s)))return false;
 return s.buildings.every(b=>{
  const p=b.householdInitiative;
  if(p===undefined)return true;
  return isStrictSumer(s)&&b.type==='house'&&b.starterHut===true&&p&&typeof p.source==='string'&&homeKey.test(p.source)&&p.source!==buildingKey(b)&&
   Array.isArray(p.members)&&p.members.length>=2&&p.members.length<=4&&new Set(p.members).size===p.members.length&&
   (p.autonomous===undefined||p.autonomous===true&&policy!==undefined)&&(p.settled===undefined||p.settled===true&&isOperational(b))&&p.members.every(id=>Number.isSafeInteger(id)&&id>=0&&id<s.demography.nextId)&&Number.isFinite(p.startedAt)&&p.startedAt>=0&&p.startedAt<=s.simTime;
 });
}
