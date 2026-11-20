import {ovenChambers} from './reference-workshops.js';

export const KILN_TAPER_LENGTH=.55;
const [kilnX,kilnZ,,kilnDepth]=ovenChambers.kiln;
const kilnCoals=kilnZ+kilnDepth/2-.15;
// Coordinates in the unrotated workshop, in metres. The yard entrance is at
// front right. The same surfaces appear in reference-workshops and workshop-architecture.
const stations={
 'light-kiln':{work:[[kilnX,.18,kilnCoals],[kilnX+.19,.18,kilnCoals]],stands:[[kilnX-.37,kilnCoals+.68],[kilnX+.37,kilnCoals+.68]],kneel:.40},
 account:{work:[[-.76,1.09,1.67],[.97,1.09,1.66]],stands:[[-.78,2.10],[1.06,2.10]]},
 milling:{work:[[1.48,.36,1.50],[1.64,.35,1.45]],stands:[[1.47,1.83],[2.01,1.42]],kneel:.33},
 baking:{work:[[.62,.18,.045],[1.08,.18,.045]],stands:[[.52,.56],[1.19,.56]],kneel:.68},
 preparingFiber:{work:[[-1.38,.34,1.17],[-1.13,.34,1.19]],stands:[[-1.49,1.55],[-.80,1.54]],kneel:.34},
 weavingLinen:{work:[[-.83,.88,-.25],[-.19,.88,-.25]],stands:[[-.83,.09],[-.16,.09]],kneel:.73},
 preservingMilk:{work:[[-.20,1.06,1.89],[.38,1.06,1.89]],stands:[[-.22,2.32],[.55,2.29]]},
 weavingBasket:{work:[[-.99,.68,2.02],[-.46,.68,2.02]],stands:[[-1.18,2.34],[-.25,2.34]],kneel:.48},
 weavingMat:{work:[[.38,.119,1.19],[1.08,.119,1.19]],stands:[[.38,1.59],[1.08,1.59]],kneel:.22},
 castingAxe:{work:[[-.94,.825,.48],[-.30,.825,.48]],stands:[[-.96,.90],[-.25,.90]]},
 cuttingJoinery:{work:[[-.58,.803,1.76],[.19,.803,1.76]],stands:[[-.60,2.10],[.24,2.10]],kneel:.70},
};
const initial={granary:'account',bakery:'milling',linenYard:'preparingFiber',dairyStore:'preservingMilk',basketry:'weavingBasket',matYard:'weavingMat',coppersmith:'castingAxe',joineryYard:'cuttingJoinery'};
export const hasArtisanContact=type=>Object.hasOwn(initial,type);
export function artisanContact(b,c,slot,worldPoint){
 const task=c.activity.task==='idle'?initial[b.type]:c.activity.task;
 const station=stations[task];if(!station)return null;
 const [sx,sz]=b.workCorner||[1,1];
 const point=(x,h,z)=>{
  const [u,v]=sx===sz?[x*sx,z*sz]:sx===1?[z,-x]:[-z,x];
  return worldPoint(b,[u,h,v]);
 };
 const i=slot%2,[x,h,z]=station.work[i],[px,pz]=station.stands[i],stand=point(px,0,pz),target=point(x,h,z);
 const door=point(2.54,0,2.55);
 if(task!=='account'&&Math.hypot(door.x-c.x,door.y-c.y)>.32)return null;
 // Cross the accessible frontage before turning into the room; in the linen yard
 // the aisle between the bundles and the wash trough serves the rear loom.
 const via=task==='account'?frontApproach(b,c,worldPoint,px):[door,point(1.83,0,2.18)];
 if(task==='weavingLinen'){via.push(point(-.35,0,1.70),point(-.32,0,.52));}
 else if(task==='castingAxe'){via.push(point(.92,0,2.31),point(.92,0,1.04));}
 else if(task==='baking'){via.push(point(.85,0,2.18),point(.76,0,.95));}
 else if(task==='preparingFiber'){via.push(point(-.41,0,1.80));}
 via.push(stand);
 return {kind:'artisan',task,stand,target,building:b,progress:c.activity.progress,seatHeight:station.kneel,via};
}
export function artisanPose(contact,time){
 const wave=Math.sin(time*3.4),beat=(1+Math.cos(time*3.4))*.5,h=contact.target.height;
 let right=[.095,h+.018,.49],left=[-.095,h+.018,.49],bend=.31,tool=null;
 switch(contact.task){
  case 'account':right=[.09,h+.08+beat*.025,.42];left=[-.13,h,.46];tool='scribe-stylus';bend=.14;break;
  case 'milling':right=[.09,h,.49+wave*.045];left=[-.09,h,.49+wave*.045];bend=.57;break;
  case 'light-kiln':{
   // The last part of the worker's charge interval pushes the smouldering end
   // onto the fuel. Until then the taper is held slightly above the firebed.
   const reach=Math.min(1,Math.max(0,((contact.progress??0)-.30)/.58));
   right=[.10,h+.29+(1-reach)*.10,.038-(1-reach)*.085];
   left=[-.14,.57,-.14];tool='kiln-taper';bend=.38;break;
  }
  case 'baking':right=[.08,h+.51,.23+wave*.065];left=[-.09,h+.43,.31+wave*.065];tool='baking-paddle';bend=.5;break;
  case 'preparingFiber':right=[.08,h+beat*.055,.49];left=[-.08,h+(1-beat)*.055,.49];bend=.52;break;
  case 'weavingLinen':right=[.12+wave*.09,h+.012,.49];left=[-.15,h+.055,.49];break;
  case 'preservingMilk':right=[.07,h+beat*.065,.49];left=[-.07,h+.015,.49];break;
  case 'weavingBasket':right=[.055+wave*.06,h+beat*.028,.49];left=[-.062,h,.49];break;
  case 'weavingMat':right=[.085+wave*.075,h+.012,.49];left=[-.11,h+.012,.49];bend=.68;break;
  case 'castingAxe':right=[.05,h+.16+beat*.045,.37];left=[-.07,h+.13,.32];tool='casting-cup';break;
  case 'cuttingJoinery':right=[.035,h+.13+beat*.075,.40];left=[-.15,h+.025,.49];tool='joinery-adze';break;
 }
 return {right,left,tool,bend,twist:wave*.025};
}

