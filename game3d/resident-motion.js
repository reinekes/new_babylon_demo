import {isDryPoint,onBridge} from '../world.js';

// Stable identity variation belongs to the view; it never enters a save or a route.
export function residentMotion(id){
 let hash=2166136261;for(const ch of String(id??0))hash=Math.imul(hash^ch.charCodeAt(0),16777619)>>>0;
 hash=Math.imul(hash^(hash>>>16),2246822507)>>>0;hash=Math.imul(hash^(hash>>>13),3266489909)>>>0;hash=(hash^(hash>>>16))>>>0;
 const unit=n=>((hash>>>n)&255)/255;
 return {width:.91+unit(0)*.18,height:.95+unit(8)*.10,gait:.83+unit(16)*.34,phase:unit(0)*Math.PI*2,stride:.012+unit(8)*.018};
}

// Resolve actual visible neighbours only, keeping route coordinates, cargo and IDs intact.
// A small spatial hash avoids an all-pairs pass in the large city.
export function residentViewPositions(state,citizens){
 const cells=new Map(),result=new Map(),gap=.10;
 const key=(x,y)=>`${Math.floor(x/gap)},${Math.floor(y/gap)}`;
 const neighbours=(x,y)=>{const found=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)found.push(...(cells.get(`${Math.floor(x/gap)+dx},${Math.floor(y/gap)+dy}`)||[]));return found;};
 for(const c of [...citizens].sort((a,b)=>String(a.id).localeCompare(String(b.id)))){
  let p={x:c.x,y:c.y};const bridge=onBridge(state.buildings||[],c.x,c.y),phase=residentMotion(c.id).phase;
  const safe=q=>{if(bridge)return !!onBridge(state.buildings||[],q.x,q.y)&&Math.abs(q.y-c.y)<.025;
   if(!isDryPoint(state,q.x,q.y))return false;
   return !(state.buildings||[]).some(b=>!['road','bridge','field','canal'].includes(b.type)&&Math.abs(q.x-b.x)<.42&&Math.abs(q.y-b.y)<.42&&!(Math.abs(c.x-b.x)<.42&&Math.abs(c.y-b.y)<.42));};
  const clear=q=>neighbours(q.x,q.y).every(other=>Math.hypot(other.x-q.x,other.y-q.y)>=gap-.001);
  const working=c.activity&&['working','strike'].includes(c.activity.stage);
  if(!working&&!clear(p))for(let ring=1,done=false;ring<=4&&!done;ring++)for(let n=0;n<(ring+1)*6;n++){
   const radius=.10+(ring-1)*.06,angle=phase+n/((ring+1)*6)*Math.PI*2,q=bridge?{x:c.x+(n%2?1:-1)*radius,y:c.y}:{x:c.x+Math.cos(angle)*radius,y:c.y+Math.sin(angle)*radius};
   if(safe(q)&&clear(q)){p=q;done=true;break;}
  }
  result.set(c.id,p);const cell=key(p.x,p.y);if(!cells.has(cell))cells.set(cell,[]);cells.get(cell).push(p);
 }
 return result;
}
