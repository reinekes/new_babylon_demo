// Camera navigation changes presentation only; the settlement stays untouched.
export function orbitCamera(camera,alpha,beta){
 camera.alpha+=alpha;camera.beta=Math.max(camera.lowerBetaLimit??.18,Math.min(camera.upperBetaLimit??1.48,camera.beta+beta));
}
export function bindMapControls(canvas,{camera,groundAt,onHover,onClick,onNavigate,isPhoto=()=>false}){
 const pointers=new Map(),handlers=[];let press=null,multi=false,pinch=0,anchor=null;
 const on=(name,fn)=>{canvas.addEventListener(name,fn);handlers.push([name,fn]);};
 const point=e=>({x:e.clientX,y:e.clientY});
 const middle=()=>{const p=[...pointers.values()];return {x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2,d:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)};};
 const pan=(from,to)=>{if(from&&to){camera.target.x+=from.x-to.x;camera.target.z+=from.z-to.z;}};
 const begin=(id,p,button,dragging,touch)=>({id,...p,last:p,button,dragging,touch,anchor:button===1?null:groundAt(p.x,p.y)});
 const endPointer=id=>{
  if(!pointers.delete(id))return;
  if(multi&&pointers.size>=2){const m=middle();pinch=m.d;anchor=groundAt(m.x,m.y);return;}
  if(multi&&pointers.size===1){
   const [[remaining,p]]=pointers;
   press=begin(remaining,p,0,true,true);
  }else if(press?.id===id)press=null;
  multi=false;pinch=0;anchor=null;
 };
 on('contextmenu',e=>e.preventDefault());
 on('auxclick',e=>{if(e.button===1)e.preventDefault();});
 on('pointerdown',e=>{if(![0,1,2].includes(e.button))return;const id=e.pointerId??1;pointers.set(id,point(e));try{canvas.setPointerCapture?.(id);}catch{}
  if(pointers.size>1){multi=true;press=null;const m=middle();pinch=m.d;anchor=groundAt(m.x,m.y);return;}
  press=begin(id,point(e),e.button,e.button!==0||e.shiftKey,e.pointerType==='touch');if(press.dragging)e.preventDefault();
 });
 on('pointermove',e=>{const id=e.pointerId??1;if(pointers.has(id))pointers.set(id,point(e));
  if(press?.id===id&&press.button===1){e.preventDefault();orbitCamera(camera,(press.last.x-e.clientX)*.006,(press.last.y-e.clientY)*.006);press.last=point(e);return;}
  if(e.pointerType!=='touch')onHover?.(e.clientX,e.clientY);
  if(multi){if(pointers.size>=2){const m=middle();if(m.d>0&&pinch>0)camera.radius=Math.max(camera.lowerRadiusLimit??8,Math.min(camera.upperRadiusLimit??360,camera.radius*pinch/m.d));pinch=m.d;pan(anchor,groundAt(m.x,m.y));onNavigate?.();}return;}
  if(!press||press.id!==id)return;if(Math.hypot(e.clientX-press.x,e.clientY-press.y)>(press.touch?10:6))press.dragging=true;
  if(press.dragging){e.preventDefault();pan(press.anchor,groundAt(e.clientX,e.clientY));onNavigate?.();}
 });
 on('pointerup',e=>{const id=e.pointerId??1,p=press;endPointer(id);try{canvas.releasePointerCapture?.(id);}catch{}
  if(p?.id===id&&p.button===0&&!p.dragging&&!isPhoto()&&Math.hypot(e.clientX-p.x,e.clientY-p.y)<=(p.touch?10:6))onClick?.(p.touch?p.x:e.clientX,p.touch?p.y:e.clientY,p.touch);
 });
 const cancel=e=>endPointer(e.pointerId??1);
 on('pointercancel',cancel);
 on('lostpointercapture',cancel);
 on('pointerleave',()=>{if(!pointers.size)onHover?.(null,null);});
 return ()=>{for(const [name,fn]of handlers)canvas.removeEventListener(name,fn);pointers.clear();press=null;};
}
