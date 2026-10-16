import {constructionProgress} from './construction.js';
import {bridgeSpan} from './world.js';
// Drawn in the same depth queue as completed architecture and residents.
export function drawConstruction(r,b,s,t){
 const q=b.construction,c=r.ctx,scale=r.s,p=r.point(b.x,b.y),progress=constructionProgress(b);
 if(b.type==='road'){
  r.line([r.point(b.a.x,b.a.y),r.point(b.b.x,b.b.y)],'#ccaa78',6*scale);
  for(const a of [-7,7]){r.line([[p.x+a*scale,p.y+3*scale],[p.x+a*scale,p.y-8*scale]],'#8b704c',1.4*scale);}
  r.line([[p.x-8*scale,p.y-8*scale],[p.x+8*scale,p.y-8*scale]],'#dbc08c',2*scale);
 }else if(b.type==='bridge'){
  const span=bridgeSpan(b.y),fraction=q.kind==='upgrade'?1:.08+progress.work*.92,east=s.citizens.some(c=>c.site===`${b.x},${b.y}`&&c.sitePort?.endsWith(':1')),start=east?span.right:span.left,end=start+(east?-1:1)*(span.right-span.left)*fraction,low=Math.min(start,end),high=Math.max(start,end);
  r.polygon([r.point(start,span.y-.13,5),r.point(end,span.y-.13,5),r.point(end,span.y+.13,5),r.point(start,span.y+.13,5)],'#c6ad7d','#8e7654');
  for(let x=span.left;x<=span.right;x+=.5){r.line([r.point(x,span.y,0),r.point(x,span.y,8)],'#8b704c',2*scale);}
  for(let x=low;x<high;x+=.2)r.line([r.point(x,span.y-.13,5),r.point(x,span.y+.13,5)],'#8c7651',.7*scale);
  if(q.kind==='upgrade')r.bridge(b,false);
  const bank=r.point(start+(east?.25:-.25),span.y);r.box(bank.x,bank.y,7*scale,3*scale,5*scale,'#d7b48a','#a77b54','#c49669');
 }else{
  if(q.kind==='upgrade'){
   r.building({...b,construction:undefined},s,t);
   if(progress.work>.18){const lightCount=r.lights.length;c.save();const height=16+progress.work*120;c.beginPath();c.rect(p.x-95*scale,p.y-height*scale,190*scale,(height+40)*scale);c.clip();r.building({...b,level:q.target,construction:undefined},s,t);c.restore();r.lights.length=lightCount;}
  }
  else{
   r.tile(b.x,b.y,'#ac986d','#e0cb98');
   r.box(p.x,p.y,21*scale,10.5*scale,3*scale,'#d1b984','#9f8057','#b49463');
   if(progress.work>.18){
    const lightCount=r.lights.length;c.save();const height=8+progress.work*100;c.beginPath();c.rect(p.x-95*scale,p.y-height*scale,190*scale,(height+40)*scale);c.clip();r.building({...b,construction:undefined},s,t);c.restore();r.lights.length=lightCount;
   }
  }
  // Scaffold posts, cross-braces and the plank platform remain until completion.
  const h=(q.kind==='upgrade'?70:18+progress.work*62)*scale;
  for(const [x,y]of [[-.46,.46],[.46,.46],[.46,-.46]]){const a=r.point(b.x+x,b.y+y);r.line([[a.x,a.y],[a.x,a.y-h]],'#866e4b',1.8*scale);}
  const a=r.point(b.x-.46,b.y+.46),d=r.point(b.x+.46,b.y+.46),e=r.point(b.x+.46,b.y-.46);
  for(const k of [.35,.7,1]){r.line([[a.x,a.y-h*k],[d.x,d.y-h*k],[e.x,e.y-h*k]],'#b99763',2.4*scale);}
  r.line([[a.x,a.y],[d.x,d.y-h*.7]],'#9d8055',scale);r.line([[d.x,d.y],[a.x,a.y-h*.7]],'#9d8055',scale);
  if(q.delivered.clay>0)r.box(p.x-14*scale,p.y+11*scale,6*scale,3*scale,5*scale,'#d1a179','#a1714e','#bb885e');
  if(q.delivered.reed>0){for(let i=0;i<4;i++)r.line([[p.x+(8+i)*scale,p.y+10*scale],[p.x+(17+i)*scale,p.y+5*scale]],'#8d9a63',1.5*scale);}
 }
}
export function drawConstructionLabel(r,b){
 const progress=constructionProgress(b),c=r.ctx,p=b.type==='bridge'?r.point(bridgeSpan(b.y).left,b.y+.5):r.point(b.x,b.y);
 const y=p.y-(b.type==='road'?15:b.construction.kind==='upgrade'?88:40+progress.work*62)*r.s,width=46*r.s;
 c.fillStyle='#f7efd8ed';c.fillRect(p.x-width/2-3*r.s,y-13*r.s,width+6*r.s,21*r.s);
 c.fillStyle='#617459';c.font=`${Math.max(8,9*r.s)}px Arial`;c.textAlign='center';c.fillText(`${b.construction.kind==='upgrade'?'↑':'⚒'} ${Math.floor(progress.ratio*100)}%`,p.x,y-3*r.s);
 c.fillStyle='#d1c4a0';c.fillRect(p.x-width/2,y+2*r.s,width,3*r.s);c.fillStyle='#7d9163';c.fillRect(p.x-width/2,y+2*r.s,width*progress.ratio,3*r.s);
}
