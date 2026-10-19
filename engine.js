import {isRiverBank} from './river-trade.js';
import {upgradeCost,legacyUpgradeCost} from './masonry.js';
export {upgradeCost} from './masonry.js';
import {initializeKilns,validateKilns} from './kilns.js';
import {initializeBricks,validateBricks} from './bricks.js';
import {initializeWater,validateWater} from './water.js';
import {initializeTextiles,validateTextiles} from './textiles.js';
import {syncInventory,validateInventory,stockStores,reserveStock} from './inventory.js';
import {initializeDistricts,validateDistricts} from './district-logistics.js';
import {initializeFoodPlan,availableFood,validateFoodPlan} from './food-planning.js';
import {initializePests,syncPestSites,validatePests,catReason,bringCat} from './pests.js';
import {initializeCrops,changeCropSeason,cropSummary,validateCrops} from './agriculture.js';
import {fieldWater,irrigationFor} from './irrigation.js';
import {initializeClothing,validateClothing} from './clothing.js';
import {ROLES,validateEducation,newMedicalSkill,advanceMedicalYear} from './education.js';
import {initializeWellbeing,validateWellbeing,affectResidents,mournResidents,mealRation} from './wellbeing.js';
import {validateHouseholds} from './households.js';
import {initializeDemography,advanceGenerations,validateDemography} from './demography.js';
import {startFuneral,validateFuneral} from './funerals.js';
import {initializeTrade,advanceTrade,validateTrade} from './trading.js';
import {roadUpgradeCost,roadKey} from './roads.js';
import {createOrder,isComplete,nextOrder,constructionEntities,workRequired} from './construction.js';
import {WIDTH,HEIGHT,terrain,river,bridgeSpan,initializeWorld,nearDeposit,isShore,validateWorld,isDryPoint,ensureResourceSites} from './world.js';
import {BUILDINGS,MIRACLES,RESOURCE_NAMES,MATERIALS,levelOf,capacityOf,outputMultiplier,buildingKey,storageOf,housingOf,citizenName} from './definitions.js';
import {syncCitizens,advanceWorkers,workforceStats,recoverCitizenCargo} from './workforce.js';
import {createDivinity,registerMiracle} from './divinity.js';
export {WIDTH,HEIGHT,terrain,river,bridgeSpan,BUILDINGS,MIRACLES};
export const VERSION=21;
export const SEASONS=['Весна','Лето','Осень','Зима'];
const emptyResources=()=>({food:0,clay:0,reed:0,wood:0,stone:0,hides:0,wool:0,cloth:0,clothing:0,brick:0,firedBrick:0,faith:0,prestige:0});
const emptyBuffs=()=>({fertility:0,inspiration:0,haste:0,sunlight:0});
export function log(s,title,text='',kind='info'){const last=s.news[0];if(last&&last.title===title&&last.tick===s.tick)return;s.news.unshift({title,text,kind,year:s.year,season:s.season,tick:s.tick});s.news=s.news.slice(0,80);}
export function createGame(){
 const s={version:VERSION,year:1,season:0,tick:0,seasonElapsed:0,simTime:0,population:12,capacity:16,happiness:75,rngState:117,roads:[],funeral:null,deaths:0,resources:{food:100,clay:90,reed:45,wood:20,stone:0,hides:0,wool:0,cloth:0,clothing:0,brick:0,firedBrick:0,faith:25,prestige:10},buildings:[{type:'house',x:8,y:8,level:1},{type:'house',x:9,y:9,level:1},{type:'field',x:12,y:8,level:1},{type:'clay',x:7,y:7,level:1},{type:'shrine',x:9,y:8,level:1}],cooldowns:Object.fromEntries(Object.keys(MIRACLES).map(k=>[k,0])),buffs:emptyBuffs(),divinity:createDivinity(),citizens:[],deliveries:0,delivered:emptyResources(),lastDelivery:null,drought:0,rain:0,droughtSeen:false,memories:[],news:[],event:null,won:false,lost:false,continued:false,hungry:0,miracleCount:0,name:'Безымянный дух',achievements:[]};
 initializeWorld(s);ensureResourceSites(s);initializeTrade(s);initializeTextiles(s);initializeBricks(s);initializeKilns(s);initializeCrops(s);initializeFoodPlan(s);initializePests(s);syncPestSites(s);syncCitizens(s);for(const c of s.citizens)delete c.age;initializeDemography(s,{mixed:true});for(const c of s.citizens)c.mealEaten=mealRation(c);syncCitizens(s);syncInventory(s);initializeDistricts(s);initializeWater(s);log(s,'У города появился покровитель','Двенадцать жителей оставили у реки первое подношение. Храм принимает первые грузы; рабочие отправляются на поля и в карьер.','good');return s;
}
export const count=(s,type)=>s.buildings.filter(b=>b.type===type&&isComplete(b)).length;
export const storage=storageOf;
export function workers(s){const needed=s.buildings.filter(b=>isComplete(b)&&Object.keys(BUILDINGS[b.type].output).length).length*2;return needed?Math.min(1,workforceStats(s).employed/needed):1;}
export function buildingAt(s,x,y){return s.buildings.find(b=>b.x===x&&b.y===y)||s.buildings.find(b=>{if(b.type!=='bridge'||b.y!==y)return false;const span=bridgeSpan(y);return terrain(x,y,s)==='water'&&x>=span.left&&x<=span.right;});}
export function canBuild(s,type,x,y,placementOnly=false){
 const b=BUILDINGS[type];if(!b)return 'Неизвестная постройка';if(!placementOnly&&s.lost)return 'Поселение покинуто';if(!placementOnly&&s.event)return 'Сначала реши судьбу события';if(terrain(x,y,s)==='void')return 'За пределами долины';if(buildingAt(s,x,y))return 'Эта клетка уже занята';
 if(type==='bridge'){
  if(terrain(x,y,s)!=='water'||terrain(x,y)!=='water')return 'Выбери клетку воды: мост соединит оба берега';
  if(s.buildings.some(b=>b.type==='bridge'&&b.y===y))return 'На этом участке уже есть мост';
 }else if(terrain(x,y,s)==='water')return 'На воде можно построить мост';
 if(type==='harbor'&&!isRiverBank(s,x,y))return 'Пристани нужен сухой берег главной реки, не озеро';
 if(type==='field'&&!fieldWater(s,{x,y}).productive)return 'Полю нужна приречная земля или готовый канал с водой рядом';
 if(['clay','reed','quarry','logging','hunting','garden'].includes(type)&&!nearDeposit(s,({quarry:'stone',logging:'forest',hunting:'wildlife',garden:'dates'})[type]||type,x,y))return type==='garden'?'Нужен отмеченный финиковый участок':'Нужно отмеченное месторождение';
 if(['fishing','waterpoint'].includes(type)&&!isShore(s,x,y))return 'Нужна сухая клетка у воды';
 if(type==='ziggurat'&&s.buildings.some(b=>b.type===type))return 'Зиккурат уже построен';if(!placementOnly&&(b.prestige||0)>s.resources.prestige)return `Нужно ${b.prestige} престижа`;
 for(const k of [...MATERIALS,'faith'])if(!placementOnly&&(b[k]||0)>s.resources[k])return `Не хватает: ${RESOURCE_NAMES[k]}`;
 return '';
}
export const canPlace=(s,type,x,y)=>canBuild(s,type,x,y,true);
export function build(s,type,x,y){const reason=canBuild(s,type,x,y);if(reason)return {ok:false,reason};const sources=reserveStock(s,BUILDINGS[type]);if(!sources)return {ok:false,reason:'Не хватает материалов'};s.resources.faith-=BUILDINGS[type].faith||0;s.buildings.push({type,x,y,level:1,construction:{...createOrder(BUILDINGS[type]),sources,allocations:structuredClone(sources),order:nextOrder(s)}});initializeTextiles(s);initializeBricks(s);initializeKilns(s);initializeCrops(s);s.capacity=housingOf(s);syncCitizens(s);initializeWater(s);log(s,`Заложено: ${BUILDINGS[type].name}`,'Материалы зарезервированы. Жители доставят их и возведут здание.','build');check(s);return {ok:true};}

