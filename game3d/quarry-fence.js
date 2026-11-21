import {footprintSize} from '../footprints.js';
import {foundationWorldPoint} from './building-foundations.js';
import {renderedShoreDistance,visualSurfaceElevation} from './shore-profile.js';
import {mineralExcavations,mineralPitGeometry} from './mineral-excavation.js';
import {lakeContours} from './lake-shore.js';

// Local metres around the whole holding. Both runs stop short of the street
// corner so a worker can approach any of the four deposits with a full basket.
export function quarryFencePanels(b,state,contours=lakeContours(state)){
 if(!['clay','quarry'].includes(b.type)||b.construction?.kind==='new')return [];
 const size=footprintSize(b),center=(size-1)*3,rim=size*3-.18;
 const [sx,sz]=b.workCorner||[1,1],gate=size===2?2.92:1.73;
 const sides=[[[-1,-1],[1,-1]],[[1,-1],[1,1]],[[1,1],[-1,1]],[[-1,1],[-1,-1]]];
 const angle=(b.rotation||0)*Math.PI/2,cos=Math.cos(angle),sin=Math.sin(angle);
 const cuts=mineralExcavations(state,[b]);
 const landings=cuts.map(site=>{
  const [x,,z]=mineralPitGeometry(site).ladder.head;
  const dx=(site.x-b.x)*6+x-center,dz=(site.y-b.y)*6+z-center;
  return {x:center+dx*cos-dz*sin,z:center+dx*sin+dz*cos};
 });
 const panels=[];
 for(const [side,[start,end]] of sides.entries()){
  const x0=center+rim*start[0],z0=center+rim*start[1],dx=(end[0]-start[0])/2,dz=(end[1]-start[1])/2;
  const beginsAtPort=start[0]===sx&&start[1]===sz,endsAtPort=end[0]===sx&&end[1]===sz;
  let opening=gate;
  if(size===2&&(beginsAtPort||endsAtPort)){
   // A long leg from the corner to a near-side deposit grazes the last post.
   // Keep clearance for a full basket along every legal 0.31-tile work stance.
   const sign=beginsAtPort?1:-1,px=center+sx*size*3,pz=center+sz*size*3;
   for(const site of cuts)for(let i=0;i<8;i++){
    const gx=(site.x-b.x+.31*Math.cos(i*Math.PI/4))*6-center,gz=(site.y-b.y+.31*Math.sin(i*Math.PI/4))*6-center;
    const x=center+gx*cos-gz*sin-px,z=center+gx*sin+gz*cos-pz;
    const along=sign*(x*dx+z*dz),inward=Math.abs(x*dz-z*dx);
    if(along>0&&inward>0)opening=Math.max(opening,(.18*along+.42*Math.hypot(along,inward))/inward-.18);
   }
  }
  const from=beginsAtPort?opening:0,to=2*rim-(endsAtPort?opening:0);
  let runs=[[from,to]];
  // Leave room to step off a ladder when its head lands on an outer lip.
  for(const p of landings){
   const u=(p.x-x0)*dx+(p.z-z0)*dz;
   if(Math.abs((p.x-x0)*dz-(p.z-z0)*dx)>.95)continue;
   runs=runs.flatMap(([lo,hi])=>[[lo,Math.min(hi,u-.77)],[Math.max(lo,u+.77),hi]].filter(([left,right])=>right-left>.22));
  }
  function at(along){
   const x=x0+dx*along,z=z0+dz*along,p=foundationWorldPoint(b,x,z);
   return {x,z,y:visualSurfaceElevation(p.x,p.y,state,contours),dry:renderedShoreDistance(p.x,p.y,state,contours)>.035};
  }
  for(const [left,right] of runs){
   const bays=Math.ceil((right-left)/1.58);let a=at(left);
   for(let i=1;i<=bays;i++){
    const lo=left+(right-left)*(i-1)/bays,hi=left+(right-left)*i/bays,b=at(hi);
    if(a.dry&&b.dry)panels.push({a,b,side});
    else if(a.dry!==b.dry){
     let dry=a.dry?lo:hi,wet=a.dry?hi:lo;
     for(let j=0;j<7;j++){const mid=(dry+wet)/2;if(at(mid).dry)dry=mid;else wet=mid;}
     const shore=at(dry);
     if(Math.abs(dry-(a.dry?lo:hi))>.22)panels.push(a.dry?{a,b:shore,side}:{a:shore,b,side});
    }
    a=b;
   }
  }
 }
 return panels;
}

