import {isStrictSumer} from './scenario-profiles.js';

export const AXE_EDGE=6;
export const axeWorkMultiplier=b=>b.type==='logging'&&b.axeKit?.edge>0?1.25:1;
export function useAxe(b,wood){
 if(b.type==='logging'&&b.axeKit?.edge>0&&wood>0)b.axeKit.edge--;
}
export function axeNeeds(b){
 const kit=b.axeKit;
 if(kit?.edge===0)return {copper:1-kit.copper};
 if(kit?.edge>0)return {};
 return {axe:1-(kit?.axe||0)};
}
export function putAxeSupply(b,k,amount){
 const kit=b.axeKit??={edge:null,axe:0,copper:0};
 kit[k]+=amount;
 if(kit[k]>=1-1e-8){
  kit[k]=0;
  kit.edge=AXE_EDGE;
 }
}
export function validateAxeKit(s,b){
 const kit=b.axeKit;
 if(kit===undefined)return true;
 return b.type==='logging'&&isStrictSumer(s)&&kit&&Object.keys(kit).length===3&&
  (kit.edge===null||Number.isInteger(kit.edge)&&kit.edge>=0&&kit.edge<=AXE_EDGE)&&
  ['axe','copper'].every(k=>Number.isFinite(kit[k])&&kit[k]>=0&&kit[k]<1)&&
  (kit.edge===null||kit.axe===0)&&(kit.edge===0||kit.copper===0);
}
