import {canalArm,WATER_HEIGHT} from './water.js';
import {visualSurfaceElevation,lakeDistance,lakeContours} from './lake-shore.js';
import {renderedShoreDistance} from './shore-profile.js';
const STEP=.24,OUTER=.9,INNER=.51,TILE=6,clamp=n=>Math.max(0,Math.min(1,n));
const empty=()=>({positions:[],indices:[],colors:[],uvs:[]});
const geometryCache=new WeakMap();
function surfaceSampler(s){
 const contours=lakeContours(s),samples=new Map();
 return (x,z)=>{const key=`${x},${z}`;let value=samples.get(key);if(!value){const X=x/TILE,Y=z/TILE;value={ground:visualSurfaceElevation(X,Y,s,contours),shore:renderedShoreDistance(X,Y,s,contours),lake:lakeDistance(X,Y,s,contours)};samples.set(key,value);}return value;};
}
export function canalArms(s,canals){return canals.flatMap(c=>(c.arms?.length?c.arms:[[1,0],[-1,0]]).map(([dx,dy])=>({...canalArm(s,c,dx,dy),wet:c.wet,progress:c.progress})));}
export function canalDistance(x,z,arms,wetOnly=false){let best=Infinity,arm=null,t=0;for(const a of arms){if(wetOnly&&!a.wet)continue;const dx=(a.b.x-a.a.x)*TILE,dz=(a.b.y-a.a.y)*TILE,q=clamp(((x-a.a.x*TILE)*dx+(z-a.a.y*TILE)*dz)/(dx*dx+dz*dz||1)),d=Math.hypot(x-a.a.x*TILE-q*dx,z-a.a.y*TILE-q*dz);if(d<best){best=d;arm=a;t=q;}}return {distance:best,arm,t};}
function clip(points,limit){const out=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],da=a.d-limit,db=b.d-limit;if(da<=0)out.push(a);if((da<0)!==(db<0)){const t=da/(da-db);out.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,d:limit});}}return out;}
function append(g,poly,sample,arms,water){if(poly.length<3)return;const index=g.positions.length/3;for(const p of poly){const near=canalDistance(p.x,p.z,arms),level=near.arm?.wet?WATER_HEIGHT+.006:.095,{ground,shore,lake}=sample(p.x,p.z),blend=clamp((near.distance-.43)/.44),ease=blend*blend*(3-2*blend),height=water?WATER_HEIGHT+.006:Math.min(ground+.018,level-.25+(ground+.018-level+.25)*ease);g.positions.push(p.x,height,p.z);g.uvs.push(p.x/3,p.z/3);if(water){g.colors.push(Math.max(.20,WATER_HEIGHT-ground),lake<0?1:0,clamp((shore+.16)/.16),1);}else{const tone=.76+.24*blend;g.colors.push(tone,tone,tone,1);}}for(let i=1;i<poly.length-1;i++)g.indices.push(index,index+i,index+i+1);}
// One union surface for all branches: no crossed arm walls, overlapping lids or
// square cut-outs at L/T/X junctions. Fine cells are allocated only near channels.
export function canalNetworkGeometry(s,canals){
 // Ground dunes depend on building positions, but never on their work counters.
 // Keep only one result per state; drawing and foreign construction remain pure.
 const signature=JSON.stringify([canals.map(c=>[c.x,c.y,c.wet,c.progress,c.arms]),s.world?.lakes,(s.buildings||[]).map(b=>[b.x,b.y])]),cached=geometryCache.get(s);
 if(cached?.signature===signature)return cached.result;
 const sample=surfaceSampler(s);
 const arms=canalArms(s,canals).filter(a=>a.progress>0),cells=new Map(),water=empty(),wetBed=empty(),dryBed=empty();
 for(const a of arms){const minX=Math.floor((Math.min(a.a.x,a.b.x)*TILE-OUTER)/STEP),maxX=Math.ceil((Math.max(a.a.x,a.b.x)*TILE+OUTER)/STEP),minZ=Math.floor((Math.min(a.a.y,a.b.y)*TILE-OUTER)/STEP),maxZ=Math.ceil((Math.max(a.a.y,a.b.y)*TILE+OUTER)/STEP);for(let x=minX;x<maxX;x++)for(let z=minZ;z<maxZ;z++){const key=`${x},${z}`,cell=cells.get(key)||{x,z,arms:[]};cell.arms.push(a);cells.set(key,cell);}}
 for(const {x,z,arms:local}of cells.values()){
  const p=[[x,z],[x,z+1],[x+1,z],[x+1,z+1]].map(([i,j])=>({x:i*STEP,z:j*STEP}));
  for(const ids of [[0,1,2],[2,1,3]]){const tri=ids.map(i=>({...p[i],d:canalDistance(p[i].x,p[i].z,local).distance})),poly=clip(tri,OUTER),center=poly.length&&canalDistance(poly[0].x,poly[0].z,local);if(poly.length)append(center.arm?.wet?wetBed:dryBed,poly,sample,local,false);
   const wet=ids.map(i=>({...p[i],d:canalDistance(p[i].x,p[i].z,local,true).distance}));append(water,clip(wet,INNER),sample,local,true);
  }
 }
 const result={water,wetBed,dryBed,arms};geometryCache.set(s,{signature,result});return result;
}
// Shore dressing must open too, otherwise its decorative rim seals a real inlet.
export function openCanalMouths(g,arms){const mouths=arms.filter(a=>a.mouth);for(let i=0;i<g.positions.length;i+=3){const p=g.positions,d=canalDistance(p[i],p[i+2],mouths);if(d.distance>1.5)continue;const blend=clamp((1.5-d.distance)/.6),h=(d.arm?.endHeight??WATER_HEIGHT)-.24;p[i+1]=Math.min(p[i+1],p[i+1]*(1-blend)+h*blend);if(g.colors)g.colors[i/3*4+3]*=1-blend;}return g;}