export function createQuarryFence(B,scene,panels,material){
 if(!panels.length)return null;
 const positions=[],uvs=[],colors=[],indices=[],normals=[];
 const vec=(x,y,z)=>new B.Vector3(x,y,z);
 // Cane and bindings share one opaque mesh and the city's existing reed finish.
 function cane(a,b,r,tip,tint,sides=5){
  const origin=vec(...a),end=vec(...b),d=end.subtract(origin).normalize(),u=B.Vector3.Cross(d,Math.abs(d.y)>.8?B.Axis.Z:B.Axis.Y).normalize(),v=B.Vector3.Cross(d,u);
  const base=positions.length/3;
  for(let j=0;j<2;j++)for(let k=0;k<sides;k++){
   const t=k*2*Math.PI/sides,radius=j?tip:r,p=j?end:origin;
   const x=radius*Math.cos(t),y=radius*Math.sin(t);
   positions.push(p.x+u.x*x+v.x*y,p.y+u.y*x+v.y*y,p.z+u.z*x+v.z*y);
   uvs.push(k/sides*.17,j*.82);const shade=j?1:.75;
   colors.push(tint[0]*shade,tint[1]*shade,tint[2]*shade,1);
  }
  for(let i=0;i<sides;i++){const m=base+i,n=base+(i+1)%sides;indices.push(m,m+sides,n,n,m+sides,n+sides);}
  for(let i=1;i<sides-1;i++)indices.push(base+sides,base+sides+i+1,base+sides+i);
 }
 const posts=new Set(),bindings=[.48,.36,.24],upright=[.76,.59,.42];
 for(const [index,{a,b}] of panels.entries()){
  const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),nx=-dz/length,nz=dx/length;
  const count=Math.max(2,Math.round(length/.115)),phase=index*2.4;
  for(let k=0;k<count;k++){
   const t=(k+.5)/count,wave=Math.sin(k*5.1+phase),x=a.x+dx*t,z=a.z+dz*t,y=a.y+(b.y-a.y)*t;
   const lean=.025*Math.sin(phase+2.8*t)+.013*wave,height=.82+.041*Math.sin(phase+t*3.9)+.053*wave;
   const shade=1.14+.19*Math.sin(k*1.81+phase),width=.044+.006*wave;
   cane([x,y-.085,z],[x+(dx/length)*lean+nx*.026,y+height,z+(dz/length)*lean+nz*.026],width,width*.76,[shade,shade*.99,shade*.86],4);
  }
  for(const h of [.27,.625]){
   cane([a.x+nx*.055,a.y+h,a.z+nz*.055],[b.x+nx*.055,b.y+h,b.z+nz*.055],.030,.027,bindings);
   cane([a.x-nx*.050,a.y+h+.015,a.z-nz*.050],[b.x-nx*.050,b.y+h+.015,b.z-nz*.050],.021,.020,bindings);
  }
  for(const p of [a,b]){
   const key=p.x.toFixed(3)+','+p.z.toFixed(3);if(posts.has(key))continue;posts.add(key);
   const top=.96+.043*Math.sin(p.x*2.7+p.z*4.3);
   cane([p.x,p.y-.095,p.z],[p.x,p.y+top,p.z],.068,.057,upright,6);
   for(const h of [.27,.625])cane([p.x,p.y+h-.029,p.z],[p.x,p.y+h+.039,p.z],.077,.076,bindings,6);
  }
 }
 const mesh=new B.Mesh('bound-reed-quarry-fence',scene),data=new B.VertexData();
 B.VertexData.ComputeNormals(positions,indices,normals);Object.assign(data,{positions,indices,uvs,colors,normals});data.applyToMesh(mesh);mesh.material=material;
 return mesh;
}
