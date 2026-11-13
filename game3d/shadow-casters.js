// Roots can switch shadow detail without replacing the visible rig or person.
export function createActorShadowFilter(){
 const owners=new WeakMap();
 return mesh=>{
  if(mesh.isDisposed()||!mesh.isEnabled())return false;
  if(mesh.shadowProxy)return !!mesh.parent?.simplifiedShadow;
  let owner=owners.get(mesh);
  if(owner===undefined){owner=null;for(let n=mesh.parent;n;n=n.parent)if(n.simplifiedShadow!==undefined||n.metadata?.animalKind){owner=n;break;}owners.set(mesh,owner);}
  return owner?.metadata?.animalKind!=='fish'&&!owner?.simplifiedShadow;
 };
}

// Keep animated rigs on Babylon's normal path. Frozen rigid meshes outside the
// light's clip volume cannot write into the map, with padding for normal bias.
export function shadowCasterInside(mesh,planes){
 if(!mesh.isWorldMatrixFrozen||mesh.skeleton||mesh.sourceMesh?.skeleton
    ||mesh.morphTargetManager||mesh.sourceMesh?.morphTargetManager||mesh.hasThinInstances)return true;
 const box=mesh.getBoundingInfo?.()?.boundingBox;
 if(!box)return true;
 const {centerWorld:point,extendSizeWorld:size}=box;
 return planes.every(plane=>{
  const {x,y,z}=plane.normal;
  const radius=Math.abs(x)*size.x+Math.abs(y)*size.y+Math.abs(z)*size.z;
  return plane.dotCoordinate(point)>=-radius-1;
 });
}

// At a fixed full-city camera, present the same map and projection together
// on the intervening frame. Camera, world and light-mode changes render now.
export function createOverviewShadowCadence(){
 let previous=null,hold=false;
 return (state,mode,camera,enabled,paused,elapsed)=>{
  if(!enabled){previous=null;hold=false;return true;}
  const {alpha,beta,radius,target}=camera,signature=[mode,alpha,beta,radius,target.x,target.y,target.z,state.buildings.length,state.season];
  const stable=elapsed<.075&&previous?.state===state&&signature.every((value,i)=>value===previous.signature[i]);
  previous={state,signature};
  hold=!!stable&&!paused&&!hold;
  return !hold;
 };
}
