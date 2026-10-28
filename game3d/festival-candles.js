import {loadModel} from './asset-loading.js';

// A small supplied wax model is optional detail, requested only for the feast.
// All holders share its geometry/material; no skeleton or source animation runs.
export function createFestivalCandles(B,scene,meshes=[],{loadAsset}={}){
 const holders=new Map(),materials=[];let source=null,promise=null,disposed=false;
 const material=(name,color)=>{const m=new B.StandardMaterial(name,scene);m.diffuseColor=B.Color3.FromHexString(color);m.emissiveColor=m.diffuseColor;m.disableLighting=true;m.specularColor=B.Color3.Black();materials.push(m);return m;};
 let wax,amber,core;
 const track=(mesh,root,mat,caster=true)=>{mesh.parent=root;mesh.material=mat;mesh.isPickable=false;mesh.receiveShadows=false;if(caster)meshes.push(mesh);return mesh;};
 function untrack(mesh){const i=meshes.indexOf(mesh);if(i>=0)meshes.splice(i,1);}
 function attach(a){
  if(!source||a.imported)return;
  const copy=source.instantiateModelsToScene(name=>`festival-candle-${a.id}-${name}`,false),mount=new B.TransformNode(`festival-candle-model-${a.id}`,scene);mount.parent=a.root;mount.position.y=-.10;
  for(const n of copy.rootNodes)n.parent=mount;
  for(const m of mount.getChildMeshes()){m.isPickable=false;m.receiveShadows=false;m.metadata={...(m.metadata||{}),importedCandle:true};meshes.push(m);}
  untrack(a.fallback);a.fallback.dispose();a.fallback=null;a.imported=true;
 }
 function start(){if(promise||disposed)return;promise=Promise.resolve().then(()=>loadAsset?loadAsset():loadModel(B,scene,'assets/art-courtyard/models/','festival-candle.glb',scene,undefined,'.glb')).then(container=>{if(disposed){container.dispose();return;}source=container;for(const a of holders.values())attach(a);}).catch(error=>{if(!disposed)console.warn('Festival candle detail unavailable; using a small wax candle.',error);});}
 function make(id){
  if(!wax){wax=material('festival-candle-fallback-wax','#e7d3a8');amber=material('festival-candle-flame-amber','#ffae43');core=material('festival-candle-flame-core','#fff1b0');}
  const root=new B.TransformNode(`festival-candle-${id}`,scene);root.metadata={festivalCandle:true,citizenId:id};
  const fallback=track(B.MeshBuilder.CreateCylinder('festival-candle-wax',{height:.4,diameter:.17,tessellation:8},scene),root,wax);fallback.position.y=.10;
  const fire=new B.TransformNode(`festival-candle-fire-${id}`,scene);fire.parent=root;fire.position.y=.30;
  const outer=track(B.MeshBuilder.CreateCylinder('festival-candle-outer-flame',{height:.16,diameterBottom:.06,diameterTop:0,tessellation:6},scene),fire,amber,false);outer.position.y=.06;
  const inner=track(B.MeshBuilder.CreateCylinder('festival-candle-inner-flame',{height:.10,diameterBottom:.035,diameterTop:0,tessellation:6},scene),fire,core,false);inner.position.y=.04;
  const light=holders.size<3?new B.PointLight(`festival-candle-light-${id}`,new B.Vector3(0,.40,0),scene):null;if(light){light.parent=root;light.diffuse=B.Color3.FromHexString('#ffbc74');light.range=2.5;light.intensity=.38;}
  const a={id,root,fallback,fire,light,imported:false};holders.set(id,a);attach(a);return a;
 }
 function remove(a){for(const m of a.root.getChildMeshes())untrack(m);a.light?.dispose();a.root.dispose();holders.delete(a.id);}
 function update(people,time,grips){
  if(disposed)return;if(people.length)start();const seen=new Set();
  for(const p of people){seen.add(p.id);const a=holders.get(p.id)||make(p.id),grip=grips.get(p.id);a.root.setEnabled(!!grip);if(grip)a.root.position.copyFrom(grip);
   const pulse=.94+.06*Math.sin(time*11+p.id);a.fire.scaling.set(1,pulse,1);a.fire.rotation.z=.07*Math.sin(time*9+p.id);if(a.light)a.light.intensity=.38*pulse;
  }
  for(const [id,a]of holders)if(!seen.has(id))remove(a);
 }
 function dispose(){if(disposed)return;disposed=true;for(const a of [...holders.values()])remove(a);source?.dispose();source=null;for(const m of materials)m.dispose();}
 return {update,dispose,rootFor:id=>holders.get(id)?.root,get ready(){return promise;}};
}
