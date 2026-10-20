import {WIDTH,HEIGHT,river,terrain} from '../world.js';
import {TILE,shoreDistance,surfaceElevation} from '../district3d/terrain.js';
const noise=(x,y)=>{const n=Math.sin(x*127.1+y*311.7+73129)*43758.5453;return n-Math.floor(n);};
const distance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);};
// Small uneven colonies occupy damp margins; their centres never cover a real
// foundation, path or channel. The low dry plain deliberately remains open.
export function floodplainTufts(s,roads=[]){
 const result=[];
 const clear=p=>!(s.buildings||[]).some(b=>Math.abs(b.x-p.x)<.79&&Math.abs(b.y-p.y)<.79)&&roads.every(r=>distance(p,r.a,r.b)>.29);
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
 return result;
}
export function tuftGeometry(s,tufts){
 const g={positions:[],indices:[],colors:[],uvs:[]};
 // Bent ribbons spread in five directions. Real vertical leaves give volume
 // without transparent cards, extra meshes, or any per-frame geometry work.
 for(const p of tufts){const Y=surfaceElevation(p.x,p.y,s),reeds=p.kind==='reed';
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
 const g={positions:[],indices:[],colors:[],uvs:[]},steps=HEIGHT*12,across=6;
 for(const side of [-1,1]){const offset=g.positions.length/3;
  for(let j=0;j<=steps;j++){const y=-.5+HEIGHT*j/steps,width=.13+.14*(.5+.5*Math.sin(y*1.13+side*3))+.05*Math.sin(y*3.7)**2;
   for(let i=0;i<=across;i++){const t=i/across,x=river(y)+side*(1.07+width*t),Y=surfaceElevation(x,y,s),n=noise(x*2,y*2);
    g.positions.push(x*TILE,Y+.024,y*TILE);g.uvs.push(x/3,y/3);g.colors.push(.61+(.18+n*.045)*t,.57+(.12+n*.035)*t,.43+(.09+n*.025)*t,i===across||(s.buildings||[]).some(b=>Math.abs(b.x-x)<.31&&Math.abs(b.y-y)<.3)?0:Math.sin(Math.PI*(.12+.88*t))*.7);
    if(j<steps&&i<across){const a=offset+j*(across+1)+i;g.indices.push(a,a+across+1,a+1,a+1,a+across+1,a+across+2);}
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
