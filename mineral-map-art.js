import {quarryFencePanels} from './game3d/quarry-fence.js';
import {workstationBuilding} from './game3d/workstations.js';
import {mineralDepositAngle,mineralDepositGeometry,mineralPitGeometry} from './game3d/mineral-excavation.js';

// One tile is 6 m in the city and 60 × 30 pixels in the unzoomed map.
const horizontal=5,vertical=2.5,heightScale=Math.sqrt(2*(horizontal**2-vertical**2));

function mineralFaces(mesh,angle,scale,bed){
 const {positions,indices,colors}=mesh,c=Math.cos(angle),s=Math.sin(angle),vertices=[];
 for(let i=0;i<positions.length;i+=3){
  const x=(positions[i]*c+positions[i+2]*s)*scale,z=(positions[i+2]*c-positions[i]*s)*scale,y=positions[i+1]*scale-bed;
  vertices.push({x,y,z,u:(x-z)*horizontal,v:(x+z)*vertical-y*heightScale,depth:x+z+y*2*vertical/heightScale});
 }
 const faces=[];
 for(let i=0;i<indices.length;i+=3){
  const a=vertices[indices[i]],b=vertices[indices[i+1]],d=vertices[indices[i+2]];
  const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,ex=d.x-a.x,ey=d.y-a.y,ez=d.z-a.z;
  const nx=dy*ez-dz*ey,ny=dz*ex-dx*ez,nz=dx*ey-dy*ex;
  const length=Math.hypot(nx,ny,nz);
  if(!length)continue;
  const sign=nx+ny*2*vertical/heightScale+nz<0?-1:1;
  const light=.63+.37*Math.max(0,sign*(-.5*nx+.81*ny-.29*nz)/length);
  const rgb=[0,1,2].map(channel=>{
   const linear=(colors[4*indices[i]+channel]+colors[4*indices[i+1]+channel]+colors[4*indices[i+2]+channel])*light/3;
   const display=linear<=.0031308?12.92*linear:1.055*Math.pow(linear,1/2.4)-.055;
   return Math.round(255*Math.max(0,Math.min(1,display)));
  });
  faces.push({a,b,d,depth:a.depth+b.depth+d.depth,color:`rgb(${rgb.join(',')})`});
 }
 return faces;
}

function paintMinerals(ctx,site,pit,size){
 const faces=pit?mineralFaces(mineralPitGeometry(pit),0,1,0):[];
 if(size>0)faces.push(...mineralFaces(mineralDepositGeometry(site.kind),mineralDepositAngle(site),size,pit?.depth||0));
 ctx.save();
 if(pit){
  const dx=(pit.extensionX||0)*6,dz=(pit.extensionY||0)*6;
  const x0=Math.min(0,dx)-3,x1=Math.max(0,dx)+3,z0=Math.min(0,dz)-3,z1=Math.max(0,dz)+3;
  ctx.beginPath();
  for(const [i,[x,z]] of [[x0,z0],[x1,z0],[x1,z1],[x0,z1]].entries()){
   const u=(x-z)*horizontal,v=(x+z)*vertical;
   if(i===0)ctx.moveTo(u,v);else ctx.lineTo(u,v);
  }
  ctx.closePath();ctx.clip();
 }
 for(const {a,b,d,color} of faces.sort((u,v)=>u.depth-v.depth)){
  ctx.beginPath();ctx.moveTo(a.u,a.v);ctx.lineTo(b.u,b.v);ctx.lineTo(d.u,d.v);ctx.closePath();
  ctx.fillStyle=color;ctx.fill();
 }
 ctx.restore();
}

export function drawMapMineral(r,site,pit,size){
 const cut=pit?[pit.depth,pit.extensionX||0,pit.extensionY||0,pit.bankDistance,pit.landX,pit.landZ].join('/'):'surface';
 const p=r.point(site.x,site.y);
 if(r.mineralSprites?.world!==r.state?.world||!r.mineralSprites)r.mineralSprites={world:r.state?.world,tiles:new Map()};
 const cache=r.mineralSprites.tiles,key=`${site.kind}/${site.x}/${site.y}`;
 let sprite=cache.get(key);
 if(!sprite||sprite.cut!==cut||sprite.size!==size){
  const canvas=r.createLayerCanvas?.()||(typeof document!=='undefined'?document.createElement('canvas'):null);
  const ctx=canvas?.getContext('2d');
  if(ctx){
   const dx=pit?.extensionX||0,dz=pit?.extensionY||0,u=(dx-dz)*30,v=(dx+dz)*15;
   const width=76+Math.abs(u),height=64+Math.abs(v),originX=38-Math.min(0,u),originY=32-Math.min(0,v);
   const resolution=3;
   canvas.width=width*resolution;canvas.height=height*resolution;
   ctx.setTransform(resolution,0,0,resolution,originX*resolution,originY*resolution);
   paintMinerals(ctx,site,pit,size);sprite={canvas,cut,size,width,height,originX,originY};cache.set(key,sprite);
  }else{
   r.ctx.save();r.ctx.translate(p.x,p.y);r.ctx.scale(r.s,r.s);paintMinerals(r.ctx,site,pit,size);r.ctx.restore();return;
  }
 }
 r.ctx.drawImage(sprite.canvas,p.x-sprite.originX*r.s,p.y-sprite.originY*r.s,sprite.width*r.s,sprite.height*r.s);
}

const fenceDrawings=new WeakMap();
export function mapQuarryFence(r,b,state){
 if(!['clay','quarry'].includes(b.type)||b.construction?.kind==='new')return null;
 const oriented=workstationBuilding({...b,rotation:0},state),corner=(oriented.workCorner||[1,1]).join(',');
 let saved=fenceDrawings.get(b);
 if(!saved||saved.corner!==corner||saved.world!==state.world){
  saved={corner,world:state.world,panels:quarryFencePanels(oriented,state)};fenceDrawings.set(b,saved);
 }
 return front=>{
  const q=r.s;
  for(const {a,b:end,side} of saved.panels){
   if((side===1||side===2)!==front)continue;
   const from=r.point(b.x+a.x/6,b.y+a.z/6,a.y*7),to=r.point(b.x+end.x/6,b.y+end.z/6,end.y*7);
   const height=5.5*q,steps=Math.max(2,Math.round(Math.hypot(a.x-end.x,a.z-end.z)*2.8));
   r.polygon([[from.x,from.y],[to.x,to.y],[to.x,to.y-height],[from.x,from.y-height]],front?'#a8895a':'#95754a');
   for(let i=0;i<=steps;i++){
    const t=i/steps,x=from.x+(to.x-from.x)*t,y=from.y+(to.y-from.y)*t;
    r.line([[x,y],[x+.12*q,y-height-(i===0?1.5:.48*Math.sin(i*3.9+side))*q]],i===0?'#695137':'#c3a877',q*(i===0?1.05:.55));
   }
   for(const h of [.32,.72])r.line([[from.x,from.y-height*h],[to.x,to.y-height*h]],'#78603e',.7*q);
  }
 };
}