export function canUpgrade(s,b){if(!b)return 'Выбери здание';if(b.type==='canal')return 'Канал готовится в один уровень';if(b.construction)return 'Строительство уже идёт';if(s.event||s.lost)return 'Сначала заверши событие';if(levelOf(b)>=3)return 'Достигнут третий уровень';const cost=upgradeCost(b);if(MATERIALS.some(k=>(s.resources[k]||0)<(cost[k]||0)))return 'Нужно: '+Object.entries(cost).map(([k,n])=>`${n} ${RESOURCE_NAMES[k]}`).join(', ');return '';}
export function upgrade(s,x,y){const b=buildingAt(s,x,y),reason=canUpgrade(s,b);if(reason)return {ok:false,reason};const cost=upgradeCost(b);const sources=reserveStock(s,cost);if(!sources)return {ok:false,reason:'Не хватает материалов'};b.construction={...createOrder(cost,levelOf(b)+1,'upgrade'),sources,allocations:structuredClone(sources),order:nextOrder(s)};s.capacity=housingOf(s);syncCitizens(s);log(s,`Улучшение: ${BUILDINGS[b.type].name}`,'Строители доставят материалы. Прежний уровень работает до завершения.','build');check(s);return {ok:true};}
export function yieldSummary(s,b){
 const level=levelOf(b),def=BUILDINGS[b.type];if(b.type==='field'&&Number.isInteger(b.x))return cropSummary(s,b)+' · 2 рабочих места';if(b.type==='house')return `Жильё: ${capacityOf(b)} жителей`;
 if(b.type==='canal')return !Number.isInteger(b.x)?'Соединяй участки от реки · полив соседних полей':b.construction?'Вода появится после завершения связного пути от реки':irrigationFor(s).wet.has(`${b.x},${b.y}`)?'Канал наполнен · полив соседних клеток':'Сухое русло · соедини готовыми участками с рекой';
 if(b.type==='kiln')return `4 сырца + 3 тростника → 4 обожжённых · обжиг ${(20/outputMultiplier(b)).toFixed(1)} с + остывание ${(8/outputMultiplier(b)).toFixed(1)} с`;
 if(b.type==='brickyard')return '4 глины + 1 тростник + 2 воды → 4 сырца · сушка на солнце 30 с · 2 работника';
 if(b.type==='waterpoint')return 'Вода домам и кирпичным дворам · 2 водоноса';
 if(b.type==='healer')return `1 обученный лекарь · ${1+level} места · база ${1+(level-1)*.5} здоровья/с · требуется обучение в храме`;
 if(b.type==='harbor')return `Грузовые лодки · 2 носильщика · до ${4+2*level} ед. за рейс`;
 if(b.type==='market')return `Приём караванов · 2 носильщика · до ${4+2*level} ед. груза за рейс`;
 if(b.type==='granary')return `+${150*level} хранения каждого материала · принимает все грузы`;
 if(b.type==='bridge')return `Соединяет берега · скорость на мосту ×${(1+(level-1)*.25).toFixed(2)}`;
 const output=Object.entries(def.output).map(([k,n])=>`${(n*outputMultiplier(b)).toFixed(n<1?2:1)} ${RESOURCE_NAMES[k]}`).join(' + ');
 return `${b.type==='field'?(Number.isInteger(b.x)?fieldWater(s,b).label:'Приречная земля или полив из канала')+' · ':''}${output} за рейс работника · 2 рабочих места${b.type==='garden'?` · +${2+2*level} довольства`:''}`;
}
export function miracle(s,id){
 const m=MIRACLES[id];if(!m)return {ok:false,reason:'Неизвестное чудо'};if(s.event||s.lost)return {ok:false,reason:'Сначала заверши текущее событие'};if(s.cooldowns[id])return {ok:false,reason:`Будет доступно через ${s.cooldowns[id]} сез.`};if(s.resources.faith<m.cost)return {ok:false,reason:`Нужно ${m.cost} веры`};if(id==='cat'&&catReason(s))return {ok:false,reason:catReason(s)};if(id==='abundance'&&s.resources.food>=storage(s))return {ok:false,reason:'Амбары уже полны'};
 if(s.funeral&&['bless','healing'].includes(id))return {ok:false,reason:'Дождись возвращения траурной процессии'};
 if(['bless','healing'].includes(id)&&s.population>=s.capacity&&s.happiness>=100)return {ok:false,reason:'Город уже счастлив; для новых жителей нужны дома'};
 s.resources.faith-=m.cost;s.cooldowns[id]=m.cooldown;s.miracleCount++;
 if(!s.memories.includes('first')){s.memories.push('first');log(s,'Первое чудо','Люди запомнят этот день. У святилища зажгли огни.','good');}
 const oldName=s.name;registerMiracle(s,m.domain);
 if(id==='cat'){const first=!s.pests.cats.length;bringCat(s);log(s,'Бог привёл кошку',first?'Первая кошка пришла по твоей воле и охраняет хранилище.':'Ещё одна кошка охотится у незащищённого хранилища.','good');}
 if(id==='rain'){if(s.drought){if(!s.memories.includes('rain'))s.memories.push('rain');log(s,'Дождь победил засуху','Поля ожили. Люди запомнят, как ты вернул воду.','good');}s.drought=0;s.rain=2;}
 if(id==='abundance')s.resources.food=Math.min(storage(s),s.resources.food+45);
 if(id==='bless'||id==='healing'){affectResidents(s,{mood:id==='bless'?12:7});s.happiness=Math.min(100,s.happiness+(id==='bless'?15:10));s.population+=Math.max(0,Math.min(id==='bless'?3:6,s.capacity-s.population));}
 if(['fertility','inspiration','haste','sunlight'].includes(id))s.buffs[id]=3;
 if(id==='sunlight'){affectResidents(s,{mood:7});s.happiness=Math.min(100,s.happiness+10);}
 if(id==='revelation'){s.resources.faith+=20;s.resources.prestige+=12;}
 if(id==='stars')s.resources.prestige+=18;
 if(id==='peace'){affectResidents(s,{mood:22});s.happiness=Math.min(100,s.happiness+25);}
 if(id==='shaping'){s.resources.clay+=60;s.resources.reed+=40;}
 log(s,m.name,m.desc,'miracle');if(s.name!==oldName)log(s,`Новое имя: ${s.name}`,'Люди называют тебя по твоим деяниям. Все заслуженные имена остаются в пантеоне.','good');syncCitizens(s);check(s);return {ok:true};
}
function check(s){
 s.capacity=housingOf(s);
 if(s.population<=0){s.population=0;s.lost=true;s.event=null;syncCitizens(s);return;}
 const hasMiracles=s.deaths>0||Object.values(s.divinity.domains).some(v=>v>0);
 if(s.population>=24&&!s.achievements.includes('population')){s.achievements.push('population');log(s,'Поселение стало городом','Двадцать четыре человека называют это место домом.','good');}
 if(s.resources.food>=150&&!s.achievements.includes('food')){s.achievements.push('food');if(!hasMiracles){s.name='Наполняющий амбары';if(!s.divinity.names.includes(s.name))s.divinity.names.push(s.name);}log(s,'Полные амбары','Запас еды достиг 150. Город встречает будущее с надеждой.','good');}
 if(s.population>=30&&!s.achievements.includes('keeper')){s.achievements.push('keeper');if(!hasMiracles){s.name='Хранитель людей';if(!s.divinity.names.includes(s.name))s.divinity.names.push(s.name);}}
 if(s.year>=10&&s.population>=30&&count(s,'ziggurat')&&!s.won){s.won=true;log(s,'Город коснулся неба','Великий зиккурат возвышается над долиной. Твоё имя останется в веках.','good');}
}
function settleSeason(s){
 const previous=s.season;s.tick++;s.season=s.tick%4;s.year=1+Math.floor(s.tick/4);changeCropSeason(s,previous);advanceTrade(s);advanceMedicalYear(s);
 if(s.funeral&&s.funeral.scope!=='family'){syncCitizens(s);check(s);return;}
 for(const k of Object.keys(s.cooldowns))s.cooldowns[k]=Math.max(0,s.cooldowns[k]-1);
 // Production is already in citizens' delivered cargo. Never credit it here.
 const hungry=s.citizens.filter(c=>c.hunger>=30);s.hungry=hungry.length?Math.max(...hungry.map(c=>c.missedMeals)):0;
 s.happiness=s.citizens.length?s.citizens.reduce((n,c)=>n+c.mood,0)/s.citizens.length:0;
 if(hungry.length)log(s,'Голод в семьях',`${hungry.length} жителей недоедают. Проверь домашние запасы и доставку еды.`,'bad');
 const victims=!s.funeral?s.citizens.filter(c=>c.health<=0&&c.missedMeals>=3):[];
 if(victims.length){const deceased=victims.map(c=>({id:c.id,name:citizenName(c.id),x:c.x,y:c.y}));mournResidents(s,victims.map(c=>c.id));for(const c of victims)recoverCitizenCargo(s,c.id);const ids=new Set(victims.map(c=>c.id));s.citizens=s.citizens.filter(c=>!ids.has(c.id));s.population=s.citizens.length;s.deaths+=victims.length;syncCitizens(s);startFuneral(s,deceased);log(s,'Смерть от голода',`Погибли ${victims.length} жителей из семей, которым не хватало еды. Город провожает умерших.`,'bad');}
 if(!s.funeral||s.funeral.scope==='family'){const report=advanceGenerations(s,id=>recoverCitizenCargo(s,id));syncCitizens(s);if(report.deceased.length)startFuneral(s,report.deceased,{family:true});}
 if(s.funeral&&s.funeral.scope!=='family'){syncCitizens(s);check(s);return;}
 s.drought=Math.max(0,s.drought-1);s.rain=Math.max(0,s.rain-1);for(const k of Object.keys(s.buffs))s.buffs[k]=Math.max(0,s.buffs[k]-1);
 if(s.season===0){
  log(s,`Начался ${s.year}-й год`,`В городе ${s.population} жителей. В амбарах ${Math.floor(s.resources.food)} еды.`,'year');
  if(s.year===3||(!s.droughtSeen&&s.year>=4)){s.drought=3;s.droughtSeen=true;affectResidents(s,{faith:-8,mood:-7});log(s,'На долину опустилась засуха','Нужен полив ячменя: соедини поля с рекой каналами или призови Небесный дождь.','bad');}
  else if(s.year%5===0)s.event={id:'refugees',title:'Люди у городских ворот',text:'Три семьи покинули истощённые земли. Прими до шести жителей за 20 еды — если для них найдётся жильё.'};
  else if(s.year%3===1){s.resources.food+=Math.max(0,Math.min(30,storage(s)-s.resources.food));log(s,'Щедрый разлив','Река принесла плодородный ил. Общие амбары получили 30 еды.','good');}
  else s.event={id:'festival',title:'Ночь тысячи огней',text:'Жрецы предлагают праздник у воды. 20 еды превратятся в 15 веры, 5 престижа и 10 довольства.'};
 }
 syncCitizens(s);check(s);
}
export function advanceTime(s,seconds){
 if(s.lost&&!s.funeral||s.event||!Number.isFinite(seconds)||seconds<=0)return 0;
 syncInventory(s);let remaining=Math.min(seconds,3600),advanced=0;
 while(remaining>1e-7&&(!s.lost||s.funeral)&&!s.event){
  const dt=Math.min(remaining,45-s.seasonElapsed);advanceWorkers(s,dt);s.seasonElapsed+=dt;remaining-=dt;advanced+=dt;
  if(s.seasonElapsed>=45-1e-7){s.seasonElapsed=0;settleSeason(s);}
 }
 syncInventory(s);check(s);return advanced;
}
export function advanceSeason(s){return advanceTime(s,45-s.seasonElapsed)>0;}
export function eventReason(s){if(!s.event)return 'Нет события';const price={caravan:35,refugees:20,festival:20}[s.event.id];if(availableFood(s)<price)return `Нужно ${price} еды`;if(s.event.id==='refugees'&&s.population>=s.capacity)return 'Нет свободного жилья';return '';}
export function resolveEvent(s,choice){
 if(!s.event||!['accept','skip'].includes(choice))return {ok:false,reason:'Нет такого решения'};
 if(choice==='accept'){
  const reason=eventReason(s);if(reason)return {ok:false,reason};const id=s.event.id;s.resources.food-=id==='caravan'?35:20;
  if(id==='caravan'){s.resources.clay+=25;s.resources.reed+=20;}if(id==='refugees')s.population+=Math.min(6,s.capacity-s.population);if(id==='festival'){affectResidents(s,{faith:4,mood:8});s.resources.faith+=15;s.resources.prestige+=5;s.happiness=Math.min(100,s.happiness+10);}
 }
 log(s,s.event.title,choice==='accept'?'Город принял твоё решение.':'Город сохранил запасы и продолжил свой путь.',choice==='accept'?'good':'info');s.event=null;syncCitizens(s);check(s);return {ok:true};
}
export function goals(s){return [{label:'Построить новое поле',done:count(s,'field')>=2},{label:'Поселить 24 жителя',done:s.achievements.includes('population')},{label:'Спасти поля от засухи',done:s.memories.includes('rain')},{label:'Набрать 50 престижа',done:s.resources.prestige>=50},{label:'Возвести зиккурат и встретить 10-й год с 30 жителями',done:s.won}];}
export const encode=s=>{if(s?.resources&&Array.isArray(s.buildings))syncInventory(s);return JSON.stringify(s);};
export function decode(raw){
 try{
  const s=JSON.parse(raw),legacy=s?.version===1,old=s?.version<3,oldTrade=s?.version<4,oldLogistics=s?.version<5,oldMortality=s?.version<6,oldGenerations=s?.version<7,oldHouseholds=s?.version<8,oldWellbeing=s?.version<9,oldCalling=s?.version<10,oldEducation=s?.version<11,oldAgriculture=s?.version<12,oldPests=s?.version<13,oldFoodPlan=s?.version<14,oldInventory=s?.version<15,oldTextiles=s?.version<16,oldClothing=s?.version<17,oldBricks=s?.version<18,oldFiring=s?.version<19,oldMasonry=s?.version<20;
  if(!s||![1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,VERSION].includes(s.version))return null;
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
  if(oldTrade){s.version=VERSION;delete s.trade;initializeTrade(s);}
  if(oldLogistics){s.version=VERSION;initializeTrade(s);}
  if(oldMortality){s.version=VERSION;initializeTrade(s);s.funeral=null;s.deaths=0;s.divinity.rating=s.miracleCount*2;s.divinity.inspirationAttempts=0;s.divinity.inspirationSuccesses=0;}
  if(oldPests){initializePests(s);s.cooldowns.cat??=0;syncPestSites(s);}
  if(oldTextiles){
   for(const r of [s.resources,s.delivered,...(s.buildings||[]).map(b=>b.stock)])if(r){r.wool??=0;r.cloth??=0;}
   const c=s.trade?.caravan;if(c){for(const [k,base] of [['wool',4],['cloth',22]]){c.stock[k]??=0;c.prices[k]??={buy:base+2,sell:base};}}
   initializeTextiles(s);initializeBricks(s);initializeKilns(s);
  }
  if(oldClothing){for(const r of [s.resources,s.delivered,...(s.buildings||[]).map(b=>b.stock)])if(r)r.clothing??=0;const c=s.trade?.caravan;if(c){c.stock.clothing??=0;c.prices.clothing??={buy:54,sell:52};}initializeClothing(s);}
  if(oldBricks){
   for(const r of [s.resources,s.delivered,...(s.buildings||[]).map(b=>b.stock)])if(r)r.brick??=0;
   const c=s.trade?.caravan;if(c){c.stock.brick??=0;c.prices.brick??={buy:10,sell:8};}
   for(const b of [...s.buildings||[],...s.roads||[]])if(b.construction)b.construction.legacyBricks=true;
   initializeBricks(s);initializeKilns(s);initializeWater(s);
  }
  if(oldFiring){
   for(const r of [s.resources,s.delivered,...(s.buildings||[]).map(b=>b.stock)])if(r)r.firedBrick??=0;
   const c=s.trade?.caravan;if(c){c.stock.firedBrick??=0;c.prices.firedBrick??={buy:18,sell:16};}
   for(const b of [...s.buildings||[],...s.roads||[]])if(b.construction)b.construction.legacyFiring=true;
   for(const b of s.buildings||[])b.legacyFiringLevel=levelOf(b);
   initializeKilns(s);
  }
  if(oldMasonry){for(const b of s.buildings||[])b.legacyMasonryLevel=levelOf(b);for(const b of [...s.buildings||[],...s.roads||[]])if(b.construction?.kind==='upgrade')b.construction.legacyMasonry=true;}
  if(s.world&&!validateWorld(s))return null;
  initializeWorld(s);ensureResourceSites(s);
  const finite=(v,min=0,max=1e9)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
  const integer=(v,min=0,max=1e6)=>Number.isInteger(v)&&v>=min&&v<=max;
  if(!integer(s.tick)||!integer(s.year,1)||s.year!==1+Math.floor(s.tick/4)||s.season!==s.tick%4||!integer(s.population)||!integer(s.capacity)||!finite(s.happiness,0,100))return null;
  for(const k of Object.keys(emptyResources()))if(!finite(s.resources?.[k])||!finite(s.delivered?.[k]))return null;
  if(!finite(s.simTime)||!finite(s.seasonElapsed,0,44.99999999)||Math.abs(s.simTime-(s.tick*45+s.seasonElapsed))>.001||!integer(s.deliveries))return null;
  if(!Array.isArray(s.buildings)||s.buildings.length>WIDTH*HEIGHT)return null;
  if(!oldInventory&&!validateTrade(s))return null;
  if(!validateWorld(s)||!Number.isInteger(s.rngState)||s.rngState<0||s.rngState>4294967295||!Array.isArray(s.roads)||s.roads.length>WIDTH*HEIGHT*4)return null;
  const roadIds=new Set();for(const r of s.roads){if(r.type!=='road'||!integer(r.level,1,3)||typeof r.id!=='string'||roadIds.has(r.id)||!r.a||!r.b||!finite(r.x,-.5,WIDTH)||!finite(r.y,-.5,HEIGHT)||Math.abs(Math.abs(r.a.x-r.b.x)+Math.abs(r.a.y-r.b.y)-1)>1e-7||[r.a,r.b,{x:r.x,y:r.y}].some(p=>!isDryPoint(s,p.x,p.y))||r.id!==roadKey(r.a,r.b)||r.x!==(r.a.x+r.b.x)/2||r.y!==(r.a.y+r.b.y)/2)return null;roadIds.add(r.id);}
  const cells=new Set(),bridgeRows=new Set();
  for(const b of s.buildings){
   const key=buildingKey(b),land=terrain(b.x,b.y,s);
   if(!BUILDINGS[b.type]||land==='void'||cells.has(key)||!integer(b.level,1,3))return null;
   if(b.legacyMasonryLevel!==undefined&&!integer(b.legacyMasonryLevel,1,b.level))return null;
   if(b.legacyFiringLevel!==undefined&&!integer(b.legacyFiringLevel,1,b.level))return null;
   if(b.type==='bridge'){if(land!=='water'||bridgeRows.has(b.y))return null;bridgeRows.add(b.y);}
   else if(land==='water'||b.type==='harbor'&&!isRiverBank(s,b.x,b.y)||b.type==='canal'&&(b.level!==1||b.construction?.kind==='upgrade'))return null;
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
  if(s.funeral===undefined||!integer(s.deaths)||!validateFuneral(s))return null;
  for(const k of ['rating','inspirationAttempts','inspirationSuccesses'])if(!integer(s.divinity[k]))return null;
  if(s.divinity.inspirationSuccesses>s.divinity.inspirationAttempts)return null;
  if(!Array.isArray(s.news)||s.news.length>80||s.news.some(n=>typeof n.title!=='string'||typeof n.text!=='string'||!integer(n.year,1)||!integer(n.season,0,3)||typeof n.kind!=='string'))return null;
  if(s.event!==null&&(!s.event||!['caravan','refugees','festival'].includes(s.event.id)||typeof s.event.title!=='string'||typeof s.event.text!=='string'))return null;
  if(legacy)syncCitizens(s);
  if(!Array.isArray(s.citizens)||s.citizens.length!==s.population)return null;
  const ids=new Set(),buildings=new Map(constructionEntities(s).map(b=>[buildingKey(b),b]));
  const point=p=>p&&finite(p.x,-.5,WIDTH-.5)&&finite(p.y,-.5,HEIGHT-.5);
  for(const c of s.citizens){
   if(!integer(c.id)||ids.has(c.id)||!point(c)||(buildings.get(c.home)?.type!=='house'||!isComplete(buildings.get(c.home)))||!['home','toWork','working','toStore','returnWork','toHome','blocked','toSupply','toSite','constructing','waiting','unloading','toMarket','toSaleSupply','toSaleMarket','toPantrySupply','toPantryHome','toRest','resting','toHealer','treatment','toSchool','studying','toDistrictSupply','toDistrictStore','waterTrip','toCraftSupply','toClothesSupply','toClothesHome'].includes(c.phase))return null;
   if(c.recovering!==undefined&&typeof c.recovering!=='boolean')return null;
   if(c.clinic!=null&&(buildings.get(c.clinic)?.type!=='healer'||!isComplete(buildings.get(c.clinic))||!['toHealer','treatment','blocked'].includes(c.phase)||Object.values(c.cargo||{}).some(n=>n>0)||Object.values(c.buildCargo||{}).some(n=>n>0)||c.pantryTrip||c.tradeJob||c.saleJob))return null;
   if(['toHealer','treatment'].includes(c.phase)&&!c.clinic)return null;
   if(c.calling!==undefined&&!ROLES.includes(c.calling)||c.futureRole!==undefined&&(!ROLES.includes(c.futureRole)||c.age>=16||c.futureRole!==c.calling))return null;
   ids.add(c.id);if(c.saleJob!=null&&(!s.trade.sales.some(q=>q.id===c.saleJob&&q.market===c.saleMarket)||!['toSaleSupply','toSaleMarket','blocked','toHome','home'].includes(c.phase)))return null;
   if(c.tradeJob!=null&&(!s.trade.deliveries.some(q=>q.id===c.tradeJob&&q.market===c.tradeMarket)||!['toMarket','toStore','unloading','blocked','toHome','home','toRest','resting','toPantrySupply','toPantryHome'].includes(c.phase)))return null;
   if(c.role!==undefined&&!ROLES.includes(c.role)||c.pendingRole!==undefined&&!ROLES.includes(c.pendingRole)||c.siteDuty!=null&&!['carrier','builder'].includes(c.siteDuty))return null;
   if(c.workplace!=null&&(typeof c.workplace!=='string'||!isComplete(buildings.get(c.workplace)||{construction:{kind:'new'}})||!buildings.has(c.workplace)||!['healer','depot','waterpoint'].includes(buildings.get(c.workplace).type)&&!Object.keys(BUILDINGS[buildings.get(c.workplace).type].output).length))return null;
   if(c.seedField!==undefined&&(typeof c.seedField!=='string'||buildings.get(c.seedField)?.type!=='field'||!isComplete(buildings.get(c.seedField))||c.work!==c.seedField||!finite(c.seedFood,0,6)||Object.values(c.cargo||{}).some(n=>n>0)||Object.values(c.buildCargo||{}).some(n=>n>0)||c.pantryTrip||c.saleJob||c.tradeJob||c.clinic||c.school||!['toStore','toWork','blocked','toHome','home','resting'].includes(c.phase)))return null;
   if(c.seedField===undefined&&c.seedFood!==undefined)return null;
   if(c.guardPost!=null&&(typeof c.guardPost!=='string'||!['shrine','granary','depot'].includes(buildings.get(c.guardPost)?.type)||!isComplete(buildings.get(c.guardPost))||c.workplace||c.age<16||!['auto','production'].includes(c.role)))return null;
   if(c.work!==null&&(!buildings.has(c.work)||!isComplete(buildings.get(c.work))||c.guardPost!==c.work&&!['healer','depot','waterpoint'].includes(buildings.get(c.work).type)&&!Object.keys(BUILDINGS[buildings.get(c.work).type].output).length))return null;
   if(c.store!==null&&!['shrine','granary','depot','house'].includes(buildings.get(c.store)?.type))return null;
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
   if(q.routeOrder!==undefined&&(b.type!=='road'||!integer(q.routeOrder,0,1e9)))return null;
   if(q.priority!==undefined&&!integer(q.priority,0,2)||q.order!==undefined&&!integer(q.order,0,1e9))return null;
   const cost=b.type==='road'?roadUpgradeCost(b):q.kind==='new'?BUILDINGS[b.type]:q.legacyMasonry?legacyUpgradeCost(b):upgradeCost(b);
   if(!q.required||!q.remaining||!q.delivered||[q.required,q.remaining,q.delivered].some(v=>Object.keys(v).some(k=>!MATERIALS.includes(k))))return null;
   if([q.remaining,q.delivered].some(v=>Object.keys(v).length!==Object.keys(q.required).length||Object.keys(v).some(k=>!(k in q.required))))return null;
   const expected=q.legacyPrice?{clay:cost.clay||0,reed:cost.reed||0}:{...cost,...q.legacyBricks?{brick:0}:{},...q.legacyFiring?{firedBrick:0}:{}};
   if(q.legacyMasonry!==undefined&&q.legacyMasonry!==true)return null;
   if(q.legacyFiring!==undefined&&q.legacyFiring!==true)return null;
   if(q.legacyBricks!==undefined&&q.legacyBricks!==true)return null;
   if(q.legacyPrice!==undefined&&q.legacyPrice!==true)return null;
   for(const k of MATERIALS){if((q.required[k]||0)!==(expected[k]||0))return null;}
   for(const k of Object.keys(q.required)){
    if(!integer(q.required?.[k])||!finite(q.remaining?.[k],0,q.required[k])||!finite(q.delivered?.[k],0,q.required[k]))return null;
    const carried=s.citizens.filter(c=>c.site===buildingKey(b)).reduce((n,c)=>n+(c.buildCargo?.[k]||0),0);
    if(Math.abs(q.required[k]-q.remaining[k]-q.delivered[k]-carried)>1e-7)return null;
   }
   if(q.work>0&&Object.keys(q.required).some(k=>q.delivered[k]<q.required[k]))return null;
  }
  const guardPosts=new Set();for(const c of s.citizens)if(c.guardPost){if(guardPosts.has(c.guardPost))return null;guardPosts.add(c.guardPost);}
  const permanent=new Map();for(const c of s.citizens)if(c.workplace){const b=buildings.get(c.workplace);if(c.age<16||(b.type==='healer'?c.role!=='healer'||!c.medicine?.level:b.type==='tailor'?c.role!=='tailor':b.type==='waterpoint'?c.role!=='watercarrier':!['auto','production'].includes(c.role)))return null;const n=(permanent.get(c.workplace)||0)+1;if(n>(b.type==='healer'?1:2))return null;permanent.set(c.workplace,n);}
  if(s.lastDelivery!==null&&(!s.lastDelivery||!finite(s.lastDelivery.time,0,s.simTime)||!integer(s.lastDelivery.citizen)||typeof s.lastDelivery.store!=='string'||!s.lastDelivery.cargo||Object.entries(s.lastDelivery.cargo).some(([k,v])=>!(k in emptyResources())||!finite(v))))return null;
  if(oldGenerations){initializeDemography(s);s.version=VERSION;}
  if(oldHouseholds)s.version=VERSION;
  if(oldWellbeing){for(const c of s.citizens)if(c.pantryTrip){if(c.pantryTrip!==true||c.tradeJob!=null||c.saleJob!=null||Object.entries(c.cargo).some(([k,n])=>k!=='food'&&n>0)||Object.values(c.buildCargo||{}).some(n=>n>0)||!['toPantrySupply','toPantryHome','blocked'].includes(c.phase))return null;c.pantryFood=c.cargo.food||0;c.cargo={};}initializeWellbeing(s);s.version=VERSION;}
  if(oldCalling)for(const c of s.citizens){const role=c.pendingRole||c.role;if(role&&role!=='auto')c.calling??=role;}
  if(oldEducation)for(const c of s.citizens)if(buildings.get(c.work)?.type==='healer'){c.role='healer';if(!c.pendingRole)c.calling='healer';c.medicine=newMedicalSkill(s.year,1);}
  if(!validateEducation(s)||!validateDemography(s)||!validateHouseholds(s)||!validateWellbeing(s))return null;
  if(s.funeral&&!s.funeral.style){const deceased=s.funeral.deceased;s.funeral=null;startFuneral(s,deceased);}
  if(oldFoodPlan)initializeFoodPlan(s);if(!validateCrops(s)||!validateFoodPlan(s))return null;initializeCrops(s,{legacy:oldAgriculture});
  if(!validatePests(s)||!validateTextiles(s)||!validateClothing(s)||!validateKilns(s)||!validateBricks(s)||!validateWater(s))return null;
  if(oldInventory){syncInventory(s);initializeDistricts(s);const central=stockStores(s)[0];if(!central)return null;const key=buildingKey(central);for(const b of constructionEntities(s)){const q=b.construction;if(q){q.sources={[key]:{...q.remaining}};q.allocations={[key]:{...q.required}};}}for(const q of s.trade.sales){q.sources={[key]:{[q.resource]:q.remaining}};q.allocations={[key]:{[q.resource]:q.amount}};}}
  if(!validateInventory(s)||!validateDistricts(s)||!validateTrade(s))return null;
  for(const b of constructionEntities(s)){const q=b.construction;if(q&&!validSources(s,q.sources,q.remaining)||q&&!validSources(s,q.allocations,q.required))return null;}

  s.version=VERSION;return s;
 }catch{return null;}
}

export function validSources(s,sources,expected){if(!sources||typeof sources!=='object'||Array.isArray(sources))return false;const stores=new Set(stockStores(s).map(buildingKey)),totals=Object.fromEntries(MATERIALS.map(k=>[k,0]));for(const [key,stock] of Object.entries(sources)){if(!stores.has(key)||!stock||typeof stock!=='object'||Array.isArray(stock))return false;for(const [k,n]of Object.entries(stock)){if(!MATERIALS.includes(k)||!Number.isFinite(n)||n<0)return false;totals[k]+=n;}}return MATERIALS.every(k=>Math.abs(totals[k]-(expected[k]||0))<1e-7);}
