import {WIDTH,HEIGHT,river,terrain} from '../world.js';
import {TILE,shoreDistance,surfaceElevation} from '../district3d/terrain.js';
import {footprintSize} from '../footprints.js';
import {lakeContours,lakeDistance,visualSurfaceElevation} from './lake-shore.js';
import {riverRows} from '../district3d/river-profile.js';
const noise=(x,y)=>{const n=Math.sin(x*127.1+y*311.7+73129)*43758.5453;return n-Math.floor(n);};
const distance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);};

// Physical occupied square plus a small render-only margin; legacy monuments
// deliberately retain their saved one-cell footprint.
export function sceneryClear(s,p,padding=.29){return !(s.buildings||[]).some(b=>{const size=footprintSize(b),center=(size-1)/2,half=size/2+padding;return Math.abs(b.x+center-p.x)<half&&Math.abs(b.y+center-p.y)<half;});}

// Small uneven colonies occupy damp margins; their centres never cover a real
// foundation, path or channel. The low dry plain deliberately remains open.
export function floodplainTufts(s,roads=[]){
 const result=[],contours=lakeContours(s);
 const clear=p=>sceneryClear(s,p)&&roads.every(r=>distance(p,r.a,r.b)>.29);
 for(let j=0;j<HEIGHT;j++)for(let i=0;i<WIDTH;i++){
  const x=i+(noise(i,j)-.5)*.32,y=j+(noise(j,i+9)-.5)*.32,d=shoreDistance(x,y,s),colony=.5+.5*Math.sin(x*2.1+Math.sin(y*1.7))*Math.sin(y*1.4-x*.35);
  if(d<.25||d>4.8||terrain(Math.round(x),Math.round(y),s)==='water'||noise(i+31,j+12)>.36+colony*.43||!clear({x,y}))continue;
  const reed=d<.9&&noise(i+41,j)<.52,count=reed?4:3+Math.floor(noise(i,j+22)*3);
  for(let k=0;k<count;k++){
   const p={x:x+(noise(i+k*13,j)-.5)*.60,y:y+(noise(j+k*7,i)-.5)*.60};
   if(shoreDistance(p.x,p.y,s)<.23||!clear(p))continue;
   result.push({...p,kind:reed?'reed':'grass',height:reed?.8+noise(i+k,j+61)*.95:.24+noise(i+k,j+71)*.48,width:reed?.085:.12,angle:noise(i+k,j+81)*Math.PI*2,tone:.72+noise(i+k,j+91)*.28});
  }
 }
 for(const {points}of contours)for(let i=0;i<points.length;i+=7){const a=points[i],b=points[(i+1)%points.length],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1;if(noise(a.x,a.y)>.68)continue;for(let k=0;k<3;k++){const outward=.13+k*.055,p={x:a.x+dy/length*outward,y:a.y-dx/length*outward};if(!clear(p)||lakeDistance(p.x,p.y,s,contours)<.07)continue;result.push({...p,kind:'reed',height:.65+noise(i+k,42)*.8,width:.065,angle:i*2.399,tone:.8+noise(i+k,43)*.2});}}
 return result;
}
export function tuftGeometry(s,tufts){
 const g={positions:[],indices:[],colors:[],uvs:[]};
 // Bent ribbons spread in five directions. Real vertical leaves give volume
 // without transparent cards, extra meshes, or any per-frame geometry work.
 for(const p of tufts){const Y=visualSurfaceElevation(p.x,p.y,s),reeds=p.kind==='reed';
  for(let k=0;k<(reeds?4:5);k++){
   const angle=p.angle+k*2.399,dx=Math.cos(angle),dz=Math.sin(angle),px=-dz,pz=dx,h=p.height*(.7+.3*noise(k,p.x)),bend=reeds?.28:.46,offset=g.positions.length/3;
   for(let j=0;j<3;j++){const t=j/2,w=p.width*(j===0?.45:j===1?.7:.025),reach=t*t*bend;
    for(const side of [-1,1]){g.positions.push(p.x*TILE+dx*reach+px*w*side,Y+h*t,p.y*TILE+dz*reach+pz*w*side);const tone=p.tone*(.62+.38*t);g.colors.push(tone*.91,tone,tone*.64,1);g.uvs.push((side+1)/2,t);}
   }
   for(let j=0;j<2;j++){const a=offset+j*2;g.indices.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
 }
 return g;
}
// A thin contour mesh follows the physical slope, with a varying, fading outer
// margin rather than a painted ring or evenly spaced decorative stones.
export function riverbankGeometry(s){
 const g={positions:[],indices:[],colors:[],uvs:[]},rows=riverRows(true),across=6;
 for(const side of [-1,1]){const offset=g.positions.length/3;
  for(let j=0;j<rows.length;j++){const y=rows[j],width=.13+.14*(.5+.5*Math.sin(y*1.13+side*3))+.05*Math.sin(y*3.7)**2;
   for(let i=0;i<=across;i++){const t=i/across,x=river(y)+side*(1.07+width*t),Y=surfaceElevation(x,y,s),n=noise(x*2,y*2);
    g.positions.push(x*TILE,Y+.024,y*TILE);g.uvs.push(x/3,y/3);g.colors.push(.61+(.18+n*.045)*t,.57+(.12+n*.035)*t,.43+(.09+n*.025)*t,i===across||(s.buildings||[]).some(b=>Math.abs(b.x-x)<.31&&Math.abs(b.y-y)<.3)?0:Math.sin(Math.PI*(.12+.88*t))*.7);
    if(j<rows.length-1&&i<across){const a=offset+j*(across+1)+i;g.indices.push(a,a+across+1,a+1,a+1,a+across+1,a+across+2);}
   }
  }
 }
 return g;
}
export function rectangularSiteGeometry(size=5.25,thickness=.09){
 const positions=[],indices=[];
 for(const [x,z,w,d]of [[0,-size/2,size,thickness],[0,size/2,size,thickness],[-size/2,0,thickness,size],[size/2,0,thickness,size]]){
  const i=positions.length/3;positions.push(x-w/2,0,z-d/2,x-w/2,0,z+d/2,x+w/2,0,z-d/2,x+w/2,0,z+d/2);indices.push(i,i+1,i+2,i+2,i+1,i+3);
 }
 return {positions,indices};
}

// A fading wet margin follows only the joined outside contour.
export function lakebankGeometry(s){
 const g={positions:[],indices:[],colors:[],uvs:[]},contours=lakeContours(s);
 for(const {points}of contours){const offset=g.positions.length/3,n=points.length;
  for(let j=0;j<=n;j++){const p=points[j%n],a=points[(j+n-1)%n],b=points[(j+1)%n],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,width=.15+.055*Math.sin(p.x*3+p.y*2);
   for(let k=0;k<4;k++){const t=k/3,d=-.025+width*t,x=p.x+dy/len*d,y=p.y-dx/len*d,blocked=(s.buildings||[]).some(b=>Math.abs(b.x-x)<.55&&Math.abs(b.y-y)<.55);g.positions.push(x*TILE,visualSurfaceElevation(x,y,s,contours)+.027,y*TILE);g.uvs.push(x/3,y/3);g.colors.push(.62+t*.13,.57+t*.12,.43+t*.10,blocked||k===3?0:Math.sin(Math.PI*(.2+.8*t))*.58);if(j<n&&k<3){const i=offset+j*4+k;g.indices.push(i,i+4,i+1,i+1,i+4,i+5);}}
  }
 }return g;
}
