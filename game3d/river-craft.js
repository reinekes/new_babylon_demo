import {loadModel} from './asset-loading.js';
import {TILE} from '../district3d/terrain.js';
import {bridgeSpan} from '../world.js';
import {WATER_HEIGHT} from './water.js';
import {cargoLayout,GOODS_KINDS} from './goods.js';

export const RIVER_CRAFT_MODEL='river-cargo-boat.glb';
const CARGO_SCALE=.60;
export function riverCraftCargo(stock){
 const layout=cargoLayout(stock,{columns:2,layers:1,maxKinds:GOODS_KINDS.length}),center=(layout.at(-1)?.z||0)/2;
 return layout.map(p=>({...p,x:p.x*CARGO_SCALE,y:.20+p.y*CARGO_SCALE,z:(p.z-center)*CARGO_SCALE}));
}
export function riverCraftPose(s,c,time=0){
 if(!c||c.transport!=='river'||!Number.isFinite(c.x)||!Number.isFinite(c.y))return null;
 const route=c.route||[],next=route[c.routeIndex||0];let yaw=null;
 if(next&&Math.hypot(next.x-c.x,next.y-c.y)>1e-5)yaw=Math.atan2(next.x-c.x,next.y-c.y);
 if(yaw===null){const previous=route.slice(0,c.routeIndex||0).reverse().find(p=>Math.hypot(p.x-c.x,p.y-c.y)>1e-5);if(previous)yaw=Math.atan2(c.x-previous.x,c.y-previous.y);}
 const lowered=(s.buildings||[]).some(b=>b.type==='bridge'&&b.construction?.kind!=='new'&&Math.abs(c.y-bridgeSpan(b.y).y)<.95);
 return {x:c.x*TILE,y:WATER_HEIGHT+Math.sin(time*1.7)*.012,z:c.y*TILE,yaw:yaw??0,roll:Math.sin(time*1.1)*.006,lowered,draft:.29};
}

// A small boat detail is requested only when a real river visit exists. Until it
// resolves, a rounded hull keeps the saved trade visible. Loading never writes
// trade stock, sales, orders, port cargo or the simulation clock.
export function createTradeRiverCraft(B,scene,meshes,materials,goods,options={}){
 let asset=null,promise=null,disposed=false,root=null,copy=null,identity=null,detail=false,rig=null,furled=null,lastYaw=0,cargoSignature='';
 const parts=[],cargo=[],ownedMaterials=[];
 const register=m=>{m.isPickable=false;m.receiveShadows=true;meshes.push(m);parts.push(m);return m;};
 const forget=m=>{let i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);i=parts.indexOf(m);if(i>=0)parts.splice(i,1);m.dispose();};
 const load=options.loadBoatAsset||(file=>loadModel(B,scene,'assets/art-courtyard/models/',file,scene,undefined,'.glb'));
 function start(){if(promise||disposed)return;promise=Promise.resolve().then(()=>load(RIVER_CRAFT_MODEL)).then(value=>{if(disposed){value.dispose();return;}asset=value;asset.removeAllFromScene?.();}).catch(error=>(options.warn||console.warn)('River craft detail unavailable',error));}
 function clearCargo(){for(const m of cargo)forget(m);cargo.length=0;cargoSignature='';}
 function clear(){clearCargo();for(const m of parts.splice(0)){const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);}copy?.dispose?.();copy=null;root?.dispose();root=null;rig=null;furled=null;detail=false;}
 function material(name,hex){const m=new B.PBRMaterial(name,scene);m.albedoColor=B.Color3.FromHexString(hex).toLinearSpace();m.roughness=.95;m.metallic=0;ownedMaterials.push(m);return m;}
 const linen=material('river-craft-unbleached-furled-linen','#a18b60');
 function build(c){
  root=new B.TransformNode('actual-trade-caravan',scene);lastYaw=0;
  if(asset){copy=asset.instantiateModelsToScene(n=>'river-craft-'+n,false,{doNotInstantiate:true});for(const n of copy.rootNodes)n.parent=root;for(const m of root.getChildMeshes())register(m);rig=root.getDescendants().find(n=>n.name==='river-craft-RiverCraftLowerableRig')||null;detail=true;}
  else{
   const hull=B.MeshBuilder.CreateSphere('river-craft-loading-hull',{diameter:1,segments:12},scene);hull.parent=root;hull.position.y=-.05;hull.scaling.set(1.43,.5,6.1);hull.material=materials.wood;register(hull);
  }
  furled=new B.TransformNode('river-craft-lowered-sail-and-mast',scene);furled.parent=root;
  const spar=B.MeshBuilder.CreateCylinder('river-craft-lowered-mast',{height:3.6,diameter:.068,tessellation:6},scene);spar.rotation.x=Math.PI/2;spar.position.set(0,.24,-.1);spar.material=materials.wood;spar.parent=furled;register(spar);
  const cloth=B.MeshBuilder.CreateCylinder('river-craft-furled-sail',{height:1.15,diameter:.19,tessellation:12},scene);cloth.rotation.z=Math.PI/2;cloth.position.set(0,.23,-1.1);cloth.material=linen;cloth.parent=furled;register(cloth);
 }
 function update(s,c,time=s.simTime||0){if(disposed)return;const pose=riverCraftPose(s,c,time),key=pose?c.id||'current-river-visit':null;
  if(key!==identity||(asset&&root&&!detail)){clear();identity=key;if(pose)build(c);}
  if(!pose)return;if(!root)build(c);start();
  const sig=JSON.stringify(c.stock||{});if(sig!==cargoSignature){clearCargo();cargoSignature=sig;for(const p of riverCraftCargo(c.stock)){const source=goods.sources.get(p.kind);if(!source)continue;const m=source.createInstance(`cargo-${p.kind}`);m.setEnabled(true);m.parent=root;m.scaling.setAll(CARGO_SCALE);m.position.set(p.x,p.y,p.z);m.metadata={goods:{...p},riverCargo:true};cargo.push(register(m));}}
  if((c.route||[])[c.routeIndex||0]||!root.metadata)lastYaw=pose.yaw;
  root.position.set(pose.x,pose.y,pose.z);root.rotation.set(0,lastYaw,pose.roll);if(rig)rig.setEnabled(!pose.lowered);furled.setEnabled(pose.lowered);
  root.metadata={riverCraft:true,tradeId:c.id,detailLoaded:detail,loweredRig:pose.lowered,stockSignature:sig,draft:pose.draft,sourceArtisticAdaptation:'Gislinge 12th-century hull'};
 }
 return {update,get ready(){return promise;},get root(){return root;},dispose(){if(disposed)return;disposed=true;clear();asset?.dispose();asset=null;for(const m of ownedMaterials)m.dispose();}};
}
