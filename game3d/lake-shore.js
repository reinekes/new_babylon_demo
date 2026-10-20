import {surfaceElevation,TILE} from '../district3d/terrain.js';

// Rendering only: the simulation keeps its saved water cells and coordinates.
const cache=new WeakMap();
const key=p=>`${p.x},${p.y}`;
const smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
export function lakeContours(s){
 const signature=JSON.stringify(s.world?.lakes||[]),cached=cache.get(s);if(cached?.signature===signature)return cached.contours;
 const cells=new Map();for(const lake of s.world?.lakes||[])for(const c of lake.cells)cells.set(key(c),c);
 const edges=new Map(),put=(a,b)=>edges.set(key(a),{a,b});
 for(const {x,y}of cells.values()){
  if(!cells.has(`${x},${y-1}`))put({x:x-.5,y:y-.5},{x:x+.5,y:y-.5});
  if(!cells.has(`${x+1},${y}`))put({x:x+.5,y:y-.5},{x:x+.5,y:y+.5});
  if(!cells.has(`${x},${y+1}`))put({x:x+.5,y:y+.5},{x:x-.5,y:y+.5});
  if(!cells.has(`${x-1},${y}`))put({x:x-.5,y:y+.5},{x:x-.5,y:y-.5});
 }
 const contours=[];
 while(edges.size){const first=edges.values().next().value,loop=[];let edge=first;
  while(edge){loop.push(edge.a);edges.delete(key(edge.a));edge=edges.get(key(edge.b));if(edge===first)break;}
  if(loop.length<3)continue;
  // Corner cutting rounds both convex and concave turns of the joined outline.
  // Subtle deterministic displacement prevents long ruler-straight shorelines.
  let points=loop;
  for(let pass=0;pass<3;pass++){const next=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];next.push({x:a.x*.75+b.x*.25,y:a.y*.75+b.y*.25},{x:a.x*.25+b.x*.75,y:a.y*.25+b.y*.75});}points=next;}
  points=points.map((p,i)=>{const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1,wave=-.025+.012*Math.sin(p.x*3.17+p.y*1.83)+.008*Math.sin(p.y*5.3-p.x*2.4);return {x:p.x+dy/length*wave,y:p.y-dx/length*wave};});
  const bounds={minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};contours.push({points,bounds});
 }
 cache.set(s,{signature,contours});return contours;
}
function contourDistance(x,y,{points,bounds}){
 // Callers only need distances within the soft-bank envelope.
 if(x<bounds.minX-.7||x>bounds.maxX+.7||y<bounds.minY-.7||y>bounds.maxY+.7)return Infinity;
 let inside=false,d=Infinity;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const a=points[j],b=points[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));
  d=Math.min(d,Math.hypot(x-a.x-dx*t,y-a.y-dy*t));
  if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }
 return inside?-d:d;
}
export function lakeDistance(x,y,s,contours=lakeContours(s)){let d=Infinity;for(const c of contours)d=Math.min(d,contourDistance(x,y,c));return d;}
// One continuous basin depends on the outside contour, never individual cells.
export function lakeBedHeight(distance){return -.18-.74*smooth(-distance/.38)+.18*smooth(distance/.26);}
export function visualSurfaceElevation(x,y,s,contours=lakeContours(s)){
 const distance=lakeDistance(x,y,s,contours);if(distance>.6)return surfaceElevation(x,y,s);
 const riverOnly={...s,world:{...s.world,lakes:[]}},dry=surfaceElevation(x,y,riverOnly);
 return Math.min(dry,lakeBedHeight(distance));
}
export function organicLakeGeometry(s,height=-.18){
 const g={positions:[],indices:[],colors:[],uvs:[],points:[],depths:[]},contours=lakeContours(s);
 const vertex=p=>{const d=Math.max(0,height-visualSurfaceElevation(p.x,p.y,s,contours));g.positions.push(p.x*TILE,height,p.y*TILE);g.colors.push(d,1,0,1);g.uvs.push(p.x,p.y);g.points.push({x:p.x,y:p.y});g.depths.push(d);};
 // Clip small triangles against the single outer shore. Identical coordinates
 // along adjacent triangles meet exactly; there are no internal cell rims.
 for(const contour of contours){const b=contour.bounds,n=8,minX=Math.floor(b.minX*n),maxX=Math.ceil(b.maxX*n),minY=Math.floor(b.minY*n),maxY=Math.ceil(b.maxY*n);
  for(let y=minY;y<maxY;y++)for(let x=minX;x<maxX;x++){
   const a={x:x/n,y:y/n},b={x:(x+1)/n,y:y/n},c={x:x/n,y:(y+1)/n},d={x:(x+1)/n,y:(y+1)/n};
   for(const tri of [[a,c,b],[b,c,d]]){const poly=[];
    for(let i=0;i<3;i++){const p=tri[i],q=tri[(i+1)%3],dp=contourDistance(p.x,p.y,contour),dq=contourDistance(q.x,q.y,contour);if(dp<=0)poly.push(p);if((dp<0)!==(dq<0)){const t=dp/(dp-dq);poly.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});}}
    if(poly.length<3)continue;const offset=g.positions.length/3;for(const p of poly)vertex(p);for(let i=1;i<poly.length-1;i++)g.indices.push(offset,offset+i,offset+i+1);
   }
  }
 }
 return g;
}
