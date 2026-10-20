import {clippedFieldGeometry,organicHousePoint,organicHouseVariant} from './field-shore.js';
import {constructionProgress} from '../construction.js';
import {buildingKey} from '../definitions.js';
import {createDistrictBuilding, districtCropVisual} from '../district3d/buildings.js';

const HOME_ASSET='assets/art-courtyard/models/adobe-courtyard.glb';
const tier=b=>Math.max(1,Math.min(3,b.level||1));
const progress=b=>b.construction?Math.floor(Math.max(0,Math.min(1,constructionProgress(b).ratio))*12):12;
const isHouse=b=>b.type==='house'&&(!b.construction||b.construction.kind==='upgrade');

// The adapter only reads simulation objects. Templates live outside the game state.
export function gameBuildingSignature(b,state){
 return [b.type,tier(b),b.construction?.kind||'complete',b.construction?.target||'',progress(b),b.type==='field'?districtCropVisual(b).signature:'',b.type==='bridge'||b.type==='field'?`${b.x},${b.y}`:'',b.type==='field'?JSON.stringify(state?.world?.lakes||[]):'',isHouse(b)&&tier(b)===1?organicHouseVariant(b):''].join('|');
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

export async function createGameBuildings(B,scene,materials){
 const container=await B.SceneLoader.LoadAssetContainerAsync('',HOME_ASSET,scene,undefined,'.glb');
 const originals=mergeCourtyardAsset(B,container),templates=new Map(),active=new Map(),meshes=[],ownedMaterials=[];
 let disposed=false;
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
 const materialSet={...materials};
 // Share photographic surface maps with the high detail asset's authored UVs.
 for(const mesh of originals){
  const m=mesh.material,name=m?.name||'';
  const source=/plastered/.test(name)?materials.plaster:/timber/.test(name)?materials.wood:/roof-earth/.test(name)?materials.soil:null;
  if(source&&m){m.albedoTexture=source.albedoTexture;m.bumpTexture=source.bumpTexture;m.roughness=.97;}
 }
 const min=new B.Vector3(Infinity,Infinity,Infinity),max=new B.Vector3(-Infinity,-Infinity,-Infinity);
 for(const mesh of originals){mesh.computeWorldMatrix(true);const b=mesh.getBoundingInfo().boundingBox;min.minimizeInPlace(b.minimumWorld);max.maximizeInPlace(b.maximumWorld);}
 // Width is about 8.8 m including wall thickness; .52 preserves a clear tile margin.
 const scale=Math.min(.52,5.15/(max.x-min.x),5.15/(max.z-min.z));
 const center=min.add(max).scale(.5),verticalScale=.74;
 function additions(b,root){
  const groups=new Map();
  const box=(name,x,y,z,w,h,d,mat)=>{
   const m=B.MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);m.position.set(x,y,z);m.material=mat||trim;
   if(!groups.has(m.material))groups.set(m.material,[]);groups.get(m.material).push(m);return m;
  };
  const level=tier(b),facing=level===3?fired:raw;
  if(isHouse(b)){
   // Open court remains clear: no solid picking/collision cube around the home.
   if(level>=2){
    for(const x of [-2.25,2.25])box('house-masonry-pier',x,.55,1.75,.32,1.1,.42,facing);
    for(const x of [-1.6,.1,1.8])box('house-repair-course',x,.18,1.55,1.35,.32,.16,facing);
    box('house-upper-room',-1.15,2.47,1.08,1.55,.8,1.2,level===3?fired:trim);
    box('house-upper-roof',-1.15,2.91,1.08,1.72,.12,1.35,materials.soil);
    box('house-upper-door',-1.15,2.36,.47,.43,.57,.025,shade);
   }
   if(level===3){
    for(let i=0;i<7;i++)box('house-fired-plinth',-1.9+i*.59,.14,1.94,.56,.28,.22,fired);
    box('house-roof-parapet',-1.15,3.05,1.67,1.72,.25,.15,fired);
    box('house-roof-parapet',-1.94,3.05,1.08,.15,.25,1.35,fired);
   }
  }else if(!b.construction||b.construction.kind==='upgrade'){
   // Civic silhouettes keep the original functional courtyards, flat roofs and
   // craft apparatus. Recessed panels/buttresses make their scale readable.
   if(['shrine','granary','depot'].includes(b.type)){
    for(const x of [-2.22,-1.45,1.45,2.22]){
     box('civic-buttress',x,1.17,-2.42,.25,2.34,.35,level===3?fired:raw);
     box('civic-capital',x,2.4,-2.42,.36,.13,.43,trim);
    }
    for(const x of [-1.95,-1,1,1.95])box('civic-vent',x,2.07,.249,.3,.24,.026,shade);
   }
   if(b.type==='shrine'){
    for(const x of [-1.63,1.63])box('temple-gateway',x,1.56,.72,.32,2.9,.42,raw);
    box('temple-gate-cornice',0,3.08,.72,3.6,.2,.5,trim);
   }
   if(b.type==='ziggurat'){
    for(let step=0;step<3;step++)for(let i=0;i<7-step;i++)for(const sign of [-1,1]){
     const width=5.3-step*1.05;
     box('ziggurat-recess',-width/2+.28+i*(width-.56)/(6-step),.38+step*.75,-.3+sign*(4.6-step*.85)/2,.14,.55,.035,raw);
    }
   }
   if(b.type==='market'){
    box('market-rear-store',1.83,.65,1.7,1.05,1.3,1.25,raw);
    box('market-store-roof',1.83,1.36,1.7,1.18,.13,1.38,materials.soil);
    box('market-store-opening',1.83,.65,1.06,.6,1.1,.03,shade);
   }
  }
  if(b.construction){
   const p=progress(b)/12;
   if(b.construction.kind==='upgrade'){
    for(const x of [-2.55,2.55])for(const z of [-1.8,1.8])box('upgrade-scaffold-post',x,1.5,z,.075,3,.075,materials.wood);
    for(const x of [-2.55,2.55])for(const y of [1.1,2.1])box('upgrade-scaffold-rail',x,y,0,.07,.07,3.75,materials.wood);
   }
   // Quantised work advances a visible scaffold and a small stack, not just text.
   for(let i=0;i<2+Math.floor(p*6);i++)box('site-materials',-1.75+i%4*.44,.13+Math.floor(i/4)*.21,2.35,.4,.2,.4,raw);
   box('site-work-board',2.55,.5+p*1.65,-1.4,.08,.09,1.75,materials.wood);
  }
  const result=[];
  for(const [material,parts] of groups){
   const mesh=B.Mesh.MergeMeshes(parts,true,true,undefined,false,false);mesh.material=material;mesh.name=`game-detail-${material.name}`;mesh.parent=root;result.push(mesh);
  }
  return result;
 }
 function acquire(b,key,state){
  let t=templates.get(key);if(t){t.users++;return t;}
  const root=new B.TransformNode(`game-template-${key}`,scene);let sources=[];
  if(isHouse(b)){
   for(const original of originals){
    const mesh=original.clone(`${original.name}-tier${tier(b)}`,null,true);mesh.isVisible=false;
    mesh.scaling.set(scale,verticalScale,scale);mesh.position.set(-center.x*scale,-min.y*verticalScale,-center.z*scale);
    if(tier(b)===1){
     // Independent geometry once per shared variant; all groups use the same warp.
     mesh.makeGeometryUnique();
     const p=Array.from(mesh.getVerticesData(B.VertexBuffer.PositionKind)),authored=mesh.getVerticesData(B.VertexBuffer.NormalKind),normals=[],variant=organicHouseVariant(b);
     for(let i=0;i<p.length;i+=3){
      const x=(p[i]-center.x)*scale,y=(p[i+1]-min.y)*verticalScale,z=(p[i+2]-center.z)*scale,v=organicHousePoint(x,y,z,variant),epsilon=.001;
      // Preserve authored (including bevel-weighted) normals through the warp's
      // inverse transpose. Rebuilding them from reflected glTF indices reverses
      // Babylon's default winding and loses the artist's hard/smooth edge choices.
      const derivative=(axis)=>{const a=[x,y,z],c=[x,y,z];a[axis]+=epsilon;c[axis]-=epsilon;const u=organicHousePoint(...a,variant),w=organicHousePoint(...c,variant);return new B.Vector3((u[0]-w[0])/(2*epsilon),(u[1]-w[1])/(2*epsilon),(u[2]-w[2])/(2*epsilon));};
      const dx=derivative(0),dy=derivative(1),dz=derivative(2),normal=B.Vector3.Cross(dy,dz).scale(authored[i]/scale).addInPlace(B.Vector3.Cross(dz,dx).scale(authored[i+1]/verticalScale)).addInPlace(B.Vector3.Cross(dx,dy).scale(authored[i+2]/scale)).normalize();
      p[i]=v[0];p[i+1]=v[1];p[i+2]=v[2];normals.push(normal.x,normal.y,normal.z);
     }
     mesh.setVerticesData(B.VertexBuffer.PositionKind,p);mesh.setVerticesData(B.VertexBuffer.NormalKind,normals);mesh.scaling.setAll(1);mesh.position.setAll(0);
    }
    if(tier(b)>=2&&/plastered/.test(original.material?.name||''))mesh.material=tier(b)===3?fired:raw;
    mesh.parent=root;sources.push(mesh);
   }
  }else{
   const base=createDistrictBuilding(B,scene,{...b,id:'template'},materialSet);
   // Existing architecture is local to its root, including bridge-span offsets.
   for(const mesh of base.meshes){mesh.unfreezeWorldMatrix();mesh.parent=root;sources.push(mesh);}
   base.root.dispose();
  }
  sources.push(...additions(b,root));
  if(b.type==='field')sources=sources.filter(mesh=>{
   const data=B.VertexData.ExtractFromMesh(mesh),clipped=clippedFieldGeometry(data,b,state);
   if(!clipped.indices.length){mesh.dispose();return false;}
   const geometry=new B.VertexData();Object.assign(geometry,clipped);geometry.applyToMesh(mesh);return true;
  });
  if(isHouse(b)){
   const lamp=B.MeshBuilder.CreateBox('game-home-lamp',{width:.22,height:.2,depth:.04},scene);lamp.position.set(.22,1.08,.52);lamp.material=shade;lamp.parent=root;lamp.metadata={homeLamp:true};sources.push(lamp);
  }
  for(const source of sources){source.isVisible=false;source.isPickable=false;source.checkCollisions=false;source.receiveShadows=true;source.computeWorldMatrix(true);}
  t={root,sources,users:1};templates.set(key,t);return t;
 }
 function release(key){const t=templates.get(key);if(t&&!--t.users){t.root.dispose();templates.delete(key);}}
 function remove(key){const record=active.get(key);if(!record)return;for(const m of record.meshes){const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);}record.root.dispose();release(record.signature);active.delete(key);}
 function sync(state){
  if(disposed)return;
  const seen=new Set(),occupied=new Set((state.citizens||[]).filter(c=>c.home!=null).map(c=>c.home));
  for(const b of state.buildings||[]){
   // Landscape owns connected canal beds, wetness, banks and construction.
   // The legacy standalone side walls would span across those real channels.
   if(b.type==='canal')continue;
   const key=buildingKey(b),signature=gameBuildingSignature(b,state);seen.add(key);
   let record=active.get(key);
   if(record&&(record.signature!==signature||record.x!==b.x||record.y!==b.y)){remove(key);record=null;}
   if(!record){
    const template=acquire(b,signature,state),root=new B.TransformNode(`game-building-${key}`,scene),parts=[];
    root.position.set(b.x*6,0,b.y*6);root.metadata={tile:{x:b.x,y:b.y},buildingKey:key,type:b.type};
    for(const source of template.sources){
     const mesh=source.metadata?.homeLamp?source.clone(`${key}-${source.name}`,null,true):source.createInstance(`${key}-${source.name}`);mesh.parent=root;mesh.isVisible=true;mesh.isPickable=true;mesh.checkCollisions=false;if(source.metadata?.homeLamp)mesh.receiveShadows=true;
     mesh.metadata={...root.metadata,homeLamp:!!source.metadata?.homeLamp};mesh.computeWorldMatrix(true);mesh.freezeWorldMatrix();parts.push(mesh);
    }
    record={root,meshes:parts,signature,x:b.x,y:b.y};active.set(key,record);meshes.push(...parts);
   }
   for(const mesh of record.meshes)if(mesh.metadata.homeLamp)mesh.material=occupied.has(key)?warm:shade;
  }
  for(const key of active.keys())if(!seen.has(key))remove(key);
 }
 return {sync,meshes,dispose(){if(disposed)return;for(const key of active.keys())remove(key);for(const source of originals)source.dispose();container.dispose();for(const m of ownedMaterials)m.dispose(false,false);disposed=true;}};
}
