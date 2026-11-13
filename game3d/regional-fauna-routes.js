import {riverPoint,riverLength,onBridge} from '../world.js';
import {calendarAt,calendarRateFor,MONTH_SECONDS} from '../calendar.js';
import {surfaceElevation} from '../district3d/terrain.js';
import {WATER_HEIGHT,waterDepth} from './water.js';

const herdFormation=[[0,0],[-.37,-.44],[.38,-.51],[-.75,-.92],[.76,-1.02]];
function onagerRoutes(state,center,clearSegment){
 if(!center)return [];
 const directions=[[1,0],[0,1],[-1,0],[0,-1]];
 const centers=[center,...directions.map(([x,y])=>({x:center.x+x*1.25,y:center.y+y*1.25}))];
 for(const site of centers)for(const [dx,dy] of directions){
  const routes=herdFormation.map(([side,back],index)=>{
   const start={x:site.x+dx*back-dy*side,y:site.y+dy*back+dx*side};
   const drift=[0,-.06,.11,-.19,.17][index],reach=[1.53,1.42,1.71,1.55,1.34][index];
   return [start,{x:start.x+dx*reach-dy*drift,y:start.y+dy*reach+dx*drift}];
  });
  if(routes.every(([a,b])=>clearSegment(state,a,b)))return routes;
 }
 return [];
}

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
 const quail=[];
 for(const {bank:center} of spots(9,2.1)){
  const group=[[0,0],[.27,.12],[-.24,.17],[.5,.35],[-.52,.34]].map(([x,y])=>riverPoint(center+x,state,2.05+y));
  if(!group.every((p,i)=>dry(state,p.x,p.y,.28)&&group.slice(0,i).every(q=>Math.hypot(p.x-q.x,p.y-q.y)>.18)))continue;
  quail.push(...group);break;
 }
 const frogEnd=frog&&riverPoint(frog.bank+.16,state,1.66);
 return {ibis,quail,frog:frog&&(frogEnd&&clearSegment(state,frog.point,frogEnd)?[frog.point,frogEnd]:[frog.point]),
  onagers:onagerRoutes(state,steppeland,clearSegment),
  pelican:pool(5,-.27,1.25,.22,.40),cormorant:pool(-6,.47,.83,.19,.40),
  kingfisher:pool(-3,.28,.70,.09,.42),harrier:bank(9,2.3,.30)};
}

// The Iraqi Central Marsh survey recorded the species in December–February.
function pelicanPose(state,site){
 const {season,month,progress}=calendarAt(state);
 if(!site||season!==3)return null;
 const winter=(month-9+progress)/3;
 const edge=.13;
 const swim=Math.max(0,Math.min(1,(winter-edge)/(1-2*edge)));
 const swimSeconds=3*MONTH_SECONDS*(1-2*edge)/calendarRateFor(state);
 const phase=swim*swimSeconds;
 const rhythm=phase*.63;
 // Paddle, glide, then slow briefly when the bill drops toward the water.
 const angle=(phase+.78*Math.sin(rhythm))/48*Math.PI*2;
 const point=a=>riverPoint(site.bank+1.25*Math.sin(a),state,-.27+.22*Math.cos(a));
 const water=point(angle),ahead=point(angle+.001);
 const yaw=Math.atan2(ahead.x-water.x,ahead.y-water.y);
 const arriving=winter<edge,leaving=winter>1-edge;
 const flight=arriving?1-winter/edge:leaving?(winter-1+edge)/edge:0;
 const travel=(arriving?-1:1)*flight*1.7;
 const lift=flight*flight*6;
 const stroke=.60+.40*Math.cos(rhythm);
 const scoop=Math.max(0,-Math.cos(rhythm))**8;
 return {x:water.x+Math.sin(yaw)*travel,y:water.y+Math.cos(yaw)*travel,yaw,
  behavior:arriving?'landing':leaving?'taking-off':'swimming',flight,scoop,stroke,
  elevation:WATER_HEIGHT+.025+lift, pitch:arriving?.14*flight:leaving?-.17*flight:0};
}

function onagerPose([start,end=start],time){
 const length=Math.hypot(end.x-start.x,end.y-start.y);
 const travel=length/.18,pause=6,turn=1.35;
 const half=travel+pause+turn;
 const clock=time%(2*half),returning=clock>=half,phase=clock%half;
 const distance=travel?Math.min(1,phase/travel):0;
 const from=returning?end:start,to=returning?start:end;
 const yaw=Math.atan2(to.x-from.x,to.y-from.y);
 const turning=length>0&&phase>=travel+pause;
 const pivot=turning?(phase-travel-pause)/turn:0;
 return {x:from.x+(to.x-from.x)*distance,y:from.y+(to.y-from.y)*distance,
  yaw:yaw+pivot*Math.PI,behavior:phase<travel||turning?'walking':'grazing',
  turn:turning?Math.sin(pivot*Math.PI):0};
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
 const pelican=pelicanPose(state,plan.pelican);
 if(pelican)add('white-pelican',pelican);
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
  add('savigny-tree-frog',{x,y,hop,hopProgress:b===a?0:step,yaw:Math.atan2(b.x-a.x,b.y-a.y)+(phase<6?0:Math.PI),
   elevation:surfaceElevation(x,y,state)+hop*.14});
 }
 for(const [index,point] of plan.quail.entries()){
  animals.push({id:'ambient-common-quail-'+index,kind:'common-quail',decorative:true,...point,
   yaw:index*1.8+Math.sin(time*.53+index)*.38});
 }
 for(const [index,route] of plan.onagers.entries()){
  animals.push({id:index?'ambient-onager-'+index:'ambient-onager',kind:'onager',decorative:true,
   scale:[1.07,.88,.99,.71,.94][index],phase:index*.91,...onagerPose(route,time+[0,1.15,2.8,.48,3.7][index])});
 }
 return animals;
}
