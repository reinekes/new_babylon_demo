import {footpathRibbonPoint,footpathRibbonTangent} from '../footpaths.js';
import {navigationSegmentClear,obstacleIndex} from '../navigation.js';
import {createAlluvialWaterMaterial} from './alluvial-water.js';
import {worldWidth,worldHeight,riverLength,riverPoint,riverAxis,terrain,isDryPoint,onBridge} from '../world.js';
import {shoreDistance,surfaceElevation,TILE} from '../district3d/terrain.js';

import {organicLakeGeometry,visualSurfaceElevation} from './lake-shore.js';
import {renderedShoreDistance,RIVER_HALF_WIDTH} from './shore-profile.js';
import {riverRows} from '../district3d/river-profile.js';

export const WATER_HEIGHT=-.18;
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const noise=(x,y)=>{const n=Math.sin(x*127.1+y*311.7+73129)*43758.5453;return n-Math.floor(n);};
export function waterDepth(x,y,s){return Math.max(0,WATER_HEIGHT-visualSurfaceElevation(x,y,s));}
const sheet=()=>({positions:[],indices:[],colors:[],uvs:[],points:[],depths:[]});
function vertex(g,x,y,s,lake){const d=waterDepth(x,y,s);g.positions.push(x*TILE,WATER_HEIGHT,y*TILE);g.points.push({x,y});g.depths.push(d);g.colors.push(d,lake?1:0,0,1);g.uvs.push(x,y);}
export function waterSurfaceGeometry(s){
 const flow=sheet(),lakes=sheet(),across=24,rows=riverRows(true,s);
 // The shallow edge reaches the actual intersection of the terrain and water,
 // beyond the old uniform strip. Adjacent rows share all cross-section vertices.
 for(let j=0;j<rows.length;j++){const along=rows[j];for(let i=0;i<=across;i++){const p=riverPoint(along,s,(i/across*2-1)*RIVER_HALF_WIDTH);vertex(flow,p.x,p.y,s,false);if(i<across&&j<rows.length-1){const a=j*(across+1)+i;flow.indices.push(a,a+across+1,a+1,a+1,a+across+1,a+across+2);}}}
 if(riverAxis(s)==='x')for(let i=0;i<flow.indices.length;i+=3)[flow.indices[i+1],flow.indices[i+2]]=[flow.indices[i+2],flow.indices[i+1]];
 const organic=organicLakeGeometry(s,WATER_HEIGHT);Object.assign(lakes,organic);
 return {river:flow,lakes};
}
// Real connected canals meet the submerged river bank instead of ending at the
// abstract half-cell boundary. Construction and disconnected channels stay dry.
export function canalArm(s,c,dx,dy){
 const a={x:c.x,y:c.y};let length=.5*c.progress,mouth=false;
 if(c.wet&&terrain(c.x+dx,c.y+dy,s)==='water'){
  mouth=true;
  // Continue far enough that the inlet visibly overlaps the continuous surface.
  // The scan is bounded to the one real neighbouring water cell.
  length=.5;while(length<1.3&&renderedShoreDistance(c.x+dx*length,c.y+dy*length,s)>-.12)length+=.025;
  length=Math.min(1.3,length+.08);
 }
 const b={x:c.x+dx*length,y:c.y+dy*length};
 return {a,b,mouth,startHeight:c.wet?WATER_HEIGHT+.006:.095,endHeight:c.wet?WATER_HEIGHT+.006:.095};
}

