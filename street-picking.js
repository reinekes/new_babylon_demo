import {footpathRibbonPoint,streetCurveLookup} from './footpaths.js';

// Match a pointer to the same curved street the player sees on the ground.
export function roadNear(state,location,curve){
 const point=location?.roadPoint??location,roads=state?.roads;
 if(!roads?.length||!Number.isFinite(point?.x)||!Number.isFinite(point?.y))return null;
 let best=null,bestSquared=.85*.85;
 for(const road of roads){
  const {a,b}=road;if(!a||!b)continue;
  // Allow for both a displaced junction and the bend around a solid obstacle.
  if(point.x<Math.min(a.x,b.x)-2.5||point.x>Math.max(a.x,b.x)+2.5||
     point.y<Math.min(a.y,b.y)-2.5||point.y>Math.max(a.y,b.y)+2.5)continue;
  curve??=streetCurveLookup(state);
  const control=curve(a,b,road.id),steps=control?12:1;
  let prev=footpathRibbonPoint(a,b,control,0);
  for(let i=1;i<=steps;i++){
   const next=footpathRibbonPoint(a,b,control,i/steps);
   const dx=next.x-prev.x,dy=next.y-prev.y,px=point.x-prev.x,py=point.y-prev.y;
   const t=Math.max(0,Math.min(1,(px*dx+py*dy)/(dx*dx+dy*dy||1)));
   const distance=(px-dx*t)**2+(py-dy*t)**2;
   if(distance<bestSquared){best=road;bestSquared=distance;}
   prev=next;
  }
 }
 return best;
}
