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
