import {footprintSize,occupiesCell} from './footprints.js';

export const extractionKinds=Object.freeze({
 clay:'clay',reed:'reed',quarry:'stone',logging:'forest',garden:'dates',hunting:'wildlife'
});
export const extractionSource=b=>b.deposit||b;
export const isExtractionCourt=b=>!!extractionKinds[b.type]&&footprintSize(b)===2;
export const extractionWorkspaceWidth=b=>(b.level||1)===1?2.8:3.5;

export function extractionPlacements(state,type,x,y){
 const kind=extractionKinds[type];
 if(!kind)return [{x,y}];
 const sites=(state.world?.deposits||[]).filter(d=>d.kind===kind);
 const selected=sites.find(d=>d.x===x&&d.y===y);
 if(selected)return [[0,0],[-1,0],[0,-1],[-1,-1]].map(([dx,dy])=>({x:x+dx,y:y+dy,deposit:{x,y}}));
 const deposit=sites.find(d=>occupiesCell({type,x,y,footprint:2},d.x,d.y));
 return deposit?[{x,y,deposit:{x:deposit.x,y:deposit.y}}]:[{x,y}];
}

export function extractionWorkArea(b){
 const source=extractionSource(b),a=(b.rotation||0)*Math.PI/2;
 const dx=source.x-b.x-.5,dy=source.y-b.y-.5;
 const sx=Math.sign(dx*Math.cos(a)-dy*Math.sin(a))||-1;
 const sz=Math.sign(dx*Math.sin(a)+dy*Math.cos(a))||-1;
 return {x:3-sx*3,z:3-sz*3};
}

export function extractionOwner(state,deposit){
 return state.buildings?.find(b=>isExtractionCourt(b)&&extractionKinds[b.type]===deposit.kind&&
  extractionSource(b).x===deposit.x&&extractionSource(b).y===deposit.y);
}
