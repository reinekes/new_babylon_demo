import {footprintCells,footprintSize,occupiesCell} from './footprints.js';

export const extractionKinds=Object.freeze({
 clay:'clay',reed:'reed',quarry:'stone',logging:'forest',garden:'dates',hunting:'wildlife'
});
export const extractionSource=b=>b.deposit||b;
export const isExtractionCourt=b=>!!extractionKinds[b?.type]&&footprintSize(b)===2;
export const extractableCourts=new Set(['clay','reed','quarry','logging','garden']);
export const extractionWorkspaceWidth=b=>(b.level||1)===1?2.8:3.5;
export function extractionSources(state,b){
 if(!isExtractionCourt(b))return [extractionSource(b)];
 const kind=extractionKinds[b.type],primary=extractionSource(b);
 return (state?.world?.deposits||[]).filter(d=>d.kind===kind&&occupiesCell(b,d.x,d.y)).sort((a,b)=>
  Number(b.x===primary.x&&b.y===primary.y)-Number(a.x===primary.x&&a.y===primary.y)||a.y-b.y||a.x-b.x);
}

export function extractionPlacements(state,type,x,y){
 const kind=extractionKinds[type];
 if(!kind)return [{x,y}];
 const sites=(state.world?.deposits||[]).filter(d=>d.kind===kind);
 const selected=sites.find(d=>d.x===x&&d.y===y);
 if(selected)return [[0,0],[-1,0],[0,-1],[-1,-1]].map(([dx,dy])=>({x:x+dx,y:y+dy,deposit:{x,y}}));
 const deposit=sites.find(d=>occupiesCell({type,x,y,footprint:2},d.x,d.y));
 return deposit?[{x,y,deposit:{x:deposit.x,y:deposit.y}}]:[{x,y}];
}

export function extractionWorkArea(b,state){
 const sites=state?extractionSources(state,b):[];
 if(sites.length>1){
  const primary=extractionSource(b);
  const vacant=footprintCells(b).filter(p=>!sites.some(s=>s.x===p.x&&s.y===p.y));
  const point=vacant.sort((a,c)=>Math.hypot(c.x-primary.x,c.y-primary.y)-Math.hypot(a.x-primary.x,a.y-primary.y))[0];
  if(!point)return {x:3,z:3};
  const a=(b.rotation||0)*Math.PI/2,dx=point.x-b.x-.5,dy=point.y-b.y-.5;
  return {x:3+Math.round(6*(dx*Math.cos(a)-dy*Math.sin(a))),z:3+Math.round(6*(dx*Math.sin(a)+dy*Math.cos(a)))};
 }
 const source=extractionSource(b),a=(b.rotation||0)*Math.PI/2;
 const dx=source.x-b.x-.5,dy=source.y-b.y-.5;
 const sx=Math.sign(dx*Math.cos(a)-dy*Math.sin(a))||-1;
 const sz=Math.sign(dx*Math.sin(a)+dy*Math.cos(a))||-1;
 return {x:3-sx*3,z:3-sz*3};
}

export function extractionOwner(state,deposit){
 return state.buildings?.find(b=>isExtractionCourt(b)&&extractionKinds[b.type]===deposit.kind&&
  occupiesCell(b,deposit.x,deposit.y));
}
