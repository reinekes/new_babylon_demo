// Babylon normally asks isReady() of every scene mesh before checking visibility.
// A city owns many disabled clothing/tools and hidden source GLBs. Omit those
// before the expensive material check, while preserving live camera masks and
// invisible intersection-action meshes. Shadow render lists remain independent.
export function createRenderableMeshCandidates(scene){
 const candidates={data:[],length:0},owners=new WeakMap(),visibleOwners=new WeakMap();let frame=0;
 return ()=>{
  const camera=scene.activeCamera,mask=camera?.layerMask??0xffffffff,eye=camera?.globalPosition||camera?.position,height=scene.getEngine?.().getRenderHeight?.()||0,view=camera?.getViewMatrix?.().m,screenBudget=camera?.mode!==1&&camera?.fovMode!==1&&eye&&height&&camera.fov>0,halfFovTangent=screenBudget?Math.tan(camera.fov/2):0;let count=0;frame++;
  for(const mesh of scene.meshes){
   if(mesh.isBlocked||!mesh.isEnabled())continue;
   if(!mesh.actionManager&&(!mesh.isVisible||mesh.visibility<=0||(mesh.layerMask&mask)===0))continue;
   let matrixReady=false;
   // Match Babylon's existing camera-frustum decision, before material readiness.
   // Shadow-only offscreen casters still use the independent explicit render list.
   if(!scene.skipFrustumClipping&&!mesh.actionManager&&!mesh.alwaysSelectAsActiveMesh&&!mesh.billboardMode&&scene.frustumPlanes?.length&&mesh.isInFrustum){
    let owner=owners.get(mesh);
    if(owner===undefined){owner=null;for(let n=mesh.parent;n;n=n.parent)if(n.simplifiedShadow!==undefined||n.metadata?.animalKind==='fish'){owner=n;break;}owners.set(mesh,owner);}
    if(owner?.getAbsolutePosition){
     let cached=visibleOwners.get(owner);
     if(cached?.frame!==frame){const point=owner.getAbsolutePosition(),radius=owner.metadata?.animalKind==='fish'?4:10;cached={frame,visible:scene.frustumPlanes.every(p=>p.dotCoordinate(point)>=-radius)};visibleOwners.set(owner,cached);}
     if(!cached.visible)continue;
    }
    mesh.computeWorldMatrix?.();matrixReady=true;if(!mesh.isInFrustum(scene.frustumPlanes))continue;
   }
   if(!mesh.actionManager&&!mesh.alwaysSelectAsActiveMesh&&!mesh.billboardMode&&screenBudget){
    if(!matrixReady)mesh.computeWorldMatrix?.();const sphere=mesh.getBoundingInfo?.()?.boundingSphere;
    if(sphere){const p=sphere.centerWorld,depth=view?Math.abs(p.x*view[2]+p.y*view[6]+p.z*view[10]+view[14]):Math.hypot(p.x-eye.x,p.y-eye.y,p.z-eye.z)*.7,pixels=sphere.radiusWorld*height/(halfFovTangent*Math.max(.01,depth));
     if(pixels<1)continue;
    }
   }
   candidates.data[count++]=mesh;
  }
  candidates.data.length=count;candidates.length=count;return candidates;
 };
}
