// Grab-and-drag navigation, matching the flat map. Rendering coordinates only.
export function bindMapControls(canvas,{camera,groundAt,onHover,onClick,isPhoto=()=>false}){
 const pointers=new Map(),handlers=[];let press=null,multi=false,pinch=0,anchor=null;
 const on=(name,fn)=>{canvas.addEventListener(name,fn);handlers.push([name,fn]);};
 const point=e=>({x:e.clientX,y:e.clientY});
 const middle=()=>{const p=[...pointers.values()];return {x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2,d:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)};};
 const pan=(from,to)=>{if(from&&to){camera.target.x+=from.x-to.x;camera.target.z+=from.z-to.z;}};
 on('contextmenu',e=>e.preventDefault());
 on('pointerdown',e=>{if(![0,1,2].includes(e.button))return;const id=e.pointerId??1;pointers.set(id,point(e));try{canvas.setPointerCapture?.(id);}catch{}
  if(pointers.size>1){multi=true;press=null;const m=middle();pinch=m.d;anchor=groundAt(m.x,m.y);return;}
  press={id,...point(e),button:e.button,dragging:e.button!==0||e.shiftKey,anchor:groundAt(e.clientX,e.clientY)};if(press.dragging)e.preventDefault();
 });
 on('pointermove',e=>{const id=e.pointerId??1;if(pointers.has(id))pointers.set(id,point(e));onHover?.(e.clientX,e.clientY);
  if(multi){if(pointers.size>=2){const m=middle();if(m.d>0&&pinch>0)camera.radius=Math.max(8,Math.min(360,camera.radius*pinch/m.d));pinch=m.d;pan(anchor,groundAt(m.x,m.y));}return;}
  if(!press||press.id!==id)return;if(Math.hypot(e.clientX-press.x,e.clientY-press.y)>6)press.dragging=true;
  if(press.dragging){e.preventDefault();pan(press.anchor,groundAt(e.clientX,e.clientY));}
 });
 on('pointerup',e=>{const id=e.pointerId??1;pointers.delete(id);try{canvas.releasePointerCapture?.(id);}catch{}
  if(multi){if(!pointers.size){multi=false;pinch=0;anchor=null;}press=null;return;}
  const p=press;press=null;if(p?.id===id&&p.button===0&&!p.dragging&&!isPhoto()&&Math.hypot(e.clientX-p.x,e.clientY-p.y)<=6)onClick?.(e.clientX,e.clientY);
 });
 on('pointercancel',e=>{pointers.delete(e.pointerId??1);press=null;if(!pointers.size)multi=false;});
 on('pointerleave',()=>{if(!pointers.size)onHover?.(null,null);});
 return ()=>{for(const [name,fn]of handlers)canvas.removeEventListener(name,fn);pointers.clear();press=null;};
}
