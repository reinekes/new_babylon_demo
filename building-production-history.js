import {recordCreatorUse} from './creator-materials.js';
import {BUILDINGS,MATERIALS,buildingKey} from './definitions.js';

const resources=key=>MATERIALS.includes(key)||['faith','prestige'].includes(key);
const stamp=({year,season})=>(year-1)*4+season;
const date=index=>({year:Math.floor(index/4)+1,season:((index%4)+4)%4});
const validDate=row=>Number.isSafeInteger(row?.year)&&row.year>=1&&Number.isInteger(row?.season)&&row.season>=0&&row.season<4;
const validResources=value=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.entries(value).every(([key,amount])=>resources(key)&&Number.isFinite(amount)&&amount>=0&&amount<=1e9);
const validRow=row=>validDate(row)&&validResources(row.resources);

/** Actual output only: callers invoke once when a batch is completed, including
 * finished goods waiting for room in the local output store.
 * Transfers, imports, stock snapshots and rendered projections never call this. */
export function recordBuildingProduction(s,b,resource,amount){
 if(!b||!validDate(s)||!resources(resource)||!Number.isFinite(amount)||amount<=0)return false;
 recordCreatorUse(s,b);
 recordAnnualProduction(s,b,resource,amount);
 const now=stamp(s),previous=(Array.isArray(b.productionHistory)?b.productionHistory:[]).filter(row=>validRow(row)&&stamp(row)<=now),first=previous.length?Math.min(...previous.map(stamp)):now,start=Math.max(0,now-2,first),bySeason=new Map(previous.map(row=>[stamp(row),row.resources])),rows=[];
 for(let index=start;index<=now;index++)rows.push({...date(index),resources:{...bySeason.get(index)}});
 const current=rows.at(-1);current.resources[resource]=(current.resources[resource]||0)+amount;
 b.productionHistory=rows;return true;
}

/** Three calendar seasons including the current one. Unknown pre-tracking rows
 * remain explicit, while tracked seasons with no output are genuine zeroes. */
export function productionHistory(s,b){
 if(!validDate(s))return [];
 const now=stamp(s),history=(Array.isArray(b?.productionHistory)?b.productionHistory:[]).filter(row=>validRow(row)&&stamp(row)<=now),first=history.length?Math.min(...history.map(stamp)):Infinity,bySeason=new Map(history.map(row=>[stamp(row),row.resources]));
 return Array.from({length:3},(_,offset)=>{const index=now-2+offset;return {...date(index),known:index>=0&&index>=first,current:index===now,resources:{...bySeason.get(index)}};});
}

/** Optional on old saves; an existing history must stay bounded and chronological. */
export function validateProductionHistory(s){
 if(!validDate(s))return false;
 return validCityProduction(s)&&(s.buildings||[]).every(b=>(b.productionHistory===undefined||Array.isArray(b.productionHistory)&&b.productionHistory.length<=3&&b.productionHistory.every((row,index,rows)=>validRow(row)&&stamp(row)<=stamp(s)&&(!index||stamp(row)>stamp(rows[index-1]))))&&validAnnual(s,b.productionAnnual));
}


const validStart=row=>validDate(row)&&Number.isFinite(row.elapsed)&&row.elapsed>=0&&row.elapsed<45;
const instant=row=>stamp(row)*45+(row.elapsed||0);
const annualStart=s=>({year:s.year,season:s.season,elapsed:s.seasonElapsed||0});
const validAnnual=(s,a)=>a===undefined||a&&validStart(a.started)&&instant(a.started)<=instant(annualStart(s))&&Array.isArray(a.rows)&&a.rows.length<=4&&a.rows.every((row,index,rows)=>Number.isSafeInteger(row.year)&&row.year>=a.started.year&&row.year<=s.year&&validResources(row.resources)&&(!index||row.year>rows[index-1].year));

/** Start optional accounting during real simulation, never from a readonly view.
 * Decoding old saves leaves dates, people and freight untouched. */
export function initializeProductionAccounting(s){
 if(!validStart(annualStart(s)))return false;
 s.cityProductionSince??=annualStart(s);
 for(const b of s.buildings||[])if(Object.keys(BUILDINGS[b.type]?.output||{}).length&&b.construction?.kind!=='new'&&b.productionAnnual===undefined)b.productionAnnual={started:annualStart(s),rows:[]};
 return true;
}
function recordAnnualProduction(s,b,resource,amount){
 const started=annualStart(s);if(!validStart(started))return;
 b.productionAnnual??={started,rows:[]};
 const a=b.productionAnnual,byYear=new Map(a.rows.filter(row=>row.year>=s.year-3&&row.year<=s.year).map(row=>[row.year,row.resources]));
 const rows=[];for(let year=Math.max(1,s.year-3,a.started.year);year<=s.year;year++)rows.push({year,resources:{...byYear.get(year)}});
 const current=rows.at(-1);if(!current)return;current.resources[resource]=(current.resources[resource]||0)+amount;a.rows=rows;
}

