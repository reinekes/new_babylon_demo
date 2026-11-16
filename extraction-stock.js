import {mineralCapacity,mineralRemaining} from './mineral-stock.js';
import {forestCapacity,forestStock} from './forest-stock.js';
import {REED_CAPACITY,reedStatus} from './reed-stock.js';
import {isStrictSumer} from './scenario-profiles.js';
import {extractionKinds,extractionSources} from './extraction-courts.js';
import {DATE_HARVEST_CAPACITY,dateStock} from './orchard-layout.js';

export function extractionStock(state,site,kind=site.kind){
 if(!isStrictSumer(state))return {stock:Infinity,capacity:Infinity,resting:false};
 const {x,y}=site;
 if(kind==='forest'){const key=`${x},${y}`;return {...forestStock(state,key),capacity:forestCapacity(state,key)};}
 if(kind==='reed')return {...reedStatus(state,x,y),capacity:REED_CAPACITY};
 if(kind==='dates')return {stock:dateStock(state,site),capacity:DATE_HARVEST_CAPACITY,resting:false};
 if(kind==='clay'||kind==='stone')return {stock:mineralRemaining(state,kind,x,y),capacity:mineralCapacity(state,kind,x,y),resting:false};
 return {stock:Infinity,capacity:Infinity,resting:false};
}

export function availableExtractionSources(state,b){
 return extractionSources(state,b).filter(site=>{
  const {stock,resting}=extractionStock(state,site,extractionKinds[b.type]);return !resting&&stock>1e-8;
 });
}

export function extractionStockFraction(state,site){
 if(site.kind==='reed')return isStrictSumer(state)?(state.reedBeds?.[`${site.x},${site.y}`]?.stock??REED_CAPACITY)/REED_CAPACITY:1;
 const {stock,capacity}=extractionStock(state,site);
 return Number.isFinite(capacity)?Math.max(0,Math.min(1,stock/capacity)):1;
}
