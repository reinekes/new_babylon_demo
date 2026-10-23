import {workstationBuilding} from './workstations.js';
import {createRoofAccess} from './roof-access.js';
import {cropSeed,fieldCropKind} from './crop-varieties.js';
import {loadFieldCrops,usesBarleyCards} from './field-crops.js';
import {createBuildingFoundations,foundationContext,foundationSignature} from './building-foundations.js';
import {createConstructionSite} from './construction-sites.js';
import {footprintSize} from '../footprints.js';
import {createArchitecture} from './architecture.js';
import {createHouseArchitecture,houseVisualKind} from './house-architecture.js';
import {clippedFieldGeometry,organicHousePoint,organicHouseVariant} from './field-shore.js';
import {constructionProgress} from '../construction.js';
import {buildingKey,capacityOf} from '../definitions.js';
import {createDistrictBuilding, districtCropVisual} from '../district3d/buildings.js';

const rotationOf=b=>((Math.trunc(Number(b?.rotation)||0)%4)+4)%4;
const HOME_ASSET='assets/art-courtyard/models/adobe-courtyard.glb';
const tier=b=>Math.max(1,Math.min(3,b.level||1));
const progress=b=>b.construction?Math.floor(Math.max(0,Math.min(1,constructionProgress(b).ratio))*12):12;
const isHouse=b=>b.type==='house'&&(!b.construction||b.construction.kind==='upgrade');

// The adapter only reads simulation objects. Templates live outside the game state.
export function gameBuildingSignature(b,state,shoreContext){
 return [workstationBuilding(b,state).workCorner?.join(',')||'',b.type,b.footprint||1,tier(b),b.construction?.kind||'complete',b.construction?.target||'',progress(b),b.type==='field'?`${rotationOf(b)}:${districtCropVisual(b).signature}:${usesBarleyCards(b)?fieldCropKind(b):'sprouts'}`:'',b.type==='bridge'||b.type==='field'?`${b.x},${b.y}`:'',b.type==='field'?JSON.stringify(state?.world?.lakes||[]):'',isHouse(b)?`${houseVisualKind(b)}:${organicHouseVariant(b)}`:'',foundationSignature(b,state,shoreContext)].join('|');
}

// glTF's handedness conversion is a reflected root. MergeMeshes bakes its negative
// determinant into the vertices but loses the root's automatic winding override.
export function mergeCourtyardAsset(B,container){
 container.addAllToScene();
 const groups=new Map();
 for(const mesh of container.meshes){
  if(!mesh.getTotalVertices())continue;
  mesh.computeWorldMatrix(true);
  if(!groups.has(mesh.material))groups.set(mesh.material,[]);
  groups.get(mesh.material).push(mesh);
 }
 const merged=[];
 for(const [material,parts] of groups){
  const reflected=parts[0].getWorldMatrix().determinant()<0;
  const mesh=B.Mesh.MergeMeshes(parts,true,true,undefined,false,false);
  if(!mesh)throw Error('Не удалось объединить геометрию сырцового двора');
  mesh.name=`game-courtyard-${material?.name||'surface'}`;
  mesh.material=material;
  mesh.overrideMaterialSideOrientation=reflected?B.Material.ClockWiseSideOrientation:B.Material.CounterClockWiseSideOrientation;
  mesh.isVisible=false;mesh.isPickable=false;mesh.checkCollisions=false;
  merged.push(mesh);
 }
 if(!merged.length)throw Error('Модель сырцового двора не содержит геометрии');
 return merged;
}

