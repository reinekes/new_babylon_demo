import {extractionOwner} from '../extraction-courts.js';
import {mineralDepositGeometry,mineralDepositAngle} from './mineral-excavation.js';
import {extractionStockFraction} from '../extraction-stock.js';
import {terrain} from '../world.js';
import {TILE,surfaceElevation} from '../district3d/terrain.js';
import {visualSurfaceElevation} from './lake-shore.js';
import {sceneryClear} from './nature.js';
import {resourceDisplayLayout} from './nature-details.js';
const random=(x,y)=>{const n=Math.sin(x*127.1+y*311.7+73129)*43758.5453;return n-Math.floor(n);};
// Measured baked bounds from the three shipped valley-reed GLBs. Their node
// hierarchy contains no additional scale; valleyVegetationPlan supplies it.
const REED_BOUNDS=[[.36430428,.34432592],[.45892704,.38188655],[.46566234,.41786274]];
const finiteVector=v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z);
function boxDistance(origin,direction,min,max,limit){let near=0,far=limit;for(const axis of ['x','y','z']){const delta=direction[axis];if(Math.abs(delta)<1e-12){if(origin[axis]<min[axis]||origin[axis]>max[axis])return null;continue;}let a=(min[axis]-origin[axis])/delta,b=(max[axis]-origin[axis])/delta;if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return null;}return near;}
// Test the triangles of the shared outcrop. Transform the ray once; its
// parameter remains a world-space distance even after stock scaling.
function mineralHit(d,state,origin,direction,limit,base){
 const scale=Math.cbrt(extractionStockFraction(state,d));if(scale<=1e-6)return null;
 const angle=mineralDepositAngle(d),c=Math.cos(angle),s=Math.sin(angle);
 const local=(x,y,z)=>[(c*x-s*z)/scale,y/scale,(s*x+c*z)/scale];
 const o=local(origin.x-d.x*TILE,origin.y-base,origin.z-d.y*TILE),v=local(direction.x,direction.y,direction.z);
 const {positions:p,indices}=mineralDepositGeometry(d.kind);let nearest=null;
 for(let i=0;i<indices.length;i+=3){
  const a=3*indices[i],b=3*indices[i+1],f=3*indices[i+2];
  const ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2],wx=p[f]-p[a],wy=p[f+1]-p[a+1],wz=p[f+2]-p[a+2];
  const hx=v[1]*wz-v[2]*wy,hy=v[2]*wx-v[0]*wz,hz=v[0]*wy-v[1]*wx,det=ux*hx+uy*hy+uz*hz;
  if(Math.abs(det)<1e-9)continue;
  const tx=o[0]-p[a],ty=o[1]-p[a+1],tz=o[2]-p[a+2],u=(tx*hx+ty*hy+tz*hz)/det;if(u<0||u>1)continue;
  const qx=ty*uz-tz*uy,qy=tz*ux-tx*uz,qz=tx*uy-ty*ux,w=(v[0]*qx+v[1]*qy+v[2]*qz)/det;if(w<0||u+w>1)continue;
  const distance=(wx*qx+wy*qy+wz*qz)/det;if(distance>=0&&distance<=limit&&(nearest===null||distance<nearest))nearest=distance;
 }
 return nearest;
}
// Bounded proxies of the visible clumps, not a nearest-resource search. Call only
// after direct resident/building hits, and never while placing construction.
export function pickResourceDeposit(state,ray,{maxDistance=Infinity}={}){
 if(!finiteVector(ray?.origin)||!finiteVector(ray?.direction)||Number.isNaN(maxDistance)||maxDistance<0)return null;const norm=Math.hypot(ray.direction.x,ray.direction.y,ray.direction.z);if(!norm)return null;const direction={x:ray.direction.x/norm,y:ray.direction.y/norm,z:ray.direction.z/norm};let nearest=Math.min(maxDistance,Number.isFinite(ray.length)?Math.max(0,ray.length):Infinity),selected=null;
 for(const d of state?.world?.deposits||[]){
  if(!['clay','reed','stone'].includes(d.kind)||terrain(d.x,d.y,state)==='water'||extractionOwner(state,d)||!sceneryClear(state,d,.12))continue;
  const reed=d.kind==='reed',base=surfaceElevation(d.x,d.y,state),x=d.x*TILE,z=d.y*TILE;
  if(boxDistance(ray.origin,direction,{x:x-2.7,y:base-.6,z:z-2.7},{x:x+2.7,y:base+(reed?2.5:1.7),z:z+2.7},nearest)===null)continue;
  if(!reed){
   const distance=mineralHit(d,state,ray.origin,direction,nearest,base);
   if(distance!==null){nearest=distance;selected={x:d.x,y:d.y};}continue;
  }
  for(const [i,p]of resourceDisplayLayout(d).entries()){
   if(!sceneryClear(state,p,.05))continue;
   const seed=d.x*73+d.y*11+i,scale=.75+random(seed,53)*.55,variant=Math.floor(random(seed,61)*3),angle=random(seed,37)*Math.PI*2,[bx,bz]=REED_BOUNDS[variant],c=Math.abs(Math.cos(angle)),a=Math.abs(Math.sin(angle));
   const rx=(bx*c+bz*a)*scale,rz=(bx*a+bz*c)*scale,bottom=visualSurfaceElevation(p.x,p.y,state),top=bottom+Math.max(1.8*scale,1.25+p.size*.38);
   const distance=boxDistance(ray.origin,direction,{x:p.x*TILE-rx,y:bottom,z:p.y*TILE-rz},{x:p.x*TILE+rx,y:top,z:p.y*TILE+rz},nearest);
   if(distance!==null&&(distance<nearest||selected===null)){nearest=distance;selected={x:d.x,y:d.y};}
  }
 }
 return selected;
}
