import {citizenName,BUILDINGS} from './definitions.js';
import {mealRation,workRate} from './wellbeing.js';
import {displayName,syncCitizenEpithets} from './citizen-epithets.js';
import {PROFESSION_NAMES,professionRole} from './professions.js';

export const LIFE_HISTORY_LIMIT=160;
export const LIFE_CAUSE_NAMES={oldAge:'Старость',starvation:'Голод',unknown:'Причина неизвестна'};
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const finite=(n,min=0,max=1e12)=>Number.isFinite(n)&&n>=min&&n<=max;
const tick=s=>s.tick||0;
const epithetRecord=c=>({...c.epithet?{epithet:{...c.epithet}}:{},...c.epithetHistory?{epithetHistory:c.epithetHistory.map(row=>({...row}))}:{}});
const identity=(c,s)=>({id:c.id,name:citizenName(c.id),age:c.age??null,sex:c.sex??null,parents:[...(c.parents||[])],partner:c.partner??null,generation:c.generation||1,home:c.home||null,firstSeenTick:tick(s),bornTick:null,diedTick:null,cause:null,...epithetRecord(c)});

/** Explicit simulation hooks only. Views below never initialise/mutate state.
 * Missing old-save ancestors stay unknown: an ID is not evidence of a life. */
export function initializeLifeAnalytics(s){
 if(s.lifeAnalytics!==undefined)return s.lifeAnalytics;
 s.lifeAnalytics={version:1,startedTick:tick(s),baseline:{births:s.demography?.births||0,deaths:s.deaths||0},people:(s.citizens||[]).map(c=>identity(c,s)),history:[]};
 return s.lifeAnalytics;
}
export function syncLifeAnalytics(s){
 const a=initializeLifeAnalytics(s),byId=new Map(a.people.map(p=>[p.id,p]));
 for(const c of s.citizens||[]){let p=byId.get(c.id);if(!p){p=identity(c,s);a.people.push(p);byId.set(c.id,p);}if(p.diedTick!==null)continue;Object.assign(p,{age:c.age??null,sex:c.sex??null,parents:[...(c.parents||[])],partner:c.partner??null,generation:c.generation||1,home:c.home||null,...epithetRecord(c)});}
 const living=new Set((s.citizens||[]).map(c=>c.id));for(const p of a.people)if(p.diedTick===null&&!living.has(p.id)){p.diedTick=tick(s);p.cause='unknown';}
 return a;
}
export function recordLifeBirth(s,c){const a=initializeLifeAnalytics(s);let p=a.people.find(p=>p.id===c.id);if(!p){p=identity(c,s);a.people.push(p);}if(p.diedTick===null)p.bornTick??=tick(s);return p;}
export function recordLifeDeath(s,c,cause='unknown'){
 const a=initializeLifeAnalytics(s);let p=a.people.find(p=>p.id===c.id);if(!p){p=identity(c,s);a.people.push(p);}if(p.diedTick!==null)return p;
 // Call before deletion, while age, home and kinship are still available.
 if(c.age!==undefined)p.age=c.age;if(c.parents)p.parents=[...c.parents];if(c.partner!==undefined)p.partner=c.partner;
 Object.assign(p,epithetRecord(c));p.diedTick=tick(s);p.cause=Object.hasOwn(LIFE_CAUSE_NAMES,cause)?cause:'unknown';return p;
}
export function snapshotLifeAnalytics(s){
 syncCitizenEpithets(s);
 const a=syncLifeAnalytics(s),m=lifeAnalytics(s),row={tick:tick(s),population:m.population,children:m.ages.children,adults:m.ages.adults,elders:m.ages.elders,births:m.births,deaths:m.deaths,causes:{...m.causes},health:m.average.health,mood:m.average.mood,hunger:m.average.hunger,thirst:m.average.thirst,faith:m.average.faith};
 if(a.history.at(-1)?.tick===row.tick)a.history[a.history.length-1]=row;else a.history.push(row);
 if(a.history.length>LIFE_HISTORY_LIMIT)a.history.splice(0,a.history.length-LIFE_HISTORY_LIMIT);return row;
}
export function validateLifeAnalytics(s){
 const a=s.lifeAnalytics;if(!a||a.version!==1||!integer(a.startedTick)||a.startedTick>tick(s)||!a.baseline||!integer(a.baseline.births)||!integer(a.baseline.deaths)||!Array.isArray(a.people)||a.people.length>100000||!Array.isArray(a.history)||a.history.length>LIFE_HISTORY_LIMIT)return false;
 const ids=new Map(),living=new Set((s.citizens||[]).map(c=>c.id));
 for(const p of a.people){if(!p||!integer(p.id)||(integer(s.demography?.nextId)&&p.id>=s.demography.nextId)||ids.has(p.id)||typeof p.name!=='string'||p.name.length>160||!(p.age===null||finite(p.age,0,100))||![null,'m','f'].includes(p.sex)||!Array.isArray(p.parents)||![0,2].includes(p.parents.length)||new Set(p.parents).size!==p.parents.length||p.parents.some(id=>!integer(id)||id>=p.id)||!(p.partner===null||integer(p.partner)&&p.partner!==p.id)||!integer(p.generation)||p.generation<1||!(p.home===null||typeof p.home==='string'&&/^\d+,\d+$/.test(p.home))||!integer(p.firstSeenTick)||p.firstSeenTick<a.startedTick||p.firstSeenTick>tick(s)||!(p.bornTick===null||integer(p.bornTick)&&p.bornTick>=a.startedTick&&p.bornTick<=p.firstSeenTick)||!(p.diedTick===null||integer(p.diedTick)&&p.diedTick>=p.firstSeenTick&&p.diedTick<=tick(s))||!(p.diedTick===null?p.cause===null:Object.hasOwn(LIFE_CAUSE_NAMES,p.cause))||living.has(p.id)!==(p.diedTick===null))return false;ids.set(p.id,p);}
 if([...living].some(id=>!ids.has(id)))return false;
 let previous=-1,previousRow=null;for(const h of a.history){if(!h||!integer(h.tick)||h.tick<a.startedTick||h.tick>tick(s)||h.tick<=previous||!['population','children','adults','elders','births','deaths'].every(k=>integer(h[k]))||h.children+h.adults+h.elders!==h.population||!h.causes||!Object.keys(LIFE_CAUSE_NAMES).every(k=>integer(h.causes[k]))||Object.values(h.causes).reduce((a,b)=>a+b,0)!==h.deaths||!['health','mood','hunger','thirst','faith'].every(k=>h[k]===null||finite(h[k],0,100)))return false;if(previousRow&&(h.births<previousRow.births||h.deaths<previousRow.deaths||Object.keys(LIFE_CAUSE_NAMES).some(k=>h.causes[k]<previousRow.causes[k])))return false;previous=h.tick;previousRow=h;}
 return true;
}

