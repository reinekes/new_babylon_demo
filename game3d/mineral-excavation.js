import {riverLocal} from '../world.js';
import {RIVER_HALF_WIDTH,riverProfileCenter} from '../district3d/river-profile.js';
import {extractionKinds,extractionSources,extractionWorkArea,isExtractionCourt} from '../extraction-courts.js';

export const mineralDepth=kind=>kind==='stone'?2.65:2.15;
export const mineralDepositAngle=site=>.48*Math.sin(site.x*2.73+site.y*1.9);
const mineralType=b=>b.type==='clay'||b.type==='quarry';

function bankClearance(x,y,state){
 const p=riverLocal(x,y,state);
 let distance=Math.abs(p.across-riverProfileCenter(p.along,state))-RIVER_HALF_WIDTH;
 for(const l of state.world?.lakes||[])for(const c of l.cells){
  const dx=Math.abs(x-c.x)-.5,dz=Math.abs(y-c.y)-.5;
  distance=Math.min(distance,Math.max(dx,dz)<=0?Math.max(dx,dz):Math.hypot(Math.max(0,dx),Math.max(0,dz)));
 }
 return distance;
}
function clearanceOfCell(x,y,state){
 let minimum=Infinity;
 for(const dx of [-.5,0,.5])for(const dz of [-.5,0,.5])minimum=Math.min(minimum,bankClearance(x+dx,y+dz,state));
 return minimum;
}
// Sites stay in map coordinates when the building or work bay is rotated.
export function mineralExcavations(state){
 const pits=[];
 for(const b of state.buildings||[]){
  if(!mineralType(b)||b.construction?.kind==='new')continue;
  const kind=extractionKinds[b.type],sites=extractionSources(state,b);
  for(const p of sites.length?sites:[b.deposit||b]){
   // The loading hut occupies the diagonally opposite quadrant. Open an
   // adjoining quadrant for a long access slope in single-source 2x2 yards.
   const roomy=isExtractionCourt(b)&&sites.length===1;
   const dx=p.x===b.x?1:-1,dz=p.y===b.y?1:-1;
   const candidates=(p.x+p.y)%2===0?[[dx,0],[0,dz]]:[[0,dz],[dx,0]];
   const extension=roomy&&candidates.find(([u,v])=>clearanceOfCell(p.x+u,p.y+v,state)>.10);
   const pit={kind,x:p.x,y:p.y,depth:mineralDepth(kind),extensionX:extension?.[0]||0,extensionY:extension?.[1]||0};
   if(clearanceOfCell(p.x,p.y,state)<.38){
    const d=bankClearance(p.x,p.y,state),gx=bankClearance(p.x+.01,p.y,state)-bankClearance(p.x-.01,p.y,state),gz=bankClearance(p.x,p.y+.01,state)-bankClearance(p.x,p.y-.01,state),len=Math.hypot(gx,gz);
    if(len>.00001){pit.bankDistance=d*6;pit.landX=gx/len;pit.landZ=gz/len;}
   }
   pits.push(pit);
  }
 }
 return pits;
}

// The old one-cell yard keeps its workbench at the street corner. Its small
// shelter stands on the opposite bank; larger courts use a vacant source cell.
export function mineralWorkBay(b,state){
 if(!isExtractionCourt(b)){
  const [sx,sz]=b.workCorner||[1,1];return {x:-2.16*sx,z:-2.18*sz,compact:true};
 }
 const area=extractionWorkArea(b,state);return {...area,compact:area.x===3&&area.z===3};
}

