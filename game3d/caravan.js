import {loadModel} from './asset-loading.js';
import {surfaceElevation,TILE} from '../district3d/terrain.js';
import {cargoLayout} from './goods.js';
export const CARAVAN_MODELS={merchant:'caravan-merchant.glb',camel:'caravan-camel.glb'};
export const CARAVAN_RELEASE='caravan-20261023-1';
// Follow the saved road polyline backwards, preserving formation around corners.
// Pure display projection: never initialize trade, reserve goods, or edit a save.
export function caravanFormation(c){
 if(!c||!Number.isFinite(c.x)||!Number.isFinite(c.y)||c.transport==='river')return [];
 const route=c.route||[],index=c.routeIndex||0,next=route[index];let heading=next&&Math.hypot(next.x-c.x,next.y-c.y)>.00001?Math.atan2(next.x-c.x,next.y-c.y):null;
 const previous=route.slice(0,index).reverse().filter(p=>Math.hypot(p.x-c.x,p.y-c.y)>.00001);if(heading===null&&previous[0])heading=Math.atan2(c.x-previous[0].x,c.y-previous[0].y);heading??=Math.PI/2;
 function at(metres){let remaining=metres/TILE,p={x:c.x,y:c.y};for(const target of previous){const d=Math.hypot(target.x-p.x,target.y-p.y);if(d>=remaining){const f=remaining/d;return {x:p.x+(target.x-p.x)*f,y:p.y+(target.y-p.y)*f,yaw:Math.atan2(p.x-target.x,p.y-target.y)};}remaining-=d;p=target;}return {x:p.x-Math.sin(heading)*remaining,y:p.y-Math.cos(heading)*remaining,yaw:heading};}
 return [{kind:'merchant',...at(0),offset:0},{kind:'camel',...at(3.8),offset:.28},{kind:'camel',...at(7.45),offset:.73}];
}
export function caravanCargoSignature(stock={}){return JSON.stringify(Object.entries(stock).filter(([,n])=>Number.isFinite(n)&&n>0).sort(([a],[b])=>a.localeCompare(b)));}
export async function createTradeCaravan(B,scene,meshes,materials,goods,options={}){
 const sources=new Map(),actors=[],ownedMaterials=[],cargoMeshes=[];let key=null,lastTime=null,cargoSignature='',disposed=false;
 const load=options.loadAsset||(file=>loadModel(B,scene,'assets/art-courtyard/models/',`${file}?v=${CARAVAN_RELEASE}`,scene,undefined,'.glb'));
 for(const result of await Promise.allSettled(Object.entries(CARAVAN_MODELS).map(async([kind,file])=>({kind,asset:await load(file)}))))if(result.status==='fulfilled')sources.set(result.value.kind,result.value.asset);else(options.warn||console.warn)('Caravan model unavailable',result.reason);
 const material=(name,hex)=>{const m=new B.PBRMaterial(name,scene);m.albedoColor=B.Color3.FromHexString(hex).toLinearSpace();m.roughness=.96;m.metallic=0;ownedMaterials.push(m);return m;};
 const wool=material('caravan-woven-saddle-cloth','#8e5235'),linen=material('caravan-linen-pannier','#ad976c'),rope=material('caravan-hemp-lashings','#6f593b');
 const register=m=>{m.isPickable=false;m.receiveShadows=true;meshes.push(m);return m;};
 const forget=m=>{const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);m.dispose();};
 const clearCargo=()=>{for(const m of cargoMeshes)forget(m);cargoMeshes.length=0;};
 function actor(kind,index){const copy=sources.get(kind).instantiateModelsToScene(n=>`caravan-${index}-${n}`,false,{doNotInstantiate:true}),root=new B.TransformNode(`caravan-${kind}-${index}`,scene);for(const n of copy.rootNodes)n.parent=root;const groups=new Map();for(const g of copy.animationGroups){g.stop();groups.set(g.name.replace(`caravan-${index}-`,''),g);}for(const skeleton of copy.skeletons||[])skeleton.useTextureToStoreBoneMatrices=true;const owned=root.getChildMeshes();for(const m of owned)register(m);const a={kind,root,groups,skeletons:copy.skeletons,owned,phase:index*.31,clock:index*1.1,clip:null,last:null};actors.push(a);
  if(kind==='camel'){
   const cloth=B.MeshBuilder.CreateSphere(`camel-${index}-woven-saddle`,{diameter:1,segments:12},scene);cloth.parent=root;cloth.position.set(0,1.94,-.28);cloth.scaling.set(1.16,.10,1.26);cloth.material=wool;owned.push(register(cloth));
   for(const side of [-1,1]){const bag=B.MeshBuilder.CreateSphere(`camel-${index}-cloth-pannier`,{diameter:1,segments:12},scene);bag.parent=root;bag.position.set(side*.56,1.59,-.27);bag.scaling.set(.48,.65,.81);bag.material=linen;owned.push(register(bag));for(const z of [-.58,.06]){const tie=B.MeshBuilder.CreateTube(`camel-${index}-tied-pannier`,{path:[new B.Vector3(side*.67,1.36,z),new B.Vector3(side*.77,1.77,z),new B.Vector3(0,2.02,z),new B.Vector3(-side*.77,1.77,z)],radius:.017,tessellation:5},scene);tie.material=rope;tie.parent=root;owned.push(register(tie));}}
  }return a;
 }
 function clear(){clearCargo();for(const a of actors){for(const m of a.owned){const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);}for(const g of a.groups.values())g.dispose();a.root.dispose();for(const sk of a.skeletons||[])sk.dispose();}actors.length=0;cargoSignature='';}
 function goodsUpdate(c){const sig=caravanCargoSignature(c.stock);if(sig===cargoSignature)return;cargoSignature=sig;clearCargo();const layout=cargoLayout(c.stock,{columns:2,layers:2,maxKinds:13});for(const [i,p]of layout.entries()){const a=actors[1+i%2],source=goods?.sources.get(p.kind);if(!a||!source)continue;const m=source.createInstance(`caravan-stock-${p.kind}`);m.setEnabled(true);m.parent=a.root;m.scaling.setAll(.42);m.position.set((Math.floor(i/2)%2?1:-1)*.58,1.88+Math.floor(i/8)*.19,-.62+(Math.floor(i/4)%2)*.60);m.metadata={goods:{...p},caravanCargo:true};m.rotation.y=(i%3-1)*.1;cargoMeshes.push(register(m));}}
 function pose(a,clip,phase,dt=0){if(!a.groups.has(clip))clip='Idle';const g=a.groups.get(clip);if(!g)return;if(a.clip!==clip){a.transition=a.clip?[...new Set([...a.groups.values()].flatMap(g=>g.targetedAnimations.map(t=>t.target)).filter(n=>n?.position&&n?.scaling))].map(n=>({n,p:n.position.clone(),q:n.rotationQuaternion?.clone(),s:n.scaling.clone()})):null;a.blend=0;for(const old of a.groups.values())old.stop();g.start(true,1,g.from,g.to,false);g.pause();a.clip=clip;}g.goToFrame(g.from+(phase%1)*(g.to-g.from));if(a.transition){a.blend=Math.min(1,a.blend+dt/.25);const t=a.blend*a.blend*(3-2*a.blend);for(const v of a.transition){v.n.position.copyFrom(B.Vector3.Lerp(v.p,v.n.position,t));v.n.scaling.copyFrom(B.Vector3.Lerp(v.s,v.n.scaling,t));if(v.q&&v.n.rotationQuaternion)B.Quaternion.SlerpToRef(v.q,v.n.rotationQuaternion,t,v.n.rotationQuaternion);}if(a.blend===1)a.transition=null;}}
 function update(state,c,time=state.simTime||0){if(disposed)return;const formation=caravanFormation(c),newKey=formation.length?c.id||'current-land-caravan':null;if(key!==newKey){clear();key=newKey;lastTime=null;if(newKey&&sources.size===2)for(const [i,p]of formation.entries())actor(p.kind,i);}
  if(!actors.length){lastTime=time;return;}goodsUpdate(c);const dt=lastTime===null?0:Math.max(0,time-lastTime),reset=lastTime!==null&&(time<lastTime||dt>5);lastTime=time;const stopped=['trading','unloading'].includes(c.phase);
  for(const [i,a]of actors.entries()){const p=formation[i],d=a.last?Math.hypot(p.x-a.last.x,p.y-a.last.y)*TILE:0;const moved=d>.000001&&!reset;const fresh=!a.last;
   // Position derives only from the saved caravan; gait is distance-driven and freezes on pause.
   if(dt>0||fresh||reset){a.root.position.set(p.x*TILE,surfaceElevation(p.x,p.y,state),p.y*TILE);a.root.rotation.y=p.yaw;a.last={x:p.x,y:p.y};if(moved)a.phase=(a.phase+d/(a.kind==='camel'?2:1.04))%1;if(stopped&&dt>0)a.clock+=Math.min(dt,.25);const clip=stopped?(a.kind==='camel'&&i===2?'Idle2':'Idle'):'Walk';pose(a,clip,stopped?a.clock/(a.kind==='camel'?4.5:3):a.phase,Math.min(dt,.1));}
   a.root.metadata={caravanId:c.id,kind:a.kind,clip:a.clip,gaitPhase:a.phase,historicalArtisticCamel:a.kind==='camel'};
  }
 }
 return {update,actors,loaded:()=>sources.size===2,dispose(){if(disposed)return;disposed=true;clear();for(const source of sources.values())source.dispose();sources.clear();for(const m of ownedMaterials)m.dispose();}};
}
