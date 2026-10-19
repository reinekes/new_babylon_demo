import {citizenName} from './definitions.js';
import {canWork} from './demography.js';
export const STUDY_SECONDS=20;
export const ROLES=['auto','builder','carrier','production','healer'];
export const inspirationChance=(c,role)=>role==='healer'?(canWork(c)?.2:.4):(canWork(c)?.4:.7);
export const medicalLevel=c=>c.medicine?.level||0;
export const qualifiedHealer=c=>canWork(c)&&medicalLevel(c)>0;
export const newMedicalSkill=(year,level=0)=>({level,study:level?STUDY_SECONDS:0,practice:0,year});
export const healingSpeed=c=>1+.15*Math.max(0,medicalLevel(c)-1);
export const healingQuality=c=>85+2.5*Math.max(0,medicalLevel(c)-1);
export const healingCost=c=>1-.1*Math.max(0,medicalLevel(c)-1);
export function advanceMedicalYear(s){for(const c of s.citizens){const m=c.medicine;if(!m||s.year<=m.year)continue;if(m.level&&m.level<5&&m.practice>0){m.level++;s.news.unshift({title:'Мастерство лекаря',text:`${citizenName(c.id)} достиг уровня ${m.level}. Лечение стало быстрее и бережнее.`,kind:'good',tick:s.tick,year:s.year,season:s.season});s.news=s.news.slice(0,80);}m.year=s.year;m.practice=0;}}
export function validateEducation(s){return s.citizens.every(c=>{
 const m=c.medicine;if(m!==undefined&&(!m||!Number.isInteger(m.level)||m.level<0||m.level>5||!Number.isFinite(m.study)||m.study<0||m.study>STUDY_SECONDS||m.level>0&&m.study!==STUDY_SECONDS||m.level===0&&m.study===STUDY_SECONDS||!Number.isFinite(m.practice)||m.practice<0||m.practice>1e9||!Number.isSafeInteger(m.year)||m.year<1||m.year>s.year))return false;
 if(c.careGoal!==undefined&&(!Number.isFinite(c.careGoal)||c.careGoal<85||c.careGoal>95))return false;
 const school=s.buildings.find(b=>`${b.x},${b.y}`===c.school&&['shrine','ziggurat'].includes(b.type)&&b.construction?.kind!=='new');
 if(c.school!==undefined&&(!school||!canWork(c)||c.role!=='healer'||!m||m.level!==0||!['toSchool','studying','blocked'].includes(c.phase)||c.clinic||c.pantryTrip||c.tradeJob||c.saleJob||Object.values(c.cargo||{}).some(n=>n>0)||Object.values(c.buildCargo||{}).some(n=>n>0)))return false;
 if(['toSchool','studying'].includes(c.phase)&&!c.school)return false;
 if(c.work&&s.buildings.find(b=>`${b.x},${b.y}`===c.work)?.type==='healer'&&!qualifiedHealer(c))return false;
 return true;
 });}
