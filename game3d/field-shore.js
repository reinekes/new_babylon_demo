import {renderedShoreDistance,visualSurfaceElevation} from './shore-profile.js';
import {lakeContours} from './lake-shore.js';
import {fieldPatchLimits} from '../field-patches.js';
import {terrain} from '../world.js';
import {occupiesCell} from '../footprints.js';

// A narrow dry lip separates cultivated soil from the surface of the water.
export const FIELD_SHORE_BUFFER=.012;
const EDGE=.06,BOUND=1.25;
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
export function fieldWorldPoint(building,x,z){
 const rotation=((building.rotation||0)%4+4)%4;
 const [X,Z]=rotation===1?[z,-x]:rotation===2?[-x,-z]:rotation===3?[-z,x]:[x,z];
 return {x:building.x+X/6,y:building.y+Z/6};
}

// Fit the furrows across the dry cross-section of one riverbank parcel. The dry
// lip of the next water tile can be cultivated up to the waterline. A dry or
// occupied neighbour keeps its full footprint and joined plots keep their seams.
export function fieldBorderSignature(b,state,occupied){
 const offsets=[[1,0],[-1,0],[0,1],[0,-1]];
 return offsets.map(([dx,dy])=>{
  const x=b.x+dx,y=b.y+dy;
  return terrain(x,y,state)==='water'&&(occupied?occupied.has(`${x},${y}`):(state?.buildings||[]).some(v=>occupiesCell(v,x,y)))?'1':'0';
 }).join('');
}
export function bankFieldLayout(b,state){
 if(!state)return null;
 const contours=lakeContours(state),distance=(x,z)=>{const p=fieldWorldPoint(b,x,z);return renderedShoreDistance(p.x,p.y,state,contours);};
 if(distance(0,0)>.99)return null;
 const dx=distance(1,0)-distance(-1,0),dz=distance(0,1)-distance(0,-1);
 if(Math.max(Math.abs(dx),Math.abs(dz))<.03)return null;
 const alongX=Math.abs(dx)>=Math.abs(dz),sign=(alongX?dx:dz)>0?-1:1;
 const side=alongX?(sign>0?1:3):(sign>0?2:0),joins=b.fieldPatch?.joins;
 if(joins?.[side])return null;
 const neighbour=fieldWorldPoint(b,alongX?sign*6:0,alongX?0:sign*6);
 const x=Math.round(neighbour.x),y=Math.round(neighbour.y);
 const extend=terrain(x,y,state)==='water'&&!(state.buildings||[]).some(v=>occupiesCell(v,x,y));
 const rim=joins?2.9:2.65,max=extend?5.97:2.98,memo=new Map();
 const across=(n,line)=>alongX?distance(sign*n,line):distance(line,sign*n);
 function wetEdge(line){
  if(memo.has(line))return memo.get(line);
  let a=-rim,b=max;
  if(across(b,line)>=FIELD_SHORE_BUFFER)b=extend?rim:max;
  else if(across(a,line)<FIELD_SHORE_BUFFER)b=a;
  else{for(let k=0;k<15;k++){const mid=(a+b)/2;if(across(mid,line)>=FIELD_SHORE_BUFFER)a=mid;else b=mid;}b=a;}
  memo.set(line,b);return b;
 }
 return (x,z)=>{
  const line=alongX?z:x,n=sign*(alongX?x:z),end=wetEdge(line);
  // The far border of a connected patch can be widened without shifting
  // its interior rows or displacing vertices at a shared tile boundary.
  const start=joins?rim-1.1:-rim;
  const f=Math.max(0,Math.min(1,(n-start)/(rim-start)));
  const moved=n+(joins?Math.max(0,end-rim):end-rim)*f;
  return alongX?{x:sign*moved,z}:{x,z:sign*moved};
 };
}

