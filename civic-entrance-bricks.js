import {isReedShrine} from './building-presentation.js';
import {footprintCells,footprintSize} from './footprints.js';
import {fortificationWorldPoint as buildingPoint} from './fortification-layout.js';
import {worldWidth,worldHeight} from './world.js';
import {renderedShoreDistance} from './game3d/shore-profile.js';
import {lakeContours} from './game3d/lake-shore.js';
import {surfaceElevation} from './district3d/terrain.js';

export const hasCivicApron=b=>b.type==='communalHouse'||b.type==='shrine'||b.type==='ziggurat';
const shades=['#a68965','#ae8e69','#9e7e5d','#a48462','#ad9170','#a58d6f','#a78864','#aa8b67','#a38663'];
const linearColor=hex=>hex.slice(1).match(/../g).map(byte=>((parseInt(byte,16)/255+.055)/1.055)**2.4);
const pigments=shades.map(linearColor);
const noise=(i,j,k)=>{const n=Math.sin(i*135.7+j*53.1+k*17.3)*43758.5453;return n-Math.floor(n);};

function threshold(b,s){
 const size=footprintSize(b);
 if(b.type==='communalHouse')return {start:5.42,neck:.78,shoulder:2.12,rows:13};
 if(b.type==='ziggurat')return size===2?{start:5.28,neck:.99,shoulder:2.50,rows:15}:{start:2.50,neck:.74,shoulder:1.79,rows:10};
 return isReedShrine(s,b)?{start:1.75,neck:1.05,shoulder:1.52,rows:13}:{start:2.62,neck:.83,shoulder:1.83,rows:12};
}

// Laid at the front sill, spreading into a small, partly buried fan.
// Only the staggered course centres are regular; the broken edges follow the dust.
export function civicEntranceBricks(s){
 const buildings=s.buildings||[],sites=buildings.filter(b=>hasCivicApron(b)&&b.construction?.kind!=='new');
 if(!sites.length)return [];
 const occupied=new Map();
 for(const b of buildings)for(const p of footprintCells(b))occupied.set(p.x+','+p.y,b);
 const width=worldWidth(s),height=worldHeight(s),contours=lakeContours(s),result=[];
 for(const b of sites){
  const center=(footprintSize(b)-1)*3,seed=b.x*37+b.y*13,pattern=threshold(b,s);
  const temple=b.type==='ziggurat',pitch=temple?.64:.50;
  const open=p=>{
   const x=Math.round(p.x),y=Math.round(p.y),owner=occupied.get(x+','+y);
   return x>=0&&x<width&&y>=0&&y<height&&(!owner||owner===b)&&renderedShoreDistance(p.x,p.y,s,contours)>.22;
  };
  for(let row=0;row<pattern.rows;row++){
   const t=row/(pattern.rows-1);
   // A continuous runner from the lowest tread broadens into laid courses.
   const flare=temple?Math.min(1,Math.max(0,(t-.12)*2.0)):Math.sin(t*Math.PI*.86);
   const breadth=pattern.neck+(pattern.shoulder-pattern.neck)*flare;
   const drift=Math.sin(t*3.8+seed)*.22*t,reach=pattern.start+(row+.5)*.30;
   for(let course=-7;course<=7;course++){
    const x=(course+row%2*.5)*pitch+drift;
    const outer=Math.abs(x)/breadth,grain=noise(course,row,seed);
    if(outer>1+.08*grain||grain<(Math.max(0,t-.65)*1.65+Math.max(0,outer-.73)*.74))continue;
    const worn=Math.max(0,outer-.68)+Math.max(0,t-.65);
    const w=pitch/2-.006-.009*grain-worn*.040,d=(temple?.138:.149)-.006*noise(course,seed,row)-worn*.027;
    const chip=.022+.055*noise(row,seed,course),angle=(noise(row,course,seed)-.5)*(.085+.27*worn);
    const cos=Math.cos(angle),sin=Math.sin(angle),cx=x+(grain-.5)*.014,cz=reach+(noise(seed,course,row)-.5)*.012;
    const polygon=[[-w+chip,-d],[w-.012,-d],[w,-d+.017],[w,d-chip*.55],[w-chip*.70,d],[-w,d-.009],[-w,-d+chip]].map(([u,v])=>
     buildingPoint(b,center+cx+u*cos-v*sin,center+cz+u*sin+v*cos));
    if(!polygon.every(open))continue;
    const at=buildingPoint(b,center+cx,center+cz);
    const mix=noise(seed+2,row,course),shade=temple?6+Math.floor(mix*3):Math.floor(mix*6);
    result.push({polygon,at,shade,wear:worn,rough:grain});
   }
  }
 }
 return result;
}

// One opaque mesh for every threshold in town. The inset tops and shallow
// chipped shoulders catch the light without adding a draw call for each brick.
export function civicBrickGeometry(bricks,s){
 const positions=[],colors=[],indices=[];
 for(const {polygon,at,shade,wear,rough} of bricks){
  const start=positions.length/3,n=polygon.length,pigment=pigments[shade];
  const base=Math.max(0,surfaceElevation(at.x,at.y,s))+.082;
  for(const top of [false,true]){
   const inset=top?.92:1,light=(top?1:.83)*(1-.12*wear);
   for(const p of polygon){
    positions.push((at.x+(p.x-at.x)*inset)*6,base+(top?.009+.007*rough-.006*wear:0),(at.y+(p.y-at.y)*inset)*6);
    colors.push(pigment[0]*light,pigment[1]*light,pigment[2]*light,1);
   }
  }
  for(let j=0;j<n;j++){
   const next=(j+1)%n;
   indices.push(start+j,start+next,start+n+next,start+j,start+n+next,start+n+j);
  }
  // Weld the chipped rim, but keep the face flat. Sharing its normals
  // with the bevel used to turn alternating bricks into light/dark wedges.
  const face=positions.length/3;
  positions.push(...positions.slice((start+n)*3,face*3));
  colors.push(...colors.slice((start+n)*4,face*4));
  for(let j=1;j<n-1;j++)indices.push(face,face+j,face+j+1);
 }
 return {positions,colors,indices};
}

export function civicBrickCanvasLayer(bricks){
 if(!bricks.length)return ()=>{};
 if(typeof Path2D==='undefined')return r=>{
  for(const {polygon,shade} of bricks)r.polygon(polygon.map(p=>r.point(p.x,p.y)),shades[shade]);
 };
 // Store world-coordinate paths. Panning and zooming reuse the colour batches.
 const paths=shades.map(()=>new Path2D());
 for(const {polygon,shade} of bricks){
  const path=paths[shade];path.moveTo(polygon[0].x,polygon[0].y);
  for(let j=1;j<polygon.length;j++)path.lineTo(polygon[j].x,polygon[j].y);
  path.closePath();
 }
 return r=>{
  const ctx=r.ctx;ctx.save();ctx.transform(r.tw/2,r.th/2,-r.tw/2,r.th/2,r.ox,r.oy);
  for(let i=0;i<paths.length;i++){ctx.fillStyle=shades[i];ctx.fill(paths[i]);}
  ctx.restore();
 };
}
