import {cityCommandReason} from './city-command-lock.js';
import {mealCycle} from './wellbeing.js';
import {recordCraftNameEvidence} from './causal-facts.js';
import {advanceStarObservations,starKnowledgeReason} from './star-observations.js';
import {peaceKnowledgeReason} from './peace-discovery.js';
import {arrivalKnowledgeReason} from './arrival-hospitality.js';
import {shapingModelReason} from './shaping-model.js';
import {recordShapingProject} from './shaping-projects.js';
import {advanceRevelationEvidence,recordRevelationFact,recordRevelationTraining,revelationKnowledgeReason} from './revelation-evidence.js';
import {sunlightKnowledgeReason} from './sunlight-gathering.js';
import {abundanceKnowledgeReason} from './abundance-discovery.js';
import {windKnowledgeReason} from './wind-delivery.js';
import {recordCreatorInspiration,creatorReady} from './creator-materials.js';
import {richCatchKnowledgeReason} from './rich-catch.js';
import {CITY_STAGE_POPULATION,monumentChapterReason} from './monument-chapter.js';
import {dispatchNeighborWater,neighborWaterRoute} from './water.js';
import {isStrictSumer,usesCatDiscovery} from './scenario-profiles.js';
import {preparedFisherInspiration} from './miracle-discovery.js';
import {buildingKey,isCityFortification,isOperational} from './definitions.js';
import {networkFor,routeBetween,invalidateAssignments} from './workforce.js';
import {navigationSegmentClear} from './navigation.js';
import {isDryPoint,worldWidth,worldHeight} from './world.js';
import {footprintSize} from './footprints.js';
const BASIC=new Set(['house','clay','reed','field','garden','fishing','hunting','waterpoint','bridge','canal','brickyard','granary','sheepfold']);
const MONUMENTS=new Set(['shrine','ziggurat','ishtarGate','harbor']);
const cargo=c=>!!c.memorialMove||Object.values(c.cargo||{}).some(n=>n>0)||Object.values(c.buildCargo||{}).some(n=>n>0);
export const gameMode=s=>s.godhood?.mode||'legacy';
export const isAwakening=s=>gameMode(s)==='awakening';
export const isMatureGod=s=>gameMode(s)==='mature';
export const knowsPresence=(s,c)=>!isAwakening(s)||s.godhood.believerIds.includes(typeof c==='object'?c?.id:c);
export const builderLevel=c=>c?.builderSkill?.level||1;
export const PRACTICE_PER_PROJECT=8;
export const builderExperience=skill=>(skill?.projects||0)+Math.floor(((skill?.practice||0)+1e-8)/PRACTICE_PER_PROJECT);
const levelFor=skill=>builderExperience(skill)>=5?3:builderExperience(skill)>=2?2:1;
const canTeachOrLearn=(s,c)=>c.age>=16&&c.role==='builder'&&!c.pendingRole&&c.calling==='builder'&&knowsPresence(s,c);
export function builderTeachingPair(s,people){
 if(!isAwakening(s))return null;
 const builders=people.filter(c=>canTeachOrLearn(s,c));
 if(builders.length!==2||builderLevel(builders[0])===builderLevel(builders[1]))return null;
 const [mentor,pupil]=builders.sort((a,b)=>builderLevel(b)-builderLevel(a));
 return {mentor,pupil};
}
export function builderTeachingCandidates(s,network){
 if(!isAwakening(s))return [];
 const homes=new Map(network.ports.map(port=>[buildingKey(port.building),network.components.get(port.key)]));
 const builders=s.citizens.filter(c=>canTeachOrLearn(s,c)&&!c.site&&!c.clinic&&!c.floodShelter&&homes.get(c.home)!==undefined)
  .sort((a,b)=>builderLevel(b)-builderLevel(a)||a.id-b.id);
 const mentors=new Map(),pairs=[];
 for(const builder of builders){
  const component=homes.get(builder.home),mentor=mentors.get(component);
  if(!mentor)mentors.set(component,builder);
  else if(builderLevel(mentor)>builderLevel(builder))pairs.push({mentor,pupil:builder});
 }
 return pairs;
}
export function addBuilderPractice(c,amount,maxLevel){
 if(builderLevel(c)>=maxLevel)return;
 const skill=c.builderSkill??={level:1,projects:0};
 const ceiling=((maxLevel===3?5:2)-skill.projects)*PRACTICE_PER_PROJECT;
 skill.practice=Math.min(ceiling,(skill.practice||0)+amount);
 skill.level=levelFor(skill);
}
export function applyBuilderInstruction(s,contributions,room=Infinity,site=null){
 const total=contributions.reduce((n,{work})=>n+work,0);
 const pair=contributions.length===2&&builderTeachingPair(s,contributions.map(({c})=>c));
 if(!pair||room<=0)return Math.min(total,room);
 const shared=Math.min(...contributions.map(({work})=>work));
 const effective=total-shared*.5;
 const practice=shared*Math.min(1,room/effective);
 recordRevelationTraining(s,site,pair,practice);
 addBuilderPractice(pair.pupil,practice,builderLevel(pair.mentor));
 if(builderLevel(pair.pupil)===3)recordCraftNameEvidence(s,site,pair);
 return Math.min(effective,room);
}
export const knowledgeTier=(type,level=1)=>Math.max(level,MONUMENTS.has(type)?3:BASIC.has(type)||type==='road'?1:2);
export function initializeGodhood(s,{mode}={}){
 if(mode===undefined||s.godhood)return;
 if(!['awakening','mature'].includes(mode))throw Error('Неизвестный режим игры');
 s.godhood={version:1,mode,stage:mode==='awakening'?'unseen':'recognized',witnessId:null,believerIds:[],firstBuilderGift:false,completedProjects:[],signTarget:null,signOrigin:null,recognitionAt:null};
 if(mode==='awakening'){s.resources.faith=0;s.resources.prestige=0;s.name='Незримый дух';s.divinity.names=[];for(const c of s.citizens)c.faith=0;}
 else{s.resources.faith=1000;s.resources.prestige=250;s.name='Покровитель долины';}
}
export function godhoodView(s){
 const g=s.godhood;if(!g)return {mode:'legacy',stage:'recognized',builderLevel:3,believers:s.citizens.length};
 const mature=isMatureGod(s),builders=s.citizens.filter(c=>c.age>=16&&c.role==='builder'&&c.calling==='builder'&&knowsPresence(s,c));
 return {...g,signTarget:g.signTarget?{...g.signTarget}:null,signOrigin:g.signOrigin?{...g.signOrigin}:null,believerIds:[...g.believerIds],completedProjects:[...g.completedProjects],builderLevel:mature?3:Math.max(0,...builders.map(builderLevel)),believers:mature?s.citizens.length:g.believerIds.filter(id=>s.citizens.some(c=>c.id===id)).length};
}

