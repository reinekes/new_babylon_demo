import {footprintSize} from '../footprints.js';
import {workstationFor} from './workstations.js';
import {isDryPoint,onBridge} from '../world.js';

// Stable identity variation belongs to the view; it never enters a save or a route.
export function residentMotion(id){
 let hash=2166136261;for(const ch of String(id??0))hash=Math.imul(hash^ch.charCodeAt(0),16777619)>>>0;
 hash=Math.imul(hash^(hash>>>16),2246822507)>>>0;hash=Math.imul(hash^(hash>>>13),3266489909)>>>0;hash=(hash^(hash>>>16))>>>0;
 const unit=n=>((hash>>>n)&255)/255;
 return {width:.80+unit(0)*.40,height:.89+unit(8)*.22,gait:.83+unit(16)*.34,phase:unit(0)*Math.PI*2,stride:.012+unit(8)*.018};
}

// The shipped GLB contains two complete strides in 104 frames at 60 fps.
// Each planted foot travels about .62m backwards per stance: 4 * .62m per clip.
// Verified against foot_l/foot_r transform tracks, not the simulation clock.
// Modest pelvic narrowing only: never replace authored lower-limb rotations.
export const RESIDENT_STANCE=Object.freeze({hipWidthScale:.84});
export const RESIDENT_WALK={authoredMetres:2.48,frames:104,fps:60};
export function residentWalkPhase(phase,metres,forwardScale=1,authoredMetres=RESIDENT_WALK.authoredMetres){
 return (phase+Math.max(0,metres)/(authoredMetres*Math.max(.1,forwardScale)))%1;
}
export function residentIdentity(id){
 const m=residentMotion(id),n=Math.round(m.phase/(Math.PI*2)*255);
 return {hair:n%4,beard:Math.floor(n/4)%4,skin:Math.floor(n/16)%5,cloth:Math.floor(n/3)%7,
  headWidth:.88+(n%7)*.04,headHeight:.91+(Math.floor(n/7)%6)*.035};
}