const data=()=>({positions:[],indices:[],colors:[],uvs:[]});
const stone=[.63,.59,.49],clay=[.53,.32,.21];
function vertex(g,p,color,shade=1){
 const id=g.positions.length/3;g.positions.push(...p);g.colors.push(...color.map(c=>c*shade),1);
 g.uvs.push(p[0]*.72+p[2]*.19,p[2]*.69+p[1]*.80);return id;
}
// New charts at bedding breaks and caps keep creases crisp while each face
// shares normals along its length. Babylon's upward-facing winding is clockwise.
function strip(g,left,right,color,tone=()=>1){
 const start=g.positions.length/3;
 for(let i=0;i<left.length;i++){
  vertex(g,left[i],color,tone(i,0));vertex(g,right[i],color,tone(i,1));
  if(i){const n=start+i*2;g.indices.push(n-2,n,n-1,n-1,n,n+1);}
 }
}
function cap(g,loop,center,color,shade=1){
 const middle=vertex(g,center,color,shade),start=g.positions.length/3;
 for(const p of loop)vertex(g,p,color,shade);
 for(let i=1;i<loop.length;i++)g.indices.push(middle,start+i-1,start+i);
}
function fracturedBlock(g,outline,height,seed,shade=1){
 // Each joint separates two closed masses. The sawtooth plan returns over
 // the crown as short, intersecting planes instead of concentric height bands.
 const count=outline.length,cx=outline.reduce((sum,p)=>sum+p[0],0)/count,cz=outline.reduce((sum,p)=>sum+p[1],0)/count;
 const crown=(x,z)=>height+(x-cx)*(.065+.091*Math.sin(seed))+(z-cz)*(.087*Math.cos(seed*.86)-.075);
 const heel=[],knee=[],edge=[],top=[];
 for(let i=0;i<count;i++){
  const [x,z]=outline[i],n=outline[(i+1)%count],prev=outline[(count+i-1)%count];
  const chipped=.035+.055*(.5+.5*Math.sin(seed+i*2.53));
  for(const q of [prev,n]){
   const ox=x+(q[0]-x)*chipped,oz=z+(q[1]-z)*chipped;
   const tip=.022+.105*(.5+.5*Math.sin(seed*2.3+i*1.8))**3;
   heel.push([ox,-.105,oz]);
   knee.push([cx+(ox-cx)*.995,height*(.32+.12*Math.sin(seed+i)),cz+(oz-cz)*.995]);
   edge.push([cx+(ox-cx)*.96,crown(ox,oz)-height*(tip+.055),cz+(oz-cz)*.96]);
   top.push([cx+(ox-cx)*(.96-tip),crown(ox,oz),cz+(oz-cz)*(.96-tip)]);
  }
 }
 for(const ring of [heel,knee,edge,top])ring.push(ring[0]);
 const tone=(i)=>shade*(.86+.075*Math.sin(Math.floor(i/2)*2.3+seed));
 strip(g,heel,knee,stone,i=>tone(i)*.80);strip(g,knee,edge,stone,tone);strip(g,edge,top,stone,i=>tone(i)*1.06);
 cap(g,top,[cx,height+.022,cz],stone,shade*1.015);
}
function stoneLedge(g){
 // Rear bed, exposed middle ledge, detached front blocks and fresh angular
 // talus. Paired outlines follow the same joint with a narrow open fissure.
 const masses=[
  [[[-2.04,-.83],[-1.74,-1.27],[-1.02,-1.40],[-.91,-.81],[-1.18,-.37],[-1.85,-.38]],1.20,4,.88],
  [[[-.96,-1.42],[-.12,-1.53],[.27,-1.29],[.19,-.80],[-.12,-.52],[-.39,-.56],[-.82,-.75]],1.56,7,.98],
  [[[.34,-1.29],[1.03,-1.38],[1.44,-1.09],[1.35,-.72],[1.01,-.43],[.49,-.42],[.24,-.71]],1.40,11,.95],
  [[[1.53,-1.04],[1.95,-.85],[2.06,-.46],[1.79,-.16],[1.44,-.29],[1.39,-.64]],1.04,27,.88],
  [[[-1.89,-.31],[-1.18,-.30],[-.99,-.48],[-.67,-.21],[-.81,.22],[-1.31,.52],[-2,.30]],.90,5,1.02],
  [[[-.91,-.56],[-.79,-.70],[-.39,-.48],[-.11,-.43],[.19,-.66],[.44,-.38],[.50,.07],[.20,.27],[-.56,.29],[-.72,.16],[-.61,-.21]],1.09,13,.89],
  [[[.52,-.35],[1.02,-.36],[1.34,-.56],[1.39,-.23],[1.72,-.10],[1.62,.34],[.96,.46],[.61,.27]],.95,17,1.01],
  [[[-1.98,.39],[-1.37,.60],[-1.00,.39],[-.88,.73],[-1.11,1.18],[-1.63,1.20],[-1.99,.88]],.54,19,.95],
  [[[-.96,.33],[-.69,.24],[-.57,.36],[.22,.34],[.46,.52],[.32,.91],[-.18,1.06],[-.64,.92]],.65,22,1.0],
  [[[.65,.36],[.98,.54],[1.56,.43],[1.77,.74],[1.49,1.02],[.88,1.10],[.58,.83]],.52,23,.85],
  [[[-.93,1.10],[-.68,1.01],[-.42,1.14],[-.51,1.39],[-.78,1.41]],.28,31,.90],
  [[[.64,1.18],[.94,1.22],[1.00,1.46],[.82,1.52],[.56,1.39]],.24,32,1.03],
  [[[1.78,.13],[2.06,-.09],[2.19,.17],[2.09,.41],[1.85,.45]],.36,35,.89]
 ];
 const bedding=[[-2.10,-.72],[-1.69,-1.33],[-.35,-1.52],[.83,-1.43],[1.68,-.95],[2.06,-.40],[1.88,.52],[1.51,1.04],[.83,1.28],[-.34,1.13],[-1.60,1.25],[-2.07,.73]];
 fracturedBlock(g,bedding,.23,39,.64);
 for(const [outline,height,seed,shade] of masses)fracturedBlock(g,outline,height,seed,shade);
 // Fallen chips collect against the toe, with the long axis of each chip in a
 // different direction. All are part of the same fixed source as the bed.
 for(let i=0;i<22;i++){
  const a=i*2.399,cx=1.94*Math.cos(a),cz=1.34*Math.sin(a),r=.065+.091*(.5+.5*Math.sin(i*15.2));
  const points=Array.from({length:5},(_,k)=>{const t=k*2*Math.PI/5+i*.94;return [cx+Math.cos(t)*r*1.5,cz+Math.sin(t)*r];});
  fracturedBlock(g,points,r*.67,i+47,.82+.17*Math.sin(i*1.2));
 }
}
function clayLenses(g){
 const count=30;
 // Tapered lenticular banks, split by a shallow erosion channel. The core
 // exposes warm alluvium beneath a lighter, dusty skin.
 for(const [cx,cz,rx,rz,height,seed] of [[-.39,-.34,1.64,1.02,1.02,2],[.43,.55,1.48,.65,.57,11],[-1.43,.80,.56,.46,.32,17],[1.44,-.46,.57,.69,.56,23]]){
  let prev;const exposed=[];
  for(const [scale,h,shade] of [[1,-.10,.68],[1.02,.12,.72],[.94,.31,.88],[.92,.37,1.08],[.83,.48,.86],[.79,.55,1.02],[.71,.76,.91],[.55,.88,1.08],[.28,.97,1.12]]){
   const row=[];
   for(let i=0;i<=count;i++){
    const a=i%count/count*2*Math.PI,wave=1+.073*Math.sin(3*a+seed)+.041*Math.sin(7*a-seed);
    const x=cx+Math.cos(a)*rx*scale*wave,z=cz+Math.sin(a)*rz*scale*wave;
    row.push([x,h*height+Math.max(0,h)*(.07*Math.sin(2*a+seed)+.07*Math.cos(a+1.1)),z]);
   }
   const damp=height>.9&&h<.33?[.39,.30,.23]:clay;
   if(prev)strip(g,prev,row,damp,i=>shade+.065*Math.sin(i*.71+seed));exposed.push(row);prev=row;
  }
  cap(g,prev,[cx,height,cz],clay,1.10);
  for(let k=0;k<9;k++){
   const i=(k*11+seed)%count,lo=2+k%3,hi=7+(k%2),left=[],right=[];
   for(let j=lo;j<=hi;j++){
    const p=exposed[j][i],q=exposed[j][i+1],t=.18+.13*Math.sin(k*2.1+j*2.32),w=(j===hi?.025:.036+.038*Math.sin(j*1.4+k));
    const at=f=>[cx+(p[0]+(q[0]-p[0])*f-cx)*1.008,p[1]+(q[1]-p[1])*f+.007,cz+(p[2]+(q[2]-p[2])*f-cz)*1.008];
    left.push(at(t));right.push(at(t+w));
   }
   strip(g,right,left,[.27,.16,.105],()=>.88);
  }
 }
}
const minerals=new Map();
export function mineralDepositGeometry(kind){
 if(!minerals.has(kind)){const g=data();if(kind==='stone')stoneLedge(g);else clayLenses(g);minerals.set(kind,g);}
 return minerals.get(kind);
}
export function mineralPitGeometry(site){
 const g=data(),rock=site.kind==='stone',depth=mineralDepth(site.kind),seed=site.x*.71+site.y*.37;
 const count=40,tint=rock?[.60,.53,.43]:[.61,.43,.32];
 // The outer ring exactly replaces a map cell. Unequal widths and wavering
 // bedding lines describe stepped cuts, with one lower shoulder for access.
 const profile=[[3,0,1],[2.82,.01,.95],[2.72,.12,.82],[2.68,.26,.84],[2.63,.28,1],[2.54,.30,.96],[2.50,.44,.80],[2.46,.54,.86],[2.38,.55,1],[2.31,.57,.91],[2.27,.75,.78],[2.21,.80,.88],[2.14,.82,.94],[2.08,1,.76]];
 const sections=[];let prev;
 for(let j=0;j<profile.length;j++){
  const [r,h,shade]=profile[j],row=[];
  for(let i=0;i<=count;i++){
   const a=(i%count)*2*Math.PI/count,c=Math.cos(a),s=Math.sin(a),solid=Math.max(Math.abs(c),Math.abs(s));
   const uneven=.045*Math.sin(5*a+seed)+.046*Math.sin(3*a-seed),square=j===0?1/solid:1/(solid**(rock?.65:.37));
   const shoulder=(1+Math.cos(a-.79))**6/64;
   // Shelves pinch out along different lengths of the face. Opposite
   // sections retain broken nodes where a slab or damp bank has slumped.
   const eroded=(.5+.5*Math.sin(2*a+seed*.31+Math.floor(j/4)*1.8))**1.1;
   const step=[3,4,5,7,8,9,11,12].includes(j)?eroded:0;
   const t=Math.max(0,(j-1)/(profile.length-2)),smoothR=2.83-.76*t;
   const ledge=r*(1-eroded)+smoothR*eroded;
   const radial=((j===0?r:ledge)+(j?uneven:0))*square;
   const relative=h*(1-eroded)+t*eroded;
   const y=j===0?0:j===profile.length-1?-depth:-depth*(relative+Math.sin(relative*Math.PI)*(.095*Math.sin(a*3+seed)-.17*shoulder+step*.043*Math.sin(j*1.8)));
   let x=radial*c,z=radial*s;
   const sx=site.extensionX||0,sz=site.extensionY||0;
   // Pull out the far lip and expose the long approach. Its fan narrows
   // toward the toe, while the source and its immediate bed stay unmoved.
   const along=Math.max(0,(sx*x+sz*z)/3),corridor=Math.max(0,sx*c+sz*s)**4;
   const extra=6*along**1.7*(1-.62*Math.min(1,-y/depth)*corridor);
   x+=sx*extra;z+=sz*extra;
   if(j>0&&site.bankDistance!==undefined){
    // Leave a continuous earthen bund on the water side. The outer apron
    // still reaches the original ground seam; the underlying seam stays put.
    const inset=.63+Math.min(1,-y/depth)*.15;
    const lift=Math.max(0,inset-site.bankDistance-x*site.landX-z*site.landZ);
    x+=lift*site.landX;z+=lift*site.landZ;
   }
   row.push([x,y,z]);
  }
  if(prev)strip(g,prev,row,tint,i=>(shade+.066*Math.sin(i*.79+seed)-.12*(1+Math.sin(i*.42+j*.31))*.5*h)*(1-.34*h));sections.push(row);prev=row;
 }
 cap(g,prev,[0,-depth,0],tint,.60);
 // Lay both wooden rails clear of every intermediate bench. The bed beneath
 // the toe, the bank at the head and the local pitch all follow this actual pit.
 const accessCandidates=[10,30,12,28,8,32,0,20];
 const score=i=>{
  const a=2*Math.PI*i/count,c=Math.cos(a),s=Math.sin(a);
  return Math.abs(c)*.3+Math.max(0,c*(site.extensionX||0)+s*(site.extensionY||0))*2-Math.min(0,c*(site.landX||0)+s*(site.landZ||0))*2;
 };
 const station=accessCandidates.reduce((best,i)=>score(i)<score(best)?i:best),lip=sections[1][station];
 const radius=Math.hypot(lip[0],lip[2]),dx=lip[0]/radius,dz=lip[2]/radius,top=.39;
 let toeRadius=Math.hypot(prev[station][0],prev[station][2])-.35;
 for(const section of sections.slice(2,-1)){
  const p=section[station],t=(top-p[1])/(top+depth);
  toeRadius=Math.min(toeRadius,radius+(Math.hypot(p[0],p[2])-.09-radius)/t);
 }
 g.ladder={toe:[dx*toeRadius,-depth+.035,dz*toeRadius],head:[lip[0],top,lip[2]],across:[-dz*.26,0,dx*.26]};
 // Short broken bedding joints or rain-scoured seams terminate at distinct
 // depths. Project them directly onto the sampled face so they follow a cut.
 for(let k=0;k<(rock?16:10);k++){
  const i=(k*13+8)%count,lo=2+(k*5)%6,hi=Math.min(profile.length-1,lo+2+k%4),a=[],b=[];
  for(let j=lo;j<=hi;j++){
   const p=sections[j][i],q=sections[j][i+1],u=.32+.19*Math.sin(k*2.7+j*.86);
   const w=(rock?.032:.055)*Math.sin(Math.PI*(j-lo+.23)/(hi-lo+.56));
   const at=f=>{const x=p[0]+(q[0]-p[0])*f,z=p[2]+(q[2]-p[2])*f;return [x*.998,p[1]+(q[1]-p[1])*f+.006,z*.998];};
   a.push(at(u-w));b.push(at(u+w));
  }
  strip(g,b,a,tint,()=>rock?.44:.54);
 }
 return g;
}

// Every shared river strip contains the half-tile boundaries. Look up each
// triangle by its centre; adjoining cells keep all of their original indices.
export function openMineralCells(grid,pits,tile){
 if(!pits.length)return grid.indices;
 const keys=new Set(),keep=[],p=grid.positions,idx=grid.indices;
 for(const pit of pits){keys.add(pit.x+','+pit.y);if(pit.extensionX||pit.extensionY)keys.add((pit.x+pit.extensionX)+','+(pit.y+pit.extensionY));}
 for(let i=0;i<idx.length;i+=3){
  const a=idx[i]*3,b=idx[i+1]*3,c=idx[i+2]*3;
  const x=Math.round((p[a]+p[b]+p[c])/(3*tile)),y=Math.round((p[a+2]+p[b+2]+p[c+2])/(3*tile));
  if(!keys.has(x+','+y))keep.push(idx[i],idx[i+1],idx[i+2]);
 }
 return keep;
}
