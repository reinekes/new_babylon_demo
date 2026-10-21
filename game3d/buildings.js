import {footprintSize} from '../footprints.js';
import {createArchitecture} from './architecture.js';
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
export function gameBuildingSignature(b,state){
 return [b.type,b.footprint||1,tier(b),b.construction?.kind||'complete',b.construction?.target||'',progress(b),b.type==='field'?`${rotationOf(b)}:${districtCropVisual(b).signature}`:'',b.type==='bridge'||b.type==='field'?`${b.x},${b.y}`:'',b.type==='field'?JSON.stringify(state?.world?.lakes||[]):'',isHouse(b)?organicHouseVariant(b):''].join('|');
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
 let disposed=false,previewRecord=null;
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
 const houseFinishes=[1,2,3].map(level=>['#dfc8a1','#cab18c','#ead6b5'].map((color,variant)=>finish(`house-${level}-finish-${variant}`,level===3?['#b98760','#a77453','#c09269'][variant]:color,level>=2?materials.brick:materials.plaster)));
 const textiles=['#d9c39e','#ba9d77','#ded4b9'].map((color,i)=>finish(`household-cloth-${i}`,color,materials.linen));
 const materialSet={...materials,raw,fired,shade,trim,warm};
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
  const groups=new Map(),variant=organicHouseVariant(b);
  const box=(name,x,y,z,w,h,d,mat)=>{
   if(isHouse(b)&&variant===1)x=-x;
   if(isHouse(b)&&variant===2){x*=.94;z*=.96;}
   if(b.type==='ziggurat'&&b.footprint===2){x=3+x*2;z=3+z*2;w*=2;d*=2;y*=2;h*=2;}
   const m=B.MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);m.position.set(x,y,z);m.material=mat||trim;
   if(!groups.has(m.material))groups.set(m.material,[]);groups.get(m.material).push(m);return m;
  };
  const level=tier(b),facing=level===3?fired:raw;
  if(isHouse(b)){
   // Three repeatable family layouts: courtyard screens, drying mats and vessels
   // vary without allocating a unique template or material per resident.
   const textile=textiles[variant],shadeX=[.9,-.7,.2][variant],shadeZ=[.05,.45,.9][variant],shadeW=[1.35,1.8,1.1][variant];
   for(const side of [-1,1])box('house-reed-screen-post',shadeX+side*shadeW/2,.65,shadeZ,.055,1.3,.055,materials.wood);
   box('house-courtyard-screen',shadeX,.97,shadeZ,shadeW,.6,.045,textile);
   box('house-roof-drying-mat',[-.9,.3,1.1][variant],2.21,-1.48,[1.15,1.6,.8][variant],.035,.62,textile);
   for(let i=0;i<variant+1;i++){
    const px=-1.6+i*.39,pz=1.85-variant*.17,body=B.MeshBuilder.CreateSphere('house-family-jar',{diameter:1,segments:8},scene);body.scaling.set(.27,.44,.27);body.position.set(px,.25,pz);body.material=materials.terracotta;
    if(!groups.has(body.material))groups.set(body.material,[]);groups.get(body.material).push(body);
    const rim=B.MeshBuilder.CreateCylinder('house-family-jar-rim',{height:.085,diameter:.16,tessellation:10},scene);rim.position.set(px,.5,pz);rim.material=materials.terracotta;groups.get(body.material).push(rim);
   }
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
    {
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
    if(/plastered/.test(original.material?.name||''))mesh.material=houseFinishes[tier(b)-1][organicHouseVariant(b)];
    mesh.overrideMaterialSideOrientation=original.overrideMaterialSideOrientation;
    mesh.parent=root;sources.push(mesh);
   }
  }else{
   if(b.type==='field'||b.type==='bridge'||b.type==='house'||b.type==='canal'){
    const base=createDistrictBuilding(B,scene,{...b,id:'template'},materialSet);
    for(const mesh of base.meshes){mesh.unfreezeWorldMatrix();mesh.parent=root;sources.push(mesh);}
    base.root.dispose();
   }else for(const mesh of createArchitecture(B,scene,b,materialSet)){mesh.parent=root;sources.push(mesh);}

  }
  sources.push(...additions(b,root));
  if(b.type==='field')sources=sources.filter(mesh=>{
   const data=B.VertexData.ExtractFromMesh(mesh),clipped=clippedFieldGeometry(data,b,state);
   if(!clipped.indices.length){mesh.dispose();return false;}
   const geometry=new B.VertexData();Object.assign(geometry,clipped);geometry.applyToMesh(mesh);return true;
  });
  if(isHouse(b)){
   for(let index=0;index<4;index++){
    const lamp=B.MeshBuilder.CreateBox(`game-home-lamp-${index}`,{width:.22,height:.2,depth:.04},scene);lamp.position.set(.22+index*.34,1.08,.52);lamp.material=shade;lamp.parent=root;lamp.metadata={homeLamp:true,lampIndex:index};sources.push(lamp);
   }
  }
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
  mat.alpha=.34;mat.transparencyMode=B.PBRMaterial.PBRMATERIAL_ALPHABLEND;mat.emissiveColor=B.Color3.FromHexString(allowed?'#35634a':'#772e24');mat.backFaceCulling=base.backFaceCulling;mat.sideOrientation=base.sideOrientation;mat.disableDepthWrite=true;
  pair.set(allowed,mat);return mat;
 }
 function clearPreview(){if(previewRecord){previewRecord.root.dispose();previewRecord=null;}}
 function preview(input,state,options={}){
  if(disposed)return null;if(!input){clearPreview();return null;}
  const b={...input,level:1,construction:undefined},signature=gameBuildingSignature(b,state),allowed=options.allowed!==false;
  if(!previewRecord||previewRecord.signature!==signature){
   clearPreview();let template=previewTemplates.get(signature);
   if(template){previewTemplates.delete(signature);previewTemplates.set(signature,template);}else{template=acquire(b,signature,state);previewTemplates.set(signature,template);}
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
  if(disposed)return;
  const seen=new Set(),occupied=new Map();for(const c of state.citizens||[])if(c.home!=null)occupied.set(c.home,(occupied.get(c.home)||0)+1);
  for(const b of state.buildings||[]){
   // Landscape owns connected canal beds, wetness, banks and construction.
   // The legacy standalone side walls would span across those real channels.
   if(b.type==='canal')continue;
   const key=buildingKey(b),signature=gameBuildingSignature(b,state);seen.add(key);
   let record=active.get(key);
   if(record&&(record.signature!==signature||record.x!==b.x||record.y!==b.y)){remove(key);record=null;}
   if(!record){
    const template=acquire(b,signature,state),root=new B.TransformNode(`game-building-${key}`,scene),parts=[];
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
   const litWindows=Math.ceil(Math.min(1,(occupied.get(key)||0)/Math.max(1,capacityOf(b)))*4);
   for(const mesh of record.meshes)if(mesh.metadata.homeLamp)mesh.material=mesh.metadata.lampIndex<litWindows?warm:shade;
  }
  for(const key of active.keys())if(!seen.has(key))remove(key);
 }
 return {sync,meshes,preview,clearPreview,light(night){const n=Math.max(0,Math.min(1,night||0));warm.emissiveColor.set(.065+.72*n,.035+.38*n,.012+.11*n);},dispose(){if(disposed)return;clearPreview();for(const key of previewTemplates.keys())release(key);previewTemplates.clear();ghostMaterials.clear();for(const key of active.keys())remove(key);for(const source of originals)source.dispose();container.dispose();for(const m of ownedMaterials)m.dispose(false,false);disposed=true;}};
}
