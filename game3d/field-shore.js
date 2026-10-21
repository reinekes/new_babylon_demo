import {renderedShoreDistance,visualSurfaceElevation} from './shore-profile.js';
import {lakeContours} from './lake-shore.js';

// Only 12 cm beyond the actual drawn water. The previous 1.41 m simulation-bank
// margin removed dry middle rows of the starting riverside field.
export const FIELD_SHORE_BUFFER=.02;
const EDGE=.06,BOUND=1.25,CLIP=FIELD_SHORE_BUFFER;
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
export function fieldWorldPoint(building,x,z){
 const rotation=((building.rotation||0)%4+4)%4;
 const [X,Z]=rotation===1?[z,-x]:rotation===2?[-x,-z]:rotation===3?[-z,x]:[x,z];
 return {x:building.x+X/6,y:building.y+Z/6};
}
export function clippedFieldGeometry(data,building,state){
 const contours=lakeContours(state),distance=(x,z)=>{const p=fieldWorldPoint(building,x,z);return renderedShoreDistance(p.x,p.y,state,contours);};
 let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(let i=0;i<data.positions.length;i+=3){minX=Math.min(minX,data.positions[i]);maxX=Math.max(maxX,data.positions[i]);minZ=Math.min(minZ,data.positions[i+2]);maxZ=Math.max(maxZ,data.positions[i+2]);}
 const centerX=(minX+maxX)/2,centerZ=(minZ+maxZ)/2;
 // Most fields are wholly inland: retain their original compact shared indices.
 if(distance(centerX,centerZ)-Math.hypot(maxX-minX,maxZ-minZ)/12*BOUND>=CLIP)return data;
 const positions=[],normals=[],uvs=[],indices=[];
 const point=index=>({p:Array.from(data.positions.slice(index*3,index*3+3)),n:Array.from(data.normals?.slice(index*3,index*3+3)||[0,1,0]),uv:Array.from(data.uvs?.slice(index*2,index*2+2)||[0,0])});
 const dry=v=>distance(v.p[0],v.p[2]);
 const mix=(a,b,t)=>({p:lerp(a.p,b.p,t),n:lerp(a.n,b.n,t),uv:lerp(a.uv,b.uv,t)});
 const edge=(a,b)=>Math.hypot(a.p[0]-b.p[0],a.p[2]-b.p[2]);
 const emit=(a,b,c)=>{for(const v of [a,b,c]){indices.push(positions.length/3);positions.push(...v.p);normals.push(...v.n);uvs.push(...v.uv);}};
 const crossing=(a,b)=>{
  let low=0,high=1;const inside=dry(a)>=CLIP;
  for(let i=0;i<25;i++){const t=(low+high)/2;if((dry(mix(a,b,t))>=CLIP)===inside)low=t;else high=t;}
  return mix(a,b,inside?low:high);
 };
 function triangle(a,b,c){
  const values=[dry(a),dry(b),dry(c)],length=Math.max(edge(a,b),edge(b,c),edge(c,a));
  if(Math.min(...values)-length/6*BOUND>=CLIP){emit(a,b,c);return;}
  if(Math.max(...values)+length/6*BOUND<CLIP)return;
  if(length>EDGE){const ab=mix(a,b,.5),bc=mix(b,c,.5),ca=mix(c,a,.5);triangle(a,ab,ca);triangle(ab,b,bc);triangle(ca,bc,c);triangle(ab,bc,ca);return;}
  const polygon=[];let previous=c;
  for(const current of [a,b,c]){
   const was=dry(previous)>=CLIP,now=dry(current)>=CLIP;
   if(was!==now)polygon.push(crossing(previous,current));
   if(now)polygon.push(current);previous=current;
  }
  for(let i=1;i+1<polygon.length;i++)emit(polygon[0],polygon[i],polygon[i+1]);
 }
 for(let i=0;i<data.indices.length;i+=3)triangle(...Array.from(data.indices.slice(i,i+3),point));
 // Returned data stays local. The renderer rotates the finished root afterwards.
 for(let i=0;i<positions.length;i+=3){const p=fieldWorldPoint(building,positions[i],positions[i+2]);positions[i+1]+=visualSurfaceElevation(p.x,p.y,state,contours);}
 return {positions,normals,uvs,indices};
}

// Smooth, coherent deformation applies to every material group together. At ground
// level y stays zero, so pots/thresholds keep their authored contact and door gaps.
export function organicHousePoint(x,y,z,variant=0){
 const phase=variant*1.71;
 return [x*(.94+variant*.006)+.055*Math.sin(z*1.37+phase)+.045*Math.sin(x*.84+z*.63+phase)+y*.014*Math.sin(z*.72+phase),
  y*(.97+.022*Math.sin(x*.95+z*.62+phase)),
  z*(.90+variant*.014)+.075*Math.sin(x*1.05+phase)+.035*Math.cos(z*1.34+x*.5+phase)];
}
export const organicHouseVariant=b=>((Math.imul(b.x|0,73856093)^Math.imul(b.y|0,19349663))>>>0)%3;
