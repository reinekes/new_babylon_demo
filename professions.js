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
 weaver:entry('Ткач','production',['weaver']),shepherd:entry('Пастух','production',['sheepfold']),
 dairyman:entry('Молочник','production',['cowshed']),
 fisher:entry('Рыбак','production',['fishing']),hunter:entry('Охотник','production',['hunting']),
 brickmaker:entry('Формовщик кирпича','production',['brickyard']),kilnworker:entry('Обжигальщик','production',['kiln']),
 priest:entry('Жрец','production',['shrine','ziggurat'])
});
export const PROFESSION_IDS=Object.freeze(Object.keys(PROFESSIONS));
export const PROFESSION_NAMES=Object.freeze(Object.fromEntries(Object.entries(PROFESSIONS).map(([id,p])=>[id,p.name])));
export const professionRole=id=>PROFESSIONS[id]?.role;
const byBuilding=Object.freeze(Object.fromEntries(Object.entries(PROFESSIONS).flatMap(([id,p])=>p.buildings.map(type=>[type,id]))));
export const professionForBuilding=type=>byBuilding[type]||null;
export function professionMatchesTask(c,task){
 const p=PROFESSIONS[c.calling];if(c.age<16||!p||c.calling==='auto'||c.role!==p.role)return false;
 if(p.buildings.length)return p.buildings.includes(task)||c.calling===task;
 if(c.calling==='production')return task==='production'||professionRole(professionForBuilding(task))==='production';
 return c.calling===task;
}
export function canStaffBuilding(c,b){
 if(c.age<16)return false;
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