export function canalSection(s,arm,t){
 const dx=arm.b.x-arm.a.x,dy=arm.b.y-arm.a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len,x=arm.a.x+dx*t,y=arm.a.y+dy*t,height=arm.startHeight+(arm.endHeight-arm.startHeight)*t,halfWidth=.68+(arm.mouth?.12*t*t:0);
 const banks=[-1,-.65,.65,1].map(side=>{const X=x*TILE+nx*side*halfWidth,Z=y*TILE+ny*side*halfWidth,ground=visualSurfaceElevation(X/TILE,Z/TILE,s),d=renderedShoreDistance(X/TILE,Z/TILE,s);
  // The bank dissolves into the natural submerged bed. Never keep a raised tan
  // lip at the river surface or broaden it into an artificial delta/fan.
  const blend=clamp((.24-d)/.28),smooth=blend*blend*(3-2*blend),dryRim=Math.max(height+.015,ground+.012),wetRim=Math.min(height-.065,ground+.012),rim=dryRim*(1-smooth)+wetRim*smooth;
  return {x:X,z:Z,height:Math.abs(side)>.9?rim:Math.min(height-.17,ground+.012)};
 });
 return {x,y,height,halfWidth,nx,ny,banks};
}
export function submergedPebbles(s){
 const result=[],put=(x,y,i,riverStone)=>{if(waterDepth(x,y,s)<=.14)return;const size=.065+Math.pow(noise(i,41),1.6)*.235;result.push({x,y,size,tone:Math.floor(noise(i,71)*3),angle:noise(i,32)*Math.PI*2,flat:.07+noise(i,84)*.10,river:riverStone});};
 // Sparse deterministic clusters with gaps, varying offsets and several muted
 // stone colours; no alternating rows or equal spacing along the banks.
 for(let j=0;j<46;j++){if(noise(j,16)>.66)continue;const cy=(j+noise(j,12))/46*riverLength(s),side=noise(j,22)<.5?-1:1,count=1+Math.floor(noise(j,31)*5);
  for(let k=0;k<count;k++){const id=j*11+k,along=clamp(cy+(noise(id,18)-.5)*1.5,0,riverLength(s)-.01),p=riverPoint(along,s,side*(.25+noise(id,25)*.7));put(p.x,p.y,id,true);}
 }
 for(const lake of s.world?.lakes||[])for(const c of lake.cells){if(noise(c.x,c.y)>.58)continue;for(let k=0;k<1+Math.floor(noise(c.y,c.x)*3);k++){const id=10000+c.y*100+c.x*3+k;put(c.x+(noise(id,1)-.5)*.76,c.y+(noise(id,2)-.5)*.76,id,false);}}
 return result;
}

function dryClearance(s,a,b,index){
 return isDryPoint(s,a.x,a.y)&&isDryPoint(s,b.x,b.y)&&navigationSegmentClear(s,a,b,index);
}
function safeFraction(clear){
 if(clear(1))return 1;
 let lo=0,hi=1;
 for(let i=0;i<7;i++){const mid=(lo+hi)/2;if(clear(mid))lo=mid;else hi=mid;}
 return lo;
}
function shoulderPoint(row,side,t){
 const d=row.reach*side*t;
 return {x:row.p.x+row.nx*d,y:row.p.y+row.nz*d};
}

export function wornRoadGeometry(s,a,b,width=1.12,height=.04,level=1,segmentsPerMeter=2,control=null,obstacles=obstacleIndex(s.buildings||[]),progress=1){
 const dx=(b.x-a.x)*TILE,dz=(b.y-a.y)*TILE,len=Math.hypot(dx,dz),steps=Math.max(6,Math.ceil(len*segmentsPerMeter*progress)),fractions=[-1,-.82,-.48,0,.48,.82,1],origin={x:(a.x+b.x)*TILE/2,z:(a.y+b.y)*TILE/2};
 const g={positions:[],indices:[],uvs:[],colors:[],centers:[],widths:[],origin};
 const rows=[];
 if(!len||progress<=0||!isDryPoint(s,a.x,a.y)||!isDryPoint(s,b.x,b.y)||onBridge(s.buildings||[],origin.x/TILE,origin.z/TILE,s)||!navigationSegmentClear(s,a,b,obstacles))return g;
 for(let j=0;j<=steps;j++){
  const t=j/steps*progress,p=footpathRibbonPoint(a,b,control,t);
  const {x:vx,y:vz}=footpathRibbonTangent(a,b,control,t);
  const tangent=Math.hypot(vx,vz)||1,nx=-vz/tangent,nz=vx/tangent;
  const x=p.x*TILE,z=p.y*TILE;
  g.centers.push({x,y:z});
  const half=width*.5*(.98+.035*Math.sin(x*.7+z*.34)+.022*Math.sin(x*1.03-z*.58)),reach=half*1.045/TILE;
  const row={t,p,x,z,nx,nz,half,reach,trimLeft:1,trimRight:1};
  for(const side of [-1,1]){
   const key=side<0?'left':'right';
   row[key]=safeFraction(k=>dryClearance(s,p,shoulderPoint(row,side,k),obstacles));
  }
  rows.push(row);
 }
 // The outer edge between two legal samples can still nick a courtyard corner.
 // Limit the whole span, sharing the most restrictive width at each junction.
 for(let j=1;j<=steps;j++){
  const a=rows[j-1],b=rows[j];
  for(const side of [-1,1]){
   const key=side<0?'left':'right';
   const scale=safeFraction(k=>dryClearance(s,shoulderPoint(a,side,a[key]*k),shoulderPoint(b,side,b[key]*k),obstacles));
   const trim=side<0?'trimLeft':'trimRight';
   a[trim]=Math.min(a[trim],scale);b[trim]=Math.min(b[trim],scale);
  }
 }
 for(let j=0;j<=steps;j++){
  const row=rows[j],{t,x,z,nx,nz,half}=row;
  const left=row.left*row.trimLeft,right=row.right*row.trimRight;
  g.widths.push(half*(left+right));
  for(let k=0;k<fractions.length;k++){
   // Sample shoulders in world coordinates so the same junction has identical
   // vertices even when a saved segment was laid in the opposite direction.
   const side=fractions[k],offset=side*half*(side<0?left:right),fray=Math.abs(side)>.8?1+(noise(x+nx*offset,z+nz*offset)-.5)*.09:1;
   const X=x+nx*offset*fray,Z=z+nz*offset*fray;
   // Gently crowned paving and shoulders of compacted earth meet the original
   // elevation at every endpoint, including at street and footpath junctions.
   const crown=Math.sin(Math.PI*t)*(1-Math.abs(side))*(level>=3?.022:.012);
   g.positions.push(X-origin.x,Math.max(height,surfaceElevation(X/TILE,Z/TILE,s)+height)+crown,Z-origin.z);g.uvs.push(X/3,Z/3);
   const margin=Math.abs(side),alpha=margin===1?0:margin>.8?.32:.84+.12*noise(X,Z);
   const wear=level===1 ? .14*Math.exp(-side*side*5)-.12*Math.exp(-((margin-.48)**2)/.015) : 0;
   const v=.88+wear+.09*noise(X*2,Z*2);
   g.colors.push(v*1.025,v,v*.955,alpha);
   if(j<steps&&k<fractions.length-1){const i=j*fractions.length+k;g.indices.push(i,i+fractions.length,i+1,i+1,i+fractions.length,i+fractions.length+1);}
  }
 }
 return g;
}

