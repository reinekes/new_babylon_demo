// Local clay colours, not glazed tiles. Paths stay inside the solid wall faces.
export const MASONRY_STYLES={
 mud:{top:'#dfc69b',left:'#b19365',right:'#c9ad7c',mortar:'#8e744f88',edge:'#ebd4a8',course:5.2,width:8},
 fired:{top:'#d5aa7e',left:'#9e654b',right:'#bf825b',mortar:'#f0c7999c',edge:'#e4b58a',course:3.4,width:6.2}
};
const shapes=new Map(),paths=new WeakMap();
export function masonrySegments(w,d,h,kind){
 const style=MASONRY_STYLES[kind],id=`${w}/${d}/${h}/${kind}`;if(!style)return [];
 if(shapes.has(id))return shapes.get(id);
 const result=[],columns=Math.max(2,Math.ceil(w/style.width)),face=(u,z,side)=>side===0?[-w+w*u,d*u+z]:[w*u,d*(1-u)+z];
 for(let side=0;side<2;side++)for(let row=0,low=-h;low<0;row++,low+=style.course){const high=Math.min(0,low+style.course);
  if(high<0)result.push([...face(0,high,side),...face(1,high,side)]);
  for(let j=0;j<columns;j++){const u=(j+(row%2?.5:1))/columns;if(u<=0||u>=1)continue;result.push([...face(u,low,side),...face(u,high,side)]);}
 }
 if(shapes.size>=64)shapes.delete(shapes.keys().next().value);shapes.set(id,result);return result;
}
export function masonryBox(r,x,y,w,d,h,kind,q=1){
 const style=MASONRY_STYLES[kind];if(!style)return;
 r.box(x,y,w,d,h,style.top,style.left,style.right);
 const c=r.ctx,segments=masonrySegments(w/q,d/q,h/q,kind),stroke=(kind==='fired'?.65:.7);c.save();c.strokeStyle=style.mortar;
 if(typeof Path2D!=='undefined'){
  let path=paths.get(segments);if(!path){path=new Path2D();for(const [a,b,z,e]of segments){path.moveTo(a,b);path.lineTo(z,e);}paths.set(segments,path);}
  c.save();c.translate(x,y);c.scale(q,q);c.lineWidth=stroke;c.stroke(path);c.restore();
 }else{
  c.beginPath();for(const [a,b,z,e]of segments){c.moveTo(x+a*q,y+b*q);c.lineTo(x+z*q,y+e*q);}c.lineWidth=stroke*q;c.stroke();
 }
 // The exposed corner and cornice catch the light; windows are painted later.
 c.beginPath();c.moveTo(x,y+d-h);c.lineTo(x,y+d);c.strokeStyle=style.edge;c.lineWidth=.8*q;c.stroke();c.restore();
}
