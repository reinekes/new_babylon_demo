// Babylon normally asks isReady() of every scene mesh before checking visibility.
// A city owns many disabled clothing/tools and hidden source GLBs. Omit those
// before the expensive material check, while preserving live camera masks and
// invisible intersection-action meshes. Shadow render lists remain independent.
export function createRenderableMeshCandidates(scene){
 const candidates={data:[],length:0},owners=new WeakMap(),visibleOwners=new WeakMap();
 const frozenResults=new WeakMap(),lastTransform=[],lastFrustum=[];
 let frame=0,cameraRevision=0,lastCamera,lastProjection;
 function cameraChanged(camera,transform,planes,height){
  const projection=[height,camera?.mode,camera?.fovMode,camera?.fov,scene.skipFrustumClipping,Boolean(scene.frustumPlanes)].join('|');
  let changed=camera!==lastCamera||projection!==lastProjection||transform.length!==lastTransform.length||planes.length*4!==lastFrustum.length;
  for(let i=0;i<transform.length;i++){
   if(transform[i]!==lastTransform[i])changed=true;
   lastTransform[i]=transform[i];
  }
  for(let i=0;i<planes.length;i++){
   const {normal,d}=planes[i];
   const offset=i*4;
   if(normal?.x!==lastFrustum[offset]||normal?.y!==lastFrustum[offset+1]||normal?.z!==lastFrustum[offset+2]||d!==lastFrustum[offset+3])changed=true;
   lastFrustum[offset]=normal?.x;
   lastFrustum[offset+1]=normal?.y;
   lastFrustum[offset+2]=normal?.z;
   lastFrustum[offset+3]=d;
  }
  if(changed){
   cameraRevision++;
   lastTransform.length=transform.length;
   lastFrustum.length=planes.length*4;
   lastCamera=camera;
   lastProjection=projection;
  }
 }
 function eligible(mesh,planes,eye,height,view,halfFovTangent,depthScale){
   let matrixReady=false;
   // Match Babylon's existing camera-frustum decision, before material readiness.
   // Shadow-only offscreen casters still use the independent explicit render list.
   if(!scene.skipFrustumClipping&&!mesh.actionManager&&!mesh.alwaysSelectAsActiveMesh&&!mesh.billboardMode&&planes.length&&mesh.isInFrustum){
    let owner=owners.get(mesh);
    if(owner===undefined){owner=null;for(let n=mesh.parent;n;n=n.parent)if(n.simplifiedShadow!==undefined||n.metadata?.animalKind==='fish'){owner=n;break;}owners.set(mesh,owner);}
    if(owner?.getAbsolutePosition){
     let cached=visibleOwners.get(owner);
     if(cached?.frame!==frame){
      const point=owner.getAbsolutePosition(),fish=owner.metadata?.animalKind==='fish',radius=fish?4:10;
      const depth=fish&&view?Math.abs(point.x*view[2]+point.y*view[6]+point.z*view[10]+view[14]):0;
      cached={frame,visible:planes.every(p=>p.dotCoordinate(point)>=-radius),depth};visibleOwners.set(owner,cached);
     }
     if(!cached.visible)return false;
     const fishRadius=owner.metadata?.fishModelRadius;
     if(fishRadius&&halfFovTangent&&view){
      const depth=Math.max(.01,cached.depth-fishRadius*depthScale);
      if(fishRadius*height<halfFovTangent*depth*.99999)return false;
     }
    }
    mesh.computeWorldMatrix?.();matrixReady=true;if(!mesh.isInFrustum(planes))return false;
   }
   if(!mesh.actionManager&&!mesh.alwaysSelectAsActiveMesh&&!mesh.billboardMode&&halfFovTangent){
    if(!matrixReady)mesh.computeWorldMatrix?.();const sphere=mesh.getBoundingInfo?.()?.boundingSphere;
    if(sphere){const p=sphere.centerWorld,depth=view?Math.abs(p.x*view[2]+p.y*view[6]+p.z*view[10]+view[14]):Math.hypot(p.x-eye.x,p.y-eye.y,p.z-eye.z)*.7,pixels=sphere.radiusWorld*height/(halfFovTangent*Math.max(.01,depth));
     if(pixels<1)return false;
    }
   }
  return true;
 }
 return ()=>{
  const camera=scene.activeCamera,mask=camera?.layerMask??0xffffffff,eye=camera?.globalPosition||camera?.position;
  const height=scene.getEngine?.().getRenderHeight?.()||0,view=camera?.getViewMatrix?.().m;
  const screenBudget=camera?.mode!==1&&camera?.fovMode!==1&&eye&&height&&camera.fov>0,halfFovTangent=screenBudget?Math.tan(camera.fov/2):0;
  const depthScale=view?Math.hypot(view[2],view[6],view[10]):0;
  const planes=scene.frustumPlanes||[],transform=scene.getTransformMatrix?.()?.m;
  if(transform)cameraChanged(camera,transform,planes,height);
  let count=0;frame++;
  for(const mesh of scene.meshes){
   if(mesh.isBlocked||!mesh.isEnabled())continue;
   if(!mesh.actionManager&&(!mesh.isVisible||mesh.visibility<=0||(mesh.layerMask&mask)===0))continue;
   const frozen=transform&&mesh.isWorldMatrixFrozen&&!mesh.infiniteDistance&&!mesh.skeleton&&!mesh.sourceMesh?.skeleton
    &&!mesh.morphTargetManager&&!mesh.sourceMesh?.morphTargetManager&&!mesh.hasThinInstances
    &&!mesh.actionManager&&!mesh.alwaysSelectAsActiveMesh&&!mesh.billboardMode;
   if(frozen){
    const world=mesh.getWorldMatrix(),geometry=mesh.geometry||mesh.sourceMesh?.geometry,bounds=mesh.getBoundingInfo?.(),previous=frozenResults.get(mesh);
    if(previous?.revision===cameraRevision&&previous.world===world&&previous.version===world.updateFlag&&previous.geometry===geometry&&previous.bounds===bounds){
     if(previous.visible)candidates.data[count++]=mesh;
     continue;
    }
    const visible=eligible(mesh,planes,eye,height,view,halfFovTangent,depthScale);
    frozenResults.set(mesh,{revision:cameraRevision,world,version:world.updateFlag,geometry,bounds,visible});
    if(visible)candidates.data[count++]=mesh;
    continue;
   }
   if(eligible(mesh,planes,eye,height,view,halfFovTangent,depthScale))candidates.data[count++]=mesh;
  }
  candidates.data.length=count;candidates.length=count;return candidates;
 };
}
