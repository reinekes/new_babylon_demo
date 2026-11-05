// Existing palm parts remain the fallback; all matrices are disposable display data.
const ROLL=.008;
export function createPalmRenderGroups(B,scene,meshes,{regionSize=Infinity}={}){
 const batches=[],originals=new Map(),poses=new Map();let signature='',disposed=false,lastWind=false,lastTime=NaN;
 const quaternion=new B.Quaternion();
 function clear(){for(const [mesh,enabled]of originals)if(!mesh.isDisposed())mesh.setEnabled(enabled);for(const batch of batches){const i=meshes.indexOf(batch.mesh);if(i>=0)meshes.splice(i,1);batch.mesh.dispose(false,false);}batches.length=0;originals.clear();poses.clear();}
 function sync(instances,sourceCount,enabled=true){
  if(disposed)return;
  const next=JSON.stringify([enabled,sourceCount,instances.map(m=>[m.uniqueId,m.sourceMesh?.geometry?.uniqueId,m.position.x,m.position.y,m.position.z,m.scaling.x,m.scaling.y,m.scaling.z,m.rotation.x,m.rotation.y,m.parent?.uniqueId,m.rotationQuaternion?.asArray?.(),m.billboardMode,m.isVisible,m.visibility,m.material?.uniqueId,m.material?.needAlphaBlending?.(),m.layerMask,m.renderingGroupId,m.overrideMaterialSideOrientation,m.receiveShadows,m.alphaIndex])]);
  if(next===signature)return;signature=next;clear();lastWind=false;lastTime=NaN;
  const groups=new Map();
  for(const [index,part]of instances.entries()){
   if(part.isDisposed())continue;originals.set(part,part.isEnabled());const source=part.sourceMesh;
   if(!enabled||!(sourceCount>0)||!source?.geometry||!part.isEnabled()||!part.isVisible||part.visibility!==1||part.parent||part.rotationQuaternion||part.billboardMode||part.material?.needAlphaBlending?.()||!(part.scaling.x>0)||part.scaling.x!==part.scaling.y||part.scaling.y!==part.scaling.z)continue;
   const phase=Math.floor(index/sourceCount),poseKey=[phase,part.position.x,part.position.y,part.position.z,part.scaling.x,part.scaling.y,part.scaling.z,part.rotation.x,part.rotation.y].join(':');
   let pose=poses.get(poseKey);if(!pose){pose={phase,position:part.position.clone(),scale:part.scaling.clone(),pitch:part.rotation.x,yaw:part.rotation.y,matrix:B.Matrix.Identity()};B.Quaternion.RotationYawPitchRollToRef(pose.yaw,pose.pitch,0,quaternion);B.Matrix.ComposeToRef(pose.scale,quaternion,pose.position,pose.matrix);poses.set(poseKey,pose);}
   const cell=[Math.floor(part.position.x/regionSize),Math.floor(part.position.z/regionSize)],key=[...cell,source.uniqueId,part.material?.uniqueId,part.layerMask,part.renderingGroupId,part.overrideMaterialSideOrientation,part.receiveShadows,part.alphaIndex].join(':');
   if(!groups.has(key))groups.set(key,{source,parts:[],cell});groups.get(key).parts.push({part,pose});
  }
  for(const [key,{source,parts,cell}]of groups){let mesh=null;try{
   const sample=parts[0].part;mesh=source.clone(`date-palm-batch-${key}`,null,true);mesh.unfreezeWorldMatrix();mesh.parent=null;mesh.position.setAll(0);mesh.rotation.setAll(0);mesh.rotationQuaternion=null;mesh.scaling.setAll(1);mesh.setEnabled(true);mesh.isVisible=true;mesh.visibility=1;mesh.material=sample.material;mesh.isPickable=false;mesh.receiveShadows=sample.receiveShadows;mesh.layerMask=sample.layerMask;mesh.renderingGroupId=sample.renderingGroupId;mesh.overrideMaterialSideOrientation=sample.overrideMaterialSideOrientation;mesh.alphaIndex=sample.alphaIndex;
   // Thin matrix attributes belong to geometry in Babylon; shared clones
   // otherwise overwrite every other region's GPU transforms.
   mesh.makeGeometryUnique();
   const matrices=new Float32Array(parts.length*16);for(const [i,{pose}]of parts.entries())pose.matrix.copyToArray(matrices,i*16);
   mesh.thinInstanceSetBuffer('matrix',matrices,16,false);mesh.computeWorldMatrix(true);mesh.thinInstanceRefreshBoundingInfo();
   // Rotation moves any local point by at most |roll| * its distance from
   // the origin. Inflate the calm union once, retaining safe wind/shadow bounds.
   const local=source.getBoundingInfo().boundingBox,radius=Math.hypot(...['x','y','z'].map(a=>Math.max(Math.abs(local.minimum[a]),Math.abs(local.maximum[a])))),scale=Math.max(...parts.flatMap(({pose})=>[Math.abs(pose.scale.x),Math.abs(pose.scale.y),Math.abs(pose.scale.z)])),margin=radius*scale*ROLL+.0001,box=mesh.getBoundingInfo().boundingBox,pad=new B.Vector3(margin,margin,margin);
   mesh.setBoundingInfo(new B.BoundingInfo(box.minimum.subtract(pad),box.maximum.add(pad)));mesh.doNotSyncBoundingInfo=true;mesh.freezeWorldMatrix();mesh.metadata={palmBatch:{parts:parts.map(({part})=>part.uniqueId),sourceId:source.uniqueId,cell}};
   batches.push({mesh,parts,matrices});meshes.push(mesh);for(const {part}of parts)part.setEnabled(false);
  }catch{mesh?.dispose(false,false);}}
 }
 function updateWind(time,wind){
  if(disposed||wind===lastWind&&(!wind||time===lastTime))return;lastWind=wind;lastTime=time;
  for(const pose of poses.values()){B.Quaternion.RotationYawPitchRollToRef(pose.yaw,pose.pitch,wind?Math.sin(time*1.7+pose.phase)*ROLL:0,quaternion);B.Matrix.ComposeToRef(pose.scale,quaternion,pose.position,pose.matrix);}
  for(const {mesh,parts,matrices}of batches){for(const [i,{pose}]of parts.entries())mesh.thinInstanceSetMatrixAt(i,pose.matrix,false);mesh.thinInstanceBufferUpdated('matrix');}
 }
 function dispose(){if(disposed)return;disposed=true;clear();}
 return {sync,updateWind,dispose};
}
