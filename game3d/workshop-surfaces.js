// Shared, local, original texture pairs from the approved courtyard-house study.
// Colour is applied in linear space. All building templates in a scene reuse
// the same texture objects, including those on the channel and road surfaces.
const libraries=new WeakMap();
const finishes={
 plaster:['plaster','#cbb699',.98],raw:['plaster','#a98a68',.98],
 fired:['plaster','#af7956',.94],trim:['plaster','#d3bea0',.98],
 earth:['earth','#a38c6e',1],stone:['earth','#989180',1],
 wood:['wood','#89745b',.94],reed:['reed','#b3a07a',.90],
 pottery:['pottery','#a57152',.94],cloth:['cloth','#b8aa90',.98],
 char:['wood','#514940',1],copper:['pottery','#866a50',.68],
};
export function workshopSurfaces(B,scene){
 let result=libraries.get(scene);if(result)return result;
 const materials=new Map(),maps=new Map();
 function textures(kind){
  if(!maps.has(kind)){
   const pair={};
   if(typeof Image!=='undefined'){
    for(const slot of ['color','normal']){
     const texture=new B.Texture('assets/3d/textures/courtyard/'+kind+'-'+slot+'.jpg',scene,false,true);
     texture.wrapU=texture.wrapV=B.Texture.WRAP_ADDRESSMODE;
     if(slot==='normal')texture.gammaSpace=false;
     pair[slot]=texture;
    }
   }
   maps.set(kind,pair);
  }
  return maps.get(kind);
 }
 function material(key){
  if(!materials.has(key)){
   const [kind,color,roughness]=finishes[key],maps=textures(kind);
   const mat=new B.PBRMaterial('courtyard-'+key,scene);
   mat.albedoColor=B.Color3.FromHexString(color).toLinearSpace();
   mat.metallic=key==='copper'?.37:0;mat.roughness=roughness;
   if(maps.color){mat.albedoTexture=maps.color;mat.bumpTexture=maps.normal;}
   materials.set(key,mat);
  }
  return materials.get(key);
 }
 result={material,textures};libraries.set(scene,result);return result;
}
