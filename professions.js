import {BUILDINGS} from './definitions.js';
// Specializations extend calling, never the saved workforce role or cargo schema.
const entry=(name,role,buildings=[])=>Object.freeze({name,role,buildings:Object.freeze(buildings)});
export const PROFESSIONS=Object.freeze({
 auto:entry('Авто','auto'),builder:entry('Строитель','builder'),carrier:entry('Носильщик','carrier',['depot']),
 production:entry('Производство','production'),healer:entry('Лекарь','healer',['healer']),
 tailor:entry('Мастер одежды','tailor',['tailor']),watercarrier:entry('Водонос','watercarrier',['waterpoint']),
 farmer:entry('Земледелец','production',['field']),gardener:entry('Садовник','production',['garden']),
 lumberjack:entry('Лесоруб','production',['logging']),clayworker:entry('Добытчик глины','production',['clay']),
 reedcutter:entry('Заготовитель тростника','production',['reed']),quarrier:entry('Каменотёс','production',['quarry']),
 potter:entry('Гончар','production',['pottery']),brewer:entry('Пивовар','production',['brewery']),
 weaver:entry('Ткач','production',['weaver','linenYard']),shepherd:entry('Пастух','production',['sheepfold']),
 dairyman:entry('Молочник','production',['cowshed']),
 musician:entry('Музыкант','production',['musicHouse']),
 fisher:entry('Рыбак','production',['fishing']),hunter:entry('Охотник','production',['hunting']),
 brickmaker:entry('Формовщик кирпича','production',['brickyard']),kilnworker:entry('Обжигальщик','production',['kiln']),
 priest:entry('Жрец','production',['shrine','ziggurat']),scribe:entry('Писец','production',['granary']),lawmaker:entry('Законодатель','auto')
});
export const PROFESSION_IDS=Object.freeze(Object.keys(PROFESSIONS));
export const PROFESSION_NAMES=Object.freeze(Object.fromEntries(Object.entries(PROFESSIONS).map(([id,p])=>[id,p.name])));
export const professionRole=id=>PROFESSIONS[id]?.role;
const byBuilding=Object.freeze(Object.fromEntries(Object.entries(PROFESSIONS).flatMap(([id,p])=>p.buildings.map(type=>[type,id]))));
export const professionForBuilding=type=>byBuilding[type]||null;
export const workplaceCapacity=type=>['healer','granary'].includes(type)?1:2;
export const hasWorkplace=type=>['healer','depot','waterpoint','granary'].includes(type)||Object.keys(BUILDINGS[type]?.output||{}).length>0;
export function professionMatchesTask(c,task){
 const p=PROFESSIONS[c.calling];if(c.age<16||!p||c.calling==='auto'||c.role!==p.role)return false;
 if(p.buildings.length)return p.buildings.includes(task)||c.calling===task;
 if(c.calling==='production')return task==='production'||professionRole(professionForBuilding(task))==='production';
 return c.calling===task;
}
export function canStaffBuilding(c,b){
 if(c.age<16||c.selfCalling&&professionForBuilding(b.type)!==c.calling)return false;
 if(b.type==='granary')return c.role==='production'&&c.calling==='scribe';
 if(b.type==='musicHouse')return c.role==='production'&&c.calling==='musician';
 if(b.type==='healer')return c.role==='healer'&&c.medicine?.level>0;
 if(b.type==='tailor')return c.role==='tailor';
 if(b.type==='waterpoint')return c.role==='watercarrier';
 if(b.type==='depot')return ['auto','production','carrier'].includes(c.role);
 return ['auto','production'].includes(c.role);
}
export function staffingCandidates(citizens,b){
 const key=`${b.x},${b.y}`;
 return citizens.filter(c=>c.workplace!==key&&canStaffBuilding(c,b)).sort((a,c)=>Number(professionMatchesTask(c,b.type))-Number(professionMatchesTask(a,b.type))||a.id-c.id);
}

const vocationGroups=[
 ['builder','brickmaker','kilnworker','quarrier','clayworker','lumberjack','reedcutter'],
 ['farmer','gardener','shepherd','dairyman','fisher','hunter','watercarrier','carrier'],
 ['potter','brewer','weaver','tailor'],
 ['musician','priest','scribe','healer','lawmaker']
];
const vocations=vocationGroups.flat().filter(id=>id!=='lawmaker');
const vocationGroup=id=>vocationGroups.find(group=>group.includes(id));

export function enableCareerRules(s){
 s.careerRules??={attempts:0,lastChoiceDay:0};
 return s;
}

export function residentCareerRoll(s,id,salt){
 let value=(s.world?.seed||0)^Math.imul(id+1,0x9e3779b1)^Math.imul(salt,0x85ebca6b);
 value=Math.imul(value^(value>>>16),0x7feb352d);
 value=Math.imul(value^(value>>>15),0x846ca68b);
 return ((value^(value>>>16))>>>0)/4294967296;
}

export const innateProfession=(s,c)=>vocations[Math.floor(residentCareerRoll(s,c.id,0)*vocations.length)];
export const inspirationCost=s=>2**(s.careerRules?.attempts||0);
export const inspirationPriceLabel=s=>`${inspirationCost(s).toLocaleString('ru-RU')} ${inspirationCost(s)===1?'вера':'веры'}`;

export function vocationInspirationChance(s,c,profession,base){
 if(!s.careerRules)return base;
 const innate=innateProfession(s,c);
 const chance=profession===innate ? .9 : vocationGroup(innate)?.includes(profession)?base:['auto','production'].includes(profession)?base*.75:base*.45;
 return c.selfCalling&&profession!==c.calling?Math.max(.03,chance*.25):chance;
}

export function validateCareerRules(s){
 const rules=s.careerRules;
 const valid=rules===undefined||rules&&Object.keys(rules).length===2&&Number.isInteger(rules.attempts)&&rules.attempts>=0&&rules.attempts<=30&&rules.attempts<=s.divinity.inspirationAttempts&&Number.isSafeInteger(rules.lastChoiceDay)&&rules.lastChoiceDay>=0&&rules.lastChoiceDay<=Math.floor((s.simTime+5+1e-6)/60);
 return valid&&s.citizens.every(c=>c.selfCalling===undefined||rules&&c.selfCalling===true&&vocations.includes(c.calling)&&c.role===professionRole(c.calling)&&c.age>=16);
}