export function buildingKnowledgeReason(s,type,level=1){
 if(['bakery','linenYard','dairyStore','basketry'].includes(type)&&!isStrictSumer(s))return 'Постройка доступна в Южном Шумере';
 if(type==='ziggurat'&&level===1){const reason=monumentChapterReason(s);if(reason)return reason;}
 if(isCityFortification(type)){
  if(!isStrictSumer(s))return 'Городские стены доступны в Южном Шумере';
  if(s.population<CITY_STAGE_POPULATION)return `Городские стены открываются при ${CITY_STAGE_POPULATION} жителях`;
 }
 if(!isAwakening(s))return '';
 const g=s.godhood;if(g.stage!=='recognized')return 'Сначала заяви о присутствии: нужен первый свидетель';
 const required=knowledgeTier(type,level),master=s.citizens.some(c=>c.age>=16&&c.calling==='builder'&&c.role==='builder'&&knowsPresence(s,c)&&builderLevel(c)>=required);
 return master?'':`Нужен вдохновлённый строитель ${['','I','II','III'][required]} уровня`;
}
export function miracleKnowledgeReason(s,id){
 if(s.godhood?.namelessEndingAt!==undefined)return cityCommandReason(s);
 if(id==='inannaProtection'&&s.inannaDiscovery)return '';
 if(id==='relicAwakening'&&s.depthSupply||id==='earthMemory'&&s.landMemoryChapter===1)return '';
 if(id==='stars'&&s.starObservations)return starKnowledgeReason(s);
 if(id==='peace'&&s.peaceDiscovery)return peaceKnowledgeReason(s);
 if(id==='healing'&&s.arrivalHospitality)return arrivalKnowledgeReason(s);
 if(id==='shaping'&&s.shapingProjects)return shapingModelReason(s);
 if(id==='revelation'&&s.revelationEvidence)return revelationKnowledgeReason(s);
 if(id==='sunlight'&&s.sunlightChapter)return sunlightKnowledgeReason(s);
 if(id==='abundance'&&s.abundanceDiscovery)return abundanceKnowledgeReason(s);
 if(id==='haste'&&s.windDelivery)return windKnowledgeReason(s);
 if(id==='richCatch')return richCatchKnowledgeReason(s);
 if(id==='inspiration'&&s.creatorMaterials)return creatorReady(s)?'':'Нужно доставить 30 местной глины и 20 тростника, использовать две постройки и вдохновить обоих добытчиков';
 if(id==='fertility'&&s.earthDiscovery)return s.earthDiscovery.qualifiedAt==null?'Нужна доставка урожая с трёх полей, включая урожай вдохновлённого земледельца':'';
 if(id==='rain'&&s.rainDiscovery)return s.irrigatedHarvest?'':'Нужна жатва вдохновлённого земледельца на поле, выросшем с водой из канала';
 if(id==='cat'&&usesCatDiscovery(s))return s.catDiscovery?.phase==='opened'?'':'Дар кошки откроется через историю рыбака';if(!isAwakening(s))return '';if(s.godhood.stage!=='recognized')return 'Пока никто не признал твоё присутствие';const need=['rain','bless','peace'].includes(id)?1:['inannaProtection','relicAwakening','earthMemory'].includes(id)?3:2;return godhoodView(s).builderLevel>=need?'':`Чудо откроется с мастером ${['','I','II','III'][need]} уровня`;}
