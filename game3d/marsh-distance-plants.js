// Orthographic views of the same GLBs share one alpha-tested material. At city
// overview distances six triangles retain each plant's habit and ear colour.
const charts = new Map([
 ['marsh-plumed-cane-epidermis', [0,1.56,2.86]],
 ['marsh-cattail-epidermis', [1,1.40,1.67]],
 ['marsh-clubrush-epidermis', [2,.87,.59]],
 ['alluvial-awn-grass-epidermis', [3,.84,.64]]
]);

export function createMarshDistanceCover(B,scene){
 let material=null,texture=null,far=false;
 const regions=new Map(),nearMeshes=[],farMeshes=[];
 function clear(){
  nearMeshes.length=0;regions.clear();
  for(const mesh of farMeshes)mesh.dispose();
  farMeshes.length=0;far=false;
 }
 function collect(mesh,points,cell,matrices){
  const chart=charts.get(mesh.material.name);
  if(!chart||typeof Image==='undefined')return;
  if(!material){
   material=new B.PBRMaterial('floodplain-distant-foliage',scene);
   texture=new B.Texture('assets/3d/textures/floodplain-botany-distant.webp',scene,false,true);
   texture.hasAlpha=true;material.albedoTexture=texture;material.useAlphaFromAlbedoTexture=true;
   material.transparencyMode=B.Material.MATERIAL_ALPHATEST;material.alphaCutOff=.19;
   material.roughness=.94;material.metallic=0;material.backFaceCulling=false;
   material.twoSidedLighting=false;
  }
  nearMeshes.push(mesh);
  if(!regions.has(cell))regions.set(cell,{positions:[],indices:[],normals:[],uvs:[]});
  const g=regions.get(cell),[column,width,height]=chart;
  for(const [i,p] of points.entries()){
   const cx=matrices[i*16+12],cy=matrices[i*16+13],cz=matrices[i*16+14];
   const w=p.scale*width,h=(p.scaleY??p.scale)*height;
   const cos=Math.cos(p.angle),sin=Math.sin(p.angle);
   const quad=(row,offsets)=>{
    const index=g.positions.length/3,u0=column/4+.001,u1=(column+1)/4-.001,v1=1-row/4-.001,v0=1-(row+1)/4+.001;
    g.uvs.push(u0,v0,u1,v0,u1,v1,u0,v1);
    for(const [x,y,z] of offsets){g.positions.push(cx+(x*cos+z*sin)*w,cy+y*h,cz+(-x*sin+z*cos)*w);g.normals.push(0,1,0);}
    g.indices.push(index,index+1,index+2,index,index+2,index+3);
   };
   quad(0,[[-.5,0,0],[.5,0,0],[.5,1,0],[-.5,1,0]]);
   quad(1,[[0,0,-.5],[0,0,.5],[0,1,.5],[0,1,-.5]]);
   quad(2,[[-.5,.51,.5],[.5,.51,.5],[.5,.51,-.5],[-.5,.51,-.5]]);
  }
 }
 function finish(){
  for(const [cell,g] of regions){
   const mesh=new B.Mesh('distant-marsh-'+cell,scene),data=new B.VertexData();
   Object.assign(data,g);data.applyToMesh(mesh);mesh.material=material;
   mesh.metadata={distantMarsh:true};mesh.isPickable=false;mesh.receiveShadows=true;
   mesh.freezeWorldMatrix();mesh.setEnabled(false);farMeshes.push(mesh);
  }
  regions.clear();
 }
 function update(){
  if(!farMeshes.length)return;
  const radius=scene.activeCamera?.radius??0;
  const next=texture.isReady()&&radius>(far?63:75);
  if(next===far)return;
  far=next;
  for(const mesh of nearMeshes)mesh.setEnabled(!far);
  for(const mesh of farMeshes)mesh.setEnabled(far);
 }
 return {collect,finish,update,clear,meshes:farMeshes,dispose(){clear();material?.dispose(false,false);texture?.dispose();}};
}
