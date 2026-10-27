import {buildingKey} from './definitions.js';
import {networkFor,routeBetween,invalidateAssignments} from './workforce.js';
import {navigationSegmentClear} from './navigation.js';
import {isDryPoint,WIDTH,HEIGHT} from './world.js';
import {footprintSize} from './footprints.js';
const BASIC=new Set(['house','clay','reed','field','garden','fishing','hunting','waterpoint','bridge','canal','brickyard','granary','sheepfold']);
const MONUMENTS=new Set(['shrine','ziggurat','ishtarGate','harbor']);
const cargo=c=>Object.values(c.cargo||{}).some(n=>n>0)||Object.values(c.buildCargo||{}).some(n=>n>0);
export const gameMode=s=>s.godhood?.mode||'legacy';
export const isAwakening=s=>gameMode(s)==='awakening';
export const isMatureGod=s=>gameMode(s)==='mature';
export const knowsPresence=(s,c)=>!isAwakening(s)||s.godhood.believerIds.includes(typeof c==='object'?c?.id:c);
export const builderLevel=c=>c?.builderSkill?.level||1;
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
 if(!isAwakening(s))return '';
 const g=s.godhood;if(g.stage!=='recognized')return 'Сначала заяви о присутствии: нужен первый свидетель';
 const required=knowledgeTier(type,level),master=s.citizens.some(c=>c.age>=16&&c.calling==='builder'&&c.role==='builder'&&knowsPresence(s,c)&&builderLevel(c)>=required);
 return master?'':`Нужен вдохновлённый строитель ${['','I','II','III'][required]} уровня`;
}
export function miracleKnowledgeReason(s,id){if(!isAwakening(s))return '';if(s.godhood.stage!=='recognized')return 'Пока никто не признал твоё присутствие';const need=['rain','bless','peace'].includes(id)?1:['inannaProtection','relicAwakening','earthMemory'].includes(id)?3:2;return godhoodView(s).builderLevel>=need?'':`Чудо откроется с мастером ${['','I','II','III'][need]} уровня`;}
export function godhoodInspirationReason(s,c,profession){if(!isAwakening(s))return '';if(s.godhood.stage!=='recognized')return 'Сначала помоги первому человеку заметить присутствие бога';if(!knowsPresence(s,c))return 'Этот человек ещё не признал присутствие бога: помоги ему увидеть дело общины';return '';}
export function firstBuilderInspiration(s,c,profession){return isAwakening(s)&&profession==='builder'&&s.godhood.stage==='recognized'&&!s.godhood.firstBuilderGift&&s.godhood.witnessId===c.id;}
export function acceptGodhoodInspiration(s,c,profession){if(!s.godhood||!isAwakening(s))return;if(profession==='builder'){c.builderSkill??={level:1,projects:0};if(c.id===s.godhood.witnessId)s.godhood.firstBuilderGift=true;}}
export function canLeadConstruction(s,c,b){return !isAwakening(s)||c&&c.age>=16&&c.calling==='builder'&&c.role==='builder'&&knowsPresence(s,c)&&builderLevel(c)>=knowledgeTier(b.type,b.construction?.target||b.level||1);}
export function recordBuilderCompletion(s,b){
 if(!isAwakening(s))return false;
 const q=b.construction;if(!q||!['new','upgrade'].includes(q.kind)||!Number.isFinite(q.work)||![1,2,3].includes(q.target)||q.work+1e-8<(b.type==='road'?6:12)*q.target||Object.entries(q.required||{}).some(([k,n])=>(q.delivered?.[k]||0)<n))return false;
 const g=s.godhood,key=buildingKey(b),stamp=`${key}:${q.target}`;
 if(g.completedProjects.includes(stamp))return false;
 // An assigned traveller has not performed this project's work yet.
 const ports=networkFor(s).ports,onsite=c=>{const port=b.type==='road'?b.a:ports.find(p=>p.building.siteKey?`site:${p.building.siteKey}:${p.building.side}`===c.sitePort:buildingKey(p.building)===c.sitePort);if(port)return Math.hypot(c.x-port.x,c.y-port.y)<.05;const n=footprintSize(b),dx=Math.max(b.x-.5-c.x,0,c.x-(b.x+n-.5)),dy=Math.max(b.y-.5-c.y,0,c.y-(b.y+n-.5));return Math.hypot(dx,dy)<.05;};
 const workers=s.citizens.filter(c=>c.site===key&&c.siteDuty==='builder'&&c.phase==='constructing'&&onsite(c)&&canLeadConstruction(s,c,b));
 if(!workers.length)return false;g.completedProjects.push(stamp);
 for(const c of workers){c.builderSkill??={level:1,projects:0};c.builderSkill.projects++;c.builderSkill.level=c.builderSkill.projects>=5?3:c.builderSkill.projects>=2?2:1;}
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
const samePoint=(a,b)=>a&&b&&Math.hypot(a.x-b.x,a.y-b.y)<1e-6;
function clearSignSegment(s,c,a,b,first=false){
 // Founders begin inside their own home; the first step is its real doorway.
 const view=first?{...s,buildings:s.buildings.filter(b=>buildingKey(b)!==c.home)}:s;
 return navigationSegmentClear(view,a,b);
}
function signPathValid(s,c,g){
 const route=c?.route;if(!Array.isArray(route)||route.length<2||route.length>WIDTH*HEIGHT*2||!Number.isInteger(c.routeIndex)||c.routeIndex<1||c.routeIndex>route.length||!samePoint(route[0],g.signOrigin)||!samePoint(route.at(-1),g.signTarget))return false;
 return route.every((p,i)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-.5&&p.x<=WIDTH-.5&&p.y>=-.5&&p.y<=HEIGHT-.5&&(!i||clearSignSegment(s,c,route[i-1],p,i===1)));
}

function signRoute(s,c){
 const net=networkFor(s),home=net.ports.find(p=>buildingKey(p.building)===c.home),target=s.relicQuest?.site?.shore;if(!home||!target)return null;
 const goal=[...net.nodes.values()].filter(n=>Math.hypot(n.x-target.x,n.y-target.y)<.8).sort((a,b)=>Math.hypot(a.x-target.x,a.y-target.y)-Math.hypot(b.x-target.x,b.y-target.y)).find(n=>net.components.get(n.key)===net.components.get(home.key));
 const route=goal&&routeBetween(s,home.key,goal.key),points=route?.length?[{x:c.x,y:c.y},...route.map(n=>({x:n.x,y:n.y}))]:null;return points&&points.every((p,i)=>!i||clearSignSegment(s,c,points[i-1],p,i===1))?points:null;
}
export function beginFirstSign(s,id){
 reconcileWitness(s);const g=s.godhood;if(!isAwakening(s)||g.stage!=='unseen')return {ok:false,reason:'Первый знак уже подан'};
 if(s.lost||s.funeral||s.event)return {ok:false,reason:'Дождись завершения события'};
 let chosen=null,route=null;for(const c of s.citizens.filter(c=>(id===undefined||c.id===id)&&c.age>=16&&c.health>=60&&['home','resting','blocked'].includes(c.phase)&&!c.site&&!c.workplace&&!cargo(c)&&!c.waterTrip&&!c.clinic&&!c.pantryTrip)){const r=signRoute(s,c);if(r){chosen=c;route=r;break;}}
 if(!chosen)return {ok:false,reason:'Пусть здоровый свободный взрослый вернётся домой; нужен доступный берег'};
 g.stage='sign';g.witnessId=chosen.id;g.signTarget={...route.at(-1)};g.signOrigin={x:chosen.x,y:chosen.y};chosen.phase='awakening';chosen.route=route;chosen.routeIndex=1;chosen.work=null;chosen.site=null;invalidateAssignments(s);return {ok:true,citizenId:chosen.id};
}
export function advanceGodhood(s,dt){
 if(!isAwakening(s)||!Number.isFinite(dt)||dt<=0)return;reconcileWitness(s);const g=s.godhood;if(g.stage!=='sign')return;
 const c=s.citizens.find(c=>c.id===g.witnessId);
 if(!c||c.phase!=='awakening'||s.funeral||cargo(c)||!signPathValid(s,c,g)){loseSign(s,c);return;}
 let left=dt;while(left>1e-8&&c.routeIndex<c.route.length){const p=c.route[c.routeIndex],d=Math.hypot(c.x-p.x,c.y-p.y);if(!clearSignSegment(s,c,c,p,c.routeIndex===1)){loseSign(s,c);return;}const moved=Math.min(d,left*.95);if(d>1e-8){c.x+=(p.x-c.x)*moved/d;c.y+=(p.y-c.y)*moved/d;}left-=moved/.95;if(d<=moved+1e-8)c.routeIndex++;else break;}
 if(c.routeIndex<c.route.length)return;if(!samePoint(c,g.signTarget)){loseSign(s,c);return;}
 const first=g.recognitionAt===null;g.stage='recognized';if(first)g.recognitionAt=s.simTime||0;if(!g.believerIds.includes(c.id))g.believerIds.push(c.id);
 if(first)s.resources.faith+=1;c.faith=Math.max(c.faith,65);
 if(first){s.name='Услышанный у воды';if(!s.divinity.names.includes(s.name))s.divinity.names.push(s.name);}
 const route=[...c.route].reverse();c.phase='toHome';c.route=route;c.routeIndex=1;invalidateAssignments(s);
 s.news.unshift({title:first?'Первый, кто услышал':'Новое свидетельство',text:`Житель ${c.id+1} заметил знак и дошёл до источника. ${first?'Теперь он признаёт твоё присутствие: +1 вера.':'Он признаёт твоё присутствие; первая награда уже была получена.'} Вдохнови его строителем.`,kind:'good',year:s.year,season:s.season,tick:s.tick});s.news=s.news.slice(0,80);
}

export function godhoodCitizenView(s,c){return c.phase==='awakening'?{walking:c.routeIndex<c.route.length,controlled:false}:{};}
function validProjectStamp(value){
 if(typeof value!=='string'||value.length>128)return false;
 const match=/^(.*):([123])$/.exec(value);if(!match)return false;const key=match[1],building=/^(\d+),(\d+)$/.exec(key);
 if(building)return Number(building[1])<WIDTH&&Number(building[2])<HEIGHT;
 const road=/^road:(\d+),(\d+)\|(\d+),(\d+)$/.exec(key);if(!road)return false;
 const [x,y,u,v]=road.slice(1).map(Number);return Math.max(x,u)<=WIDTH&&Math.max(y,v)<=HEIGHT&&Math.abs(x-u)+Math.abs(y-v)===1;
}
export function validateGodhood(s){
 const g=s.godhood;if(g===undefined)return !(s.citizens||[]).some(c=>c.phase==='awakening');
 const id=n=>Number.isSafeInteger(n)&&n>=0&&n<s.demography.nextId,point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-.5&&p.x<=WIDTH-.5&&p.y>=-.5&&p.y<=HEIGHT-.5&&isDryPoint(s,p.x,p.y);
 if(!g||typeof g!=='object'||Array.isArray(g)||g.version!==1||!['awakening','mature'].includes(g.mode)||!['unseen','sign','recognized'].includes(g.stage)||!Array.isArray(g.believerIds)||new Set(g.believerIds).size!==g.believerIds.length||g.believerIds.some(n=>!id(n))||typeof g.firstBuilderGift!=='boolean'||!Array.isArray(g.completedProjects)||g.completedProjects.length>10000||new Set(g.completedProjects).size!==g.completedProjects.length||g.completedProjects.some(v=>!validProjectStamp(v)))return false;
 if(g.witnessId!==null&&!id(g.witnessId)||g.recognitionAt!==null&&(!Number.isFinite(g.recognitionAt)||g.recognitionAt<0||g.recognitionAt>(s.simTime||0)+.1))return false;
 if(g.signTarget!==null&&!point(g.signTarget)||g.signOrigin!==null&&!point(g.signOrigin))return false;
 if(g.mode==='mature'&&(g.stage!=='recognized'||g.witnessId!==null||g.signTarget!==null||g.signOrigin!==null||g.recognitionAt!==null||g.believerIds.length||g.firstBuilderGift||g.completedProjects.length))return false;
 if(g.mode==='awakening'){
  if(g.stage==='unseen'&&(g.witnessId!==null||g.signTarget!==null||g.signOrigin!==null))return false;
  if(g.stage==='recognized'&&(g.witnessId===null||g.recognitionAt===null||!g.believerIds.includes(g.witnessId)))return false;
  if(g.recognitionAt===null&&(g.believerIds.length||g.firstBuilderGift||g.completedProjects.length))return false;
  if(g.stage==='sign'){const c=s.citizens.find(c=>c.id===g.witnessId);if(!point(g.signTarget)||!point(g.signOrigin)||!c||c.age<16||c.phase!=='awakening'||cargo(c)||!signPathValid(s,c,g))return false;}
 }
 if(s.citizens.some(c=>c.phase==='awakening'&&(g.mode!=='awakening'||g.stage!=='sign'||c.id!==g.witnessId)))return false;
 return s.citizens.every(c=>c.builderSkill===undefined||c.builderSkill&&typeof c.builderSkill==='object'&&!Array.isArray(c.builderSkill)&&Number.isInteger(c.builderSkill.projects)&&c.builderSkill.projects>=0&&c.builderSkill.projects<=10000&&c.builderSkill.level===(c.builderSkill.projects>=5?3:c.builderSkill.projects>=2?2:1));
}
