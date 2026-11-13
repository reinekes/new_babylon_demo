import {extractionOwner} from '../extraction-courts.js';
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
// Bounded proxies of the visible clumps, not a nearest-resource search. Call only
// after direct resident/building hits, and never while placing construction.
export function pickResourceDeposit(state,ray,{maxDistance=Infinity}={}){
 if(!finiteVector(ray?.origin)||!finiteVector(ray?.direction)||Number.isNaN(maxDistance)||maxDistance<0)return null;const norm=Math.hypot(ray.direction.x,ray.direction.y,ray.direction.z);if(!norm)return null;const direction={x:ray.direction.x/norm,y:ray.direction.y/norm,z:ray.direction.z/norm};let nearest=Math.min(maxDistance,Number.isFinite(ray.length)?Math.max(0,ray.length):Infinity),selected=null;
 for(const d of state?.world?.deposits||[]){
  if(!['clay','reed','stone'].includes(d.kind)||terrain(d.x,d.y,state)==='water'||extractionOwner(state,d)||!sceneryClear(state,d,.12))continue;
  const reed=d.kind==='reed',base=surfaceElevation(d.x,d.y,state),x=d.x*TILE,z=d.y*TILE;
  if(boxDistance(ray.origin,direction,{x:x-2.3,y:base-.6,z:z-2.3},{x:x+2.3,y:base+(reed?2.5:1),z:z+2.3},nearest)===null)continue;
  for(const [i,p]of resourceDisplayLayout(d).entries()){
   if(!sceneryClear(state,p,.05))continue;let rx,rz,bottom,top;
   if(reed){const seed=d.x*73+d.y*11+i,scale=.75+random(seed,53)*.55,variant=Math.floor(random(seed,61)*3),angle=random(seed,37)*Math.PI*2,[bx,bz]=REED_BOUNDS[variant],c=Math.abs(Math.cos(angle)),a=Math.abs(Math.sin(angle));rx=(bx*c+bz*a)*scale;rz=(bx*a+bz*c)*scale;bottom=visualSurfaceElevation(p.x,p.y,state);top=bottom+Math.max(1.8*scale,1.25+p.size*.38);}
   else{const c=Math.abs(Math.cos(p.angle)),a=Math.abs(Math.sin(p.angle));rx=(.56*c+.51*a)*p.size;rz=(.56*a+.51*c)*p.size;const ground=surfaceElevation(p.x,p.y,state);bottom=ground-.13*p.size;top=ground+.51*p.size;}
   const distance=boxDistance(ray.origin,direction,{x:p.x*TILE-rx,y:bottom,z:p.y*TILE-rz},{x:p.x*TILE+rx,y:top,z:p.y*TILE+rz},nearest);
   if(distance!==null&&(distance<nearest||selected===null)){nearest=distance;selected={x:d.x,y:d.y};}
  }
 }
 return selected;
}