// View-only travel from a real street port to the current tool and back.
// Keep an absolute position: the simulation may already be on the next street
// segment while the visible resident is coming out of the open work gallery.
export function artisanWalk(actor,contact,c,dt,speed,paused){
 const state=actor.workAisle;
 if(!contact?.via&&!state)return null;
 if(c.controlled||c.festivalContact||c.funeralContact||c.eventContact){actor.workAisle=null;return null;}
 if(actor.lastX===null){
  actor.workAisle=contact?.via?{key:contact.target.x+','+contact.target.y+','+contact.task,building:c.work,speed:contact.aisleSpeed,via:contact.via,steps:contact.via,index:contact.via.length,x:contact.stand.x,y:contact.stand.y}:null;return null;
 }
 let walk=state;
 if(contact?.via){
  const key=contact.target.x+','+contact.target.y+','+contact.task;
  if(!walk||walk.key!==key){
   const changing=walk&&!walk.exiting&&walk.building===c.work;
   const steps=changing?[...walk.via.slice(1).reverse(),...contact.via.slice(1)]:contact.via;
   walk=actor.workAisle={key,building:c.work,speed:contact.aisleSpeed,via:contact.via,steps,index:0,x:actor.lastX,y:actor.lastY};
  }
 }else if(!walk.exiting){
  walk={...walk,exiting:true,steps:walk.via.slice(0,Math.min(walk.index,walk.via.length)).reverse(),index:0};actor.workAisle=walk;
 }
 let metres=paused?0:Math.max(0,dt)*Math.max(1,speed)*(walk.speed??1.4);
 while(walk.index<walk.steps.length){
  const target=walk.steps[walk.index],dx=target.x-walk.x,dy=target.y-walk.y,dist=Math.hypot(dx,dy)*6;
  if(dist<=.004){walk.index++;continue;}
  if(metres<dist){walk.x+=dx*metres/dist;walk.y+=dy*metres/dist;return walk;}
  walk.x=target.x;walk.y=target.y;metres-=dist;walk.index++;
 }
 if(walk.exiting){
  const dx=c.x-walk.x,dy=c.y-walk.y,d=Math.hypot(dx,dy)*6;
  if(d>metres&&d>.025){walk.x+=dx*metres/d;walk.y+=dy*metres/d;return walk;}
  actor.workAisle=null;
 }
 return null;
}

// Front-room buildings keep their authored entrance when a different street corner is dry.
export function frontApproach(b,port,worldPoint,entrance=0){
 const point=(x,z)=>worldPoint(b,[x,0,z]),angle=(b.rotation||0)*Math.PI/2,dx=(port.x-b.x)*6,dz=(port.y-b.y)*6;
 const localX=dx*Math.cos(angle)-dz*Math.sin(angle),localZ=dx*Math.sin(angle)+dz*Math.cos(angle);
 const via=[{x:port.x,y:port.y}];
 if(localZ<0)via.push(point(Math.sign(localX||1)*2.93,2.93));
 via.push(point(entrance,2.88));
 return via;
}
