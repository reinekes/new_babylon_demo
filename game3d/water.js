import {WIDTH,HEIGHT,river,terrain} from '../world.js';
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
 const flow=sheet(),lakes=sheet(),across=24,rows=riverRows(true);
 // The shallow edge reaches the actual intersection of the terrain and water,
 // beyond the old uniform strip. Adjacent rows share all cross-section vertices.
 for(let j=0;j<rows.length;j++){const y=rows[j],c=river(y);for(let i=0;i<=across;i++){const x=c+(i/across*2-1)*RIVER_HALF_WIDTH;vertex(flow,x,y,s,false);if(i<across&&j<rows.length-1){const a=j*(across+1)+i;flow.indices.push(a,a+across+1,a+1,a+1,a+across+1,a+across+2);}}}
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
 for(let j=0;j<46;j++){if(noise(j,16)>.66)continue;const cy=(j+noise(j,12))/46*HEIGHT,side=noise(j,22)<.5?-1:1,count=1+Math.floor(noise(j,31)*5);
  for(let k=0;k<count;k++){const id=j*11+k,y=clamp(cy+(noise(id,18)-.5)*1.5,0,HEIGHT-.01),x=river(y)+side*(.25+noise(id,25)*.7);put(x,y,id,true);}
 }
 for(const lake of s.world?.lakes||[])for(const c of lake.cells){if(noise(c.x,c.y)>.58)continue;for(let k=0;k<1+Math.floor(noise(c.y,c.x)*3);k++){const id=10000+c.y*100+c.x*3+k;put(c.x+(noise(id,1)-.5)*.76,c.y+(noise(id,2)-.5)*.76,id,false);}}
 return result;
}

export function wornRoadGeometry(s,a,b,width=1.12,height=.04,level=1){
 const dx=(b.x-a.x)*TILE,dz=(b.y-a.y)*TILE,len=Math.hypot(dx,dz),nx=-dz/(len||1),nz=dx/(len||1),steps=Math.max(6,Math.ceil(len*2)),fractions=[-1,-.82,-.48,0,.48,.82,1],origin={x:(a.x+b.x)*TILE/2,z:(a.y+b.y)*TILE/2};
 const g={positions:[],indices:[],uvs:[],colors:[],centers:[],widths:[],origin};if(!len)return g;
 for(let j=0;j<=steps;j++){
  const t=j/steps,envelope=Math.sin(Math.PI*t),seed=noise(a.x+b.x,a.y+b.y),bend=envelope*Math.sin(t*Math.PI*1.3+seed*2)*(.13/Math.sqrt(level));
  const x=(a.x+(b.x-a.x)*t)*TILE+nx*bend,z=(a.y+(b.y-a.y)*t)*TILE+nz*bend;
  g.centers.push({x:j===0?a.x*TILE:j===steps?b.x*TILE:x,y:j===0?a.y*TILE:j===steps?b.y*TILE:z});
  const half=width*.5*(.94+.12*Math.sin(x*1.7+z*.8)+.065*Math.sin(x*3.4-z*1.2));g.widths.push(half*2);
  for(let k=0;k<fractions.length;k++){
   const side=fractions[k],fray=(Math.abs(side)>.8?1+(noise(x+k,z)-.5)*.24:1),X=x+nx*side*half*fray,Z=z+nz*side*half*fray;
   g.positions.push(X-origin.x,Math.max(height,surfaceElevation(X/TILE,Z/TILE,s)+height),Z-origin.z);g.uvs.push(X/3,Z/3);
   const alpha=Math.abs(side)===1?0:Math.abs(side)>.8?.32:.8+.15*noise(X,Z),v=.92+noise(X*2,Z*2)*.08;g.colors.push(v,v,v,alpha);
   if(j<steps&&k<fractions.length-1){const i=j*fractions.length+k;g.indices.push(i,i+fractions.length,i+1,i+1,i+fractions.length,i+fractions.length+1);}
  }
 }
 return g;
}

