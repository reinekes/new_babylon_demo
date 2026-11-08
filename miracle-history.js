import {MIRACLES} from './definitions.js';
import {RICH_CATCH_CHARGES} from './rich-catch.js';
import {worldHeight,worldWidth} from './world.js';

export function recordMiracleCast(s,id,{faithSpent,population,fishing}){
 const history=s.miracleHistory??={version:1,trials:{},paid:{}};
 const records=faithSpent===0?history.trials:history.paid;
 records[id]={number:s.miracleCount,at:s.simTime,faithSpent,...population?{population:{...population}}:{},...fishing?{fishing:{...fishing}}:{}};
}

const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

function validPopulationOutcome(id,outcome){
 if(!object(outcome)||Object.keys(outcome).length!==3||!['bless','healing'].includes(id))return false;
 const {newResidents,happiness,reserved}=outcome,blessing=id==='bless';
 return Number.isSafeInteger(newResidents)&&newResidents>=0&&newResidents<=(blessing?3:6)&&
  Number.isFinite(happiness)&&happiness>=0&&happiness<=(blessing?15:10)+1e-9&&
  Number.isSafeInteger(reserved)&&reserved>=0&&reserved<=(blessing?0:6)&&!(newResidents&&reserved);
}

function validFishingOutcome(s,id,outcome){
 if(id!=='richCatch'||!object(outcome)||Object.keys(outcome).length!==3)return false;
 const {x,y,charges}=outcome;
 return Number.isInteger(x)&&x>=0&&x<worldWidth(s)&&Number.isInteger(y)&&y>=0&&y<worldHeight(s)&&charges===RICH_CATCH_CHARGES;
}

export function validateMiracleHistory(s){
 const history=s.miracleHistory;
 if(history===undefined)return true;
 if(!object(history)||history.version!==1||Object.keys(history).length!==3||
  !object(history.trials)||!object(history.paid))return false;
 const trials=Object.entries(history.trials),paid=Object.entries(history.paid);
 const trialTimes={cat:s.catDiscovery?.usedAt,rain:s.rainDiscovery?.trialUsedAt};
 if(trials.some(([id,row])=>!Object.hasOwn(trialTimes,id)||!object(row)||row.faithSpent!==0||
  row.population!==undefined||row.fishing!==undefined||row.at!==trialTimes[id]))return false;
 if(paid.some(([id,row])=>!Object.hasOwn(MIRACLES,id)||!object(row)||
  !Number.isSafeInteger(row.faithSpent)||row.faithSpent<=0||row.population!==undefined&&!validPopulationOutcome(id,row.population)||row.fishing!==undefined&&!validFishingOutcome(s,id,row.fishing)))return false;
 const effectDates=[
  ['rain',s.rainDiscovery,s.rainDiscovery?.lastPaidAt],
  ['abundance',s.abundanceGift,s.abundanceGift?.last?.at],
  ['peace',s.peaceDiscovery,s.peaceDiscovery?.lastCast?.at]
 ];
 if(effectDates.some(([id,effect,at])=>effect&&history.paid[id]&&history.paid[id].at!==at))return false;
 const records=[...trials,...paid].map(([,row])=>row).sort((a,b)=>a.number-b.number);
 return records.length>0&&records.every((row,i)=>Object.keys(row).length===3+Number(row.population!==undefined)+Number(row.fishing!==undefined)&&
  Number.isSafeInteger(row.number)&&row.number>0&&row.number<=s.miracleCount&&
  Number.isFinite(row.at)&&row.at>=0&&row.at<=s.simTime&&
  (!i||row.number>records[i-1].number&&row.at>=records[i-1].at));
}
