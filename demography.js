import {networkFor,routeBetween} from './workforce.js';
import {buildingKey,capacityOf,citizenName} from './definitions.js';
export const lifeStage=c=>c.age<16?'child':c.age<55?'adult':'elder';
export const canWork=c=>c.age===undefined||c.age>=16;
export const foodDemand=s=>s.citizens.reduce((n,c)=>n+(c.age<16?.3:.6),0);
export function initializeDemography(s,{mixed=false}={}){
 s.demography??={nextId:Math.max(-1,...s.citizens.map(c=>c.id))+1,rngState:7919,births:0,naturalDeaths:0,lastBirth:{}};
 for(const c of s.citizens){c.age??=mixed&&c.id>=10?[6,12][c.id%2]:20+(c.id*7%29);c.parents??=[];c.generation??=1;c.partner??=null;c.sex??=c.id%2?'f':'m';if(mixed){if(c.id===8)c.age=38;if(c.id===9)c.age=34;if(c.id>=10){c.parents=[8,9];c.generation=2;}else c.partner=c.id%2?c.id-1:c.id+1;}}
}
function random(s){const d=s.demography;d.rngState=(Math.imul(d.rngState,1664525)+1013904223)>>>0;return d.rngState/4294967296;}
function news(s,title,text,kind='good'){s.news.unshift({title,text,kind,tick:s.tick,year:s.year,season:s.season});s.news=s.news.slice(0,80);}
export function advanceGenerations(s,recover=()=>{}){
 initializeDemography(s);const d=s.demography,deceased=[],grown=[];
 for(const c of s.citizens){const previous=c.age;c.age+=.5;if(previous<16&&c.age>=16){grown.push(c.id);news(s,'Новое поколение работников',`${citizenName(c.id)} исполнилось 16 лет. Теперь житель может работать.`);}if(!s.funeral&&c.age>=65&&(c.age>=85||random(s)<Math.min(.3,.008+(c.age-65)*.006)))deceased.push({id:c.id,name:citizenName(c.id),x:c.x,y:c.y});}
 for(const c of deceased)recover(c.id);
 const dead=new Set(deceased.map(c=>c.id));s.citizens=s.citizens.filter(c=>!dead.has(c.id));s.population=s.citizens.length;s.deaths+=deceased.length;d.naturalDeaths+=deceased.length;
 if(deceased.length){s.name='Хранитель памяти';if(!s.divinity.names.includes(s.name))s.divinity.names.push(s.name);}
 if(deceased.length)news(s,'Завершилась жизнь',`${deceased.map(c=>c.name).join(', ')} умерли от старости. Их дети и дела остаются в городе.`,'info');
 const living=new Map(s.citizens.map(c=>[c.id,c]));for(const c of s.citizens)if(c.partner!==null&&!living.has(c.partner))c.partner=null;
 const homes=new Map();for(const c of s.citizens){if(!homes.has(c.home))homes.set(c.home,[]);homes.get(c.home).push(c);}
 // Young adults can form a household in a newly available house.
 const singles=s.citizens.filter(c=>c.age>=16&&c.age<45&&c.partner===null);
 for(const a of singles){if(a.partner!==null)continue;const partner=singles.find(c=>c!==a&&c.partner===null&&c.sex!==a.sex&&!a.parents.includes(c.id)&&!c.parents.includes(a.id)&&!a.parents.some(id=>c.parents.includes(id)));if(partner){a.partner=partner.id;partner.partner=a.id;}}
 if(!s.funeral)for(const a of s.citizens.filter(c=>c.sex==='f'&&c.partner!==null)){
  const partner=living.get(a.partner);if(!partner)continue;
  const family=[a,partner,...s.citizens.filter(c=>c.age<16&&c.parents.includes(a.id))],current=homes.get(a.home)||[];
  if(a.home===partner.home&&!current.some(c=>c.sex==='f'&&c.partner!==null&&c.id!==a.id))continue;
  const net=networkFor(s),ports=new Map(net.ports.map(p=>[buildingKey(p.building),p.key]));
  const house=s.buildings.find(b=>b.type==='house'&&routeBetween(s,ports.get(a.home),ports.get(buildingKey(b)))&&routeBetween(s,ports.get(partner.home),ports.get(buildingKey(b)))&&!(homes.get(buildingKey(b))||[]).length&&b.construction?.kind!=='new'&&buildingKey(b)!==a.home&&capacityOf(b)-(homes.get(buildingKey(b))||[]).length>=family.length);
  if(!house||family.some(c=>Object.values(c.cargo||{}).some(n=>n>0)||Object.values(c.buildCargo||{}).some(n=>n>0)))continue;
  const destination=buildingKey(house);for(const c of family){homes.set(c.home,(homes.get(c.home)||[]).filter(p=>p.id!==c.id));c.home=destination;c.rehousing=true;if(!homes.has(destination))homes.set(destination,[]);homes.get(destination).push(c);}
  news(s,'Семья обрела дом',`${citizenName(a.id)} и ${citizenName(partner.id)} поселились в доме ${destination}.`);
 }
 const newborns=[];
 for(const b of s.buildings.filter(b=>b.type==='house'&&b.construction?.kind!=='new')){
  const home=buildingKey(b),residents=homes.get(home)||[],adults=residents.filter(c=>c.age>=16&&c.age<50);
  for(const a of adults){if(a.partner!==null)continue;const partner=adults.find(c=>c!==a&&c.sex!==a.sex&&c.partner===null&&!a.parents.includes(c.id)&&!c.parents.includes(a.id)&&!a.parents.some(id=>c.parents.includes(id)));if(partner){a.partner=partner.id;partner.partner=a.id;}}
  const pair=adults.find(c=>c.sex==='f'&&c.age<45&&living.get(c.partner)?.home===home);
  if(!pair||residents.length>=capacityOf(b)||s.happiness<65||s.hungry||s.resources.food<foodDemand(s)*2+.6||s.tick-(d.lastBirth[home]??-8)<8||random(s)>=.25)continue;
  const father=living.get(pair.partner),id=d.nextId++,baby={id,home,age:0,sex:id%2?'f':'m',parents:[pair.id,father.id],partner:null,generation:1+Math.max(pair.generation,father.generation)};
  newborns.push(baby);residents.push(baby);d.lastBirth[home]=s.tick;d.births++;news(s,'В семье родился ребёнок',`${citizenName(id)} · родители: ${citizenName(pair.id)} и ${citizenName(father.id)}. Поколение ${baby.generation}.`);
 }
 s.citizens.push(...newborns);s.population=s.citizens.length;return {deceased,grown,newborns};
}
export function validateDemography(s){const d=s.demography,int=(n,max=1e9)=>Number.isSafeInteger(n)&&n>=0&&n<=max;if(!d||!int(d.nextId,1e6)||!int(d.rngState,4294967295)||!int(d.births)||!int(d.naturalDeaths)||d.naturalDeaths>s.deaths||!d.lastBirth||typeof d.lastBirth!=='object'||Array.isArray(d.lastBirth)||Object.entries(d.lastBirth).some(([k,v])=>!/^\d+,\d+$/.test(k)||!int(v,s.tick)))return false;
 const ids=new Map(s.citizens.map(c=>[c.id,c]));return s.citizens.every(c=>int(c.id)&&c.id<d.nextId&&Number.isFinite(c.age)&&c.age>=0&&c.age<=100&&['m','f'].includes(c.sex)&&int(c.generation)&&c.generation>=1&&Array.isArray(c.parents)&&[0,2].includes(c.parents.length)&&new Set(c.parents).size===c.parents.length&&c.parents.every(id=>int(id)&&id<c.id)&& (c.partner===null||int(c.partner)&&c.partner!==c.id&&ids.get(c.partner)?.partner===c.id)&& (canWork(c)||!c.work&&!c.site&&!c.tradeJob&&!c.saleJob&&!Object.values(c.cargo).some(n=>n>0)&&!Object.values(c.buildCargo||{}).some(n=>n>0)));}