export function createGameWater(B,scene,materials){
 const meshes=[],owned=[];let signature='',disposed=false;
 const surface=createAlluvialWaterMaterial(B,scene,'clear-flowing-water'),water=surface.material;
 const stones=['#8d8e78','#a49e86','#777d73'].map((hex,i)=>{const m=new B.PBRMaterial(`submerged-rounded-pebbles-${i}`,scene);m.albedoColor=B.Color3.FromHexString(hex).toLinearSpace();m.roughness=.85;m.metallic=0;owned.push(m);return m;});
 function geometry(name,g,mat){if(!g.indices.length)return;const m=new B.Mesh(name,scene),d=new B.VertexData();d.positions=g.positions.slice();d.indices=g.indices.slice();d.uvs=g.uvs;d.colors=g.colors;
  d.normals=[];B.VertexData.ComputeNormals(d.positions,d.indices,d.normals);if(d.normals[1]<0){for(let i=0;i<d.indices.length;i+=3)[d.indices[i+1],d.indices[i+2]]=[d.indices[i+2],d.indices[i+1]];B.VertexData.ComputeNormals(d.positions,d.indices,d.normals);}d.applyToMesh(m);m.material=mat;m.isPickable=false;m.receiveShadows=false;m.useVertexColors=true;m.freezeWorldMatrix();meshes.push(m);return m;
 }
 function update(s,t=0){if(disposed)return;surface.update(s,t);const next=JSON.stringify([worldWidth(s),worldHeight(s),s.world?.river,s.world?.lakes||[]]);if(next===signature)return;signature=next;for(const m of meshes)m.dispose();meshes.length=0;
  // The terrain owner already carves the river and lake bed. A second opaque
  // ribbon intersects its differently triangulated slope, producing dark shards.
  const g=waterSurfaceGeometry(s);geometry('clear-living-river',g.river,water);geometry('clear-saved-lakes',g.lakes,water);
  const sources=stones.map((mat,i)=>{const m=B.MeshBuilder.CreateIcoSphere(`submerged-pebble-source-${i}`,{radius:1,subdivisions:i%2+1},scene);m.material=mat;m.isPickable=false;m.setEnabled(false);meshes.push(m);return m;});
  for(const [i,p]of submergedPebbles(s).entries()){const m=sources[p.tone].createInstance(`submerged-pebble-${i}`);m.setEnabled(true);m.position.set(p.x*TILE,visualSurfaceElevation(p.x,p.y,s)+p.flat*.6,p.y*TILE);m.scaling.set(p.size,p.flat,p.size*(.65+noise(i,94)*.5));m.rotation.set(noise(i,61)*.2,p.angle,noise(i,62)*.2);m.isPickable=false;m.computeWorldMatrix(true);m.freezeWorldMatrix();meshes.push(m);}

 }
 return {meshes,material:water,update,light(n){water.setFloat('night',n);},dispose(){if(disposed)return;disposed=true;for(const m of meshes)m.dispose();meshes.length=0;surface.dispose();for(const m of owned)m.dispose(false,false);}};
}
