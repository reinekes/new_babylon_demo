import {isStrictSumer} from './scenario-profiles.js';

export const TOOL_EDGE=6;
const WORK_TOOLS=Object.freeze({logging:'axe',quarry:'chisel',hunting:'blade'});
export const toolResource=b=>WORK_TOOLS[b?.type];
const kitKey=b=>b.type==='logging'?'axeKit':'toolKit';
export const workTool=b=>b[kitKey(b)];
export const toolWorkMultiplier=b=>toolResource(b)&&workTool(b)?.edge>0?1.25:1;
export function wearWorkTool(b){
 const kit=workTool(b);
 if(kit?.edge>0)kit.edge--;
}
export function toolNeeds(b){
 const kit=workTool(b),tool=toolResource(b);
 if(kit?.edge===0)return {copper:1-kit.copper};
 if(kit?.edge>0)return {};
 return {[tool]:1-(kit?.[tool]||0)};
}
export function putToolSupply(b,k,amount){
 const tool=toolResource(b),kit=b[kitKey(b)]??={edge:null,[tool]:0,copper:0};
 kit[k]+=amount;
 if(kit[k]>=1-1e-8){
  kit[k]=0;
  kit.edge=TOOL_EDGE;
 }
}
export function validateWorkTool(s,b){
 const kit=workTool(b),tool=toolResource(b);
 if(b.type==='logging'?b.toolKit!==undefined:b.axeKit!==undefined)return false;
 if(kit===undefined)return true;
 return !!(tool&&isStrictSumer(s)&&kit&&Object.keys(kit).length===3&&
  (kit.edge===null||Number.isInteger(kit.edge)&&kit.edge>=0&&kit.edge<=TOOL_EDGE)&&
  [tool,'copper'].every(k=>Number.isFinite(kit[k])&&kit[k]>=0&&kit[k]<1)&&
  (kit.edge===null||kit[tool]===0)&&(kit.edge===0||kit.copper===0));
}
