// Reserve one dry corridor per travelling herd. The destination must admit the
// whole group, including a little room on either side for members to turn.
import {seed} from '../city-life.js';

export function segmentDistance(point,from,to){
 const dx=to.x-from.x,dy=to.y-from.y;
 const along=Math.max(0,Math.min(1,((point.x-from.x)*dx+(point.y-from.y)*dy)/(dx*dx+dy*dy||1)));
 return Math.hypot(point.x-from.x-dx*along,point.y-from.y-dy*along);
}

function corridorsMeet(a,b,c,d,space){
 const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
 if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return true;
 return Math.min(segmentDistance(a,c,d),segmentDistance(b,c,d),segmentDistance(c,a,b),segmentDistance(d,a,b))<space;
}

export function planPasture(herd,state,nearby,otherHerd,clear,zoneClear){
 const members=herd.members.filter(m=>m.index<herd.size);
 if(!members.length||members.some(m=>!m.point||!m.root.isEnabled()))return null;
 const start={x:0,y:0};
 for(const m of members){start.x+=m.point.x/members.length;start.y+=m.point.y/members.length;}
 const slots=members.map(member=>({member,x:member.point.x-start.x,y:member.point.y-start.y}));
 const radius=Math.max(herd.zone.radius,...slots.map(p=>Math.hypot(p.x,p.y)+herd.spec.space*.35));
 const angle=seed(herd.seed,herd.tripCount*13+herd.index*17+961)*Math.PI*2;
 for(const span of [5.4,4.15,3,1.8])for(let i=0;i<16;i++){
  const heading=angle+i*Math.PI*2*.381966,dx=Math.cos(heading),dy=Math.sin(heading);
  const end={x:start.x+dx*span,y:start.y+dy*span,radius:herd.zone.radius};
  if(nearby.some(h=>corridorsMeet(start,end,h.pastureTrip?.start||h.zone,h.pastureTrip?.end||h.zone,radius+h.zone.radius+.20))||
     otherHerd.some(p=>segmentDistance(p,start,end)<radius+(p.radius??.5)+.2))continue;
  if(!clear(state,start,end)||!zoneClear(end))continue;
  // Adjacent tracks cover a wide group crossing the corner of a building.
  if(![-1,-.5,.5,1].every(k=>clear(state,{x:start.x-dy*radius*k,y:start.y+dx*radius*k},{x:end.x-dy*radius*k,y:end.y+dx*radius*k})))continue;
  const progress=p=>(p.x-start.x)*dx+(p.y-start.y)*dy;
  slots.sort((a,b)=>progress(b.member.point)-progress(a.member.point));
  for(const p of slots){p.goal={x:end.x+p.x,y:end.y+p.y};p.member.goal=null;p.member.backing=false;}
  return {start,end,slots,dx,dy,span,progress,clear,best:0,elapsedWithoutProgress:0};
 }
 return null;
}