export function godhoodInspirationReason(s,c,profession){if(!isAwakening(s))return '';if(s.godhood.stage!=='recognized')return 'Сначала помоги первому человеку заметить присутствие бога';if(!knowsPresence(s,c)&&!preparedFisherInspiration(s,c,profession))return 'Этот человек ещё не признал присутствие бога: помоги ему увидеть дело общины';return '';}
export function firstBuilderInspiration(s,c,profession){return isAwakening(s)&&profession==='builder'&&s.godhood.stage==='recognized'&&!s.godhood.firstBuilderGift&&s.godhood.witnessId===c.id;}
export function acceptGodhoodInspiration(s,c,profession){if(!s.godhood||!isAwakening(s))return;recordCreatorInspiration(s,profession);if(profession==='builder'){c.builderSkill??={level:1,projects:0};if(c.id===s.godhood.witnessId)s.godhood.firstBuilderGift=true;}}
export function canLeadConstruction(s,c,b){return !isAwakening(s)||c&&c.age>=16&&(b.type==='house'&&b.householdInitiative&&b.construction?.kind==='new'||c.calling==='builder'&&c.role==='builder'&&knowsPresence(s,c)&&builderLevel(c)>=knowledgeTier(b.type,b.construction?.kind==='repair'?1:b.construction?.target||b.level||1));}
export function recordBuilderCompletion(s,b){
 if(!isAwakening(s)||b.householdInitiative&&b.construction?.kind==='new')return false;
 const q=b.construction;if(!q||!['new','upgrade'].includes(q.kind)||!Number.isFinite(q.work)||![1,2,3].includes(q.target)||q.work+1e-8<(b.type==='road'?6:12)*q.target||Object.entries(q.required||{}).some(([k,n])=>(q.delivered?.[k]||0)<n))return false;
 const g=s.godhood,key=buildingKey(b),stamp=`${key}:${q.target}`;
 const seen=g.completedProjects.includes(stamp);
 if(seen&&(!s.shapingProjects||q.kind!=='new'||b.type==='road'))return false;
 // An assigned traveller has not performed this project's work yet.
 const ports=networkFor(s).ports,onsite=c=>{const port=b.type==='road'?b.a:ports.find(p=>p.building.siteKey?`site:${p.building.siteKey}:${p.building.side}`===c.sitePort:buildingKey(p.building)===c.sitePort);if(port)return Math.hypot(c.x-port.x,c.y-port.y)<.05;const n=footprintSize(b),dx=Math.max(b.x-.5-c.x,0,c.x-(b.x+n-.5)),dy=Math.max(b.y-.5-c.y,0,c.y-(b.y+n-.5));return Math.hypot(dx,dy)<.05;};
 const workers=s.citizens.filter(c=>c.site===key&&c.siteDuty==='builder'&&c.phase==='constructing'&&onsite(c)&&canLeadConstruction(s,c,b));
 if(!workers.length)return false;
 recordShapingProject(s,b,workers);
 if(seen)return false;
 g.completedProjects.push(stamp);
 recordRevelationFact(s,'building',workers[0],b.type==='road'?b.a:b);
 for(const c of workers){c.builderSkill??={level:1,projects:0};c.builderSkill.projects++;c.builderSkill.level=levelFor(c.builderSkill);}
 for(const c of s.citizens.filter(c=>c.age>=16&&!g.believerIds.includes(c.id)&&(c.site===key||Math.hypot(c.x-b.x,c.y-b.y)<3)).slice(0,2)){g.believerIds.push(c.id);c.faith=Math.max(c.faith,55);s.resources.faith+=1;}
 return true;
}
function loseSign(s,c){
 const g=s.godhood;
 if(c?.phase==='awakening'){const visited=(c.route||[]).slice(0,c.routeIndex).reverse();c.route=visited.length?[{x:c.x,y:c.y},...visited.map(p=>({x:p.x,y:p.y}))]:[];c.routeIndex=c.route.length?1:0;c.phase=c.route.length?'toHome':'blocked';}
 g.stage='unseen';g.witnessId=null;g.signTarget=null;g.signOrigin=null;invalidateAssignments(s);
}
function reconcileWitness(s){
 if(!isAwakening(s)||s.godhood.stage!=='recognized')return;
 if(!s.citizens.some(c=>s.godhood.believerIds.includes(c.id)))loseSign(s);
}
export function namelessEndingReason(s){
 const g=s.godhood;
 if(!isStrictSumer(s)||!isAwakening(s)||g.recognitionAt===null||g.stage!=='unseen'||g.namelessEndingAt!==undefined||s.lost||!s.citizens.length)return 'Для этого финала нужен живой город, утративший связь с богом';
 const lock=cityCommandReason(s);
 if(lock||s.event||s.funeral)return lock||'Дождись завершения события';
 const living=new Set(s.citizens.map(c=>c.id));
 if(g.believerIds.some(id=>living.has(id)))return 'В городе ещё есть последователи';
 if(s.foreignName?.reportedAt!=null)return 'Имя ещё помнят за пределами города';
 const help=g.firstWaterHelp,facts=s.causalFacts;
 const memories=[
  [help?.helperId,help?.recipientId],
  ...(s.lifeAnalytics?.people||[]).filter(c=>c.waterStory).map(c=>[c.id]),
  ...(facts?.water||[]).map(f=>[f.requesterId,f.organizerId,f.courierId]),
  ...(facts?.waterWitnesses||[]).map(f=>[f.recipientId,f.courierId]),
  ...(facts?.healing||[]).map(f=>[f.patientId,f.healerId]),
  ...(facts?.harvest||[]).map(f=>[f.recipientId,f.farmerId]),
  ...[...(facts?.craft||[]),...(facts?.craftSuccession||[])].map(f=>[f.pupilId,f.mentorId]),
  ...(s.arrivalHospitality?.welcomes||[]).map(f=>[f.host,...f.members]),
  ...(s.supplyVows?.history||[]).flatMap(v=>v.targets.map(t=>[...t.residents,t.delivery?.witness])),
  ...(s.supplyVows?.active?.targets||[]).map(t=>[...t.residents,t.delivery?.witness])
 ];
 return memories.some(ids=>ids.some(id=>living.has(id)))?'У жителей ещё есть память об этом имени':'';
}