/** Last three finished calendar years, excluding the unfinished current year.
 * Existing three-season histories cannot prove an annual total and stay separate.
 * The first migrated year is labelled partial unless tracking began at New Year.
 * A genuinely new building contributes zero before its known completion date. */
export function annualProductionHistory(s,b){
 if(!validDate(s))return [];
 const a=validAnnual(s,b?.productionAnnual)?b?.productionAnnual:null,byYear=new Map((a?.rows||[]).map(row=>[row.year,row.resources]));
 const fromBirth=a&&b?.built&&instant(b.built)===instant(a.started),firstComplete=a? a.started.year+(fromBirth||a.started.season===0&&a.started.elapsed===0?0:1):Infinity;
 return Array.from({length:Math.min(3,s.year-1)},(_,index)=>{const year=Math.max(1,s.year-3)+index,known=!!a&&year>=a.started.year;return {year,known,complete:known&&year>=firstComplete,resources:known?{...byYear.get(year)}:{}};});
}

// The building retains its own history while standing. This city archive stores
// only sources without a live building, so transfers and demolition never double-count.
function addArchivedOutput(s,year,type,x,y,output){
 if(year<Math.max(1,s.year-3)||!Object.keys(output).length)return;
 const key=`${type}:${x},${y}`;
 const archive=s.cityProductionArchive??={};
 for(const old of Object.keys(archive))if(Number(old)<s.year-3)delete archive[old];
 const sources=archive[year]??={},goods=sources[key]??={};
 for(const [resource,amount] of Object.entries(output))goods[resource]=(goods[resource]||0)+amount;
}

export function archiveBuildingProduction(s,b){
 for(const row of b.productionAnnual?.rows||[])addArchivedOutput(s,row.year,b.type,b.x,b.y,row.resources);
}

const manualResources=['clay','reed','stone','wood','food'];
export function recordManualProduction(s,site,amount){
 if(!manualResources.includes(site.resource)||!Number.isFinite(amount)||amount<=0)return;
 addArchivedOutput(s,s.year,'manual',site.x,site.y,{[site.resource]:amount});
}

function validCityProduction(s){
 const start=s.cityProductionSince;
 if(start!==undefined&&(!validStart(start)||instant(start)>instant(annualStart(s))))return false;
 const archive=s.cityProductionArchive;
 if(archive===undefined)return true;
 const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
 return object(archive)&&Object.keys(archive).length<=4&&Object.entries(archive).every(([year,sources])=>
  /^[1-9]\d*$/.test(year)&&Number(year)<=s.year&&object(sources)&&Object.keys(sources).length<=100000&&
  Object.entries(sources).every(([key,goods])=>{
   const match=/^(\w+):(\d{1,3}),(\d{1,3})$/.exec(key);
   return !!match&&(match[1]==='manual'||Object.hasOwn(BUILDINGS,match[1]))&&validResources(goods)&&
    (match[1]!=='manual'||Object.keys(goods).every(k=>manualResources.includes(k)));
  }));
}

export function cityProduction(s,requestedYear=s.year){
 const years=Array.from({length:Math.min(4,s.year)},(_,i)=>s.year-i);
 const year=years.includes(requestedYear)?requestedYear:s.year;
 const totals=new Map();
 function add(source,goods){
  for(const [key,amount] of Object.entries(goods||{})){
   if(!(amount>0))continue;
   if(!totals.has(key))totals.set(key,{key,total:0,sources:[]});
   const row=totals.get(key);row.total+=amount;row.sources.push({...source,amount});
  }
 }
 for(const b of s.buildings||[]){
  const row=b.productionAnnual?.rows.find(row=>row.year===year);
  if(row)add({type:b.type,kind:'building',x:b.x,y:b.y,building:buildingKey(b)},row.resources);
 }
 for(const [key,goods] of Object.entries(s.cityProductionArchive?.[year]||{})){
  const [type,position]=key.split(':'),[x,y]=position.split(',').map(Number);
  add({type,kind:type==='manual'?'manual':'demolished',x,y},goods);
 }
 const start=s.cityProductionSince;
 const covered=!!start&&(year>start.year||year===start.year&&start.season===0&&start.elapsed===0);
 const coverage=covered?'tracked':totals.size||start?.year===year?'partial':'unknown';
 for(const row of totals.values())row.sources.sort((a,b)=>b.amount-a.amount||a.y-b.y||a.x-b.x);
 return {year,years,current:year===s.year,coverage,resources:[...totals.values()]};
}
