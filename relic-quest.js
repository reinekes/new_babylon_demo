import {relicControlActive,relicCommandReason} from './city-command-lock.js';
export {relicControlActive,relicCommandReason} from './city-command-lock.js';
// A unique cult object belongs to this quest, never to interchangeable material freight.
import {buildingKey,isOperational} from './definitions.js';
import {networkFor,routeBetween,invalidateAssignments} from './workforce.js';
import {nearestWalkingNode,navigationSegmentClear} from './navigation.js';
import {isDryPoint,WIDTH,HEIGHT} from './world.js';
import {affectResidents} from './wellbeing.js';
export const RELIC_FAITH_COST=250;
export const RELIC_DIVINE_NAME='Пробуждающий глубины';
const ACTIVE=['controlled','searching','rejoicing','carrying','celebrating'];
const sum=o=>Object.values(o||{}).some(v=>v>1e-8),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-.5&&p.y>=-.5&&p.x<=WIDTH-.5&&p.y<=HEIGHT-.5;
const readyTemple=b=>['shrine','ziggurat'].includes(b.type)&&isOperational(b)&&!b.construction;
const busy=c=>!!c.site||!!c.waterTrip||c.clothingTarget!==undefined||!!c.craftSite||!!c.seedField||!!c.pantryTrip||!!c.clinic||!!c.school||!!c.districtJob||!!c.saleJob||!!c.tradeJob||!!c.pendingRole||!!c.workplace||!!c.guardPost||sum(c.cargo)||sum(c.buildCargo)||c.pantryFood>0;
const eligible=c=>c&&c.age>=16&&c.age<55&&c.health>=60&&!c.recovering&&!busy(c)&&['home','resting','blocked'].includes(c.phase);
const eligibleGuest=c=>c&&c.age>=16&&c.health>=60&&!c.recovering&&!busy(c)&&['home','resting','blocked','working'].includes(c.phase);
function news(s,title,text,kind='good'){s.news??=[];s.news.unshift({title,text,kind,year:s.year,season:s.season,tick:s.tick});s.news=s.news.slice(0,80);}
function anchor(s,p,net=networkFor(s)){
 const near=nearestWalkingNode(net,p);if(near&&distance(near,p)<1e-8)return near;
 // A nearest node on the far side of water or a wall is never a valid starting bridge.
 const candidates=[...net.nodes.values()].filter(n=>distance(n,p)<=1.6).sort((a,b)=>distance(a,p)-distance(b,p));
 return candidates.find(n=>navigationSegmentClear(s,p,n))||null;
}
function pathTo(s,c,target){
 if(!point(target)||!navigationSegmentClear(s,target,target))return null;
 const net=networkFor(s),from=anchor(s,c,net),to=anchor(s,target,net);if(!from||!to)return null;
 const nodes=routeBetween(s,from.key,to.key);if(!nodes)return null;
 const route=[{x:c.x,y:c.y},...nodes.map(p=>({x:p.x,y:p.y}))];
 if(distance(route.at(-1),target)>1e-8){if(!navigationSegmentClear(s,route.at(-1),target))return null;route.push({x:target.x,y:target.y});}
 return route;
}
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
 const site=candidates[0];if(!site)return null;delete site.rank;return site;
}
export function initializeRelicQuest(s,{reconcileUnusedSite=false}={}){
 const q=s.relicQuest;
 // Custom scenario tools may replace lakes before play. Only a pristine, never
 // paid-for placement may follow that valid world; earned or carried objects never move.
 if(reconcileUnusedSite&&q?.version===1&&q.phase==='dormant'&&q.attempts===0&&q.spentFaith===0&&q.actorId===null&&q.startedAt===null&&q.completedAt===null&&q.elapsed===0&&q.temple===null&&q.deferredEvent===null&&q.lastPosition===null&&q.foundRewarded===false&&Array.isArray(q.celebrants)&&q.celebrants.length===0&&point(q.site)&&point(q.site.shore)&&typeof q.site.lakeId==='string'&&q.artifact?.location==='lake'&&q.artifact.temple===null&&q.artifact.x===q.site.x&&q.artifact.y===q.site.y&&!s.world?.lakes?.some(l=>l.id===q.site.lakeId&&l.cells.some(p=>p.x===q.site.x&&p.y===q.site.y)))delete s.relicQuest;
 if(s.relicQuest!==undefined)return s.relicQuest;
 const site=siteFor(s);s.relicQuest=site?{version:1,phase:'dormant',site,artifact:{location:'lake',x:site.x,y:site.y,temple:null},actorId:null,spentFaith:0,attempts:0,startedAt:null,elapsed:0,temple:null,celebrants:[],foundRewarded:false,completedAt:null,deferredEvent:null,lastPosition:null}:null;return s.relicQuest;
}
const searchPoint=q=>q.artifact.location==='ground'?{x:q.artifact.x,y:q.artifact.y}:{...q.site.shore};
export function relicStartReason(s,id){
 const q=s.relicQuest;if(!q)return 'В этой долине нет доступного оазиса';if(q.phase==='completed')return 'Артефакт уже хранится в храме';if(relicControlActive(s))return 'Ты уже ведёшь человека';if(s.lost||s.funeral||s.festival||s.event)return 'Дождись завершения события, праздника или прощания';
 const c=s.citizens?.find(c=>c.id===id);if(!eligible(c))return 'Нужен здоровый свободный взрослый до 55 лет, дома и без груза';
 if((s.resources?.faith||0)<RELIC_FAITH_COST)return `Нужно ${RELIC_FAITH_COST} веры`;
 if(!pathTo(s,c,searchPoint(q)))return 'Человек не может дойти до берега оазиса';
 if(!s.buildings.some(b=>readyTemple(b)&&templePort(s,buildingKey(b))&&pathTo(s,c,templePort(s,buildingKey(b)))))return 'Нужен доступный готовый храм или зиккурат для артефакта';return '';
}
export function startRelicQuest(s,id){
 const reason=relicStartReason(s,id);if(reason)return {ok:false,reason};const q=s.relicQuest,c=s.citizens.find(c=>c.id===id);
 s.resources.faith-=RELIC_FAITH_COST;Object.assign(q,{phase:'controlled',actorId:id,spentFaith:q.spentFaith+RELIC_FAITH_COST,attempts:q.attempts+1,startedAt:s.simTime||0,elapsed:0,temple:null,celebrants:[],lastPosition:{x:c.x,y:c.y}});
 c.work=null;c.site=null;c.sitePort=null;c.siteDuty=null;c.phase='relic';c.route=[];c.routeIndex=0;c.workElapsed=0;invalidateAssignments(s);news(s,'Воля бога в человеке','Город живёт своим чередом. Веди избранного к оазису, найди артефакт и донеси его в храм.');return {ok:true};
}
export function orderRelicMove(s,target){
 const q=s.relicQuest,c=s.citizens?.find(c=>c.id===q?.actorId);if(!c||!['controlled','carrying'].includes(q.phase))return {ok:false,reason:'Сейчас человек не готов идти'};
 const route=pathTo(s,c,target);if(!route)return {ok:false,reason:'Туда нельзя пройти по суше: нужны свободный берег и мост'};
 c.route=route;c.routeIndex=1;q.temple=null;return {ok:true};
}
export function searchRelic(s){
 const q=s.relicQuest,c=s.citizens?.find(c=>c.id===q?.actorId);if(q?.phase!=='controlled'||!c)return {ok:false,reason:'Сначала возьми человека под управление'};
 if(distance(c,searchPoint(q))>.8||c.routeIndex<c.route.length)return {ok:false,reason:'Подведи человека к отмеченному берегу и остановись'};
 q.phase='searching';q.elapsed=0;c.route=[];c.routeIndex=0;return {ok:true};
}
function releaseCitizen(s,c){if(!c)return;c.phase='toHome';c.route=[];c.routeIndex=0;const p=networkFor(s).ports.find(p=>buildingKey(p.building)===c.home),route=p&&pathTo(s,c,p);if(route){c.route=route;c.routeIndex=1;}else c.phase='blocked';invalidateAssignments(s);}
function releaseGuests(s,q){for(const guest of q.celebrants){const c=s.citizens.find(c=>c.id===guest.id);if(c?.phase==='relicGuest')releaseCitizen(s,c);}q.celebrants=[];}
function recruitGuests(s,q,c){
 releaseGuests(s,q);const net=networkFor(s),targets=[...net.nodes.values()].filter(p=>distance(p,c)>=.6&&distance(p,c)<=2.1&&navigationSegmentClear(s,c,p)).sort((a,b)=>distance(a,c)-distance(b,c));
 for(const guest of s.citizens.filter(v=>v.id!==c.id&&eligibleGuest(v)).sort((a,b)=>distance(a,c)-distance(b,c)||a.id-b.id)){
  if(q.celebrants.length>=4)break;let route=null;const index=targets.findIndex(p=>{route=pathTo(s,guest,p);return !!route;});if(index<0)continue;targets.splice(index,1);guest.phase='relicGuest';guest.work=null;guest.route=route;guest.routeIndex=1;q.celebrants.push({id:guest.id,rewarded:false});
 }invalidateAssignments(s);
}
export function deliverRelic(s,templeKey){
 const q=s.relicQuest;if(q?.phase!=='carrying')return {ok:false,reason:'Сначала найди артефакт'};
 const c=s.citizens.find(c=>c.id===q.actorId),p=templePort(s,templeKey);if(!c||!p)return {ok:false,reason:'Нужен готовый храм или зиккурат'};
 const route=pathTo(s,c,p);if(!route)return {ok:false,reason:'До этого храма нет доступного пути'};c.route=route;c.routeIndex=1;q.temple=templeKey;return {ok:true};
}
function restoreEvent(s,q){if(q.deferredEvent&&!s.event&&!s.lost){s.event=q.deferredEvent;q.deferredEvent=null;}}
function safeArtifactDrop(s,p){
 if(isDryPoint(s,p.x,p.y))return {x:p.x,y:p.y};
 // Only the object washes to a bank. The controlled citizen keeps their exact
 // bridge position and their funeral or ordinary return route remains physical.
 const net=networkFor(s),from=anchor(s,p,net),dry=[...net.nodes.values()].filter(n=>isDryPoint(s,n.x,n.y)).sort((a,b)=>distance(a,p)-distance(b,p)||a.y-b.y||a.x-b.x);
 const bank=from&&dry.find(n=>net.components.get(n.key)===net.components.get(from.key)&&routeBetween(s,from.key,n.key))||dry[0];
 return bank?{x:bank.x,y:bank.y}:{...s.relicQuest.site.shore};
}
function interrupt(s,{died=false}={}){
 const q=s.relicQuest,c=s.citizens.find(c=>c.id===q.actorId);releaseGuests(s,q);
 if(q.artifact.location==='carried'){const p=c||q.lastPosition;if(p&&point(p))q.artifact={location:'ground',...safeArtifactDrop(s,p),temple:null};}
 if(c)releaseCitizen(s,c);q.phase='dormant';q.actorId=null;q.temple=null;q.elapsed=0;restoreEvent(s,q);invalidateAssignments(s);
}
export function cancelRelicQuest(s){const q=s.relicQuest;if(!relicControlActive(s))return {ok:false,reason:'Сейчас ты не ведёшь человека'};if(['carrying','rejoicing','celebrating'].includes(q.phase))return {ok:false,reason:'Артефакт уже найден: отнеси его в храм'};interrupt(s);news(s,'Поиск отложен','Человек вернулся к своей жизни. Потраченная вера не возвращается.','info');return {ok:true};}
export function recoverRelicCitizen(s,id){const q=s.relicQuest;if(!q)return false;if(relicControlActive(s)&&q.actorId===id){interrupt(s,{died:true});return true;}const guest=q.celebrants.find(a=>a.id===id);if(guest){const c=s.citizens.find(c=>c.id===id);if(c)releaseCitizen(s,c);q.celebrants=q.celebrants.filter(a=>a!==guest);return true;}return false;}
function walk(s,c,seconds){let left=seconds;for(let guard=0;guard<256&&left>1e-8&&c.routeIndex<c.route.length;guard++){const next=c.route[c.routeIndex];if(!navigationSegmentClear(s,c,next)){c.route=[];c.routeIndex=0;return false;}const d=distance(c,next),travel=d/1.05;if(travel<=left+1e-8){c.x=next.x;c.y=next.y;c.routeIndex++;left-=travel;}else{const f=left/travel;c.x+=(next.x-c.x)*f;c.y+=(next.y-c.y)*f;left=0;}}return true;}
export function advanceRelicQuest(s,dt){
 const q=s.relicQuest;if(!q||!relicControlActive(s)||!Number.isFinite(dt)||dt<=0)return;
 const c=s.citizens.find(c=>c.id===q.actorId);if(!c||s.lost){interrupt(s,{died:!c});return;}
 if(s.funeral){interrupt(s);news(s,'Поиск прерван прощанием','Человек вернулся к городу. Найденный артефакт сохранён на ближайшем безопасном берегу.','info');return;}
 if(s.event){q.deferredEvent??=s.event;s.event=null;}
 walk(s,c,dt);q.lastPosition={x:c.x,y:c.y};if(q.artifact.location==='carried'){q.artifact.x=c.x;q.artifact.y=c.y;}
 for(const a of q.celebrants){const guest=s.citizens.find(c=>c.id===a.id);if(guest?.phase==='relicGuest')walk(s,guest,dt);}
 q.celebrants=q.celebrants.filter(a=>s.citizens.some(c=>c.id===a.id));
 if(q.phase==='searching'){q.elapsed+=dt;if(q.elapsed>=2){q.phase='rejoicing';q.elapsed=0;q.artifact={location:'carried',x:c.x,y:c.y,temple:null};if(!q.foundRewarded){affectResidents(s,{mood:10},[c.id]);q.foundRewarded=true;}recruitGuests(s,q,c);news(s,'На дне оазиса найден знак','Избранный поднял древний артефакт. Соседи сходятся разделить радость.');}}
 else if(q.phase==='rejoicing'||q.phase==='celebrating'){
  q.elapsed+=dt;for(const a of q.celebrants){const guest=s.citizens.find(c=>c.id===a.id);if(guest&&guest.routeIndex>=guest.route.length&&!a.rewarded){affectResidents(s,{mood:4},[guest.id]);a.rewarded=true;}}
  const guestsArrived=q.celebrants.every(a=>{const guest=s.citizens.find(c=>c.id===a.id);return !guest||guest.routeIndex>=guest.route.length;});
  if(q.elapsed>=5&&(guestsArrived||q.elapsed>=30)){releaseGuests(s,q);q.elapsed=0;if(q.phase==='rejoicing')q.phase='carrying';else{
   q.phase='completed';q.completedAt=s.simTime||0;q.artifact={location:'temple',x:templePort(s,q.temple)?.building.x??c.x,y:templePort(s,q.temple)?.building.y??c.y,temple:q.temple};s.name=RELIC_DIVINE_NAME;if(!s.divinity.names.includes(s.name))s.divinity.names.push(s.name);if(!s.memories.includes('oasisRelic'))s.memories.push('oasisRelic');q.actorId=null;releaseCitizen(s,c);restoreEvent(s,q);news(s,'Храм принял артефакт',`Люди зовут тебя: ${RELIC_DIVINE_NAME}. Открыто чудо «Пробуждение глубин».`);
  }}
 }else if(q.phase==='carrying'&&q.temple&&c.routeIndex>=c.route.length){const p=templePort(s,q.temple);if(p&&distance(c,p)<.15){q.phase='celebrating';q.elapsed=0;recruitGuests(s,q,c);}else q.temple=null;}
}
export function relicCitizenView(s,c){
 const q=s.relicQuest;if(!q)return {};const actor=relicControlActive(s)&&q.actorId===c.id,guest=q.celebrants.some(a=>a.id===c.id);if(!actor&&!guest)return {};
 const walking=c.routeIndex<c.route.length;return {walking,carrying:actor&&q.artifact.location==='carried',cargo:{},relic:actor&&q.artifact.location==='carried',controlled:actor,celebrating:!walking&&(q.phase==='rejoicing'||q.phase==='celebrating'),activity:!walking&&actor&&q.phase==='searching'?{kind:'relicSearch',stage:'searching'}:null};
}
export function relicQuestView(s){const q=s.relicQuest;if(!q)return null;const c=s.citizens?.find(c=>c.id===q.actorId);return {phase:q.phase,active:relicControlActive(s),cost:RELIC_FAITH_COST,actorId:q.actorId,searchPoint:searchPoint(q),artifact:{...q.artifact,underwater:q.artifact.location==='lake'},site:structuredClone(q.site),celebrants:q.celebrants.map(a=>a.id),walking:!!c&&c.routeIndex<c.route.length,canSearch:q.phase==='controlled'&&!!c&&distance(c,searchPoint(q))<=.8&&c.routeIndex>=c.route.length,canCancel:['controlled','searching'].includes(q.phase),temples:s.buildings.filter(readyTemple).map(b=>({key:buildingKey(b),type:b.type,x:b.x,y:b.y})),elapsed:q.elapsed};}
export function validateRelicQuest(s){
 const q=s.relicQuest;if(q===undefined||q===null)return !(s.citizens||[]).some(c=>['relic','relicGuest'].includes(c.phase));
 const int=n=>Number.isSafeInteger(n)&&n>=0,finite=n=>Number.isFinite(n)&&n>=0,phases=['dormant',...ACTIVE,'completed'];
 if(q.version!==1||!phases.includes(q.phase)||!int(q.spentFaith)||!int(q.attempts)||q.spentFaith!==q.attempts*RELIC_FAITH_COST||!finite(q.elapsed)||q.elapsed>30.1||typeof q.foundRewarded!=='boolean'||!point(q.site)||!point(q.site.shore)||!s.world?.lakes.some(l=>l.id===q.site.lakeId&&l.cells.some(p=>p.x===q.site.x&&p.y===q.site.y))||!isDryPoint(s,q.site.shore.x,q.site.shore.y))return false;
 if(q.startedAt!==null&&(!finite(q.startedAt)||q.startedAt>(s.simTime||0)+.11)||q.completedAt!==null&&(!finite(q.completedAt)||q.completedAt>(s.simTime||0)+.11))return false;
 const a=q.artifact;if(!a||!['lake','ground','carried','temple'].includes(a.location)||!point(a))return false;
 if(a.location==='lake'&&(a.x!==q.site.x||a.y!==q.site.y||a.temple!==null)||a.location==='ground'&&(!isDryPoint(s,a.x,a.y)||a.temple!==null))return false;
 const active=relicControlActive(s),c=s.citizens.find(c=>c.id===q.actorId);
 if(active&&(!c||c.phase!=='relic'||q.attempts<1||q.startedAt===null||sum(c.cargo)||sum(c.buildCargo)||busy(c))||!active&&q.actorId!==null)return false;
 if(['controlled','searching'].includes(q.phase)&&!['lake','ground'].includes(a.location)||['rejoicing','carrying','celebrating'].includes(q.phase)&&a.location!=='carried'||q.phase==='completed'&&(a.location!=='temple'||q.completedAt===null||!s.divinity.names.includes(RELIC_DIVINE_NAME)||!s.memories.includes('oasisRelic'))||q.phase!=='completed'&&q.completedAt!==null)return false;
 if(a.location==='carried'&&(!c||distance(c,a)>1e-6||a.temple!==null)||a.location==='temple'&&(!s.buildings.some(b=>buildingKey(b)===a.temple&&['shrine','ziggurat'].includes(b.type)&&isOperational(b))||a.temple!==q.temple))return false;
 if(!Array.isArray(q.celebrants)||q.celebrants.length>4||new Set(q.celebrants.map(a=>a?.id)).size!==q.celebrants.length)return false;
 for(const a of q.celebrants){const guest=s.citizens.find(c=>c.id===a.id);if(!int(a.id)||a.id===q.actorId||typeof a.rewarded!=='boolean'||!guest||guest.phase!=='relicGuest'||busy(guest))return false;}
 if(q.celebrants.length&&!['rejoicing','celebrating'].includes(q.phase))return false;
 if(s.citizens.some(c=>c.phase==='relic'&&c.id!==q.actorId||c.phase==='relicGuest'&&!q.celebrants.some(a=>a.id===c.id)))return false;
 if(q.temple!==null&&(!['carrying','celebrating','completed'].includes(q.phase)||!s.buildings.some(b=>buildingKey(b)===q.temple&&['shrine','ziggurat'].includes(b.type)&&isOperational(b))))return false;
 if(q.lastPosition!==null&&!point(q.lastPosition))return false;
 if(q.deferredEvent!==null&&(!q.deferredEvent||!['caravan','refugees','festival'].includes(q.deferredEvent.id)||typeof q.deferredEvent.title!=='string'||typeof q.deferredEvent.text!=='string'))return false;return true;
}