export function recordNamelessEnding(s){
 const reason=namelessEndingReason(s);
 if(reason)return {ok:false,reason};
 s.godhood.namelessEndingAt=s.simTime;
 s.news.unshift({title:'Город жил дальше без этого имени',text:'Последователей и живых носителей памяти больше нет. Дворы продолжают жить.',kind:'info',year:s.year,season:s.season,tick:s.tick});
 s.news=s.news.slice(0,80);
 return {ok:true};
}

const samePoint=(a,b)=>a&&b&&Math.hypot(a.x-b.x,a.y-b.y)<1e-6;
function clearSignSegment(s,c,a,b,first=false){
 // Founders begin inside their own home; the first step is its real doorway.
 const view=first?{...s,buildings:s.buildings.filter(b=>buildingKey(b)!==c.home)}:s;
 return navigationSegmentClear(view,a,b);
}
function signPathValid(s,c,g){
 const route=c?.route;if(!Array.isArray(route)||route.length<2||route.length>worldWidth(s)*worldHeight(s)*2||!Number.isInteger(c.routeIndex)||c.routeIndex<1||c.routeIndex>route.length||!samePoint(route[0],g.signOrigin)||!samePoint(route.at(-1),g.signTarget))return false;
 return route.every((p,i)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-.5&&p.x<=worldWidth(s)-.5&&p.y>=-.5&&p.y<=worldHeight(s)-.5&&(!i||clearSignSegment(s,c,route[i-1],p,i===1)));
}

