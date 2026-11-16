import {renderedShoreDistance,visualSurfaceElevation} from './shore-profile.js';
import {lakeContours} from './lake-shore.js';
import {fieldPatchLimits} from '../field-patches.js';

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

// Every shared edge uses the same samples and height profile on either side.
// Only the unjoined edge fades into the ground and wanders from the tile line.
export function fieldPatchBedGeometry(b){
 const {joins}=b.fieldPatch,[north,east,south,west]=joins,limits=fieldPatchLimits(joins),positions=[],uvs=[],indices=[],colors=[];
 const xSteps=32,zSteps=12,phase=(b.x*17+b.y*31)*.75;
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 for(let row=0;row<=zSteps;row++)for(let col=0;col<=xSteps;col++){
  const u=col/xSteps,v=row/zSteps,x=u*6-3,z=v*6-3;
  const waveX=(Math.sin(z*1.8+phase)+.45*Math.sin(z*3.5-phase))*.09;
  const waveZ=(Math.cos(x*1.5+phase)+.40*Math.sin(x*3.7+phase))*.12;
  const envelopeX=Math.sin(Math.PI*v),envelopeZ=Math.sin(Math.PI*u);
  const rimX=west?0:Math.max(0,1-u*5),rimEast=east?0:Math.max(0,1-(1-u)*5);
  const rimZ=north?0:Math.max(0,1-v*5),rimSouth=south?0:Math.max(0,1-(1-v)*5);
  const X=x+rimX*(limits.left+3+waveX*envelopeX)+rimEast*(limits.right-3+waveX*envelopeX);
  const Z=z+rimZ*(limits.near+3+waveZ*envelopeZ)+rimSouth*(limits.far-3+waveZ*envelopeZ);
  const edge=smooth(Math.min(north?1:v*8,east?1:(1-u)*9,south?1:(1-v)*8,west?1:u*9));
  const ridge=(.5-.5*Math.cos(u*Math.PI*16))**2;
  const height=.004+edge*(.030+ridge*.106);
  const world=fieldWorldPoint(b,X,Z);
  const soil=.59+.35*ridge+.05*Math.sin(world.x*15.1+world.y*8.2)*Math.cos(world.y*13.8);
  const shade=soil*edge+(1-edge)*.98;
  positions.push(X,height,Z);uvs.push(world.x*1.5,world.y*1.5);colors.push(shade,shade*.94,shade*.85,1);
  if(row<zSteps&&col<xSteps){const i=row*(xSteps+1)+col;indices.push(i,i+1,i+xSteps+1,i+1,i+xSteps+2,i+xSteps+1);}
 }
 return {positions,uvs,indices,colors};
}
export function clippedFieldGeometry(data,building,state){
 const contours=lakeContours(state),distance=(x,z)=>{const p=fieldWorldPoint(building,x,z);return renderedShoreDistance(p.x,p.y,state,contours);};
 let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(let i=0;i<data.positions.length;i+=3){minX=Math.min(minX,data.positions[i]);maxX=Math.max(maxX,data.positions[i]);minZ=Math.min(minZ,data.positions[i+2]);maxZ=Math.max(maxZ,data.positions[i+2]);}
 const centerX=(minX+maxX)/2,centerZ=(minZ+maxZ)/2;
 // Most fields are wholly inland: retain their original compact shared indices.
 if(distance(centerX,centerZ)-Math.hypot(maxX-minX,maxZ-minZ)/12*BOUND>=CLIP)return data;
 const positions=[],normals=[],uvs=[],indices=[],colors=[],vertices=new Map();
 const point=index=>({p:Array.from(data.positions.slice(index*3,index*3+3)),n:Array.from(data.normals?.slice(index*3,index*3+3)||[0,1,0]),uv:Array.from(data.uvs?.slice(index*2,index*2+2)||[0,0]),t:data.colors?Array.from(data.colors.slice(index*4,index*4+4)):[]});
 const dry=v=>distance(v.p[0],v.p[2]);
 const mix=(a,b,t)=>({p:lerp(a.p,b.p,t),n:lerp(a.n,b.n,t),uv:lerp(a.uv,b.uv,t),t:lerp(a.t,b.t,t)});
 const edge=(a,b)=>Math.hypot(a.p[0]-b.p[0],a.p[2]-b.p[2]);
 // Adjacent adaptive triangles share most of their vertices. Keep the original
 // position/normal/UV seams, but reuse identical interpolated surface vertices
 // instead of emitting three new GPU vertices for every tiny shore triangle.
 const emit=(a,b,c)=>{for(const v of [a,b,c]){const key=[...v.p,...v.n,...v.uv,...v.t].map(n=>Math.round(n*1e8)).join(',');let index=vertices.get(key);if(index===undefined){index=positions.length/3;vertices.set(key,index);positions.push(...v.p);normals.push(...v.n);uvs.push(...v.uv);colors.push(...v.t);}indices.push(index);}};
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
 return {positions,normals,uvs,indices,...data.colors&&{colors}};
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
