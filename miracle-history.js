import {MIRACLES} from './definitions.js';

export function recordMiracleCast(s,id,faithSpent){
 const history=s.miracleHistory??={version:1,trials:{},paid:{}};
 const records=faithSpent===0?history.trials:history.paid;
 records[id]={number:s.miracleCount,at:s.simTime,faithSpent};
}

const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

export function validateMiracleHistory(s){
 const history=s.miracleHistory;
 if(history===undefined)return true;
 if(!object(history)||history.version!==1||Object.keys(history).length!==3||
  !object(history.trials)||!object(history.paid))return false;
 const trials=Object.entries(history.trials),paid=Object.entries(history.paid);
 const trialTimes={cat:s.catDiscovery?.usedAt,rain:s.rainDiscovery?.trialUsedAt};
 if(trials.some(([id,row])=>!Object.hasOwn(trialTimes,id)||!object(row)||row.faithSpent!==0||
  row.at!==trialTimes[id]))return false;
 if(paid.some(([id,row])=>!Object.hasOwn(MIRACLES,id)||!object(row)||
  !Number.isSafeInteger(row.faithSpent)||row.faithSpent<=0))return false;
 const records=[...trials,...paid].map(([,row])=>row).sort((a,b)=>a.number-b.number);
 return records.length>0&&records.every((row,i)=>Object.keys(row).length===3&&
  Number.isSafeInteger(row.number)&&row.number>0&&row.number<=s.miracleCount&&
  Number.isFinite(row.at)&&row.at>=0&&row.at<=s.simTime&&
  (!i||row.number>records[i-1].number&&row.at>=records[i-1].at));
}