export function createGameWater(B,scene,materials){
 const meshes=[],owned=[],C=(r,g,b)=>new B.Color3(r,g,b);let signature='',night=0,time=0,disposed=false;
 B.Effect.ShadersStore.gameClearWaterVertexShader=`
 precision highp float;attribute vec3 position;attribute vec4 color;uniform mat4 world,worldViewProjection;varying vec3 vWorld;varying float vDepth;varying float vLake;varying float vCanal;
 void main(){vWorld=(world*vec4(position,1.0)).xyz;vDepth=color.r;vLake=color.g;vCanal=color.b;gl_Position=worldViewProjection*vec4(position,1.0);}`;
 B.Effect.ShadersStore.gameClearWaterFragmentShader=`
 precision highp float;varying vec3 vWorld;varying float vDepth;varying float vLake;varying float vCanal;uniform vec3 cameraPosition;uniform float time,night;
 void main(){
  vec2 p=vWorld.xz;float flow=mix(time*.62,time*.12,vLake);
  float a=p.x*1.8+p.y*.75-flow,b=p.x*.63-p.y*2.3+flow*.7;
  vec3 n=normalize(vec3(.035*cos(a)+.019*cos(b),1.0,.025*cos(a)-.027*cos(b)));
  vec3 eye=normalize(cameraPosition-vWorld);float fresnel=pow(1.0-max(dot(n,eye),0.0),3.0);
  float depth=clamp(vDepth/.7,0.0,1.0),edge=smoothstep(.002,.075,vDepth);
  vec3 clear=mix(vec3(.37,.53,.40),vec3(.10,.31,.29),depth);
  vec3 sky=mix(vec3(.78,.83,.77),vec3(.37,.60,.69),clamp(reflect(-eye,n).y,0.0,1.0));
  vec3 water=mix(clear,sky,.09+fresnel*.28);
  water=mix(water,vec3(.16,.40,.32),vCanal*.5);
  float ripple=pow(max(0.0,sin(a+sin(b)*.55)),18.0)*pow(max(0.0,sin(b*.9)),5.0);
  float glint=pow(max(dot(reflect(normalize(vec3(-.6,-.9,.4)),n),eye),0.0),130.0);
  water+=vec3(.28,.29,.21)*ripple*(1.0-depth)*.45+vec3(.8,.73,.5)*glint*.35;
  water=mix(water,water*vec3(.25,.36,.52),night*.88);
  // Bed and submerged pebbles remain visible through genuine alpha blending.
  // Fine moving highlights suggest refraction without another scene render.
  float alpha=max(edge*(.08+.29*depth+fresnel*.12),vCanal*.42);
  gl_FragColor=vec4(water,clamp(alpha,.0,.72));
 }`;
 const water=new B.ShaderMaterial('clear-flowing-water',scene,{vertex:'gameClearWater',fragment:'gameClearWater'},{attributes:['position','color'],uniforms:['world','worldViewProjection','cameraPosition','time','night'],needAlphaBlending:true});
 water.backFaceCulling=false;water.disableDepthWrite=true;water.transparencyMode=B.Material.MATERIAL_ALPHABLEND;water.setFloat('time',0);water.setFloat('night',0);water.onBindObservable.add(()=>{if(scene.activeCamera)water.setVector3('cameraPosition',scene.activeCamera.globalPosition);});owned.push(water);
 const bed=new B.PBRMaterial('visible-alluvial-riverbed',scene);bed.albedoColor=B.Color3.FromHexString('#b5a586').toLinearSpace();bed.roughness=.96;bed.metallic=0;bed.albedoTexture=materials.soil?.albedoTexture||null;owned.push(bed);
 const stones=['#8d8e78','#a49e86','#777d73'].map((hex,i)=>{const m=new B.PBRMaterial(`submerged-rounded-pebbles-${i}`,scene);m.albedoColor=B.Color3.FromHexString(hex).toLinearSpace();m.roughness=.85;m.metallic=0;owned.push(m);return m;});
 function geometry(name,g,mat,isBed=false){if(!g.indices.length)return;const m=new B.Mesh(name,scene),d=new B.VertexData();d.positions=g.positions.slice();d.indices=g.indices.slice();d.uvs=g.uvs;d.colors=[];
  for(let i=0;i<g.points.length;i++){const p=g.points[i];if(isBed){d.positions[i*3+1]=visualSurfaceElevation(p.x,p.y,currentState)+.013;const grain=.84+noise(p.x*3,p.y*3)*.16;d.colors.push(grain,grain,grain*.95,1);}else d.colors.push(...g.colors.slice(i*4,i*4+4));}
  d.normals=[];B.VertexData.ComputeNormals(d.positions,d.indices,d.normals);if(d.normals[1]<0){for(let i=0;i<d.indices.length;i+=3)[d.indices[i+1],d.indices[i+2]]=[d.indices[i+2],d.indices[i+1]];B.VertexData.ComputeNormals(d.positions,d.indices,d.normals);}d.applyToMesh(m);m.material=mat;m.isPickable=false;m.receiveShadows=isBed;m.useVertexColors=true;m.freezeWorldMatrix();meshes.push(m);return m;
 }
 let currentState;
 function update(s,t=0){if(disposed)return;currentState=s;time=t;water.setFloat('time',time);water.setFloat('night',night);const next=JSON.stringify(s.world?.lakes||[]);if(next===signature)return;signature=next;for(const m of meshes)m.dispose();meshes.length=0;
  const g=waterSurfaceGeometry(s);geometry('clear-river-bed',g.river,bed,true);geometry('clear-lake-bed',g.lakes,bed,true);geometry('clear-living-river',g.river,water);geometry('clear-saved-lakes',g.lakes,water);
  const sources=stones.map((mat,i)=>{const m=B.MeshBuilder.CreateIcoSphere(`submerged-pebble-source-${i}`,{radius:1,subdivisions:i%2+1},scene);m.material=mat;m.isPickable=false;m.setEnabled(false);meshes.push(m);return m;});
  for(const [i,p]of submergedPebbles(s).entries()){const m=sources[p.tone].createInstance(`submerged-pebble-${i}`);m.setEnabled(true);m.position.set(p.x*TILE,visualSurfaceElevation(p.x,p.y,s)+p.flat*.6,p.y*TILE);m.scaling.set(p.size,p.flat,p.size*(.65+noise(i,94)*.5));m.rotation.set(noise(i,61)*.2,p.angle,noise(i,62)*.2);m.isPickable=false;m.computeWorldMatrix(true);m.freezeWorldMatrix();meshes.push(m);}

 }
 return {meshes,material:water,update,light(n){night=n;water.setFloat('night',n);bed.albedoColor=C(.46*(1-n*.65),.4*(1-n*.6),.30*(1-n*.48));},dispose(){if(disposed)return;disposed=true;for(const m of meshes)m.dispose();meshes.length=0;for(const m of owned)m.dispose(false,false);}};
}
