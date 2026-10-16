import {roadUpgradeCost,roadKey} from './roads.js';
import {createOrder,isComplete,nextOrder,constructionEntities,workRequired} from './construction.js';
import {WIDTH,HEIGHT,terrain,river,bridgeSpan,initializeWorld,nearDeposit,isShore,validateWorld,isDryPoint} from './world.js';
import {BUILDINGS,MIRACLES,RESOURCE_NAMES,MATERIALS,levelOf,capacityOf,outputMultiplier,buildingKey,storageOf,housingOf} from './definitions.js';
import {syncCitizens,advanceWorkers,workforceStats} from './workforce.js';
import {createDivinity,registerMiracle} from './divinity.js';
export {WIDTH,HEIGHT,terrain,river,bridgeSpan,BUILDINGS,MIRACLES};
export const VERSION=3;
export const SEASONS=['Весна','Лето','Осень','Зима'];
const emptyResources=()=>({food:0,clay:0,reed:0,wood:0,stone:0,hides:0,faith:0,prestige:0});
const emptyBuffs=()=>({fertility:0,inspiration:0,haste:0,sunlight:0});
export function log(s,title,text='',kind='info'){const last=s.news[0];if(last&&last.title===title&&last.tick===s.tick)return;s.news.unshift({title,text,kind,year:s.year,season:s.season,tick:s.tick});s.news=s.news.slice(0,80);}
export function createGame(){
 const s={version:VERSION,year:1,season:0,tick:0,seasonElapsed:0,simTime:0,population:12,capacity:16,happiness:75,rngState:117,roads:[],resources:{food:100,clay:90,reed:45,wood:20,stone:0,hides:0,faith:25,prestige:10},buildings:[{type:'house',x:8,y:8,level:1},{type:'house',x:9,y:9,level:1},{type:'field',x:12,y:8,level:1},{type:'clay',x:7,y:7,level:1},{type:'shrine',x:9,y:8,level:1}],cooldowns:Object.fromEntries(Object.keys(MIRACLES).map(k=>[k,0])),buffs:emptyBuffs(),divinity:createDivinity(),citizens:[],deliveries:0,delivered:emptyResources(),lastDelivery:null,drought:0,rain:0,droughtSeen:false,memories:[],news:[],event:null,won:false,lost:false,continued:false,hungry:0,miracleCount:0,name:'Безымянный дух',achievements:[]};
 initializeWorld(s);syncCitizens(s);log(s,'У города появился покровитель','Двенадцать жителей оставили у реки первое подношение. Храм принимает первые грузы; рабочие отправляются на поля и в карьер.','good');return s;
}
export const count=(s,type)=>s.buildings.filter(b=>b.type===type&&isComplete(b)).length;
export const storage=storageOf;
export function workers(s){const needed=s.buildings.filter(b=>isComplete(b)&&Object.keys(BUILDINGS[b.type].output).length).length*2;return needed?Math.min(1,workforceStats(s).employed/needed):1;}
export function buildingAt(s,x,y){return s.buildings.find(b=>b.x===x&&b.y===y)||s.buildings.find(b=>{if(b.type!=='bridge'||b.y!==y)return false;const span=bridgeSpan(y);return terrain(x,y,s)==='water'&&x>=span.left&&x<=span.right;});}
export function canBuild(s,type,x,y){
 const b=BUILDINGS[type];if(!b)return 'Неизвестная постройка';if(s.lost)return 'Поселение покинуто';if(s.event)return 'Сначала реши судьбу события';if(terrain(x,y,s)==='void')return 'За пределами долины';if(buildingAt(s,x,y))return 'Эта клетка уже занята';
 if(type==='bridge'){
  if(terrain(x,y,s)!=='water'||terrain(x,y)!=='water')return 'Выбери клетку воды: мост соединит оба берега';
  if(s.buildings.some(b=>b.type==='bridge'&&b.y===y))return 'На этом участке уже есть мост';
 }else if(terrain(x,y,s)==='water')return 'На воде можно построить мост';
 if(type==='field'&&terrain(x,y,s)!=='fertile')return 'Полю нужна зелёная земля у реки';
 if(['clay','reed','quarry','logging','hunting'].includes(type)&&!nearDeposit(s,({quarry:'stone',logging:'forest',hunting:'wildlife'})[type]||type,x,y))return 'Нужно отмеченное месторождение';
 if(type==='fishing'&&!isShore(s,x,y))return 'Нужна сухая клетка у воды';
 if(type==='ziggurat'&&s.buildings.some(b=>b.type===type))return 'Зиккурат уже построен';if((b.prestige||0)>s.resources.prestige)return `Нужно ${b.prestige} престижа`;
 for(const k of [...MATERIALS,'faith'])if((b[k]||0)>s.resources[k])return `Не хватает: ${RESOURCE_NAMES[k]}`;
 return '';
}
export function build(s,type,x,y){const reason=canBuild(s,type,x,y);if(reason)return {ok:false,reason};for(const k of [...MATERIALS,'faith'])s.resources[k]-=BUILDINGS[type][k]||0;s.buildings.push({type,x,y,level:1,construction:{...createOrder(BUILDINGS[type]),order:nextOrder(s)}});s.capacity=housingOf(s);syncCitizens(s);log(s,`Заложено: ${BUILDINGS[type].name}`,'Материалы зарезервированы. Жители доставят их и возведут здание.','build');check(s);return {ok:true};}
export function upgradeCost(b){const factor=levelOf(b)===1?1.5:2.5;return {clay:Math.ceil(BUILDINGS[b.type].clay*factor),reed:Math.max(4,Math.ceil(BUILDINGS[b.type].reed*factor)),...(levelOf(b)===2?(b.type==='house'?{wood:4,hides:2}:b.type!=='bridge'?{stone:8}:{}):{})};}
export function canUpgrade(s,b){if(!b)return 'Выбери здание';if(b.construction)return 'Строительство уже идёт';if(s.event||s.lost)return 'Сначала заверши событие';if(levelOf(b)>=3)return 'Достигнут третий уровень';const cost=upgradeCost(b);if(MATERIALS.some(k=>(s.resources[k]||0)<(cost[k]||0)))return 'Нужно: '+Object.entries(cost).map(([k,n])=>`${n} ${RESOURCE_NAMES[k]}`).join(', ');return '';}
export function upgrade(s,x,y){const b=buildingAt(s,x,y),reason=canUpgrade(s,b);if(reason)return {ok:false,reason};const cost=upgradeCost(b);for(const [k,n]of Object.entries(cost))s.resources[k]-=n;b.construction={...createOrder(cost,levelOf(b)+1,'upgrade'),order:nextOrder(s)};s.capacity=housingOf(s);syncCitizens(s);log(s,`Улучшение: ${BUILDINGS[b.type].name}`,'Строители доставят материалы. Прежний уровень работает до завершения.','build');check(s);return {ok:true};}
export function yieldSummary(s,b){
 const level=levelOf(b),def=BUILDINGS[b.type];if(b.type==='house')return `Жильё: ${capacityOf(b)} жителей`;
 if(b.type==='granary')return `+${150*level} хранения каждого материала · принимает все грузы`;
 if(b.type==='bridge')return `Соединяет берега · скорость на мосту ×${(1+(level-1)*.25).toFixed(2)}`;
 const output=Object.entries(def.output).map(([k,n])=>`${(n*outputMultiplier(b)).toFixed(n<1?2:1)} ${RESOURCE_NAMES[k]}`).join(' + ');
 return `${output} за рейс работника · 2 рабочих места${b.type==='garden'?` · +${2+2*level} довольства`:''}`;
}
export function miracle(s,id){
 const m=MIRACLES[id];if(!m)return {ok:false,reason:'Неизвестное чудо'};if(s.event||s.lost)return {ok:false,reason:'Сначала заверши текущее событие'};if(s.cooldowns[id])return {ok:false,reason:`Будет доступно через ${s.cooldowns[id]} сез.`};if(s.resources.faith<m.cost)return {ok:false,reason:`Нужно ${m.cost} веры`};if(id==='abundance'&&s.resources.food>=storage(s))return {ok:false,reason:'Амбары уже полны'};
 if(['bless','healing'].includes(id)&&s.population>=s.capacity&&s.happiness>=100)return {ok:false,reason:'Город уже счастлив; для новых жителей нужны дома'};
 s.resources.faith-=m.cost;s.cooldowns[id]=m.cooldown;s.miracleCount++;
 if(!s.memories.includes('first')){s.memories.push('first');log(s,'Первое чудо','Люди запомнят этот день. У святилища зажгли огни.','good');}
 const oldName=s.name;registerMiracle(s,m.domain);
 if(id==='rain'){if(s.drought){if(!s.memories.includes('rain'))s.memories.push('rain');log(s,'Дождь победил засуху','Поля ожили. Люди запомнят, как ты вернул воду.','good');}s.drought=0;s.rain=2;}
 if(id==='abundance')s.resources.food=Math.min(storage(s),s.resources.food+45);
 if(id==='bless'||id==='healing'){s.happiness=Math.min(100,s.happiness+(id==='bless'?15:10));s.population+=Math.max(0,Math.min(id==='bless'?3:6,s.capacity-s.population));}
 if(['fertility','inspiration','haste','sunlight'].includes(id))s.buffs[id]=3;
 if(id==='sunlight')s.happiness=Math.min(100,s.happiness+10);
 if(id==='revelation'){s.resources.faith+=20;s.resources.prestige+=12;}
 if(id==='stars')s.resources.prestige+=18;
 if(id==='peace')s.happiness=Math.min(100,s.happiness+25);
 if(id==='shaping'){s.resources.clay+=60;s.resources.reed+=40;}
 log(s,m.name,m.desc,'miracle');if(s.name!==oldName)log(s,`Новое имя: ${s.name}`,'Люди называют тебя по твоим деяниям. Все заслуженные имена остаются в пантеоне.','good');syncCitizens(s);check(s);return {ok:true};
}
function check(s){
 s.capacity=housingOf(s);
 if(s.population<=0){s.population=0;s.lost=true;s.event=null;syncCitizens(s);return;}
 const hasMiracles=Object.values(s.divinity.domains).some(v=>v>0);
 if(s.population>=24&&!s.achievements.includes('population')){s.achievements.push('population');log(s,'Поселение стало городом','Двадцать четыре человека называют это место домом.','good');}
 if(s.resources.food>=150&&!s.achievements.includes('food')){s.achievements.push('food');if(!hasMiracles){s.name='Наполняющий амбары';if(!s.divinity.names.includes(s.name))s.divinity.names.push(s.name);}log(s,'Полные амбары','Запас еды достиг 150. Город встречает будущее с надеждой.','good');}
 if(s.population>=30&&!s.achievements.includes('keeper')){s.achievements.push('keeper');if(!hasMiracles){s.name='Хранитель людей';if(!s.divinity.names.includes(s.name))s.divinity.names.push(s.name);}}
 if(s.year>=10&&s.population>=30&&count(s,'ziggurat')&&!s.won){s.won=true;log(s,'Город коснулся неба','Великий зиккурат возвышается над долиной. Твоё имя останется в веках.','good');}
}
function settleSeason(s){
 s.tick++;s.season=s.tick%4;s.year=1+Math.floor(s.tick/4);
 for(const k of Object.keys(s.cooldowns))s.cooldowns[k]=Math.max(0,s.cooldowns[k]-1);
 // Production is already in citizens' delivered cargo. Never credit it here.
 const food=s.population*.6,fed=s.resources.food>=food;s.resources.food=Math.max(0,s.resources.food-food);s.hungry=fed?0:s.hungry+1;
 const gardenJoy=s.buildings.filter(b=>b.type==='garden'&&isComplete(b)).reduce((n,b)=>n+2+2*levelOf(b),0),target=fed?Math.min(95,72+gardenJoy):12;s.happiness=Math.max(0,Math.min(100,s.happiness+(target-s.happiness)*.3));
 if(!fed){log(s,'В амбарах не хватает еды','Проверь поля, работников и дороги к складу. Люди теряют надежду.','bad');if(s.hungry>=2){const n=Math.min(s.population,Math.max(2,Math.ceil(s.population*.12)));s.population-=n;log(s,'Люди покидают город',`Голод унёс ${n} жителей. Город слабеет.`,'bad');}}
 else if(s.happiness>60&&s.population<s.capacity){const n=Math.min(2,s.capacity-s.population);s.population+=n;log(s,'Новые жители',`К городу присоединились ${n} человека. Их привлекли сытые амбары и твоя защита.`,'good');}
 s.drought=Math.max(0,s.drought-1);s.rain=Math.max(0,s.rain-1);for(const k of Object.keys(s.buffs))s.buffs[k]=Math.max(0,s.buffs[k]-1);
 if(s.season===0){
  log(s,`Начался ${s.year}-й год`,`В городе ${s.population} жителей. В амбарах ${Math.floor(s.resources.food)} еды.`,'year');
  if(s.year===3||(!s.droughtSeen&&s.year>=4)){s.drought=3;s.droughtSeen=true;log(s,'На долину опустилась засуха','Урожай полей уменьшился вдвое на три сезона. Небесный дождь может спасти посевы.','bad');}
  else if(s.year%5===0)s.event={id:'refugees',title:'Люди у городских ворот',text:'Три семьи покинули истощённые земли. Прими до шести жителей за 20 еды — если для них найдётся жильё.'};
  else if(s.year%4===0)s.event={id:'caravan',title:'Караван из дальних земель',text:'Купцы предлагают 25 глины и 20 тростника за 35 еды. Торговать или сохранить запасы?'};
  else if(s.year%3===1){s.resources.food+=Math.max(0,Math.min(30,storage(s)-s.resources.food));log(s,'Щедрый разлив','Река принесла плодородный ил. Общие амбары получили 30 еды.','good');}
  else s.event={id:'festival',title:'Ночь тысячи огней',text:'Жрецы предлагают праздник у воды. 20 еды превратятся в 15 веры, 5 престижа и 10 довольства.'};
 }
 syncCitizens(s);check(s);
}
export function advanceTime(s,seconds){
 if(s.lost||s.event||!Number.isFinite(seconds)||seconds<=0)return 0;
 let remaining=Math.min(seconds,3600),advanced=0;
 while(remaining>1e-7&&!s.lost&&!s.event){
  const dt=Math.min(remaining,45-s.seasonElapsed);advanceWorkers(s,dt);s.seasonElapsed+=dt;remaining-=dt;advanced+=dt;
  if(s.seasonElapsed>=45-1e-7){s.seasonElapsed=0;settleSeason(s);}
 }
 check(s);return advanced;
}
export function advanceSeason(s){return advanceTime(s,45-s.seasonElapsed)>0;}
export function eventReason(s){if(!s.event)return 'Нет события';const price={caravan:35,refugees:20,festival:20}[s.event.id];if(s.resources.food<price)return `Нужно ${price} еды`;if(s.event.id==='refugees'&&s.population>=s.capacity)return 'Нет свободного жилья';return '';}
export function resolveEvent(s,choice){
 if(!s.event||!['accept','skip'].includes(choice))return {ok:false,reason:'Нет такого решения'};
 if(choice==='accept'){
  const reason=eventReason(s);if(reason)return {ok:false,reason};const id=s.event.id;s.resources.food-=id==='caravan'?35:20;
  if(id==='caravan'){s.resources.clay+=25;s.resources.reed+=20;}if(id==='refugees')s.population+=Math.min(6,s.capacity-s.population);if(id==='festival'){s.resources.faith+=15;s.resources.prestige+=5;s.happiness=Math.min(100,s.happiness+10);}
 }
 log(s,s.event.title,choice==='accept'?'Город принял твоё решение.':'Город сохранил запасы и продолжил свой путь.',choice==='accept'?'good':'info');s.event=null;syncCitizens(s);check(s);return {ok:true};
}
export function goals(s){return [{label:'Построить новое поле',done:count(s,'field')>=2},{label:'Поселить 24 жителя',done:s.achievements.includes('population')},{label:'Спасти поля от засухи',done:s.memories.includes('rain')},{label:'Набрать 50 престижа',done:s.resources.prestige>=50},{label:'Возвести зиккурат и встретить 10-й год с 30 жителями',done:s.won}];}
export const encode=s=>JSON.stringify(s);
export function decode(raw){
 try{
  const s=JSON.parse(raw),legacy=s?.version===1,old=s?.version<3;
  if(!s||![1,2,VERSION].includes(s.version))return null;
  if(legacy){
   s.version=VERSION;s.simTime=s.tick*45;s.seasonElapsed=0;s.citizens=[];s.deliveries=0;s.delivered=emptyResources();s.lastDelivery=null;s.buffs=emptyBuffs();s.divinity=createDivinity();
   if(s.memories?.includes('rain'))s.divinity.domains.water=1;
   if(!s.divinity.names.includes(s.name))s.divinity.names.push(s.name);
   s.cooldowns={...Object.fromEntries(Object.keys(MIRACLES).map(k=>[k,0])),...s.cooldowns};
   if(Array.isArray(s.buildings))s.buildings=s.buildings.map(b=>({...b,level:1}));
  }
  if(old){
   const migrate=r=>{if(!r)return; r.food=(r.food||0)+(r.grain||0);delete r.grain;for(const k of MATERIALS)r[k]??=0;};
   migrate(s.resources);migrate(s.delivered);for(const c of s.citizens||[])if(c.cargo?.grain!==undefined){c.cargo.food=(c.cargo.food||0)+c.cargo.grain;delete c.cargo.grain;}
   if(s.lastDelivery?.cargo?.grain!==undefined){s.lastDelivery.cargo.food=(s.lastDelivery.cargo.food||0)+s.lastDelivery.cargo.grain;delete s.lastDelivery.cargo.grain;}
   for(const b of s.buildings||[])if(b.construction)b.construction.legacyPrice=true;
   s.version=VERSION;s.roads=[];s.rngState=117;
  }
  initializeWorld(s);
  const finite=(v,min=0,max=1e9)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
  const integer=(v,min=0,max=1e6)=>Number.isInteger(v)&&v>=min&&v<=max;
  if(!integer(s.tick)||!integer(s.year,1)||s.year!==1+Math.floor(s.tick/4)||s.season!==s.tick%4||!integer(s.population)||!integer(s.capacity)||!finite(s.happiness,0,100))return null;
  for(const k of Object.keys(emptyResources()))if(!finite(s.resources?.[k])||!finite(s.delivered?.[k]))return null;
  if(!finite(s.simTime)||!finite(s.seasonElapsed,0,44.99999999)||Math.abs(s.simTime-(s.tick*45+s.seasonElapsed))>.001||!integer(s.deliveries))return null;
  if(!Array.isArray(s.buildings)||s.buildings.length>WIDTH*HEIGHT)return null;
  if(!validateWorld(s)||!Number.isInteger(s.rngState)||s.rngState<0||s.rngState>4294967295||!Array.isArray(s.roads)||s.roads.length>WIDTH*HEIGHT*4)return null;
  const roadIds=new Set();for(const r of s.roads){if(r.type!=='road'||!integer(r.level,1,3)||typeof r.id!=='string'||roadIds.has(r.id)||!r.a||!r.b||!finite(r.x,-.5,WIDTH)||!finite(r.y,-.5,HEIGHT)||Math.abs(Math.abs(r.a.x-r.b.x)+Math.abs(r.a.y-r.b.y)-1)>1e-7||[r.a,r.b,{x:r.x,y:r.y}].some(p=>!isDryPoint(s,p.x,p.y))||r.id!==roadKey(r.a,r.b)||r.x!==(r.a.x+r.b.x)/2||r.y!==(r.a.y+r.b.y)/2)return null;roadIds.add(r.id);}
  const cells=new Set(),bridgeRows=new Set();
  for(const b of s.buildings){
   const key=buildingKey(b),land=terrain(b.x,b.y,s);
   if(!BUILDINGS[b.type]||land==='void'||cells.has(key)||!integer(b.level,1,3))return null;
   if(b.type==='bridge'){if(land!=='water'||bridgeRows.has(b.y))return null;bridgeRows.add(b.y);}
   else if(land==='water'||b.type==='field'&&land!=='fertile')return null;
   cells.add(key);
  }
  if(s.roadAnchors!==undefined&&(!Array.isArray(s.roadAnchors)||s.roadAnchors.length>WIDTH*HEIGHT||s.roadAnchors.some(b=>terrain(b.x,b.y,s)==='void'||!['road'].includes(b.type))))return null;
  if(count(s,'ziggurat')>1||s.capacity!==housingOf(s)||s.population>s.capacity)return null;
  for(const [k,m]of Object.entries(MIRACLES))if(!integer(s.cooldowns?.[k],0,m.cooldown))return null;
  for(const k of Object.keys(emptyBuffs()))if(!integer(s.buffs?.[k],0,3))return null;
  for(const k of ['drought','rain','hungry','miracleCount'])if(!integer(s[k]))return null;
  for(const k of ['droughtSeen','won','lost','continued'])if(typeof s[k]!=='boolean')return null;
  if(s.lost!==(s.population===0)||s.lost&&s.event!==null||s.continued&&!s.won)return null;
  if(typeof s.name!=='string'||s.name.length>100)return null;
  for(const k of ['memories','achievements'])if(!Array.isArray(s[k])||s[k].some(v=>typeof v!=='string'))return null;
  if(!s.divinity||!Array.isArray(s.divinity.names)||s.divinity.names.some(v=>typeof v!=='string'||v.length>100))return null;
  for(const k of Object.keys(createDivinity().domains))if(!integer(s.divinity.domains?.[k]))return null;
  if(!Array.isArray(s.news)||s.news.length>80||s.news.some(n=>typeof n.title!=='string'||typeof n.text!=='string'||!integer(n.year,1)||!integer(n.season,0,3)||typeof n.kind!=='string'))return null;
  if(s.event!==null&&(!s.event||!['caravan','refugees','festival'].includes(s.event.id)||typeof s.event.title!=='string'||typeof s.event.text!=='string'))return null;
  if(legacy)syncCitizens(s);
  if(!Array.isArray(s.citizens)||s.citizens.length!==s.population)return null;
  const ids=new Set(),buildings=new Map(constructionEntities(s).map(b=>[buildingKey(b),b]));
  const point=p=>p&&finite(p.x,-.5,WIDTH-.5)&&finite(p.y,-.5,HEIGHT-.5);
  for(const c of s.citizens){
   if(!integer(c.id)||ids.has(c.id)||!point(c)||(buildings.get(c.home)?.type!=='house'||!isComplete(buildings.get(c.home)))||!['home','toWork','working','toStore','returnWork','toHome','blocked','toSupply','toSite','constructing','waiting','unloading'].includes(c.phase))return null;
   ids.add(c.id);
   if(c.role!==undefined&&!['auto','builder','carrier','production'].includes(c.role)||c.pendingRole!==undefined&&!['auto','builder','carrier','production'].includes(c.pendingRole)||c.siteDuty!=null&&!['carrier','builder'].includes(c.siteDuty))return null;
   if(c.work!==null&&(!buildings.has(c.work)||!isComplete(buildings.get(c.work))||!Object.keys(BUILDINGS[buildings.get(c.work).type].output).length))return null;
   if(c.store!==null&&!['shrine','granary','house'].includes(buildings.get(c.store)?.type))return null;
   if(!Array.isArray(c.route)||c.route.length>WIDTH*HEIGHT*2||c.route.some(p=>!point(p))||!integer(c.routeIndex,0,c.route.length)||!finite(c.workElapsed,0,60))return null;
   if(!c.cargo||typeof c.cargo!=='object'||Array.isArray(c.cargo)||Object.entries(c.cargo).some(([k,v])=>!(k in emptyResources())||!finite(v,0,1e6)))return null;
   if(c.phase==='home'&&Object.values(c.cargo).some(v=>v>0)||c.phase==='working'&&!c.work)return null;
   if(c.site!=null&&(!buildings.get(c.site)?.construction||typeof c.sitePort!=='string'||!c.store))return null;
   if(['toSupply','toSite','constructing','waiting'].includes(c.phase)&&!c.site)return null;
   if(c.buildCargo!==undefined&&(!c.buildCargo||typeof c.buildCargo!=='object'||Array.isArray(c.buildCargo)||Object.entries(c.buildCargo).some(([k,v])=>!MATERIALS.includes(k)||!finite(v,0,6))))return null;
   if(Object.values(c.buildCargo||{}).some(v=>v>0)&&(!c.site||!['toSite','blocked'].includes(c.phase)))return null;

  }
  for(const b of constructionEntities(s)){const q=b.construction;if(!q)continue;
   if(!['new','upgrade'].includes(q.kind)||!integer(q.target,1,3)||q.target!==(q.kind==='new'?1:b.level+1)||q.kind==='new'&&b.level!==1||!finite(q.work,0,workRequired(b)))return null;
   if(q.priority!==undefined&&!integer(q.priority,0,2)||q.order!==undefined&&!integer(q.order,0,1e9))return null;
   const cost=b.type==='road'?roadUpgradeCost(b):q.kind==='new'?BUILDINGS[b.type]:upgradeCost(b);
   if(!q.required||!q.remaining||!q.delivered||[q.required,q.remaining,q.delivered].some(v=>Object.keys(v).some(k=>!MATERIALS.includes(k))))return null;
   if([q.remaining,q.delivered].some(v=>Object.keys(v).length!==Object.keys(q.required).length||Object.keys(v).some(k=>!(k in q.required))))return null;
   const expected=q.legacyPrice?{clay:cost.clay||0,reed:cost.reed||0}:cost;
   if(q.legacyPrice!==undefined&&q.legacyPrice!==true)return null;
   for(const k of MATERIALS){if((q.required[k]||0)!==(expected[k]||0))return null;}
   for(const k of Object.keys(q.required)){
    if(!integer(q.required?.[k])||!finite(q.remaining?.[k],0,q.required[k])||!finite(q.delivered?.[k],0,q.required[k]))return null;
    const carried=s.citizens.filter(c=>c.site===buildingKey(b)).reduce((n,c)=>n+(c.buildCargo?.[k]||0),0);
    if(Math.abs(q.required[k]-q.remaining[k]-q.delivered[k]-carried)>1e-7)return null;
   }
   if(q.work>0&&Object.keys(q.required).some(k=>q.delivered[k]<q.required[k]))return null;
  }
  if(s.lastDelivery!==null&&(!s.lastDelivery||!finite(s.lastDelivery.time,0,s.simTime)||!integer(s.lastDelivery.citizen)||typeof s.lastDelivery.store!=='string'||!s.lastDelivery.cargo||Object.entries(s.lastDelivery.cargo).some(([k,v])=>!(k in emptyResources())||!finite(v))))return null;
  return s;
 }catch{return null;}
}
