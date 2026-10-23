import {loadModel} from './asset-loading.js';
import {WIDTH,HEIGHT,river} from '../world.js';
import {TILE} from '../district3d/terrain.js';
import {lakeContours,lakeDistance,visualSurfaceElevation} from './lake-shore.js';
import {sceneryClear} from './nature.js';
import {resourceDisplayLayout} from './nature-details.js';

export const VALLEY_PLANT_ASSETS=Object.freeze({grass:['valley-dry-grass-1.glb','valley-dry-grass-2.glb','valley-dry-grass-3.glb'],greenGrass:['miracle-green-grass-1.glb','miracle-green-grass-2.glb','miracle-green-grass-3.glb'],reed:['valley-reed-1.glb','valley-reed-2.glb','valley-reed-3.glb'],palm:['valley-date-palm.glb']});
export const VEGETATION_BUDGETS=Object.freeze({low:{grass:180,greenGrass:80,reed:90},balanced:{grass:360,greenGrass:150,reed:180},high:{grass:560,greenGrass:220,reed:260}});
const random=(x,y)=>{const n=Math.sin(x*127.1+y*311.7+73129)*43758.5453;return n-Math.floor(n);};
const distance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);};
// Unlike saved water-cell distance, the signed lake distance follows the visible,
// rounded outside shore. These are display positions, never resource deposits.
export function vegetationBankDistance(x,y,s,contours=lakeContours(s)){return Math.min(Math.abs(x-river(y))-1.1,lakeDistance(x,y,s,contours));}
export function valleyVegetationPlan(s,roads=[],tier='balanced'){
 const budget=VEGETATION_BUDGETS[tier]||VEGETATION_BUDGETS.balanced,contours=lakeContours(s),plan={grass:[],greenGrass:[],reed:[]};
 const clear=(p,r=.24)=>p.x>0&&p.y>0&&p.x<WIDTH-1&&p.y<HEIGHT-1&&sceneryClear(s,p,r)&&roads.every(e=>distance(p,e.a,e.b)>.28+r);
 const put=(kind,p,seed)=>plan[kind].push({...p,angle:random(seed,37)*Math.PI*2,scale:(kind==='reed'?1:2)*((kind==='reed'?.75:.65)+random(seed,53)*.55),variant:Math.floor(random(seed,61)*3)});
 // Stable distributed walk: lower quality is a prefix of each species, and
 // density stays bounded even on a completely empty floodplain.
 for(let i=0;i<WIDTH*HEIGHT*3;i++){
  const cell=(i*137)%(WIDTH*HEIGHT),pass=Math.floor(i/(WIDTH*HEIGHT)),p={x:cell%WIDTH+(random(cell,pass+3)-.5)*.8,y:Math.floor(cell/WIDTH)+(random(cell,pass+9)-.5)*.8},d=vegetationBankDistance(p.x,p.y,s,contours);
  const kind=d>.13&&d<.83?'reed':d>=.83&&d<2.5&&random(cell,pass+21)>.36?'greenGrass':d>=.83&&d<6?'grass':null;
  if(!kind||plan[kind].length>=budget[kind]||!clear(p)||random(cell,pass+18)>(kind==='reed'?.63:.46))continue;
  // Clump centres are shared across quality levels; every offset is checked
  // independently against shores, complete building footprints and paths.
  for(let c=0;c<(kind==='reed'?1:3)&&plan[kind].length<budget[kind];c++){const q=c?{x:p.x+(random(cell+c*29,pass+7)-.5)*.44,y:p.y+(random(cell+c*31,pass+11)-.5)*.44}:p,bank=vegetationBankDistance(q.x,q.y,s,contours);if(!clear(q)||bank<.13||(kind==='grass'&&(bank<.83||bank>=6))||(kind==='greenGrass'&&(bank<.83||bank>=2.5)))continue;put(kind,q,cell+pass*1009+c*47);}
 }
 // Render the existing reed deposit with imported clumps as well; its identity
 // and quantities continue to belong exclusively to the simulation.
 for(const d of s.world?.deposits||[])if(d.kind==='reed')for(const [i,p]of resourceDisplayLayout(d).entries())if(clear(p,.05)&&vegetationBankDistance(p.x,p.y,s,contours)>.10&&plan.reed.length<budget.reed+90)put('reed',p,d.x*73+d.y*11+i);
 return plan;
}