export async function createGameBuildings(B,scene,materials,options={}){
 let cropAssets=options.deferAssets?null:await loadFieldCrops(B,scene),cropPromise=null;
 const templates=new Map(),active=new Map(),meshes=[],ownedMaterials=[];
 let disposed=false,previewRecord=null,highlightSignature='';const highlighted=[];
 const highlightMaterial=new B.StandardMaterial('nearby-building-glow',scene);highlightMaterial.emissiveColor=B.Color3.FromHexString('#f5ce79');highlightMaterial.diffuseColor=B.Color3.FromHexString('#f5ce79');highlightMaterial.disableLighting=true;highlightMaterial.alpha=.17;highlightMaterial.disableDepthWrite=true;ownedMaterials.push(highlightMaterial);
 function clearHighlights(){for(const mesh of highlighted)mesh.dispose();highlighted.length=0;highlightSignature='';}
 function highlight(keys=[]){
  const sig=keys.map(key=>key+':'+active.get(key)?.signature).join('|');if(sig===highlightSignature)return;clearHighlights();highlightSignature=sig;
  for(const key of keys){const record=active.get(key);if(!record)continue;
   for(const original of record.meshes){if(original.metadata?.homeLamp)continue;const source=original.sourceMesh||original,mesh=source.clone('nearby-building-highlight',original.parent,true);mesh.position.copyFrom(original.position);mesh.position.y+=.006;mesh.rotation.copyFrom(original.rotation);mesh.scaling.copyFrom(original.scaling);mesh.isVisible=true;mesh.isPickable=false;mesh.material=highlightMaterial;mesh.metadata={highlight:true};mesh.receiveShadows=false;highlighted.push(mesh);}
   const n=record.root.metadata.type==='ziggurat'?2:1,c=(n-1)*3,r=n*3-.12,points=[];
   for(const x of [-1,1])for(const z of [-1,1])points.push([new B.Vector3(c+x*(r-.8),.16,c+z*r),new B.Vector3(c+x*r,.16,c+z*r),new B.Vector3(c+x*r,.16,c+z*(r-.8))]);
   const line=B.MeshBuilder.CreateLineSystem('nearby-building-corners',{lines:points},scene);line.parent=record.root;line.color=B.Color3.FromHexString('#ffe099');line.isPickable=false;highlighted.push(line);
  }
 }

 const previewTemplates=new Map(),ghostMaterials=new Map();
 const finish=(name,color,base)=>{
  // PBRMaterial.clone() deep-clones DynamicTexture without uploading its canvas.
  // Share immutable maps explicitly so scene readiness never waits on orphan copies.
  const m=new B.PBRMaterial(`game-${name}`,scene);
  if(base)for(const slot of ['albedoTexture','bumpTexture','ambientTexture','opacityTexture','emissiveTexture','metallicTexture','reflectivityTexture','reflectionTexture','lightmapTexture'])if(base[slot])m[slot]=base[slot];
  m.albedoColor=B.Color3.FromHexString(color);m.metallic=0;m.roughness=.96;
  ownedMaterials.push(m);return m;
 };
 const raw=finish('raw-brick-facing','#c3aa83',materials.brick);
 const fired=finish('fired-brick-facing','#b1815b',materials.brick);
 const shade=finish('door-shadow','#40382d');
 const warm=finish('occupied-home','#bd8950');warm.emissiveColor=new B.Color3(.5,.29,.1);
 const trim=finish('plaster-trim','#d9c4a1',materials.plaster);
 const houseFinishes=[1,2,3].map(level=>['#dfc8a1','#cab18c','#ead6b5'].map((color,variant)=>finish(`house-${level}-finish-${variant}`,color,materials.plaster)));
 const homeShade=finish('home-interior-shadow','#100c08');
 const homePlasters=houseFinishes.map((variants,level)=>variants.map((base,variant)=>{const mat=finish(`home-plaster-${level+1}-${variant}`,['#ceb18a','#d8c29e','#e0cdaa'][variant],materials.plaster);mat.albedoTexture=null;mat.albedoColor=mat.albedoColor.toLinearSpace();return mat;}));
 const materialSet={...materials,raw,fired,shade,trim,warm};
 function acquire(b,key,state,shoreContext){
  let t=templates.get(key);if(t){t.users++;return t;}
  const root=new B.TransformNode(`game-template-${key}`,scene);let sources=[];
  if(b.construction?.kind==='new'){
   sources=createConstructionSite(B,scene,b,materialSet);for(const mesh of sources)mesh.parent=root;
  }else if(isHouse(b)){
   sources=createHouseArchitecture(B,scene,b,{...materialSet,plaster:homePlasters[tier(b)-1][organicHouseVariant(b)],shade:homeShade});for(const mesh of sources)mesh.parent=root;
  }else{
   if(b.type==='field'||b.type==='bridge'||b.type==='house'||b.type==='canal'){
    const adapted=cropAssets&&usesBarleyCards(b)?{...b,crop:{...b.crop,sown:0}}:b;
    const base=createDistrictBuilding(B,scene,{...adapted,id:'template'},materialSet);
    for(const mesh of base.meshes){mesh.unfreezeWorldMatrix();mesh.parent=root;sources.push(mesh);}
    base.root.dispose();
   }else for(const mesh of createArchitecture(B,scene,workstationBuilding(b,state),materialSet)){mesh.parent=root;sources.push(mesh);}

  }
  for(const mesh of createRoofAccess(B,scene,workstationBuilding(b,state),materialSet)){mesh.parent=root;sources.push(mesh);}
  if(b.construction?.kind==='upgrade')for(const mesh of createConstructionSite(B,scene,b,materialSet)){mesh.parent=root;sources.push(mesh);}
  if(b.type==='field')sources=sources.filter(mesh=>{
   const data=B.VertexData.ExtractFromMesh(mesh),clipped=clippedFieldGeometry(data,b,state);
   if(!clipped.indices.length){mesh.dispose();return false;}
   const geometry=new B.VertexData();Object.assign(geometry,clipped);geometry.applyToMesh(mesh);return true;
  });
  if(cropAssets&&b.type==='field')for(const mesh of cropAssets.create(b,state)){mesh.parent=root;sources.push(mesh);}
  if(isHouse(b)){
   for(let index=0;index<4;index++){
    const renewed=true,doorCentre=tier(b)===3?-.75:tier(b)===2?.2:0;
    const lamp=B.MeshBuilder.CreateBox(`game-home-lamp-${index}`,{width:renewed?.15:.22,height:.2,depth:.04},scene);lamp.position.set(renewed?doorCentre-.27+index*.18:.22+index*.34,renewed?.73:1.08,renewed?(houseVisualKind(b)==='hut'?1.07:tier(b)===3?-.69:tier(b)===2?-.875:-.245):.52);lamp.material=shade;lamp.parent=root;lamp.metadata={homeLamp:true,lampIndex:index};sources.push(lamp);
   }
  }
  for(const mesh of createBuildingFoundations(B,scene,b,materialSet,state,shoreContext)){mesh.parent=root;sources.push(mesh);}
  for(const source of sources){source.isVisible=false;source.isPickable=false;source.checkCollisions=false;source.receiveShadows=true;source.computeWorldMatrix(true);}
  t={root,sources,users:1};templates.set(key,t);return t;
 }
 function release(key){const t=templates.get(key);if(t&&!--t.users){t.root.dispose();templates.delete(key);}}
 function remove(key){const record=active.get(key);if(!record)return;for(const m of record.meshes){const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);}record.root.dispose();release(record.signature);active.delete(key);}
 function placeRoot(root,b){
  const angle=rotationOf(b)*Math.PI/2,offset=(footprintSize(b)-1)*3,c=Math.cos(angle),s=Math.sin(angle);
  root.rotation.y=angle;root.position.set(b.x*6+offset-(c+s)*offset,0,b.y*6+offset-(-s+c)*offset);
 }
 function ghostMaterial(base,allowed){
  let pair=ghostMaterials.get(base);if(!pair){pair=new Map();ghostMaterials.set(base,pair);}if(pair.has(allowed))return pair.get(allowed);
  const mat=finish(`preview-${allowed?'allowed':'blocked'}-${base.name}`,allowed?'#9cd0ac':'#e37465',base);
  mat.alpha=.34;mat.transparencyMode=B.PBRMaterial.PBRMATERIAL_ALPHABLEND;mat.emissiveColor=B.Color3.FromHexString(allowed?'#35634a':'#772e24');mat.backFaceCulling=base.backFaceCulling;mat.sideOrientation=base.sideOrientation;mat.useAlphaFromAlbedoTexture=!!base.useAlphaFromAlbedoTexture;mat.twoSidedLighting=base.twoSidedLighting;mat.disableDepthWrite=true;
  pair.set(allowed,mat);return mat;
 }
 function clearPreview(){if(previewRecord){previewRecord.root.dispose();previewRecord=null;}}
 function preview(input,state,options={}){
  if(disposed)return null;if(!input){clearPreview();return null;}
  const b={...input,level:1,construction:undefined},shoreContext=foundationContext(state),signature=gameBuildingSignature(b,state,shoreContext),allowed=options.allowed!==false;
  if(!previewRecord||previewRecord.signature!==signature){
   clearPreview();let template=previewTemplates.get(signature);
   if(template){previewTemplates.delete(signature);previewTemplates.set(signature,template);}else{template=acquire(b,signature,state,shoreContext);previewTemplates.set(signature,template);}
   // A small LRU retains nearby shore clips and all three house variants without
   // turning a long mouse sweep into an unbounded cache of templates.
   while(previewTemplates.size>8){const oldest=previewTemplates.keys().next().value;previewTemplates.delete(oldest);release(oldest);}
   const root=new B.TransformNode('game-building-preview',scene),parts=[];placeRoot(root,b);root.metadata={preview:true,tile:{x:b.x,y:b.y},type:b.type};
   for(const source of template.sources){
    if(source.metadata?.homeLamp)continue;
    const mesh=source.clone(`preview-${source.name}`,null,true);mesh.parent=root;mesh.material=ghostMaterial(source.material,allowed);mesh.overrideMaterialSideOrientation=source.overrideMaterialSideOrientation;mesh.isVisible=true;mesh.isPickable=false;mesh.checkCollisions=false;mesh.receiveShadows=false;mesh.metadata={preview:true};mesh.computeWorldMatrix(true);parts.push(mesh);
   }
   previewRecord={root,meshes:parts,signature,x:b.x,y:b.y,rotation:rotationOf(b),allowed};
  }else{
   if(previewRecord.x!==b.x||previewRecord.y!==b.y||previewRecord.rotation!==rotationOf(b)){
    placeRoot(previewRecord.root,b);previewRecord.root.metadata.tile={x:b.x,y:b.y};for(const mesh of previewRecord.meshes)mesh.computeWorldMatrix(true);
    previewRecord.x=b.x;previewRecord.y=b.y;previewRecord.rotation=rotationOf(b);
   }
   if(previewRecord.allowed!==allowed){
    const template=previewTemplates.get(signature),sources=template.sources.filter(source=>!source.metadata?.homeLamp);
    for(let i=0;i<sources.length;i++){previewRecord.meshes[i].material=ghostMaterial(sources[i].material,allowed);previewRecord.meshes[i].overrideMaterialSideOrientation=sources[i].overrideMaterialSideOrientation;}
    previewRecord.allowed=allowed;
   }
  }
  return previewRecord;
 }
 function sync(state){
  if(disposed)return;if(options.deferAssets&&state.buildings.some(b=>b.type==='field'))loadDetails();
  const shoreContext=foundationContext(state),seen=new Set(),occupied=new Map();for(const c of state.citizens||[])if(c.home!=null)occupied.set(c.home,(occupied.get(c.home)||0)+1);
  for(const b of state.buildings||[]){
   // Landscape owns connected canal beds, wetness, banks and construction.
   // The legacy standalone side walls would span across those real channels.
   if(b.type==='canal')continue;
   const key=buildingKey(b),signature=gameBuildingSignature(b,state,shoreContext);seen.add(key);
   let record=active.get(key);
   if(record&&(record.signature!==signature||record.x!==b.x||record.y!==b.y)){remove(key);record=null;}
   if(!record){
    const template=acquire(b,signature,state,shoreContext),root=new B.TransformNode(`game-building-${key}`,scene),parts=[];
    placeRoot(root,b);root.metadata={tile:{x:b.x,y:b.y},buildingKey:key,type:b.type};
    for(const source of template.sources){
     const mesh=source.metadata?.homeLamp?source.clone(`${key}-${source.name}`,null,true):source.createInstance(`${key}-${source.name}`);mesh.parent=root;mesh.isVisible=true;mesh.isPickable=true;mesh.checkCollisions=false;if(source.metadata?.homeLamp)mesh.receiveShadows=true;
     mesh.metadata={...root.metadata,homeLamp:!!source.metadata?.homeLamp,lampIndex:source.metadata?.lampIndex};mesh.computeWorldMatrix(true);mesh.freezeWorldMatrix();parts.push(mesh);
    }
    record={root,meshes:parts,signature,x:b.x,y:b.y,rotation:rotationOf(b)};active.set(key,record);meshes.push(...parts);
   }
   if(record.rotation!==rotationOf(b)){
    for(const mesh of record.meshes)mesh.unfreezeWorldMatrix();placeRoot(record.root,b);for(const mesh of record.meshes){mesh.computeWorldMatrix(true);mesh.freezeWorldMatrix();}record.rotation=rotationOf(b);
   }
   // The courtyard architecture keeps its three shared templates. A tiny garden
   // owns its terrain-dependent geometry separately, so plant variety never
   // duplicates the entire high-detail house or fragments preview caches.
   if(cropAssets&&isHouse(b)){
    const gardenSignature=`${cropSeed(b)%5}:${b.x},${b.y}:${rotationOf(b)}:${shoreContext.signature}`;
    if(record.gardenSignature!==gardenSignature){
     for(const mesh of record.gardenMeshes||[]){const a=record.meshes.indexOf(mesh),c=meshes.indexOf(mesh);if(a>=0)record.meshes.splice(a,1);if(c>=0)meshes.splice(c,1);mesh.dispose();}
     record.gardenMeshes=cropAssets.createGarden(b,state);record.gardenSignature=gardenSignature;
     for(const mesh of record.gardenMeshes){mesh.parent=record.root;mesh.isVisible=true;mesh.isPickable=true;mesh.receiveShadows=true;mesh.metadata={...mesh.metadata,...record.root.metadata};mesh.computeWorldMatrix(true);mesh.freezeWorldMatrix();record.meshes.push(mesh);meshes.push(mesh);}
    }
   }
   const litWindows=Math.ceil(Math.min(1,(occupied.get(key)||0)/Math.max(1,capacityOf(b)))*4);
   for(const mesh of record.meshes)if(mesh.metadata.homeLamp)mesh.material=mesh.metadata.lampIndex<litWindows?warm:shade;
  }
  for(const key of active.keys())if(!seen.has(key))remove(key);
 }
 function loadDetails(){if(cropPromise||cropAssets||disposed)return cropPromise;cropPromise=loadFieldCrops(B,scene).then(value=>{if(disposed){value?.dispose?.();return;}cropAssets=value;for(const [key,record]of [...active])if(record.root.metadata?.type==='field')remove(key);return value;});return cropPromise;}
 return {sync,meshes,loadDetails,refreshMaterials(){for(const m of ownedMaterials)if(/home-plaster|house-\d-finish|plaster-trim/.test(m.name))m.bumpTexture=materials.plaster.bumpTexture;},preview,clearPreview,highlight,light(night){const n=Math.max(0,Math.min(1,night||0));warm.emissiveColor.set(.065+.72*n,.035+.38*n,.012+.11*n);},dispose(){if(disposed)return;clearHighlights();clearPreview();for(const key of previewTemplates.keys())release(key);previewTemplates.clear();ghostMaterials.clear();for(const key of active.keys())remove(key);cropAssets?.dispose();for(const m of ownedMaterials)m.dispose(false,false);disposed=true;}};
}
