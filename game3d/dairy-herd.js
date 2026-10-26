import {buildingKey,isOperational} from '../definitions.js';
import {workstationWorldPoint,workstationBuilding} from './workstations.js';
import {dairyMilkingCow} from './dairy-layout.js';
// The render herd follows real dairy records; it never creates stock or cattle.
export function dairyHerd(state){
 const result=[];
 for(const b of state.buildings||[]){if(b.type!=='cowshed'||!isOperational(b)||!b.dairy)continue;
  const count=Math.min(12,b.dairy.cows+b.dairy.calves);
  const milking=dairyMilkingCow(workstationBuilding(b,state));
  for(let i=0;i<count;i++){const calf=i>=b.dairy.cows,slot=i%5,positions=[[milking.x,milking.z],[-1.3,-1.2],[.8,-1.2],[-1.45,.8],[-.45,1.55]],p=positions[slot],world=workstationWorldPoint(b,[p[0],0,p[1]]);result.push({id:`dairy-${buildingKey(b)}-${i}`,building:b,index:i,calf,scale:calf?.43:.75,anchor:{x:world.x,y:world.y},yaw:(i===0?milking.yaw:(i%2?-.5:.5)*Math.PI)+(b.rotation||0)*Math.PI/2});}
 }
 return result;
}
export function dairyPose(spec,time){if(spec.index===0)return {...spec.anchor,yaw:spec.yaw,walking:false};const t=time*.20+spec.index*1.4,offset=spec.calf?.035:.025;return {x:spec.anchor.x+Math.sin(t)*offset,y:spec.anchor.y+Math.cos(t)*offset,yaw:spec.yaw+Math.sin(t*.5)*.12,walking:true};}