// Keep original alpha-cutout materials; bake the GLTF reflection into LH geometry.
// After baking, normals/winding match native Babylon meshes (CCW), not the
// source glTF root CW override. A retained CW override flips PBR front lighting.
// Only material-compatible parts merge; textures are never replaced by a tint.
export async function loadValleyPlantSources(B,scene,files,meshes,containers,kind){
 const sources=[];let variant=0;
 for(const file of files){let container;try{
  container=await loadModel(B,scene,'assets/art-courtyard/models/',file,scene);containers.push(container);container.addAllToScene();const groups=new Map();
  for(const m of container.meshes)if(m.getTotalVertices()>0){m.computeWorldMatrix(true);if(!groups.has(m.material))groups.set(m.material,[]);groups.get(m.material).push(m);}
  for(const [mat,parts]of groups){
   // Dry-grass cards deliberately carry upward canopy normals. Flipping them
   // per front/back face turns half the tuft toward the unlit ground. Preserve
   // this authored lighting convention; ordinary reed/palm normals still flip.
   const upwardCanopy=parts.every(p=>{const n=p.getVerticesData(B.VertexBuffer.NormalKind);return n?.length&&n.every((v,i)=>i%3!==1||v>.98);});
   if(mat){
   mat.metallic=0;mat.roughness=.92;
   if(mat.albedoTexture?.hasAlpha||mat.transparencyMode===B.Material.MATERIAL_ALPHATEST){
    mat.transparencyMode=B.Material.MATERIAL_ALPHATEST;mat.backFaceCulling=false;
    // Thin leaf cards transmit sunlight through their authored green atlas.
    // This remains lit PBR: opaque trunks and the source textures are untouched.
    mat.subSurface.isTranslucencyEnabled=true;mat.subSurface.translucencyIntensity=.2;
    // Babylon 9.31 otherwise defaults transmission to white independently of
    // the leaf atlas. Match the source olive albedo in linear colour space.
    mat.subSurface.translucencyColor=new B.Color3(.08,.13,.025);
    mat.subSurface.useAlbedoToTintTranslucency=true;mat.subSurface.minimumThickness=0;mat.subSurface.maximumThickness=.03;
   }
   // Cards are viewed from both sides. Back-face visibility alone does not
   // turn their lighting normal toward the light: without two-sided lighting
   // the reverse sides of the palm/reed leaves become black silhouettes.
   // Preserve the source cutoff, colour/normal/ORM maps and solid bark shading.
   if(!mat.backFaceCulling)mat.twoSidedLighting=!upwardCanopy;
  }
   const m=B.Mesh.MergeMeshes(parts,true,true,undefined,false,false);if(!m)continue;m.name=`valley-${kind}-source-${sources.length}`;m.material=mat;m.overrideMaterialSideOrientation=B.Material.CounterClockWiseSideOrientation;m.isPickable=false;m.receiveShadows=true;m.setEnabled(false);m.metadata={valleyVariant:variant,upwardCanopy};sources.push(m);meshes.push(m);
  }
  variant++;
 }catch(error){container?.dispose();/* An unavailable optional plant must not stop the city renderer. */}}
 return sources;
}

export async function createValleyVegetation(B,scene,{tier='balanced',assets=VALLEY_PLANT_ASSETS}={}){
 const meshes=[],containers=[],sources={};let currentTier=tier,signature='',disposed=false,plan=null;const batches=[];
 for(const kind of ['grass','greenGrass','reed'])sources[kind]=await loadValleyPlantSources(B,scene,assets[kind]||[],meshes,containers,kind);
 function clear(){for(const m of batches){m.dispose();const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);}batches.length=0;}
 return {meshes,sources,get plan(){return plan;},setQuality(next){if(VEGETATION_BUDGETS[next]&&next!==currentTier){currentTier=next;signature='';}},update(s,roads,key){if(disposed||signature===`${key}|${currentTier}`)return false;signature=`${key}|${currentTier}`;clear();plan=valleyVegetationPlan(s,roads,currentTier);
  for(const kind of ['grass','greenGrass','reed']){const variants=1+Math.max(-1,...sources[kind].map(m=>m.metadata.valleyVariant));for(const src of sources[kind]){
   // Regular instances share geometry/material and remain visible to the existing
   // shadow/culling registry. No geometry or transforms change each frame.
   for(const [i,p]of plan[kind].entries()){if(p.variant%variants!==src.metadata.valleyVariant)continue;const m=src.createInstance(`valley-${kind}-${i}`);m.setEnabled(true);m.position.set(p.x*TILE,visualSurfaceElevation(p.x,p.y,s),p.y*TILE);m.scaling.setAll(p.scale);m.rotation.y=p.angle;m.overrideMaterialSideOrientation=B.Material.CounterClockWiseSideOrientation;m.isPickable=false;m.receiveShadows=true;m.metadata={valleyVegetation:{kind,...p}};m.freezeWorldMatrix();meshes.push(m);batches.push(m);}
  }}
  return true;
 },dispose(){if(disposed)return;disposed=true;clear();for(const m of meshes)if(!m.isDisposed?.())m.dispose();meshes.length=0;for(const c of containers)c.dispose();}};
}
