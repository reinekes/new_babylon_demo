import {riverPoint,riverLength,onBridge} from '../world.js';
import {loopMotion} from '../local-motion.js';
import {surfaceElevation} from '../district3d/terrain.js';
import {WATER_HEIGHT,waterDepth} from './water.js';

export function planRegionalFauna(state,along,dry,clearSegment,steppeland){
 const length=riverLength(state);
 const spots=(shift,offset)=>[shift,-shift,shift+3,-shift-3,0,3,-3].map(delta=>along+delta)
  .filter(bank=>bank>=3&&bank<=length-4).map(bank=>({bank,point:riverPoint(bank,state,offset)}));
 const bank=(shift,offset,margin)=>spots(shift,offset).find(({point:p})=>dry(state,p.x,p.y,margin));
 const pool=(shift,offset,radius,spread,depth)=>spots(shift,offset).find(({bank})=>
  Array.from({length:20},(_,i)=>i*Math.PI/10).every(angle=>{
   const p=riverPoint(bank+radius*Math.sin(angle),state,offset+spread*Math.cos(angle));
   return waterDepth(p.x,p.y,state)>depth&&dry(state,p.x,p.y,-Infinity)&&!onBridge(state.buildings,p.x,p.y,state);
  }));
 const ibis=pool(7,1.05,.46,.025,.105);
 const frog=bank(-3,1.66,.20);
 const frogEnd=frog&&riverPoint(frog.bank+.16,state,1.66);
 const onagerEnd=steppeland&&[[1.3,0],[0,1.3],[-1.3,0],[0,-1.3]].map(([dx,dy])=>({x:steppeland.x+dx,y:steppeland.y+dy}))
  .find(p=>clearSegment(state,steppeland,p));
 return {ibis,frog:frog&&(frogEnd&&clearSegment(state,frog.point,frogEnd)?[frog.point,frogEnd]:[frog.point]),
  onager:steppeland&&(onagerEnd?[steppeland,onagerEnd,steppeland]:[steppeland]),
  pelican:pool(5,-.27,1.25,.22,.40),cormorant:pool(-6,.47,.83,.19,.40),
  kingfisher:pool(-3,.28,.70,.09,.42),harrier:bank(9,2.3,.30)};
}

export function regionalFauna(state,plan,time){
 const animals=[];
 const add=(kind,pose)=>animals.push({id:'ambient-'+kind,kind,decorative:true,...pose});
 const orbit=(kind,site,offset,radius,spread,seconds,pose)=>{
  if(!site)return;
  const a=time/seconds*Math.PI*2;
  const point=angle=>riverPoint(site.bank+radius*Math.sin(angle),state,offset+spread*Math.cos(angle));
  const p=point(a),next=point(a+.001);
  add(kind,{...p,...pose(a),yaw:Math.atan2(next.x-p.x,next.y-p.y)});
 };
 orbit('white-pelican',plan.pelican,-.27,1.25,.22,34,a=>({behavior:'swimming',elevation:WATER_HEIGHT+.017+Math.sin(a*16)*.014}));
 orbit('pygmy-cormorant',plan.cormorant,.47,.83,.19,25,a=>{
  const dive=Math.max(0,-Math.cos(a))**2;
  return {behavior:dive>.2?'swimming-underwater':'swimming',elevation:WATER_HEIGHT+.018-dive*.47,pitch:dive*.25};
 });
 orbit('glossy-ibis',plan.ibis,1.05,.46,.025,27,a=>({behavior:Math.cos(a*4)<-.60?'probing':'walking'}));
 orbit('pied-kingfisher',plan.kingfisher,.28,.70,.09,19,a=>{
  const phase=(a/(2*Math.PI))%1;
  const dip=Math.max(0,Math.min(1,(phase-.62)/.035,(.73-phase)/.075));
  return {behavior:dip>.3?'diving':'hovering',elevation:WATER_HEIGHT+1.14-dip*1.20,pitch:dip*.84};
 });
 orbit('marsh-harrier',plan.harrier,2.3,1.45,.42,24,a=>({behavior:'flying',elevation:WATER_HEIGHT+3.0+Math.cos(a)*.38}));
 if(plan.frog){
  const phase=time%12,step=Math.max(0,Math.min(1,(phase%6-4.9)/.32));
  const progress=phase<6?step:1-step,[a,b=a]=plan.frog;
  const x=a.x+(b.x-a.x)*progress,y=a.y+(b.y-a.y)*progress;
  const hop=b===a?0:4*step*(1-step);
  add('savigny-tree-frog',{x,y,hop,yaw:Math.atan2(b.x-a.x,b.y-a.y)+(phase<6?0:Math.PI),
   elevation:surfaceElevation(x,y,state)+hop*.14});
 }
 if(plan.onager){
  const motion=loopMotion(plan.onager,time,.35,5);
  add('onager',{...motion,behavior:motion.walking?'walking':'grazing'});
 }
 return animals;
}
