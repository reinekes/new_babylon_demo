import {buildingKey,isOperational} from '../definitions.js';
import {footprintSize} from '../footprints.js';
import {workstationWorldPoint,workstationBuilding} from './workstations.js';
import {dairyMilkingCow} from './dairy-layout.js';

const standingPlaces={
 1:{x:[-1.80,-.60,.60,1.80],z:[-1.63,0,1.63]},
 2:{x:[-1.60,.35,3.40,5.30],z:[-.45,2.35,5.15]}
};

// The render herd follows real dairy records; it never creates stock or cattle.
export function dairyHerd(state){
 const result=[];
 for(const b of state.buildings||[]){
  if(b.type!=='cowshed'||!isOperational(b)||!b.dairy)continue;
  const count=Math.min(12,b.dairy.cows+b.dairy.calves);
  const milking=dairyMilkingCow(workstationBuilding(b,state));
  const {x,z}=standingPlaces[footprintSize(b)];
  const stalls=z.flatMap((row,j)=>x.map((column,i)=>({x:column,z:row,yaw:(i+j)%2?0:Math.PI})));
  const nearest=stalls.reduce((best,stall,index)=>Math.hypot(stall.x-milking.x,stall.z-milking.z)<Math.hypot(stalls[best].x-milking.x,stalls[best].z-milking.z)?index:best,0);
  stalls.splice(nearest,1);
  const places=[milking,...stalls];
  for(let i=0;i<count;i++){
   const calf=i>=b.dairy.cows,place=places[i],world=workstationWorldPoint(b,[place.x,0,place.z]);
   result.push({
    id:`dairy-${buildingKey(b)}-${i}`,building:b,index:i,calf,scale:calf?.43:.75,
    anchor:{x:world.x,y:world.y},yaw:place.yaw+(b.rotation||0)*Math.PI/2
   });
  }
 }
 return result;
}

export function dairyPose(spec,time){
 const sway=spec.index===0?0:Math.sin(time*.36+spec.index*1.7)*.075;
 return {...spec.anchor,yaw:spec.yaw+sway,walking:false};
}