export function lifeAnalytics(s){
 const live=s.citizens||[],stored=s.lifeAnalytics?.people||live.map(c=>identity(c,s)),byId=new Map(live.map(c=>[c.id,c])),homes=new Map((s.buildings||[]).filter(b=>b.type==='house').map(b=>[`${b.x},${b.y}`,b])),buildings=new Map((s.buildings||[]).map(b=>[`${b.x},${b.y}`,b]));
 const people=stored.map(p=>{const c=byId.get(p.id),home=c&&homes.get(c.home),work=c&&buildings.get(c.workplace||c.work),naming={...p,...c,name:p.name};return {...p,...epithetRecord(c||p),baseName:p.name,name:displayName(s,naming),...(c?{age:c.age,parents:[...(c.parents||[])],partner:c.partner??null,home:c.home}:{}),alive:!!c,role:c?.role||null,calling:c?.calling||null,professionLabel:c?PROFESSION_NAMES[c.calling&&professionRole(c.calling)===c.role?c.calling:c.role||'auto']||c.role:null,workplace:c?.workplace||c?.work||null,workLabel:work?BUILDINGS[work.type]?.name||work.type:null,phase:c?.phase||null,hunger:c?.hunger??null,health:c?.health??null,mood:c?.mood??null,faith:c?.faith??null,thirst:c?.thirst??null,mealEaten:c?.mealEaten??null,mealRequired:c?mealRation(c):null,homeFood:home?(home.pantry||0):null,homeWater:home?.water??null,workRate:c&&c.age>=16?workRate(c,c.siteDuty||buildings.get(c.work)?.type||c.role):null,missedMeals:c?.missedMeals??null};});
 const ages={children:0,adults:0,elders:0},buckets=Array.from({length:9},(_,i)=>({label:i===8?'80+':`${i*10}–${i*10+9}`,count:0})),causes={oldAge:0,starvation:0,unknown:0};
 for(const c of live){ages[c.age<16?'children':c.age<55?'adults':'elders']++;buckets[Math.min(8,Math.floor((c.age||0)/10))].count++;}
 for(const p of people)if(p.diedTick!==null&&Object.hasOwn(causes,p.cause))causes[p.cause]++;
 const average=Object.fromEntries(['age','health','mood','hunger','thirst','faith'].map(k=>{const values=live.map(c=>c[k]).filter(Number.isFinite);return[k,values.length?values.reduce((a,b)=>a+b,0)/values.length:null];}));
 const distribution=(key,limits,labels)=>labels.map((label,i)=>({label,count:live.filter(c=>Number.isFinite(c[key])&&c[key]>=(limits[i-1]??-Infinity)&&c[key]<(limits[i]??Infinity)).length}));
 const distributions={health:distribution('health',[60,85],['Ниже 60%','60–84%','85–100%']),hunger:distribution('hunger',[10,30],['Меньше 10%','10–29%','30% и выше']),thirst:distribution('thirst',[10,30],['Меньше 10%','10–29%','30% и выше']),faith:distribution('faith',[25,50,75],['Меньше 25%','25–49%','50–74%','75–100%'])};
 for(const [key,rows] of Object.entries(distributions)){const missing=live.filter(c=>!Number.isFinite(c[key])).length;if(missing)rows.push({label:'Нет данных',count:missing});}
 const activity=[['working','Работают'],['carrying','С грузом'],['travel','В пути'],['care','Лечатся / учатся'],['rest','Дома / отдыхают'],['blocked','Путь закрыт'],['child','Дети'],['other','Другие занятия']].map(([key,label])=>({key,label,count:0}));
 const load=c=>Object.values(c.cargo||{}).some(n=>n>0)||Object.values(c.buildCargo||{}).some(n=>n>0)||(c.waterTrip?.load||0)>0||['pantryFood','seedFood','clothingLoad','craftAmount','craftWool','craftCloth'].some(k=>c[k]>0);
 for(const c of live){const key=c.age<16?'child':['working','constructing'].includes(c.phase)?'working':load(c)?'carrying':c.phase==='blocked'?'blocked':c.clinic||c.school||['treatment','studying'].includes(c.phase)?'care':['home','resting'].includes(c.phase)?'rest':/^(to|return)/.test(c.phase||'')?'travel':'other';activity.find(r=>r.key===key).count++;}
 const roles=new Map();for(const c of live.filter(c=>c.age>=16)){const role=c.calling&&professionRole(c.calling)===c.role?c.calling:c.role||'auto',label=PROFESSION_NAMES[role]||role;roles.set(role,{key:role,label,count:(roles.get(role)?.count||0)+1});}
 const households=[...new Set(live.map(c=>c.home).filter(Boolean))],inspired=live.filter(c=>c.calling&&c.calling!=='auto').length;
 return {people,population:live.length,ages,buckets,average,distributions,activity,professions:[...roles.values()].sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'ru')),inspired,uninspired:live.length-inspired,households:households.length,partnered:live.filter(c=>c.partner!==null&&c.partner!==undefined&&byId.has(c.partner)).length,births:people.filter(p=>p.bornTick!==null).length,deaths:people.filter(p=>p.diedTick!==null).length,causes,workers:live.filter(c=>c.age>=16).length,working:live.filter(c=>['working','constructing'].includes(c.phase)).length,hungry:live.filter(c=>(c.hunger||0)>=30).length,thirsty:live.filter(c=>(c.thirst||0)>=30).length,ill:live.filter(c=>(c.health??100)<60).length,history:(s.lifeAnalytics?.history||[]).map(h=>({...h,causes:{...h.causes}})),startedTick:s.lifeAnalytics?.startedTick??tick(s),baseline:{...(s.lifeAnalytics?.baseline||{births:0,deaths:0})}};
}
/** Flat generation rows carry parent links for connecting branches. Limits protect
 * UI against damaged saves and very large pedigrees; the persistent registry stays whole. */
