import {cropSeed,fieldCropKind,cropPlantGeometry,createBotanicalMaterial,botanicalMesh} from './crop-varieties.js';
import {districtCropVisual} from '../district3d/buildings.js';
import {lakeContours} from './lake-shore.js';
import {fieldWorldPoint,FIELD_SHORE_BUFFER} from './field-shore.js';
import {renderedShoreDistance,visualSurfaceElevation} from './shore-profile.js';

export const FIELD_CROP_ASSET='assets/art-courtyard/models/valley-barley.glb';
export const EMMER_CROP_ASSET='assets/art-courtyard/models/crop-emmer.glb';
export const usesBarleyCards=b=>b.type==='field'&&b.construction?.kind!=='new'&&districtCropVisual(b).growth>.35;

// One optional atlas load for the layer. Keep the established procedural crops
// if the asset cannot load; a failed optional model must never hide the field.
export async function loadFieldCrops(B,scene){
 let container,base;
 const batches=new Map(),owned=[],extraContainers=[];
 try{
  container=await B.SceneLoader.LoadAssetContainerAsync('',FIELD_CROP_ASSET,scene,undefined,'.glb');container.addAllToScene();
  const sources=container.meshes.filter(m=>m.getTotalVertices());
  if(!sources.length)throw Error('Barley model has no geometry');
  for(const mesh of sources)mesh.computeWorldMatrix(true);
  const reflected=sources[0].getWorldMatrix().determinant()<0,material=sources[0].material;
  base=B.Mesh.MergeMeshes(sources,true,true,undefined,false,false);
  base.name='game-barley-source';base.material=material;base.isVisible=false;base.isPickable=false;
  base.overrideMaterialSideOrientation=reflected?B.Material.ClockWiseSideOrientation:B.Material.CounterClockWiseSideOrientation;
  // Preserve the source atlas and its glTF orientation. The narrow awns and
  // gaps between stalks are cutouts, not opaque rectangles or blended sheets.
  material.transparencyMode=B.PBRMaterial.PBRMATERIAL_ALPHATEST;material.alphaCutOff=.35;material.useAlphaFromAlbedoTexture=true;material.backFaceCulling=false;material.twoSidedLighting=true;
  if(material.albedoTexture)material.albedoTexture.hasAlpha=true;
  const source=B.VertexData.ExtractFromMesh(base),bounds=base.getBoundingInfo().boundingBox,min=bounds.minimum,max=bounds.maximum,height=max.y-min.y;
  if(!(height>0))throw Error('Barley model has no height');
  const authoredScale=.95/height,cx=(min.x+max.x)/2,cz=(min.z+max.z)/2;
  const data={positions:Array.from(source.positions),indices:Array.from(source.indices),normals:Array.from(source.normals||[]),uvs:Array.from(source.uvs||[])};
  for(let i=0;i<data.positions.length;i+=3){data.positions[i]=(data.positions[i]-cx)*authoredScale;data.positions[i+1]=(data.positions[i+1]-min.y)*authoredScale;data.positions[i+2]=(data.positions[i+2]-cz)*authoredScale;}
  const radius=Math.max(...Array.from({length:data.positions.length/3},(_,i)=>Math.hypot(data.positions[i*3],data.positions[i*3+2])));
  const botanicalMaterial=createBotanicalMaterial(B,scene);owned.push(botanicalMaterial);
  const sourcesByKind=new Map([['barley',{data,radius,material,orientation:base.overrideMaterialSideOrientation,count:8}]]);
  for(const kind of ['flax','lentil','pea','chickpea','onion']){
   const data=cropPlantGeometry(kind);data.normals=[];B.VertexData.ComputeNormals(data.positions,data.indices,data.normals);
   sourcesByKind.set(kind,{data,radius:.34,material:botanicalMaterial,count:8});
  }
  try{
   const extra=await B.SceneLoader.LoadAssetContainerAsync('',EMMER_CROP_ASSET,scene,undefined,'.glb');extraContainers.push(extra);extra.addAllToScene();
   const parts=extra.meshes.filter(m=>m.getTotalVertices());for(const m of parts)m.computeWorldMatrix(true);
   const reflected=parts[0].getWorldMatrix().determinant()<0,mat=parts[0].material;
   const merged=B.Mesh.MergeMeshes(parts,true,true,undefined,false,false);merged.isVisible=false;merged.isPickable=false;
   const source=B.VertexData.ExtractFromMesh(merged),bounds=merged.getBoundingInfo().boundingBox,lo=bounds.minimum,hi=bounds.maximum;
   const emmer={positions:Array.from(source.positions),indices:Array.from(source.indices),normals:Array.from(source.normals||[]),uvs:Array.from(source.uvs||[])},factor=1.02/(hi.y-lo.y);
   for(let i=0;i<emmer.positions.length;i+=3){emmer.positions[i]=(emmer.positions[i]-(lo.x+hi.x)/2)*factor;emmer.positions[i+1]=(emmer.positions[i+1]-lo.y)*factor;emmer.positions[i+2]=(emmer.positions[i+2]-(lo.z+hi.z)/2)*factor;}
   mat.backFaceCulling=false;mat.twoSidedLighting=true;mat.transparencyMode=B.PBRMaterial.PBRMATERIAL_ALPHATEST;mat.alphaCutOff=.185;mat.useAlphaFromAlbedoTexture=true;if(mat.albedoTexture)mat.albedoTexture.hasAlpha=true;
   const emmerRadius=Math.max(...Array.from({length:emmer.positions.length/3},(_,i)=>Math.hypot(emmer.positions[i*3],emmer.positions[i*3+2])));
   sourcesByKind.set('emmer',{data:emmer,radius:emmerRadius,material:mat,orientation:reflected?B.Material.ClockWiseSideOrientation:B.Material.CounterClockWiseSideOrientation,count:4});owned.push(merged);
  }catch{/* A missing optional wheat does not remove the original barley. */}
  function create(b,state){
   if(!usesBarleyCards(b))return [];
   const visual=districtCropVisual(b),kind=fieldCropKind(b),source=sourcesByKind.get(kind)||sourcesByKind.get('barley'),{data,radius,material,count}=source;
   if(!['growing','ripe'].includes(visual.stage)||visual.standing<=0)return [];
   const growth=Math.ceil(visual.growth*6)/6,scale=.2+growth*.8,contours=lakeContours(state),points=[];
   let allDry=true;
   for(let row=0;row<count;row++)for(let i=0;i<count;i++){
    if((row*count+i+.5)/(count*count)>visual.sown*visual.standing)continue;
    const spacing=count===8?.62:1.25,start=count===8?-2.2:-1.875,x=start+row*spacing,z=start+i*spacing,world=fieldWorldPoint(b,x,z);
    // Whole clumps stay on the dry part of the rounded bank. A conservative
    // radius covers all triangles after rotation, not just their centre.
    if(renderedShoreDistance(world.x,world.y,state,contours)<FIELD_SHORE_BUFFER+radius*scale/6*1.3){allDry=false;continue;}
    points.push({x,z,angle:(row*1.71+i*.83)%Math.PI});
   }
   if(!points.length)return [];
   // Inland batches share their geometry across fields. Their rows and stages
   // are identical; shore omissions and sloping beds need their own geometry.
   const flat=points.every(({x,z})=>{
    const p=fieldWorldPoint(b,x,z);return Math.abs(visualSurfaceElevation(p.x,p.y,state,contours))<1e-8&&renderedShoreDistance(p.x,p.y,state,contours)>.4+radius*scale/6;
   });
   const key=`${kind}:${growth}:${points.length}`,cached=allDry&&flat?batches.get(key):null;
   if(cached){const mesh=cached.clone(`game-field-${kind}`,null,true);mesh.metadata={fieldCrops:true,cropKind:kind,clumps:points.length};return [mesh];}
   const positions=[],indices=[],normals=[],uvs=[],colors=[];
   for(const {x,z,angle}of points){
    const c=Math.cos(angle),s=Math.sin(angle),offset=positions.length/3;
    for(let k=0;k<data.positions.length;k+=3){
     const X=x+(data.positions[k]*c+data.positions[k+2]*s)*scale,Z=z+(-data.positions[k]*s+data.positions[k+2]*c)*scale,p=fieldWorldPoint(b,X,Z);
     positions.push(X,.16+data.positions[k+1]*scale+visualSurfaceElevation(p.x,p.y,state,contours),Z);
     if(data.normals.length)normals.push(data.normals[k]*c+data.normals[k+2]*s,data.normals[k+1],-data.normals[k]*s+data.normals[k+2]*c);
    }
    indices.push(...data.indices.map(i=>i+offset));uvs.push(...(data.uvs||[]));if(data.colors)colors.push(...data.colors);
   }
   const mesh=new B.Mesh(`game-field-${kind}`,scene),geometry=new B.VertexData();
   if(!normals.length)B.VertexData.ComputeNormals(positions,indices,normals);
   Object.assign(geometry,{positions,indices,normals,uvs,...(colors.length?{colors}:{})});geometry.applyToMesh(mesh);mesh.material=material;mesh.overrideMaterialSideOrientation=source.orientation;mesh.metadata={fieldCrops:true,cropKind:kind,clumps:points.length};
   if(allDry&&flat){
    const source=mesh.clone('game-field-barley-batch',null,true);source.isVisible=false;source.isPickable=false;batches.set(key,source);
    while(batches.size>24){const oldest=batches.keys().next().value;batches.get(oldest).dispose();batches.delete(oldest);}
   }
   return [mesh];
  }
  function createGarden(b,state){
   if(b.type!=='house'||b.construction?.kind==='new')return [];
   const seed=cropSeed(b),kinds=['onion','lentil','pea','chickpea','flax'],positions=[],indices=[],colors=[],contours=lakeContours(state);let plants=0;
   // Small household beds stand beside the front edge, inside the 6 m tile.
   for(let row=0;row<2;row++)for(let i=0;i<5;i++){
    const kind=kinds[(seed+row)%kinds.length],data=sourcesByKind.get(kind).data,x=-1.05+i*.42,z=2.32+row*.30,world=fieldWorldPoint(b,x,z);
    if(renderedShoreDistance(world.x,world.y,state,contours)<FIELD_SHORE_BUFFER+.05)continue;
    const offset=positions.length/3;
    for(let k=0;k<data.positions.length;k+=3){const X=x+data.positions[k]*.62,Z=z+data.positions[k+2]*.62,p=fieldWorldPoint(b,X,Z);positions.push(X,.12+data.positions[k+1]*.62+visualSurfaceElevation(p.x,p.y,state,contours),Z);}
    indices.push(...data.indices.map(k=>k+offset));colors.push(...data.colors);plants++;
   }
   if(!plants)return [];
   const mesh=botanicalMesh(B,scene,'game-household-garden',{positions,indices,colors},botanicalMaterial);mesh.metadata={householdGarden:true,plants,cropKinds:[kinds[seed%kinds.length],kinds[(seed+1)%kinds.length]]};return [mesh];
  }
  return {create,createGarden,dispose(){for(const mesh of batches.values())mesh.dispose();batches.clear();for(const item of owned)item.dispose();for(const extra of extraContainers)extra.dispose();base.dispose();container.dispose();}};
 }catch{
  base?.dispose();container?.dispose();return null;
 }
}
