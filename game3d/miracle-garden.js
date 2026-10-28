import {TILE} from '../district3d/terrain.js';
import {loadValleyPlantSources} from './valley-vegetation.js';

export const MIRACLE_PLANT_ASSETS=Object.freeze({grass:['miracle-green-grass-1.glb','miracle-green-grass-2.glb','miracle-green-grass-3.glb'],snowdrop:['miracle-snowdrop-1.glb','miracle-snowdrop-2.glb'],daisy:['miracle-daisy-1.glb','miracle-daisy-2.glb'],lilac:['miracle-lilac-1.glb','miracle-lilac-2.glb'],birch:['miracle-birch-1.glb'],cactus:['miracle-cactus-1.glb','miracle-cactus-2.glb']});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
import {miracleGardenPlan} from '../miracle-garden-plan.js';
export {miracleGardenPlan} from '../miracle-garden-plan.js';

export async function createMiracleGarden(B,scene,{groundHeight=()=>.04,tileSize=TILE,duration=60,maxGardens=2,canPlant=()=>true,assets=MIRACLE_PLANT_ASSETS}={}){
 const meshes=[],containers=[],sources={},gardens=[];let disposed=false,serial=0,sceneKey=null;
 const lifetime=clamp(Number(duration)||60,8,300),limit=clamp(Math.floor(maxGardens)||2,1,3);
 for(const kind of Object.keys(MIRACLE_PLANT_ASSETS))sources[kind]=await loadValleyPlantSources(B,scene,assets[kind]||[],meshes,containers,`miracle-${kind}`);
 const ringMaterial=new B.StandardMaterial('miracle-garden-halo',scene);ringMaterial.diffuseColor=new B.Color3(.34,.62,.31);ringMaterial.emissiveColor=new B.Color3(.2,.42,.16);ringMaterial.alpha=.5;ringMaterial.disableLighting=true;
 function remove(g){for(const p of [...g.plants,...g.sources.map(mesh=>({mesh}))]){p.mesh.dispose();const i=meshes.indexOf(p.mesh);if(i>=0)meshes.splice(i,1);}g.ring.dispose();const i=meshes.indexOf(g.ring);if(i>=0)meshes.splice(i,1);gardens.splice(gardens.indexOf(g),1);}
 function animate(g){
  const fade=clamp((lifetime-g.age)/5,0,1);
  for(const src of g.sources)src.visibility=fade;
  for(const p of g.plants){const grow=clamp((g.age-p.delay)/2.4,0,1),ease=grow*grow*(3-2*grow);p.mesh.scaling.setAll(Math.max(.0001,p.scale*ease*fade));p.mesh.setEnabled(grow>0&&fade>0);}
  g.ring.visibility=Math.min(1,g.age/.65)*fade*(.6+.12*Math.sin(g.age*1.8));
 }
 return {meshes,sources,get activeGardens(){return gardens.length;},get gardens(){return gardens.map(g=>({age:g.age,plantCount:g.plants.length}));},
  clear(){for(const g of [...gardens])remove(g);},
  show(center,radius=2){if(disposed||!Number.isFinite(center?.x)||!Number.isFinite(center?.y))return false;
   while(gardens.length>=limit)remove(gardens[0]);
   const r=clamp(Number(radius)||2,1,6),id=serial++,g={age:0,plants:[],sources:[],ring:B.MeshBuilder.CreateTorus(`miracle-ring-${id}`,{diameter:r*tileSize*2,thickness:.045,tessellation:64},scene)};
   g.ring.position.set(center.x*tileSize,groundHeight(center.x,center.y)+.035,center.y*tileSize);g.ring.material=ringMaterial;g.ring.isPickable=false;g.ring.metadata={miracleGarden:true};meshes.push(g.ring);
   const localSources=new Map();
   for(const p of miracleGardenPlan(center,r)){
    if(!canPlant(p.x,p.y))continue;
    const available=sources[p.kind],variants=1+Math.max(-1,...available.map(m=>m.metadata.valleyVariant));
    for(const src of available){if(src.metadata.valleyVariant!==p.variant%variants)continue;
     let local=localSources.get(src);if(!local){local=src.clone(`miracle-${id}-source-${g.sources.length}`,null,true);local.setEnabled(false);localSources.set(src,local);g.sources.push(local);meshes.push(local);}
     const m=local.createInstance(`miracle-${id}-${p.kind}-${g.plants.length}`);m.position.set(p.x*tileSize,groundHeight(p.x,p.y)+.02,p.y*tileSize);m.rotation.y=p.angle;m.scaling.setAll(.0001);m.isPickable=false;m.receiveShadows=true;m.overrideMaterialSideOrientation=B.Material.CounterClockWiseSideOrientation;m.metadata={miracleGarden:{kind:p.kind,x:p.x,y:p.y}};m.setEnabled(false);g.plants.push({...p,mesh:m});meshes.push(m);
    }
   }
   gardens.push(g);animate(g);return true;
  },
  setAge(age){if(!Number.isFinite(age))return;for(const g of [...gardens]){g.age=Math.max(0,age);if(g.age>=lifetime)remove(g);else animate(g);}},
  update(dt,{paused=false,celebration}={}){if(celebration!==undefined){const active=celebration?.kind==='fertility'&&celebration.elapsed<lifetime,key=active?`${celebration.center.x}:${celebration.center.y}`:null;if(key!==sceneKey||active&&!gardens.length){this.clear();sceneKey=key;if(active)this.show(celebration.center,2);}if(active)this.setAge(celebration.elapsed);return;}if(disposed||paused||!Number.isFinite(dt)||dt<=0)return;for(const g of [...gardens]){g.age+=dt;if(g.age>=lifetime)remove(g);else animate(g);}},
  dispose(){if(disposed)return;disposed=true;for(const g of [...gardens])remove(g);for(const m of meshes)if(!m.isDisposed?.())m.dispose();meshes.length=0;for(const c of containers)c.dispose();ringMaterial.dispose();}
 };
}