function signRoute(s,c){
 const net=networkFor(s),home=net.ports.find(p=>buildingKey(p.building)===c.home),target=s.relicQuest?.site?.shore;if(!home||!target)return null;
 const goal=[...net.nodes.values()].filter(n=>Math.hypot(n.x-target.x,n.y-target.y)<.8).sort((a,b)=>Math.hypot(a.x-target.x,a.y-target.y)-Math.hypot(b.x-target.x,b.y-target.y)).find(n=>net.components.get(n.key)===net.components.get(home.key));
 const route=goal&&routeBetween(s,home.key,goal.key),points=route?.length?[{x:c.x,y:c.y},...route.map(n=>({x:n.x,y:n.y}))]:null;return points&&points.every((p,i)=>!i||clearSignSegment(s,c,points[i-1],p,i===1))?points:null;
}
const isRecoverySign=s=>isStrictSumer(s)&&s.godhood.recognitionAt!==null;
function homeSignRoute(s,c){
 const home=networkFor(s).ports.find(p=>p.building.type==='house'&&buildingKey(p.building)===c.home);
 const origin={x:c.x,y:c.y};
 if(!home||!isDryPoint(s,home.x,home.y)||!clearSignSegment(s,c,origin,home,true))return null;
 return [origin,{x:home.x,y:home.y}];
}
export function beginFirstSign(s,id){
 reconcileWitness(s);const g=s.godhood;if(!isAwakening(s)||g.stage!=='unseen')return {ok:false,reason:'Первый знак уже подан'};
 const lock=cityCommandReason(s);
 if(lock||s.lost||s.funeral||s.event)return {ok:false,reason:lock||'Дождись завершения события'};
 const recovery=isRecoverySign(s);
 let chosen=null,route=null;
 for(const c of s.citizens){
  if((id!==undefined&&c.id!==id)||c.age<16||c.health<60||c.site||cargo(c)||c.waterTrip||c.clinic||c.pantryTrip)continue;
  if(recovery?(c.floodShelter||!['home','resting'].includes(c.phase)):(c.workplace||!['home','resting','blocked'].includes(c.phase)))continue;
  const path=recovery?homeSignRoute(s,c):signRoute(s,c);
  if(path){chosen=c;route=path;break;}
 }
 if(!chosen)return {ok:false,reason:recovery?'Дождись здорового взрослого дома. Для знака нужен сухой выход из двора.':'Пусть здоровый свободный взрослый вернётся домой; нужен доступный берег'};
 g.stage='sign';g.witnessId=chosen.id;g.signTarget={...route.at(-1)};g.signOrigin={x:chosen.x,y:chosen.y};chosen.phase='awakening';chosen.route=route;chosen.routeIndex=1;chosen.work=null;chosen.site=null;invalidateAssignments(s);return {ok:true,citizenId:chosen.id,recovery};
}
export function firstWaterHelpChoices(s){
 if(!isStrictSumer(s)||!isAwakening(s)||s.godhood.stage!=='unseen'||s.godhood.recognitionAt!==null||s.lost||s.funeral||s.event)return [];
 const homes=new Map(s.buildings.filter(b=>b.type==='house'&&isOperational(b)).map(b=>[buildingKey(b),b]));
 const residents=new Map();
 for(const c of s.citizens)if(homes.has(c.home)&&!c.floodShelter&&!residents.has(c.home))residents.set(c.home,c);
 const choices=[];
 for(const [home,recipient] of residents){
  let helpers=0;
  for(const c of s.citizens){
   if(!neighborWaterRoute(s,c,homes.get(home)))continue;
   choices.push({helperId:c.id,recipientId:recipient.id,home});
   if(choices.length===4)return choices;
   if(++helpers===2)break;
  }
 }
 return choices;
}
export function beginFirstWaterHelp(s,helperId,recipientId){
 reconcileWitness(s);
 const choice=firstWaterHelpChoices(s).find(c=>c.helperId===helperId&&c.recipientId===recipientId);
 if(!choice)return {ok:false,reason:'Нужен свободный взрослый и доступный соседний двор с местом для воды'};
 const c=s.citizens.find(p=>p.id===helperId),b=s.buildings.find(p=>buildingKey(p)===choice.home);
 if(!dispatchNeighborWater(s,c,b))return {ok:false,reason:'Житель пока не может отправиться за водой'};
 const g=s.godhood;
 g.stage='help';g.witnessId=helperId;g.firstWaterHelp=choice;
 invalidateAssignments(s);
 return {ok:true,citizenId:helperId};
}
export function cancelFirstWaterHelp(s,helperId){
 const g=s.godhood;
 if(g?.stage!=='help'||g.witnessId!==helperId)return;
 delete g.firstWaterHelp;loseSign(s);
}
export function confirmFirstWaterHelp(s,c,b,amount){
 const g=s.godhood,help=g?.firstWaterHelp;
 if(g?.stage!=='help'||help.helperId!==c.id||help.home!==buildingKey(b)||amount<=1e-7)return;
 if(!s.citizens.some(p=>p.id===help.recipientId&&p.home===help.home&&!p.floodShelter))return;
 help.amount=amount;help.deliveredAt=s.simTime;
 help.interpretations={helper:'sign',recipient:'neighbor'};
 recognizeWitness(s,c,'помог соседям и доставил воду');
}
function recognizeWitness(s,c,action){
 const g=s.godhood,first=g.recognitionAt===null;
 g.stage='recognized';
 if(first)g.recognitionAt=s.simTime||0;
 if(!g.believerIds.includes(c.id))g.believerIds.push(c.id);
 if(first)s.resources.faith+=1;
 c.faith=Math.max(c.faith,65);
 if(first){s.name='Услышанный у воды';if(!s.divinity.names.includes(s.name))s.divinity.names.push(s.name);}
 invalidateAssignments(s);
 s.news.unshift({title:first?'Первый, кто услышал':'Новое свидетельство',text:`Житель ${c.id+1} ${action}. ${first?'Теперь он признаёт твоё присутствие: +1 вера.':'Он признаёт твоё присутствие; первая награда уже была получена.'} Вдохнови его строителем.`,kind:'good',year:s.year,season:s.season,tick:s.tick});s.news=s.news.slice(0,80);
}
export function advanceGodhood(s,dt){
 if(!isAwakening(s)||!Number.isFinite(dt)||dt<=0)return;reconcileWitness(s);const g=s.godhood;
 if(g.stage==='help'){
  const help=g.firstWaterHelp;
  if(!s.citizens.some(c=>c.id===help.helperId&&c.waterTrip?.target===help.home)||
   !s.citizens.some(c=>c.id===help.recipientId&&c.home===help.home&&!c.floodShelter))cancelFirstWaterHelp(s,help.helperId);
  return;
 }
 if(g.stage==='recognized'){advanceRevelationEvidence(s);advanceStarObservations(s);return;}
 if(g.stage!=='sign')return;
 const c=s.citizens.find(c=>c.id===g.witnessId);
 if(!c||c.phase!=='awakening'||s.funeral||cargo(c)||!signPathValid(s,c,g)){loseSign(s,c);return;}
 let left=dt;while(left>1e-8&&c.routeIndex<c.route.length){const p=c.route[c.routeIndex],d=Math.hypot(c.x-p.x,c.y-p.y);if(!clearSignSegment(s,c,c,p,c.routeIndex===1)){loseSign(s,c);return;}const moved=Math.min(d,left*.95);if(d>1e-8){c.x+=(p.x-c.x)*moved/d;c.y+=(p.y-c.y)*moved/d;}left-=moved/.95;if(d<=moved+1e-8)c.routeIndex++;else break;}
 if(c.routeIndex<c.route.length)return;if(!samePoint(c,g.signTarget)){loseSign(s,c);return;}
 const route=[...c.route].reverse();c.phase='toHome';c.route=route;c.routeIndex=1;
 recognizeWitness(s,c,isRecoverySign(s)?'откликнулся на знак':'заметил знак и дошёл до источника');
}

