// Shared, local, original texture pairs from the approved courtyard-house study.
// Colour is applied in linear space. All building templates in a scene reuse
// the same texture objects, including those on the channel and road surfaces.
const libraries=new WeakMap();
const finishes={
 plaster:['plaster','#c6aa82',.97],raw:['adobe-bond','#b59369',.99],
 fired:['adobe-bond','#b17e57',.96],trim:['plaster','#d3bea0',.98],
 earth:['earth','#a38c6e',1],stone:['earth','#989180',1],
 wood:['wood','#886e4b',.94],reed:['woven-fibre','#bca476',.90],
 pottery:['pottery','#a57152',.94],cloth:['cloth','#b8aa90',.98],
 char:['wood','#514940',1],copper:[null,'#d88b65',.34],
 'dyed-weft':['cloth','#883d30',.96],
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
     if(slot==='normal'){texture.gammaSpace=false;texture.level=kind==='plaster'?.32:.6;}
     pair[slot]=texture;
    }
   }
   maps.set(kind,pair);
  }
  return maps.get(kind);
 }
 function material(key){
  if(!materials.has(key)){
   const [kind,color,roughness]=finishes[key],maps=kind?textures(kind):null;
   const mat=new B.PBRMaterial('courtyard-'+key,scene);
   mat.albedoColor=B.Color3.FromHexString(color).toLinearSpace();
   mat.metallic=key==='copper'?.64:0;mat.roughness=roughness;
   if(maps?.color){mat.albedoTexture=maps.color;mat.bumpTexture=maps.normal;}
   materials.set(key,mat);
  }
  return materials.get(key);
 }
 result={material,textures};libraries.set(scene,result);return result;
}
