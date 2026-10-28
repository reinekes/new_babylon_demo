import {buildingKey} from '../definitions.js';
import {houseLightCount} from '../households.js';
import {footprintSize} from '../footprints.js';
import {roofAccessLayout} from './roof-access.js';
import {surfaceElevation} from '../district3d/terrain.js';

export const HOUSE_LIGHT_LIMIT=6;
export const isNightLightsFestival=state=>state.festival?.stage==='celebrating'&&state.festival.occasion!=='firstBeer';

const litFestivalBuildings=state=>(state.buildings||[]).filter(b=>b.construction?.kind!=='new'&&!['field','canal','bridge'].includes(b.type));
function festivalBuildings(state,focus,limit){
 const x=Number.isFinite(focus?.x)?focus.x:0,z=Number.isFinite(focus?.z)?focus.z:0;
 return litFestivalBuildings(state).map(b=>{const center=(footprintSize(b)-1)*3,px=b.x*6+center,pz=b.y*6+center;return {key:buildingKey(b),count:2,x:px,z:pz,distance:(px-x)**2+(pz-z)**2};}).sort((a,b)=>a.distance-b.distance||(a.key<b.key?-1:a.key>b.key?1:0)).slice(0,limit);
}

// Small oil bowls illuminate doors, courtyards and flat roof edges. Four shared
// thin-instance batches keep even a large city's celebration to four draws;
// emissive flames and soft pools do not allocate a light for every wick.
function createFestivalLamps(B,scene){
 const meshes=[],materials=[];let signature='',lampCount=0,buildingCount=0;
 const makeMaterial=(name,color,alpha=1)=>{const m=new B.StandardMaterial(name,scene);m.diffuseColor=B.Color3.FromHexString(color);m.emissiveColor=m.diffuseColor.clone();m.disableLighting=true;m.alpha=alpha;m.specularColor=B.Color3.Black();if(alpha<1){m.disableDepthWrite=true;m.backFaceCulling=false;}materials.push(m);return m;};
 function create(){
  const bowl=B.MeshBuilder.CreateCylinder('festival-oil-bowls',{height:.12,diameterTop:.34,diameterBottom:.22,tessellation:8},scene);
  const flame=B.MeshBuilder.CreateCylinder('festival-oil-flames',{height:.33,diameterTop:0,diameterBottom:.13,tessellation:6},scene);
  const core=B.MeshBuilder.CreateCylinder('festival-oil-cores',{height:.20,diameterTop:0,diameterBottom:.075,tessellation:6},scene);
  const pool=new B.Mesh('festival-oil-light-pools',scene),data=new B.VertexData(),segments=16;
  data.positions=[0,0,0];data.normals=[0,1,0];data.colors=[1,1,1,.72];data.indices=[];
  // Geometry-only radial falloff: a bright centre fades through two soft rings
  // to a fully transparent rim, without textures, canvases or a hard disc edge.
  for(const [ring,[radius,alpha]]of [[.18,.54],[.43,.18],[.78,0]].entries()){
   for(let i=0;i<segments;i++){const angle=i/segments*Math.PI*2;data.positions.push(Math.cos(angle)*radius,0,Math.sin(angle)*radius);data.normals.push(0,1,0);data.colors.push(1,1,1,alpha);}
   for(let i=0;i<segments;i++){const next=(i+1)%segments,current=1+ring*segments+i,following=1+ring*segments+next;if(!ring)data.indices.push(0,following,current);else{const inner=current-segments,innerNext=following-segments;data.indices.push(inner,following,current,inner,innerNext,following);}}
  }
  data.applyToMesh(pool);pool.useVertexColors=true;pool.hasVertexAlpha=true;
  const finishes=[makeMaterial('festival-baked-clay','#b46f3d'),makeMaterial('festival-amber-flame','#ff982f'),makeMaterial('festival-warm-wick','#fff2b4'),makeMaterial('festival-soft-lamplight','#ec9b44',.19)];
  for(const [i,mesh]of [bowl,flame,core,pool].entries()){mesh.material=finishes[i];mesh.isPickable=false;mesh.checkCollisions=false;mesh.receiveShadows=false;mesh.metadata={festivalLamp:true,festivalBatch:i};mesh.setEnabled(false);meshes.push(mesh);}
 }
 function update(state,active){
  if(!active){lampCount=0;buildingCount=0;signature='';for(const mesh of meshes)if(mesh.isEnabled())mesh.setEnabled(false);return;}
  const buildings=litFestivalBuildings(state),sig=buildings.map(b=>[b.type,b.x,b.y,b.level||1,b.rotation||0,footprintSize(b),!!b.starterHut].join(':')).join('|');
  if(sig!==signature){
   signature=sig;const positions=[];buildingCount=buildings.length;
   for(const b of buildings){
    const size=footprintSize(b),center=(size-1)*3,edge=size*3-.18,angle=(b.rotation||0)*Math.PI/2,c=Math.cos(angle),s=Math.sin(angle);
    const at=(x,y,z,ground=false)=>{const X=b.x*6+center+c*(x-center)+s*(z-center),Z=b.y*6+center-s*(x-center)+c*(z-center);positions.push({x:X,y:y+(ground?Math.max(0,surfaceElevation(X/6,Z/6,state)):0),z:Z});};
    for(const [x,z]of [[-edge,-edge],[edge,-edge],[-edge,edge],[edge,edge],[-.85,edge],[.85,edge]])at(center+x,.14,center+z,true);
    const roof=roofAccessLayout(b);if(roof)for(const dz of [-.37,.37])at(roof.x-roof.side*.22,roof.height+.19,roof.z+dz);
   }
   lampCount=positions.length;if(lampCount&&!meshes.length)create();
   const offsets=[0,.23,.19,-.065];
   for(const [i,mesh]of meshes.entries()){
    const matrices=new Float32Array(lampCount*16);for(const [j,p]of positions.entries())B.Matrix.Translation(p.x,p.y+offsets[i],p.z).copyToArray(matrices,j*16);
    mesh.thinInstanceSetBuffer('matrix',matrices,16,true);mesh.thinInstanceRefreshBoundingInfo();mesh.metadata.lampCount=lampCount;if(mesh.isEnabled()!==!!lampCount)mesh.setEnabled(!!lampCount);
   }
  }
  if(meshes.length){const pulse=1+.07*Math.sin((state.festival.elapsed||0)*8.1);materials[1].emissiveColor.set(pulse,.34*pulse,.035*pulse);materials[2].emissiveColor.set(1,.87,.48);}
 }
 function dispose(){for(const mesh of meshes)mesh.dispose();for(const material of materials)material.dispose();lampCount=0;buildingCount=0;signature='';}
 return {update,dispose,meshes,get lampCount(){return lampCount;},get buildingCount(){return buildingCount;}};
}