// Every shared edge uses the same samples and height profile on either side.
// Only the unjoined edge fades into the ground and wanders from the tile line.
export function fieldPatchBedGeometry(b,rim=2.9){
 const {joins}=b.fieldPatch,[north,east,south,west]=joins,limits=fieldPatchLimits(joins,rim),positions=[],uvs=[],indices=[],colors=[];
 const irregular=joins.some(Boolean)?1:0,xSteps=32,zSteps=12,phase=(b.x*17+b.y*31)*.75;
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 for(let row=0;row<=zSteps;row++)for(let col=0;col<=xSteps;col++){
  const u=col/xSteps,v=row/zSteps,x=u*6-3,z=v*6-3;
  const waveX=(Math.sin(z*1.8+phase)+.45*Math.sin(z*3.5-phase))*.09;
  const waveZ=(Math.cos(x*1.5+phase)+.40*Math.sin(x*3.7+phase))*.12;
  const envelopeX=Math.sin(Math.PI*v),envelopeZ=Math.sin(Math.PI*u);
  const rimX=west?0:Math.max(0,1-u*5),rimEast=east?0:Math.max(0,1-(1-u)*5);
  const rimZ=north?0:Math.max(0,1-v*5),rimSouth=south?0:Math.max(0,1-(1-v)*5);
  const X=x+rimX*(limits.left+3+waveX*envelopeX*irregular)+rimEast*(limits.right-3+waveX*envelopeX*irregular);
  const Z=z+rimZ*(limits.near+3+waveZ*envelopeZ*irregular)+rimSouth*(limits.far-3+waveZ*envelopeZ*irregular);
  const edge=smooth(Math.min(north?1:v*8,east?1:(1-u)*9,south?1:(1-v)*8,west?1:u*9));
  const world=fieldWorldPoint(b,X,Z);
  // Alluvium accumulates on one side of a slightly wandering plough ridge.
  // Vanishing at each seam preserves the exact crop/soil join of adjacent tiles.
  const drift=.48*Math.sin(world.y*7.2+world.x*.83)*Math.sin(Math.PI*u)*Math.sin(Math.PI*v);
  const ridge=(.5-.5*Math.cos(u*Math.PI*16+drift))**2;
  const tilth=Math.sin(world.x*45+world.y*21)*Math.cos(world.y*38-world.x*13);
  const height=.012+edge*(.032+ridge*(.086+.011*tilth));
  const soil=.73+.23*ridge+.037*tilth+.045*Math.sin(world.x*15.1+world.y*8.2)*Math.cos(world.y*13.8);
  const shade=soil*edge+(1-edge)*.98;
  positions.push(X,height,Z);uvs.push(world.x*5.7,world.y*5.7);colors.push(shade,shade*.94,shade*.85,1);
  if(row<zSteps&&col<xSteps){const i=row*(xSteps+1)+col;indices.push(i,i+1,i+xSteps+1,i+1,i+xSteps+2,i+xSteps+1);}
 }
 // The ard leaves crumbled aggregates on the shoulders of each furrow.
 // Sampling the existing bed keeps each fragment seated on its own ridge.
 let seed=(Math.imul(b.x|0,73856093)^Math.imul(b.y|0,19349663)^3199)>>>0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 function bedPoint(u,v){
  const gx=u*xSteps,gz=v*zSteps,i=Math.floor(gx),j=Math.floor(gz),fx=gx-i,fz=gz-j;
  const lo=(j*(xSteps+1)+i)*3,hi=lo+(xSteps+1)*3;
  return [0,1,2].map(k=>(positions[lo+k]*(1-fx)+positions[lo+3+k]*fx)*(1-fz)+(positions[hi+k]*(1-fx)+positions[hi+3+k]*fx)*fz);
 }
 for(let group=0;group<47;group++){
  const u=(group%8+.25+random()*.42)/8,v=.055+random()*.89,count=1+Math.floor(random()*3);
  for(let fragment=0;fragment<count;fragment++){
   const [x,y,z]=bedPoint(u+(random()-.5)*.035,v+(random()-.5)*.035);
   const size=.033+.049*random(),aspect=.47+.44*random(),angle=random()*Math.PI*2,shade=.57+.36*random();
   const off=positions.length/3;
   for(let k=0;k<=5;k++){
    const a=k/5*Math.PI*2+angle,r=size*(.74+.33*random()),dx=k===5?r*.12:Math.cos(a)*r,dz=k===5?r*.08:Math.sin(a)*r*aspect;
    positions.push(x+dx,y+(k===5?size*.42:-.011+random()*.009),z+dz);
    const world=fieldWorldPoint(b,x+dx,z+dz);uvs.push(world.x*5.7,world.y*5.7);
    const color=shade*(k===5?1.16:.91);colors.push(color,color*.94,color*.86,1);
   }
   for(let k=0;k<5;k++)indices.push(off+k,off+(k+1)%5,off+5);
  }
 }
 return {positions,uvs,indices,colors};
}
export function clippedFieldGeometry(data,building,state,layout=null){
 // A few millimetres cover the chord between samples on tight lake corners.
 const clip=FIELD_SHORE_BUFFER+(layout?.001:0);
 if(layout){
  const positions=Array.from(data.positions);
  for(let i=0;i<positions.length;i+=3){const p=layout(positions[i],positions[i+2]);positions[i]=p.x;positions[i+2]=p.z;}
  data={positions,uvs:data.uvs,indices:data.indices,normals:data.normals,colors:data.colors};
 }
 const contours=lakeContours(state),distance=(x,z)=>{const p=fieldWorldPoint(building,x,z);return renderedShoreDistance(p.x,p.y,state,contours);};
 let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(let i=0;i<data.positions.length;i+=3){minX=Math.min(minX,data.positions[i]);maxX=Math.max(maxX,data.positions[i]);minZ=Math.min(minZ,data.positions[i+2]);maxZ=Math.max(maxZ,data.positions[i+2]);}
 const centerX=(minX+maxX)/2,centerZ=(minZ+maxZ)/2;
 // Most fields are wholly inland: retain their original compact shared indices.
 if(distance(centerX,centerZ)-Math.hypot(maxX-minX,maxZ-minZ)/12*BOUND>=clip)return data;
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
  let low=0,high=1;const inside=dry(a)>=clip;
  for(let i=0;i<25;i++){const t=(low+high)/2;if((dry(mix(a,b,t))>=clip)===inside)low=t;else high=t;}
  return mix(a,b,inside?low:high);
 };
 function triangle(a,b,c){
  const values=[dry(a),dry(b),dry(c)],length=Math.max(edge(a,b),edge(b,c),edge(c,a));
  if(Math.min(...values)-length/6*BOUND>=clip){emit(a,b,c);return;}
  if(Math.max(...values)+length/6*BOUND<clip)return;
  if(length>EDGE){const ab=mix(a,b,.5),bc=mix(b,c,.5),ca=mix(c,a,.5);triangle(a,ab,ca);triangle(ab,b,bc);triangle(ca,bc,c);triangle(ab,bc,ca);return;}
  const polygon=[];let previous=c;
  for(const current of [a,b,c]){
   const was=dry(previous)>=clip,now=dry(current)>=clip;
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