export function familyTree(s,id,{maxDepth=8,maxNodes=250,model=null}={}){
 const m=model||lifeAnalytics(s),byId=new Map(m.people.map(p=>[p.id,p])),children=new Map();for(const p of m.people)for(const parent of p.parents){if(!children.has(parent))children.set(parent,[]);children.get(parent).push(p.id);}
 const person=n=>byId.get(n)||{id:n,name:`Житель #${n}`,unknown:true,parents:[],alive:false},selected=byId.get(id);if(!selected)return {selected:null,ancestors:[],descendants:[],partner:null,siblings:[],truncated:false};
 let truncated=false;const walk=direction=>{const seen=new Set([id]),queue=[{id,depth:0}],out=[];for(let i=0;i<queue.length;i++){const at=queue[i],next=direction==='up'?person(at.id).parents:children.get(at.id)||[];for(const n of next){if(seen.has(n))continue;if(at.depth>=maxDepth||out.length>=maxNodes){truncated=true;continue;}seen.add(n);const node={...person(n),depth:at.depth+1,via:at.id};out.push(node);queue.push(node);}}return out;};
 return {selected,ancestors:walk('up'),descendants:walk('down'),partner:selected.partner===null?null:person(selected.partner),siblings:m.people.filter(p=>p.id!==id&&p.parents.some(n=>selected.parents.includes(n))),truncated};
}
