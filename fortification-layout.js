import {footprintSize} from './footprints.js';

const TILE=6,HALF=TILE/2,THICKNESS=1.36,HEIGHT=2.12,END=2.84;
const directions=[[1,0],[0,1],[-1,0],[0,-1]];
const gateNeighbors=[[-9,-3],[9,-3],[-3,-9],[3,-9],[-9,3],[9,3],[-3,9],[3,9]];
const turn=b=>((b.rotation||0)%4+4)%4;
export function fortificationWorldPoint(b,x,z){
 const centre=(footprintSize(b)-1)*HALF;
 const [c,s]=[[1,0],[0,1],[-1,0],[0,-1]][turn(b)];
 return {x:b.x+(centre+c*(x-centre)+s*(z-centre))/TILE,y:b.y+(centre-s*(x-centre)+c*(z-centre))/TILE};
}
function wallMask(b,state){
 let mask=0;
 for(const [i,[x,z]] of directions.entries()){
  const p=fortificationWorldPoint(b,x*TILE,z*TILE);
  if(state?.buildings?.some(other=>other!==b&&['cityWall','cityGate'].includes(other.type)&&other.construction?.kind!=='new'&&
   p.x>=other.x&&p.x<other.x+footprintSize(other)&&p.y>=other.y&&p.y<other.y+footprintSize(other)))mask|=1<<i;
 }
 return mask;
}
function gateMask(b,state){
 let mask=0;
 for(const [i,[x,z]] of gateNeighbors.entries()){
  const p=fortificationWorldPoint(b,x+HALF,z+HALF);
  if(state?.buildings?.some(other=>other!==b&&other.type==='cityWall'&&other.construction?.kind!=='new'&&p.x===other.x&&p.y===other.y))mask|=1<<i;
 }
 return mask;
}
export function fortificationSignature(b,state){
 if(b.type==='cityWall')return `wall:${wallMask(b,state)}`;
 if(b.type==='cityGate')return `gate:${footprintSize(b)===2?gateMask(b,state):wallMask(b,state)&10}`;
 return '';
}
export function fortificationLayout(b,state){
 const pieces=[];
 const piece=(x,z,w,d,h=HEIGHT,material='brick',bottom=-.16)=>pieces.push({x,z,w,d,h:h-bottom,bottom,material});
 const arm=(x,z,w,d)=>piece(x,z,w,d);
 if(b.type==='cityWall'){
  const mask=wallMask(b,state);
  if(!mask){arm(0,0,END*2,THICKNESS);return pieces;}
  const half=THICKNESS/2;
  // Each arm and the centre meet on their faces. Neighbouring tiles share
  // the same section width and height, including at a corner or junction.
  for(const [i,[x,z]] of directions.entries())if(mask&1<<i){
   const length=HALF-half,offset=(HALF+half)/2;
   arm(x*offset,z*offset,x?length:THICKNESS,z?length:THICKNESS);
  }
  if(mask===1||mask===2||mask===4||mask===8){
   const [x,z]=directions.find((_,i)=>mask===1<<i),length=END-half,offset=(END+half)/2;
   arm(-x*offset,-z*offset,x?length:THICKNESS,z?length:THICKNESS);
  }
  arm(0,0,THICKNESS,THICKNESS);
  return pieces;
 }
 const size=footprintSize(b),center=(size-1)*HALF,mask=size===2?gateMask(b,state):wallMask(b,state)&10;
 for(const side of [-1,1]){
  const lateral=side*(size===2?1.95:1.54),width=size===2?3.05:2.62,depth=size===2?1.45:1.27;
  piece(center,center+lateral,width,depth,3.08);
  piece(center,center+lateral,width+.14,depth+.13,3.22,'plaster',3.08);
  if(size!==2){
   if(mask&(side<0?8:2)){
    const start=Math.abs(lateral),length=HALF-start;
    arm(center,center+side*(start+length/2),THICKNESS,length);
   }
   continue;
  }
  const attached=(mask>>(side<0?0:4))&15;
  if(!attached)continue;
  // Keep the main opening between the piers. Attach along the appropriate
  // two lanes at the tile edges, offsetting only the low return wall.
  const lane=center+side*3,half=THICKNESS/2;
  const left=attached&1?-6:attached&4?-3-half:-half;
  const right=attached&2?6:attached&8?3+half:half;
  // The pier overlaps this transverse arm before it reaches either lane.
  arm(center+(left+right)/2,lane,right-left,THICKNESS);
  for(const [i,x] of [-3,3].entries())if(attached&(4<<i)){
   arm(center+x,lane+side*(3+half)/2,THICKNESS,3-half);
  }
 }
 piece(center,center,size===2?1.28:1.05,size===2?3.05:2.4,2.91,'wood',2.55);
 return pieces;
}
