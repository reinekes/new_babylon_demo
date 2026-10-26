import {MATERIALS} from './definitions.js';

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
 return (s.buildings||[]).every(b=>b.productionHistory===undefined||Array.isArray(b.productionHistory)&&b.productionHistory.length<=3&&b.productionHistory.every((row,index,rows)=>validRow(row)&&stamp(row)<=stamp(s)&&(!index||stamp(row)>stamp(rows[index-1]))));
}