export function godhoodCitizenView(s,c){return c.phase==='awakening'?{walking:c.routeIndex<c.route.length,controlled:false}:{};}
function validProjectStamp(value,s){
 if(typeof value!=='string'||value.length>128)return false;
 const match=/^(.*):([123])$/.exec(value);if(!match)return false;const key=match[1],building=/^(\d+),(\d+)$/.exec(key);
 if(building)return Number(building[1])<worldWidth(s)&&Number(building[2])<worldHeight(s);
 const road=/^road:(\d+),(\d+)\|(\d+),(\d+)$/.exec(key);if(!road)return false;
 const [x,y,u,v]=road.slice(1).map(Number);return Math.max(x,u)<=worldWidth(s)&&Math.max(y,v)<=worldHeight(s)&&Math.abs(x-u)+Math.abs(y-v)===1;
}
export function validateGodhood(s){
 const g=s.godhood;if(g===undefined)return !(s.citizens||[]).some(c=>c.phase==='awakening');
 const id=n=>Number.isSafeInteger(n)&&n>=0&&n<s.demography.nextId,point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-.5&&p.x<=worldWidth(s)-.5&&p.y>=-.5&&p.y<=worldHeight(s)-.5&&isDryPoint(s,p.x,p.y);
 if(!g||typeof g!=='object'||Array.isArray(g)||g.version!==1||!['awakening','mature'].includes(g.mode)||!['unseen','sign','help','recognized'].includes(g.stage)||!Array.isArray(g.believerIds)||new Set(g.believerIds).size!==g.believerIds.length||g.believerIds.some(n=>!id(n))||typeof g.firstBuilderGift!=='boolean'||!Array.isArray(g.completedProjects)||g.completedProjects.length>10000||new Set(g.completedProjects).size!==g.completedProjects.length||g.completedProjects.some(v=>!validProjectStamp(v,s)))return false;
 if(g.witnessId!==null&&!id(g.witnessId)||g.recognitionAt!==null&&(!Number.isFinite(g.recognitionAt)||g.recognitionAt<0||g.recognitionAt>(s.simTime||0)+.1))return false;
 if(g.signTarget!==null&&!point(g.signTarget)||g.signOrigin!==null&&!point(g.signOrigin))return false;
 if(g.namelessEndingAt!==undefined&&(!isStrictSumer(s)||g.mode!=='awakening'||g.stage!=='unseen'||g.recognitionAt===null||
  !Number.isFinite(g.namelessEndingAt)||g.namelessEndingAt<g.recognitionAt||g.namelessEndingAt>s.simTime||
  s.citizens.some(c=>g.believerIds.includes(c.id))))return false;
 const cycle=n=>Number.isSafeInteger(n)&&n>=-1&&n<=mealCycle(s.simTime);
 if(g.lastPrayerCycle!==undefined&&(!isStrictSumer(s)||g.mode!=='awakening'||g.recognitionAt===null||!cycle(g.lastPrayerCycle)))return false;
 if(g.smallWaterResponse!==undefined){
  const r=g.smallWaterResponse;
  if(!isStrictSumer(s)||g.mode!=='awakening'||g.recognitionAt===null||!r||Object.keys(r).length!==4||!cycle(r.cycle)||!id(r.requesterId)||!id(r.helperId)||r.requesterId===r.helperId||typeof r.home!=='string'||!/^\d+,\d+$/.test(r.home))return false;
  const [x,y]=r.home.split(',').map(Number);
  if(x>=worldWidth(s)||y>=worldHeight(s))return false;
 }
 const help=g.firstWaterHelp;
 if(help!==undefined){
  if(!isStrictSumer(s)||g.mode!=='awakening'||!help||!id(help.helperId)||!id(help.recipientId)||help.helperId===help.recipientId||typeof help.home!=='string'||!/^\d+,\d+$/.test(help.home))return false;
  if(g.stage==='help'){
   if(!s.citizens.some(c=>c.id===help.helperId&&c.waterTrip?.target===help.home)||g.witnessId!==help.helperId||g.signTarget!==null||g.signOrigin!==null||help.amount!==undefined||help.deliveredAt!==undefined||help.interpretations!==undefined)return false;
  }else if(!Number.isFinite(help.amount)||help.amount<=0||help.amount>6||!Number.isFinite(help.deliveredAt)||help.deliveredAt<0||help.deliveredAt>s.simTime||g.recognitionAt===null||help.deliveredAt<g.recognitionAt)return false;
  const views=help.interpretations;
  if(views!==undefined&&(!views||views.helper!=='sign'||views.recipient!=='neighbor'||Object.keys(views).length!==2))return false;
 }else if(g.stage==='help')return false;
 if(g.mode==='mature'&&(g.stage!=='recognized'||g.witnessId!==null||g.signTarget!==null||g.signOrigin!==null||g.recognitionAt!==null||g.believerIds.length||g.firstBuilderGift||g.completedProjects.length))return false;
 if(g.mode==='awakening'){
  if(g.stage==='unseen'&&(g.witnessId!==null||g.signTarget!==null||g.signOrigin!==null))return false;
  if(g.stage==='recognized'&&(g.witnessId===null||g.recognitionAt===null||!g.believerIds.includes(g.witnessId)))return false;
  if(g.recognitionAt===null&&(g.believerIds.length||g.firstBuilderGift||g.completedProjects.length))return false;
  if(g.stage==='sign'){const c=s.citizens.find(c=>c.id===g.witnessId);if(!point(g.signTarget)||!point(g.signOrigin)||!c||c.age<16||c.phase!=='awakening'||cargo(c)||!signPathValid(s,c,g))return false;}
 }
 if(s.citizens.some(c=>c.phase==='awakening'&&(g.mode!=='awakening'||g.stage!=='sign'||c.id!==g.witnessId)))return false;
 return s.citizens.every(c=>c.builderSkill===undefined||c.builderSkill&&typeof c.builderSkill==='object'&&!Array.isArray(c.builderSkill)&&Number.isInteger(c.builderSkill.projects)&&c.builderSkill.projects>=0&&c.builderSkill.projects<=10000&&(c.builderSkill.practice===undefined||Number.isFinite(c.builderSkill.practice)&&c.builderSkill.practice>=0&&c.builderSkill.practice<=5*PRACTICE_PER_PROJECT)&&c.builderSkill.level===levelFor(c.builderSkill));
}