// Resolve actual visible neighbours only, keeping route coordinates, cargo and IDs intact.
// A small spatial hash avoids an all-pairs pass in the large city.
export function residentViewPositions(state,citizens){
 const cells=new Map(),result=new Map(),gap=.10,workSlots=new Map();
 const fixed=c=>!c.walking&&['working','constructing','waiting','treatment'].includes(c.phase);
 // Allocate work aprons first so passing pedestrians cannot reshuffle colleagues.
 const order=[...citizens].sort((a,b)=>Number(fixed(b))-Number(fixed(a))||String(a.id).localeCompare(String(b.id)));
 const key=(x,y)=>`${Math.floor(x/gap)},${Math.floor(y/gap)}`;
 const neighbours=(x,y)=>{const found=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)found.push(...(cells.get(`${Math.floor(x/gap)+dx},${Math.floor(y/gap)+dy}`)||[]));return found;};
 for(const c of order){
  // Funeral rails and the solved palms share these exact presentation anchors.
  if(c.funeralContact){result.set(c.id,{x:c.funeralContact.x,y:c.funeralContact.y});continue;}
  if(c.festivalContact){result.set(c.id,{x:c.festivalContact.x,y:c.festivalContact.y});continue;}
  let p={x:c.x,y:c.y};
  const target=c.activity?.target,workKey=target?.type?`${target.x},${target.y}`:c.activity?.kind==='healing'?`patient:${c.activity.patientId}`:null,slot=workKey?(workSlots.get(workKey)||0):0;
  let contact=workKey?workstationFor(target,c,slot):null;
  if(c.activity?.kind==='healing'&&c.activity.stage==='working'&&!c.carrying&&!c.walking){
   const dx=c.x-target.x,dy=c.y-target.y,d=Math.hypot(dx,dy)||1,q={x:target.x+dx/d*.095,y:target.y+dy/d*.095};
   if(Math.hypot(q.x-c.x,q.y-c.y)<.3)contact={kind:'healing',stand:q,target:{...target,height:1.12},building:target};
  }
  if(contact){workSlots.set(workKey,slot+1);const q=contact.stand;
   const clearApproach=[0,.25,.5,.75,1].every(t=>{const x=c.x+(q.x-c.x)*t,y=c.y+(q.y-c.y)*t;return isDryPoint(state,x,y)&&!(state.buildings||[]).some(b=>b!==target&&(b.x!==target.x||b.y!==target.y)&&!['road','bridge','field','canal'].includes(b.type)&&Math.abs(x-b.x-(footprintSize(b)-1)/2)<footprintSize(b)/2-.04&&Math.abs(y-b.y-(footprintSize(b)-1)/2)<footprintSize(b)/2-.04);});
   if(clearApproach&&neighbours(q.x,q.y).every(other=>Math.hypot(other.x-q.x,other.y-q.y)>=gap-.001)){p={x:q.x,y:q.y,contact};}
  }
  const bridge=onBridge(state.buildings||[],c.x,c.y),phase=residentMotion(c.id).phase;
  const safe=q=>{if(bridge)return !!onBridge(state.buildings||[],q.x,q.y)&&Math.abs(q.y-c.y)<.025;
   if(!isDryPoint(state,q.x,q.y))return false;
   return !(state.buildings||[]).some(b=>{if(['road','bridge','field','canal'].includes(b.type))return false;const size=footprintSize(b),x=b.x+(size-1)/2,y=b.y+(size-1)/2,half=size/2-.035;return Math.abs(q.x-x)<half&&Math.abs(q.y-y)<half&&!(Math.abs(c.x-x)<half&&Math.abs(c.y-y)<half);});};
  const clear=q=>neighbours(q.x,q.y).every(other=>Math.hypot(other.x-q.x,other.y-q.y)>=gap-.001);
  if(c.walking&&!contact&&!bridge){
   const route=c.waterTrip?.route||c.route,next=route?.[c.waterTrip?.index??c.routeIndex],dx=(next?.x??c.x)-c.x,dy=(next?.y??c.y)-c.y,length=Math.hypot(dx,dy);
   if(length>1e-6){const lane=.065+.015*(phase/(Math.PI*2)),q={x:c.x+dy/length*lane,y:c.y-dx/length*lane};if([.25,.5,.75,1].every(t=>safe({x:c.x+(q.x-c.x)*t,y:c.y+(q.y-c.y)*t})))p=q;}
  }
  if(fixed(c)&&!clear(p)){
   const target=c.activity?.target;let dx=(target?.x??c.x)-c.x,dy=(target?.y??c.y-1)-c.y;if(Math.hypot(dx,dy)<1e-6)dy=-1;
   const length=Math.hypot(dx,dy),tangent={x:-dy/length,y:dx/length},away={x:-dx/length,y:-dy/length};
   // A deterministic line along the actual facade/field edge; a second row is
   // used only when the frontage is occupied. Never move into the work target.
   const slots=[1,-1,2,-2,3,-3];let placed=false;
   for(let row=0;row<3&&!placed;row++)for(const n of row===0?slots:[0,...slots]){
    const q={x:c.x+tangent.x*n*.115+away.x*row*.115,y:c.y+tangent.y*n*.115+away.y*row*.115};
    if(Math.hypot(q.x-c.x,q.y-c.y)<=.43&&safe(q)&&clear(q)){p=q;placed=true;break;}
   }
  }
  if(!fixed(c)&&!clear(p))for(let ring=1,done=false;ring<=4&&!done;ring++)for(let n=0;n<(ring+1)*6;n++){
   const radius=.10+(ring-1)*.06,angle=phase+n/((ring+1)*6)*Math.PI*2,q=bridge?{x:c.x+(n%2?1:-1)*radius,y:c.y}:{x:c.x+Math.cos(angle)*radius,y:c.y+Math.sin(angle)*radius};
   if(safe(q)&&clear(q)){p=q;done=true;break;}
  }
  result.set(c.id,p);const cell=key(p.x,p.y);if(!cells.has(cell))cells.set(cell,[]);cells.get(cell).push(p);
 }
 return result;
}
