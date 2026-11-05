// Presentation only: the caller retains each immutable road geometry cache.
// Changed source geometry must be replaced or its world matrix recomputed.
export function createRoadRenderGroups(B,scene,meshes,{regionSize=8}={}){
 const groups=new Map(),originals=new Map();let disposed=false;
 const restore=()=>{for(const [mesh,enabled]of originals)if(!mesh.isDisposed())mesh.setEnabled(enabled);};
 const release=group=>{const index=meshes.indexOf(group.mesh);if(index>=0)meshes.splice(index,1);group.mesh.dispose(false,false);};
 function update(entries){
  if(disposed)return;restore();const wanted=new Map(),seen=new Set();
  for(const entry of entries){
   const {mesh,a,b}=entry;if(!mesh||mesh.isDisposed()||seen.has(mesh))continue;seen.add(mesh);
   if(!originals.has(mesh))originals.set(mesh,mesh.isEnabled());
   if(entry.working||!mesh.isEnabled()||!mesh.isVisible||mesh.visibility!==1||!mesh.material)continue;
   const x=Math.floor((a.x+b.x)/2/regionSize),y=Math.floor((a.y+b.y)/2/regionSize),key=[x,y,mesh.material.uniqueId,mesh.layerMask,mesh.renderingGroupId,mesh.receiveShadows,mesh.overrideMaterialSideOrientation].join(':');
   if(!wanted.has(key))wanted.set(key,[]);wanted.get(key).push(entry);
  }
  for(const mesh of originals.keys())if(!seen.has(mesh)||mesh.isDisposed())originals.delete(mesh);
  const retained=new Set();
  for(const [key,entries]of wanted){
   if(entries.length<2)continue;
   const signature=entries.map(({mesh})=>[mesh.uniqueId,mesh.getWorldMatrix().updateFlag,mesh.geometry?.uniqueId].join(',')).join('|');
   let group=groups.get(key);
   if(group?.signature!==signature){
    if(group){release(group);groups.delete(key);}let merged=null;
    try{merged=B.Mesh.MergeMeshes(entries.map(e=>e.mesh),false,true,null,false,false);}catch{}
    if(!merged)continue;
    const source=entries[0].mesh;merged.name=`road-region-${key}`;merged.material=source.material;merged.isPickable=false;merged.receiveShadows=source.receiveShadows;merged.layerMask=source.layerMask;merged.renderingGroupId=source.renderingGroupId;merged.overrideMaterialSideOrientation=source.overrideMaterialSideOrientation;merged.hasVertexAlpha=true;merged.useVertexColors=true;
    merged.metadata={road:{batched:true},roadRenderGroup:{ids:entries.map(e=>e.id)}};merged.computeWorldMatrix(true);merged.freezeWorldMatrix();
    group={mesh:merged,signature};groups.set(key,group);meshes.push(merged);
   }
   retained.add(key);for(const {mesh}of entries)mesh.setEnabled(false);
  }
  for(const [key,group]of groups)if(!retained.has(key)){release(group);groups.delete(key);}
 }
 function dispose(){if(disposed)return;disposed=true;restore();for(const group of groups.values())release(group);groups.clear();originals.clear();}
 return {update,dispose};
}
