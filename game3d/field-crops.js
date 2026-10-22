import {districtCropVisual} from '../district3d/buildings.js';
import {lakeContours} from './lake-shore.js';
import {fieldWorldPoint,FIELD_SHORE_BUFFER} from './field-shore.js';
import {renderedShoreDistance,visualSurfaceElevation} from './shore-profile.js';

export const FIELD_CROP_ASSET='assets/art-courtyard/models/valley-barley.glb';
export const usesBarleyCards=b=>b.type==='field'&&b.construction?.kind!=='new'&&districtCropVisual(b).growth>.35;

// One optional atlas load for the layer. Keep the established procedural crops
// if the asset cannot load; a failed optional model must never hide the field.
export async function loadFieldCrops(B,scene){
 let container,base;
 const batches=new Map();
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
  function create(b,state){
   if(!usesBarleyCards(b))return [];
   const visual=districtCropVisual(b);
   if(!['growing','ripe'].includes(visual.stage)||visual.standing<=0)return [];
   const growth=Math.ceil(visual.growth*6)/6,scale=.2+growth*.8,contours=lakeContours(state),points=[];
   let allDry=true;
   for(let row=0;row<8;row++)for(let i=0;i<8;i++){
    if((row*8+i+.5)/64>visual.sown*visual.standing)continue;
    const x=-2.2+row*.62,z=-2.2+i*.62,world=fieldWorldPoint(b,x,z);
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
   const key=`${growth}:${points.length}`,cached=allDry&&flat?batches.get(key):null;
   if(cached){const mesh=cached.clone('game-field-barley',null,true);mesh.metadata={fieldCrops:true,clumps:points.length};return [mesh];}
   const positions=[],indices=[],normals=[],uvs=[];
   for(const {x,z,angle}of points){
    const c=Math.cos(angle),s=Math.sin(angle),offset=positions.length/3;
    for(let k=0;k<data.positions.length;k+=3){
     const X=x+(data.positions[k]*c+data.positions[k+2]*s)*scale,Z=z+(-data.positions[k]*s+data.positions[k+2]*c)*scale,p=fieldWorldPoint(b,X,Z);
     positions.push(X,.16+data.positions[k+1]*scale+visualSurfaceElevation(p.x,p.y,state,contours),Z);
     if(data.normals.length)normals.push(data.normals[k]*c+data.normals[k+2]*s,data.normals[k+1],-data.normals[k]*s+data.normals[k+2]*c);
    }
    indices.push(...data.indices.map(i=>i+offset));uvs.push(...data.uvs);
   }
   const mesh=new B.Mesh('game-field-barley',scene),geometry=new B.VertexData();
   if(!normals.length)B.VertexData.ComputeNormals(positions,indices,normals);
   Object.assign(geometry,{positions,indices,normals,uvs});geometry.applyToMesh(mesh);mesh.material=material;mesh.overrideMaterialSideOrientation=base.overrideMaterialSideOrientation;mesh.metadata={fieldCrops:true,clumps:points.length};
   if(allDry&&flat){
    const source=mesh.clone('game-field-barley-batch',null,true);source.isVisible=false;source.isPickable=false;batches.set(key,source);
    while(batches.size>24){const oldest=batches.keys().next().value;batches.get(oldest).dispose();batches.delete(oldest);}
   }
   return [mesh];
  }
  return {create,dispose(){for(const mesh of batches.values())mesh.dispose();batches.clear();base.dispose();container.dispose();}};
 }catch{
  base?.dispose();container?.dispose();return null;
 }
}