// Only presentation data: household identities, buildings and simulation time
// remain untouched. Count residents once before choosing the nearest homes.
function nearestOccupiedHomes(state,focus,limit){
 const occupancy=new Map();for(const c of state.citizens||[]){const home=c.home;occupancy.set(home,(occupancy.get(home)||0)+1);}
 const x=Number.isFinite(focus?.x)?focus.x:0,z=Number.isFinite(focus?.z)?focus.z:0,homes=[];
 for(const b of state.buildings||[]){
  if(b.type!=='house'||b.construction?.kind==='new')continue;
  const key=buildingKey(b),count=houseLightCount(b,occupancy.get(key)||0);if(!count)continue;
  const px=b.x*6,pz=b.y*6+1.2;homes.push({key,count,x:px,z:pz,distance:(px-x)**2+(pz-z)**2});
 }
 homes.sort((a,b)=>a.distance-b.distance||(a.key<b.key?-1:a.key>b.key?1:0));return homes.slice(0,limit);
}

export function createHouseLights(B,scene,{limit=HOUSE_LIGHT_LIMIT,lamps=new Map()}={}){
 const pool=[],festival=createFestivalLamps(B,scene);let disposed=false;
 function disable(lamp){
  // Babylon Light.setEnabled calls _resyncMeshes even if its value is unchanged.
  // Guard transitions so daylight never adds a repeated full-scene pass.
  if(lamp.isEnabled())lamp.setEnabled(false);if(lamp.intensity!==0)lamp.intensity=0;
 }
 function update(state,night,focus){
  if(disposed)return;
  const celebrating=isNightLightsFestival(state);festival.update(state,celebrating);
  lamps.clear();if(!(night>0)&&!celebrating){for(const lamp of pool)disable(lamp);return;}
  const homes=celebrating?festivalBuildings(state,focus,limit):nearestOccupiedHomes(state,focus,limit),used=new Set(),assigned=new Map();
  // Keep each retained home on its existing light. Camera pans only move the
  // free slots; the pool never grows beyond the original six-light budget.
  for(const home of homes){const lamp=pool.find(l=>l.metadata?.houseKey===home.key);if(lamp){assigned.set(home.key,lamp);used.add(lamp);}}
  for(const home of homes){
   let lamp=assigned.get(home.key)||pool.find(l=>!used.has(l));
   if(!lamp){lamp=new B.PointLight(`occupied-house-pool-${pool.length}`,new B.Vector3(home.x,1.5,home.z),scene);lamp.diffuse=new B.Color3(1,.60,.22);lamp.range=7;pool.push(lamp);}
   used.add(lamp);lamp.metadata={houseKey:home.key};
   if(lamp.position.x!==home.x||lamp.position.y!==1.5||lamp.position.z!==home.z)lamp.position.set(home.x,1.5,home.z);
   const intensity=(celebrating?Math.max(.75,night):night)*home.count*3.5;if(lamp.intensity!==intensity)lamp.intensity=intensity;if(!lamp.isEnabled())lamp.setEnabled(true);lamps.set(home.key,lamp);
  }
  for(const lamp of pool)if(!used.has(lamp))disable(lamp);
 }
 function dispose(){if(disposed)return;disposed=true;for(const lamp of pool)lamp.dispose();pool.length=0;lamps.clear();festival.dispose();}
 return {update,dispose,lamps,festivalMeshes:festival.meshes,get festivalLampCount(){return festival.lampCount;},get festivalBuildingCount(){return festival.buildingCount;}};
}
