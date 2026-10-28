import {relicControlActive,relicCommandReason} from './city-command-lock.js';
export {relicControlActive,relicCommandReason} from './city-command-lock.js';
// Unique cult objects belong to their quests, never to material freight.
import {buildingKey,isOperational} from './definitions.js';
import {networkFor,invalidateAssignments} from './workforce.js';
import {navigationSegmentClear} from './navigation.js';
import {isDryPoint,WIDTH,HEIGHT} from './world.js';
import {affectResidents} from './wellbeing.js';
import {validateFuneral} from './funerals.js';
import {startDesertFuneral} from './desert-funeral.js';
import {relicPathTo,relicSegmentClear,relicExitRoute,relicSwimming} from './relic-navigation.js';
import {cityEventDefinition} from './city-events.js';
export const RELIC_FAITH_COST=250;
export const RELIC_DIVINE_NAME='Пробуждающий глубины';
export const LAND_RELIC_DIVINE_NAME='Хранящий память земли';
const CONFIG={oasis:{stateKey:'relicQuest',title:'Знак глубин',divineName:RELIC_DIVINE_NAME,memory:'oasisRelic',miracleId:'relicAwakening',miracleName:'Пробуждение глубин'},land:{stateKey:'landRelicQuest',title:'Печать земли',divineName:LAND_RELIC_DIVINE_NAME,memory:'landRelic',miracleId:'earthMemory',miracleName:'Память земли'}};
const ACTIVE=['controlled','searching','rejoicing','carrying','celebrating','returning'],isActive=q=>ACTIVE.includes(q?.phase);
const sum=o=>Object.values(o||{}).some(v=>v>1e-8),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-.5&&p.y>=-.5&&p.x<=WIDTH-.5&&p.y<=HEIGHT-.5;
const readyTemple=b=>['shrine','ziggurat'].includes(b.type)&&isOperational(b)&&!b.construction;
const busy=c=>!!c.site||!!c.waterTrip||c.clothingTarget!==undefined||!!c.craftSite||!!c.seedField||!!c.pantryTrip||!!c.clinic||!!c.school||!!c.districtJob||!!c.saleJob||!!c.tradeJob||!!c.pendingRole||!!c.workplace||!!c.guardPost||sum(c.cargo)||sum(c.buildCargo)||c.pantryFood>0;
const eligible=c=>c&&c.age>=16&&c.age<55&&c.health>=60&&!c.recovering&&!busy(c)&&['home','resting','blocked'].includes(c.phase);
const eligibleGuest=c=>c&&c.age>=16&&c.health>=60&&!c.recovering&&!busy(c)&&['home','resting','blocked','working'].includes(c.phase);
const entries=s=>Object.entries(CONFIG).map(([id,config])=>({id,config,q:s[config.stateKey]}));
export function activeRelicQuest(s){return entries(s).find(v=>isActive(v.q))?.q||null;}
export function deferRelicEvent(s){const q=activeRelicQuest(s);if(q&&s.event){q.deferredEvent??=s.event;s.event=null;return true;}return false;}
function selected(s,id){return id?entries(s).find(v=>v.id===id)||null:entries(s).find(v=>isActive(v.q))||entries(s)[0];}
function news(s,title,text,kind='good'){s.news??=[];s.news.unshift({title,text,kind,year:s.year,season:s.season,tick:s.tick});s.news=s.news.slice(0,80);}
function templePort(s,key){return networkFor(s).ports.find(p=>!p.building.siteKey&&buildingKey(p.building)===key&&readyTemple(p.building));}
function siteFor(s){
 if(!s.world?.lakes?.length)return null;
 const net=networkFor(s),homes=net.ports.filter(p=>p.building.type==='house'),components=new Set(homes.map(p=>net.components.get(p.key))),candidates=[];
 for(const lake of s.world.lakes)for(const water of lake.cells)for(const shore of net.nodes.values()){
  if(!components.has(net.components.get(shore.key))||distance(shore,water)>2.05)continue;
  const homeDistance=Math.min(...homes.filter(h=>net.components.get(h.key)===net.components.get(shore.key)).map(h=>distance(h,shore)));
  candidates.push({lakeId:lake.id,x:water.x,y:water.y,shore:{x:shore.x,y:shore.y},rank:homeDistance+distance(shore,water)*.1});
 }
 candidates.sort((a,b)=>a.rank-b.rank||a.y-b.y||a.x-b.x||a.shore.y-b.shore.y||a.shore.x-b.shore.x);
 const site=candidates.find(site=>relicPathTo(s,{site},site.shore,site));if(!site)return null;delete site.rank;return site;
}
function landSiteFor(s){
 const net=networkFor(s),homes=net.ports.filter(p=>p.building.type==='house'),candidates=[];
 for(let y=2;y<HEIGHT-2;y++)for(let x=2;x<WIDTH-2;x++){
  const p={x,y};if(!isDryPoint(s,x,y)||!navigationSegmentClear(s,p,p,net.navigation?.obstacles)||s.world.deposits.some(d=>d.x===x&&d.y===y))continue;
  const nearest=Math.min(...homes.map(h=>distance(p,h)));if(nearest<4||nearest>8)continue;candidates.push({...p,rank:Math.abs(nearest-5.5)});
 }
 candidates.sort((a,b)=>a.rank-b.rank||a.y-b.y||a.x-b.x);
 const site=candidates.find(p=>homes.some(h=>relicPathTo(s,null,h,p)));return site?{x:site.x,y:site.y,lakeId:null,shore:{x:site.x,y:site.y}}:null;
}
function pristine(q){return q?.version===1&&q.phase==='dormant'&&q.attempts===0&&q.spentFaith===0&&q.actorId===null&&q.startedAt===null&&q.completedAt===null&&q.elapsed===0&&q.temple===null&&q.deferredEvent===null&&q.lastPosition===null&&q.foundRewarded===false&&Array.isArray(q.celebrants)&&q.celebrants.length===0;}
function newQuest(site,id){return site?{version:1,phase:'dormant',site,artifact:{location:id==='oasis'?'lake':'ground',x:site.x,y:site.y,temple:null},actorId:null,spentFaith:0,attempts:0,startedAt:null,elapsed:0,temple:null,celebrants:[],foundRewarded:false,completedAt:null,deferredEvent:null,lastPosition:null}:null;}
export function initializeRelicQuest(s,{reconcileUnusedSite=false}={}){
 for(const [id,config]of Object.entries(CONFIG)){
  const q=s[config.stateKey];if(reconcileUnusedSite&&pristine(q)&&point(q.site)&&point(q.site.shore)&&q.artifact?.temple===null&&q.artifact.x===q.site.x&&q.artifact.y===q.site.y){
   const valid=id==='oasis'?s.world?.lakes?.some(l=>l.id===q.site.lakeId&&l.cells.some(p=>p.x===q.site.x&&p.y===q.site.y)):isDryPoint(s,q.site.x,q.site.y)&&navigationSegmentClear(s,q.site,q.site);
   if(!valid)delete s[config.stateKey];
  }
  if(s[config.stateKey]===undefined)s[config.stateKey]=newQuest(id==='oasis'?siteFor(s):landSiteFor(s),id);
 }
 return s.relicQuest;
}
const searchPoint=q=>({x:q.artifact.location==='ground'?q.artifact.x:q.site.x,y:q.artifact.location==='ground'?q.artifact.y:q.site.y});
export function relicSiteReserved(s,x,y){return entries(s).some(({id,q})=>id==='land'&&q&&q.artifact.location==='ground'&&Math.hypot(q.artifact.x-x,q.artifact.y-y)<.8);}
export function relicStartReason(s,id,questId='oasis'){
 if(s.miracleCelebration)return 'Дождись завершения встречи чуда';
 const choice=selected(s,questId),q=choice?.q;if(!q)return questId==='land'?'В этой долине нет доступной сухопутной реликвии':'В этой долине нет доступного оазиса';if(q.phase==='completed')return 'Артефакт уже хранится в храме';if(relicControlActive(s))return 'Ты уже ведёшь человека';if(s.lost||s.funeral||s.festival||s.event)return 'Дождись завершения события, праздника или прощания';
 const c=s.citizens?.find(c=>c.id===id);if(!eligible(c))return 'Нужен здоровый свободный взрослый до 55 лет, дома и без груза';
 if((s.resources?.faith||0)<RELIC_FAITH_COST)return `Нужно ${RELIC_FAITH_COST} веры`;
 if(!relicPathTo(s,q,c,searchPoint(q)))return 'Человек не может добраться до реликвии';
 if(!s.buildings.some(b=>readyTemple(b)&&templePort(s,buildingKey(b))&&relicPathTo(s,q,c,templePort(s,buildingKey(b)))))return 'Нужен доступный готовый храм или зиккурат для артефакта';return '';
}
export function startRelicQuest(s,id,questId='oasis'){
 const reason=relicStartReason(s,id,questId);if(reason)return {ok:false,reason};const {q}=selected(s,questId),c=s.citizens.find(c=>c.id===id);
 s.resources.faith-=RELIC_FAITH_COST;Object.assign(q,{phase:'controlled',actorId:id,spentFaith:q.spentFaith+RELIC_FAITH_COST,attempts:q.attempts+1,startedAt:s.simTime||0,elapsed:0,temple:null,celebrants:[],lastPosition:{x:c.x,y:c.y},returnReason:null,deferredFuneral:null,rejoicingReady:false});
 c.work=null;c.site=null;c.sitePort=null;c.siteDuty=null;c.phase='relic';c.route=[];c.routeIndex=0;c.workElapsed=0;invalidateAssignments(s);news(s,'Воля бога в человеке',`Город живёт своим чередом. Веди избранного ${questId==='land'?'к древней печати на суше':'в воду оазиса'}, найди артефакт и донеси его в храм.`);return {ok:true};
}
export function orderRelicMove(s,target){
 const q=activeRelicQuest(s),c=s.citizens?.find(c=>c.id===q?.actorId);if(!c||!['controlled','carrying'].includes(q.phase))return {ok:false,reason:'Сейчас человек не готов идти'};
 if(!point(target))return {ok:false,reason:'Точка за пределами долины'};const route=relicPathTo(s,q,c,target);if(!route)return {ok:false,reason:'Туда нет безопасного пути: избранный может входить только в свой оазис, не в реку или стены'};
 c.route=route;c.routeIndex=1;q.temple=null;return {ok:true};
}
export function searchRelic(s){
 const q=activeRelicQuest(s),c=s.citizens?.find(c=>c.id===q?.actorId);if(q?.phase!=='controlled'||!c)return {ok:false,reason:'Сначала возьми человека под управление'};
 if(distance(c,searchPoint(q))>.36||c.routeIndex<c.route.length)return {ok:false,reason:'Подведи человека к золотому знаку и остановись'};
 q.phase='searching';q.elapsed=0;c.route=[];c.routeIndex=0;return {ok:true};
}
function releaseCitizen(s,c){if(!c)return;c.phase='toHome';c.route=[];c.routeIndex=0;const p=networkFor(s).ports.find(p=>buildingKey(p.building)===c.home),route=p&&relicPathTo(s,null,c,p);if(route){c.route=route;c.routeIndex=1;}else c.phase='blocked';invalidateAssignments(s);}
function releaseGuests(s,q){for(const guest of q.celebrants){const c=s.citizens.find(c=>c.id===guest.id);if(c?.phase==='relicGuest')releaseCitizen(s,c);}q.celebrants=[];}
function recruitGuests(s,q,c){
 releaseGuests(s,q);const net=networkFor(s),targets=[...net.nodes.values()].filter(p=>distance(p,c)>=.6&&distance(p,c)<=2.1&&navigationSegmentClear(s,c,p)).sort((a,b)=>distance(a,c)-distance(b,c));
 for(const guest of s.citizens.filter(v=>v.id!==c.id&&eligibleGuest(v)).sort((a,b)=>distance(a,c)-distance(b,c)||a.id-b.id)){
  if(q.celebrants.length>=4)break;let route=null;const index=targets.findIndex(p=>{route=relicPathTo(s,null,guest,p);return !!route;});if(index<0)continue;targets.splice(index,1);guest.phase='relicGuest';guest.work=null;guest.route=route;guest.routeIndex=1;q.celebrants.push({id:guest.id,rewarded:false});
 }invalidateAssignments(s);
}
export function deliverRelic(s,templeKey){
 const q=activeRelicQuest(s);if(q?.phase!=='carrying')return {ok:false,reason:'Сначала найди артефакт'};
 const c=s.citizens.find(c=>c.id===q.actorId),p=templePort(s,templeKey);if(!c||!p)return {ok:false,reason:'Нужен готовый храм или зиккурат'};
 const route=relicPathTo(s,q,c,p);if(!route)return {ok:false,reason:'До этого храма нет доступного пути'};c.route=route;c.routeIndex=1;q.temple=templeKey;return {ok:true};
}
function restoreEvent(s,q){if(q.deferredEvent&&!s.event&&!s.lost){s.event=q.deferredEvent;q.deferredEvent=null;}}
function restoreFuneral(s,q){const f=q.deferredFuneral;if(!f||s.funeral)return;q.deferredFuneral=null;if(f.style==='desert')startDesertFuneral(s,f.deceased,{family:f.scope==='family'});else s.funeral=f;}
function safeArtifactDrop(s,q,p){
 if(isDryPoint(s,p.x,p.y))return {x:p.x,y:p.y};
 const route=relicExitRoute(s,q,p),bank=route&&[...route].reverse().find(n=>isDryPoint(s,n.x,n.y));if(bank)return {x:bank.x,y:bank.y};
 const dry=[...networkFor(s).nodes.values()].filter(n=>isDryPoint(s,n.x,n.y)).sort((a,b)=>distance(a,p)-distance(b,p)||a.y-b.y||a.x-b.x);return dry[0]?{x:dry[0].x,y:dry[0].y}:{...q.site.shore};
}
function interrupt(s,q){
 const c=s.citizens.find(c=>c.id===q.actorId);releaseGuests(s,q);
 if(q.artifact.location==='carried'){const p=c||q.lastPosition;if(p&&point(p))q.artifact={location:'ground',...safeArtifactDrop(s,q,p),temple:null};}
 if(c)releaseCitizen(s,c);q.phase='dormant';q.actorId=null;q.temple=null;q.elapsed=0;q.returnReason=null;restoreEvent(s,q);restoreFuneral(s,q);invalidateAssignments(s);
}
function returnToBank(s,q,reason){const c=s.citizens.find(c=>c.id===q.actorId),route=c&&relicExitRoute(s,q,c);if(!route)return false;q.phase='returning';q.returnReason=reason;q.elapsed=0;c.route=route;c.routeIndex=1;releaseGuests(s,q);return true;}
export function cancelRelicQuest(s){const q=activeRelicQuest(s);if(!q)return {ok:false,reason:'Сейчас ты не ведёшь человека'};if(!['controlled','searching'].includes(q.phase))return {ok:false,reason:q.phase==='returning'?'Человек уже возвращается к берегу':'Артефакт уже найден: отнеси его в храм'};const c=s.citizens.find(c=>c.id===q.actorId);if(c&&!isDryPoint(s,c.x,c.y)&&relicSwimming(s,q,c)){if(!returnToBank(s,q,'cancel'))return {ok:false,reason:'Нужен безопасный выход к берегу'};return {ok:true,pending:true};}interrupt(s,q);news(s,'Поиск отложен','Человек вернулся к своей жизни. Потраченная вера не возвращается.','info');return {ok:true};}
export function recoverRelicCitizen(s,id){for(const {q}of entries(s)){if(!q)continue;if(isActive(q)&&q.actorId===id){interrupt(s,q);return true;}const guest=q.celebrants.find(a=>a.id===id);if(guest){const c=s.citizens.find(c=>c.id===id);if(c)releaseCitizen(s,c);q.celebrants=q.celebrants.filter(a=>a!==guest);return true;}}return false;}
function walk(s,q,c,seconds){let left=seconds;for(let guard=0;guard<256&&left>1e-8&&c.routeIndex<c.route.length;guard++){const next=c.route[c.routeIndex];if(!relicSegmentClear(s,q,c,next)){c.route=[];c.routeIndex=0;return false;}const d=distance(c,next),speed=(relicSwimming(s,q,c)||relicSwimming(s,q,next))?.62:1.05,travel=d/speed;if(travel<=left+1e-8){c.x=next.x;c.y=next.y;c.routeIndex++;left-=travel;}else{const f=left/travel;c.x+=(next.x-c.x)*f;c.y+=(next.y-c.y)*f;left=0;}}return true;}
// Ceremony ownership changes immediately, without advancing either clock or
// moving the chosen resident twice when the main loop enters funeral mode.
export function interruptRelicForFuneral(s){
 if(!s.funeral)return false;const q=activeRelicQuest(s),c=q&&s.citizens.find(c=>c.id===q.actorId);if(!q||!c)return false;
 if(relicSwimming(s,q,c)){q.deferredFuneral=s.funeral;s.funeral=null;returnToBank(s,q,'funeral');}
 else{interrupt(s,q);news(s,'Поиск прерван прощанием','Человек вернулся к городу. Найденный артефакт сохранён на ближайшем безопасном берегу.','info');}
 return true;
}
export function advanceRelicQuest(s,dt){
 const entry=entries(s).find(v=>isActive(v.q)),q=entry?.q;if(!q||!Number.isFinite(dt)||dt<=0)return;
 const c=s.citizens.find(c=>c.id===q.actorId);if(!c||s.lost){interrupt(s,q);return;}
 if(s.funeral){interruptRelicForFuneral(s);if(!isActive(q))return;}
 deferRelicEvent(s);walk(s,q,c,dt);q.lastPosition={x:c.x,y:c.y};if(q.artifact.location==='carried'){q.artifact.x=c.x;q.artifact.y=c.y;}
 if(q.phase==='returning'){if(isDryPoint(s,c.x,c.y)&&c.routeIndex>=c.route.length){interrupt(s,q);news(s,'Человек вышел на берег','Поиск прерван, управление городом возвращено. Потраченная вера не возвращается.','info');}return;}
 for(const a of q.celebrants){const guest=s.citizens.find(c=>c.id===a.id);if(guest?.phase==='relicGuest')walk(s,null,guest,dt);}
 q.celebrants=q.celebrants.filter(a=>s.citizens.some(c=>c.id===a.id));
 if(q.phase==='searching'){q.elapsed+=dt;if(q.elapsed>=2){q.phase='rejoicing';q.elapsed=0;q.artifact={location:'carried',x:c.x,y:c.y,temple:null};if(!q.foundRewarded){affectResidents(s,{mood:10},[c.id]);q.foundRewarded=true;}q.rejoicingReady=false;if(relicSwimming(s,q,c)){const route=relicExitRoute(s,q,c);if(route){c.route=route;c.routeIndex=1;}}else{recruitGuests(s,q,c);q.rejoicingReady=true;}news(s,entry.id==='land'?'В земле найдена древняя печать':'На дне оазиса найден знак','Избранный поднял древний артефакт. На безопасной суше соседи разделят его радость.');}}
 else if(q.phase==='rejoicing'||q.phase==='celebrating'){
  if(q.phase==='rejoicing'&&!q.rejoicingReady){if(c.routeIndex<c.route.length||!isDryPoint(s,c.x,c.y))return;recruitGuests(s,q,c);q.rejoicingReady=true;}
  q.elapsed+=dt;for(const a of q.celebrants){const guest=s.citizens.find(c=>c.id===a.id);if(guest&&guest.routeIndex>=guest.route.length&&!a.rewarded){affectResidents(s,{mood:4},[guest.id]);a.rewarded=true;}}
  const guestsArrived=q.celebrants.every(a=>{const guest=s.citizens.find(c=>c.id===a.id);return !guest||guest.routeIndex>=guest.route.length;});
  if(q.elapsed>=5&&(guestsArrived||q.elapsed>=30)){releaseGuests(s,q);q.elapsed=0;if(q.phase==='rejoicing')q.phase='carrying';else{
   q.phase='completed';q.completedAt=s.simTime||0;q.artifact={location:'temple',x:templePort(s,q.temple)?.building.x??c.x,y:templePort(s,q.temple)?.building.y??c.y,temple:q.temple};s.name=entry.config.divineName;if(!s.divinity.names.includes(s.name))s.divinity.names.push(s.name);if(!s.memories.includes(entry.config.memory))s.memories.push(entry.config.memory);q.actorId=null;releaseCitizen(s,c);restoreEvent(s,q);news(s,'Храм принял артефакт',`Люди зовут тебя: ${entry.config.divineName}. Открыто чудо «${entry.config.miracleName}».`);
  }}
 }else if(q.phase==='carrying'&&q.temple&&c.routeIndex>=c.route.length){const p=templePort(s,q.temple);if(p&&distance(c,p)<.15){q.phase='celebrating';q.elapsed=0;recruitGuests(s,q,c);}else q.temple=null;}
}
export function relicCitizenView(s,c){
 const entry=entries(s).find(({q})=>q&&(isActive(q)&&q.actorId===c.id||q.celebrants.some(a=>a.id===c.id)));if(!entry)return {};const {q,id}=entry,actor=isActive(q)&&q.actorId===c.id,walking=c.routeIndex<c.route.length;
 return {walking,swimming:actor&&relicSwimming(s,q,c),carrying:actor&&q.artifact.location==='carried',cargo:{},relic:actor&&q.artifact.location==='carried',relicId:actor?id:null,controlled:actor,celebrating:!walking&&(q.phase==='rejoicing'||q.phase==='celebrating'),activity:!walking&&actor&&q.phase==='searching'?{kind:'relicSearch',stage:'searching'}:null};
}
function view(s,entry){const {q,id,config}=entry;if(!q)return null;const c=s.citizens?.find(c=>c.id===q.actorId);return {id,title:config.title,divineName:config.divineName,miracleId:config.miracleId,phase:q.phase,active:isActive(q),cost:RELIC_FAITH_COST,actorId:q.actorId,searchPoint:searchPoint(q),artifact:{...q.artifact,underwater:q.artifact.location==='lake'},site:structuredClone(q.site),celebrants:q.celebrants.map(a=>a.id),walking:!!c&&c.routeIndex<c.route.length,swimming:!!c&&relicSwimming(s,q,c),canSearch:q.phase==='controlled'&&!!c&&distance(c,searchPoint(q))<=.36&&c.routeIndex>=c.route.length,canCancel:['controlled','searching'].includes(q.phase),temples:s.buildings.filter(readyTemple).map(b=>({key:buildingKey(b),type:b.type,x:b.x,y:b.y})),elapsed:q.elapsed,completedAt:q.completedAt};}
export function relicQuestView(s,options={}){const id=typeof options==='string'?options:options.id;const entry=selected(s,id);return entry?view(s,entry):null;}
export function relicQuestViews(s){return entries(s).map(entry=>view(s,entry)).filter(Boolean);}
function validateQuest(s,q,id,config){
 const int=n=>Number.isSafeInteger(n)&&n>=0,finite=n=>Number.isFinite(n)&&n>=0,phases=['dormant',...ACTIVE,'completed'];
 if(q.version!==1||!phases.includes(q.phase)||!int(q.spentFaith)||!int(q.attempts)||q.spentFaith!==q.attempts*RELIC_FAITH_COST||!finite(q.elapsed)||q.elapsed>30.1||typeof q.foundRewarded!=='boolean'||!point(q.site)||!point(q.site.shore))return false;
 if(id==='oasis'&&(!s.world?.lakes.some(l=>l.id===q.site.lakeId&&l.cells.some(p=>p.x===q.site.x&&p.y===q.site.y))||!isDryPoint(s,q.site.shore.x,q.site.shore.y))||id==='land'&&(q.site.lakeId!==null||!isDryPoint(s,q.site.x,q.site.y)))return false;
 if(['rejoicing','carrying','celebrating','completed'].includes(q.phase)&&(!q.foundRewarded||q.attempts<1||q.startedAt===null))return false;
 if(q.startedAt!==null&&(!finite(q.startedAt)||q.startedAt>(s.simTime||0)+.11)||q.completedAt!==null&&(!finite(q.completedAt)||q.completedAt>(s.simTime||0)+.11))return false;
 const a=q.artifact;if(!a||!['lake','ground','carried','temple'].includes(a.location)||!point(a))return false;
 if(a.location==='lake'&&(id!=='oasis'||a.x!==q.site.x||a.y!==q.site.y||a.temple!==null)||a.location==='ground'&&(!isDryPoint(s,a.x,a.y)||a.temple!==null))return false;
 const active=isActive(q),c=s.citizens.find(c=>c.id===q.actorId);
 if(active&&(!c||c.phase!=='relic'||q.attempts<1||q.startedAt===null||sum(c.cargo)||sum(c.buildCargo)||busy(c))||!active&&q.actorId!==null)return false;
 if(['controlled','searching'].includes(q.phase)&&!['lake','ground'].includes(a.location)||['rejoicing','carrying','celebrating'].includes(q.phase)&&a.location!=='carried'||q.phase==='completed'&&(a.location!=='temple'||q.completedAt===null||!s.divinity.names.includes(config.divineName)||!s.memories.includes(config.memory))||q.phase!=='completed'&&q.completedAt!==null)return false;
 if(a.location==='carried'&&(!c||distance(c,a)>1e-6||a.temple!==null)||a.location==='temple'&&(!s.buildings.some(b=>buildingKey(b)===a.temple&&['shrine','ziggurat'].includes(b.type)&&isOperational(b))||a.temple!==q.temple))return false;
 if(!Array.isArray(q.celebrants)||q.celebrants.length>4||new Set(q.celebrants.map(a=>a?.id)).size!==q.celebrants.length)return false;
 for(const a of q.celebrants){const guest=s.citizens.find(c=>c.id===a.id);if(!int(a.id)||a.id===q.actorId||typeof a.rewarded!=='boolean'||!guest||guest.phase!=='relicGuest'||busy(guest))return false;}
 if(q.celebrants.length&&!['rejoicing','celebrating'].includes(q.phase))return false;
 if(q.temple!==null&&(!['carrying','celebrating','completed','returning'].includes(q.phase)||!s.buildings.some(b=>buildingKey(b)===q.temple&&['shrine','ziggurat'].includes(b.type)&&isOperational(b))))return false;
 if(q.lastPosition!==null&&!point(q.lastPosition))return false;
 if(q.deferredEvent!==null){const e=q.deferredEvent;if(!e||typeof e!=='object'||Array.isArray(e)||Object.keys(e).length!==3||!['id','title','text'].every(key=>Object.hasOwn(e,key))||!cityEventDefinition(e.id)||typeof e.title!=='string'||e.title.length>200||typeof e.text!=='string'||e.text.length>5000)return false;}
 if(q.returnReason!==undefined&&q.returnReason!==null&&!['cancel','funeral'].includes(q.returnReason)||q.phase==='returning'&&!['cancel','funeral'].includes(q.returnReason))return false;
 if(q.rejoicingReady!==undefined&&typeof q.rejoicingReady!=='boolean')return false;
 if(q.deferredFuneral!==undefined&&q.deferredFuneral!==null&&(q.phase!=='returning'||q.returnReason!=='funeral'||!validateFuneral({...s,funeral:q.deferredFuneral})))return false;
 if(active&&c.route.slice(c.routeIndex).some((p,i)=>!relicSegmentClear(s,q,i?c.route[c.routeIndex+i-1]:c,p)))return false;
 if(active&&!relicSegmentClear(s,q,c,c))return false;return true;
}
export function validateRelicQuest(s){
 const quests=entries(s),existing=quests.filter(v=>v.q!==undefined&&v.q!==null);if(existing.filter(v=>isActive(v.q)).length>1)return false;
 for(const {q,id,config}of existing)if(!validateQuest(s,q,id,config))return false;
 if(s.citizens.some(c=>c.phase==='relic'&&!existing.some(({q})=>isActive(q)&&q.actorId===c.id)||c.phase==='relicGuest'&&!existing.some(({q})=>q.celebrants?.some(a=>a.id===c.id))))return false;
 return true;
}
