import {usesCatDiscovery} from './scenario-profiles.js';

export const newRainDiscovery=()=>({version:1,trialUsedAt:null,lastPaidAt:null});

export function rainTrialReady(s){
 return !!s.rainDiscovery&&!!s.irrigatedHarvest&&s.rainDiscovery.trialUsedAt===null;
}

export function recordRainCast(s){
 const discovery=s.rainDiscovery;
 if(!discovery)return;
 if(rainTrialReady(s))discovery.trialUsedAt=s.simTime;
 else discovery.lastPaidAt=s.simTime;
}

export function validateRainDiscovery(s){
 const discovery=s.rainDiscovery;
 if(discovery===undefined)return true;
 if(!usesCatDiscovery(s)||!discovery||discovery.version!==1||Object.keys(discovery).length!==3)return false;
 const {trialUsedAt,lastPaidAt}=discovery;
 if(trialUsedAt===null)return lastPaidAt===null;
 if(!s.irrigatedHarvest||!Number.isFinite(trialUsedAt)||trialUsedAt<s.irrigatedHarvest.time||trialUsedAt>s.simTime)return false;
 return lastPaidAt===null||Number.isFinite(lastPaidAt)&&lastPaidAt>trialUsedAt&&lastPaidAt<=s.simTime;
}
