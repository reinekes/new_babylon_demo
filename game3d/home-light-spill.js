// A soft pool of light on a real surface, with an invisible outer rim.
export function createLampPool(B,scene,name,rings,centreAlpha,width=1,depth=1,offset=0){
 const mesh=new B.Mesh(name,scene);
 const data=new B.VertexData(),sides=16;
 data.positions=[0,0,offset];data.normals=[0,1,0];data.colors=[1,1,1,centreAlpha];data.indices=[];
 for(const [ring,[radius,brightness]] of rings.entries()){
  for(let i=0;i<sides;i++){
   const angle=2*Math.PI*i/sides;
   data.positions.push(Math.cos(angle)*radius*width,0,offset+Math.sin(angle)*radius*depth);
   data.normals.push(0,1,0);data.colors.push(1,1,1,brightness);
   const at=1+ring*sides+i,next=1+ring*sides+(i+1)%sides;
   if(ring===0)data.indices.push(0,next,at);
   else data.indices.push(at-sides,next,at,at-sides,next-sides,next);
  }
 }
 data.applyToMesh(mesh);mesh.useVertexColors=true;mesh.hasVertexAlpha=true;
 return mesh;
}

// Light falling through the doorway onto the courtyard. The same world-space
// footprint stays visible when individual window slits become smaller than a pixel.
export function createHomeLightSpill(B,scene){
 let mesh,material,dirty=true,count=0;
 function create(){
  mesh=createLampPool(B,scene,'occupied-courtyard-light',[[.26,.72],[.59,.36],[1,0]],.9,1.39,1.72,.53);
  material=new B.StandardMaterial('occupied-doorway-amber',scene);
  material.diffuseColor=B.Color3.Black();material.emissiveColor=new B.Color3(1,.56,.19);
  material.disableLighting=true;material.disableDepthWrite=true;material.backFaceCulling=false;
  material.alphaMode=B.Engine.ALPHA_ADD;mesh.material=material;
  mesh.isPickable=false;mesh.receiveShadows=false;
 }
 function update(night,homes){
  if(night<=0){if(mesh?.isEnabled())mesh.setEnabled(false);return;}
  if(dirty){
   const occupied=[];
   for(const home of homes.values())if(home.litWindows>0)occupied.push(home);
   count=occupied.length;
   if(count){
    if(!mesh)create();
    const matrices=new Float32Array(count*16);
    for(const [i,home] of occupied.entries()){
     const origin=home.lampOrigin,centre=origin.x+(origin.slots ? .5*(origin.slots-1)*origin.spacing : .27);
     const local=B.Matrix.Translation(centre,(home.platform?.lift||0)+.16,origin.z+.46);
     local.multiply(home.root.computeWorldMatrix(true)).copyToArray(matrices,i*16);
    }
    mesh.thinInstanceSetBuffer('matrix',matrices,16,true);mesh.thinInstanceRefreshBoundingInfo();
   }
   dirty=false;
  }
  if(mesh){
   if(mesh.isEnabled()!==Boolean(count))mesh.setEnabled(Boolean(count));
   material.alpha=.72*night;
  }
 }
 return {invalidate(){dirty=true;},update,dispose(){mesh?.dispose();material?.dispose();}};
}
