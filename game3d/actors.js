import {freightGesture} from '../service-court.js';
import {fishingHands,updateFishingTackle} from './harvest-gear.js';
import {carcassPosition} from '../harvest-handling.js';
import {createHomeVisits} from './home-visits.js';
import {waterCarrierAtBank,dipWaterVessel} from './water-carrier.js';
import {gatheringToolLength} from './gathering-contacts.js';
import {artisanWalk} from './artisan-contacts.js';
import {showBlessingApproach} from '../blessing-presentation.js';
import {showRainObserver} from '../rain-presentation.js';
import {createActorShadowFilter} from './shadow-casters.js';
import {residentScreenHeight,residentPoseIntervalForPixels,residentPoseSlot,useResidentGeometryLOD} from './resident-pose-schedule.js';
import {createResidentGeometryLOD} from './resident-geometry-lod.js';
import {miracleCelebrationView} from '../miracle-celebration.js';
import {festivalView} from '../festival.js';
import {createFestivalCourt} from './festival-court.js';
import {loadModel} from './asset-loading.js';
import {workstationHands,workstationPose} from './workstations.js';
import {professionClothing,createProfessionClothing} from './profession-clothing.js';
import {openResidentNeckline} from './resident-garments.js';
import {visibleCitizens,networkFor} from '../workforce.js';
import {ceremonyJoinStep} from '../festival-layout.js';
import {animalsFor,flockLeader} from '../fauna.js';
import {funeralView} from '../funerals.js';
import {createFuneralRitual} from './funeral-ritual.js';
import {createJackals} from './jackals.js';
import {residentAnatomy} from './resident-anatomy.js';
import {residentAppearance} from '../resident-appearance.js';
import {residentPose} from '../actor-art.js';
import {onBridge} from '../world.js';
import {surfaceElevation} from '../district3d/terrain.js';
import {actorWorkActivity} from '../labor-life.js';
import {catPettingPairs} from '../pests.js';
import {createWildlife} from './wildlife.js';
import {createGameGoats} from './goats.js';
import {createSuppliedFauna} from './supplied-fauna.js?v=living-fields-20261116';
import {createImportedFauna} from './imported-fauna.js';
import {createAmbientFauna,courtyardFauna} from './ambient-fauna.js';
import {WORK_POSES,workplaceIndex,workplaceActivity,workPose} from './work-poses.js';
import {residentMotion,residentViewPositions,residentWalkPhase,residentIdentity,RESIDENT_STANCE} from './resident-motion.js';
import {usesHistoricalMan} from './historical-resident.js';
import {WATER_HEIGHT} from './water.js';
import {nearTermWaterCouriers} from '../water.js';
import {ploughTeams,PLOUGH_HANDLE_HEIGHT} from '../plough-team.js';
export {residentMotion,residentViewPositions,residentWalkPhase,residentIdentity} from './resident-motion.js';

// These helpers read state only. The renderer never advances workers or writes saves.
export function actorViewFrame(state){
 const residents=visibleCitizens(state).map(c=>c.eventContact?{...c,x:c.eventContact.x,y:c.eventContact.y}:c.waterTrip?waterCarrierAtBank(state,c):c),byId=new Map(residents.map(c=>[c.id,c]));
 // Pair once, using the actual rendered child-play positions and walking flags.
 // A hand must be able to reach the cat; the general neighbourhood test is wider.
 const pettingPairs=catPettingPairs(state,residents).filter(p=>{const c=byId.get(p.citizenId),scale=c.age<16?.55+Math.max(0,Math.min(c.age,15))*.022:1;return Math.hypot(c.x-p.x,c.y-p.y)<=.16*scale;});
 const workplaces=workplaceIndex(state);
 const visible=new Map(residents.map(c=>{
  const activity=c.controlled&&c.activity?c.activity:actorWorkActivity(state,c,pettingPairs,workplaces)||workplaceActivity(state,c,workplaces);
  const freightHandoff=freightGesture(c,workplaces,state.district?.jobs);
  const flock=activity?.task==='sheepfold'&&activity.stage==='waiting'&&!c.carrying?flockLeader(state,workplaces.get(c.work)):null;
  return [c.id,flock?{...c,x:flock.x,y:flock.y,walking:flock.walking,herding:true,activity}:{...c,activity,...(freightHandoff?{freightHandoff}:{})}];
 }));
 const funeral=funeralView(state);
 for(const id of funeral?.mourners||[]){
  const c=visible.get(id)||(state.citizens||[]).find(c=>c.id===id);
  if(c){const rite=funeral.participants?.find(p=>p.id===id);visible.set(id,{...c,...rite?{x:rite.x,y:rite.y}:{},activity:null,phase:'mourning',walking:rite?.walking??true,carrying:false,cargo:{},robe:'#c7c9ae',mourningTorch:rite?.torch??(!!funeral.torches&&c.age>=16),funeralContact:rite});}
 }
 const miracle=miracleCelebrationView(state);
 if(miracle)for(const participant of miracle.participants){const c=visible.get(participant.id)||(state.citizens||[]).find(c=>c.id===participant.id);if(c)visible.set(c.id,{...c,...participant,activity:null,phase:'miracle',carrying:false,cargo:{},playing:false,swimming:false,eventContact:null,festivalContact:null,funeralContact:null,miracleContact:participant});}
 return {citizens:[...visible.values()],pettingPairs:miracle?[]:pettingPairs,funeral};
}
export const cityAnimalVisible=(animal,huntedMice)=>animal.kind==='mouse'?!!huntedMice?.has(animal.id):!['bird','rat','pestCatch'].includes(animal.kind);
export function actorViewCitizens(state){return actorViewFrame(state).citizens;}
export function residentVisual(c,state,buildingTypes=state.buildings||[],profession){
 const look=residentAppearance(c,buildingTypes,state,profession);
 return {...look,...residentAnatomy(c.age),
  inspired:!!((c.calling&&c.calling!=='auto')||(c.futureRole&&c.futureRole!=='auto')||state.buffs?.inspiration&&['clay','reed'].includes(look.work)),
  motion:residentMotion(c.id),identity:residentIdentity(c.id),mood:c.mood??50,role:c.role||look.work||'resident'};
}
export function actorAnimation(c,distance=0){
 if(c.kind==='sheep')return {clip:distance>.00001?'Walk':['grazing','drinking'].includes(c.behavior)?'Graze':'Idle',pose:c.behavior||'idle'};
 if(c.peaceRelief&&!c.walking&&!c.carrying&&!c.swimming&&!c.funeralContact&&!c.miracleContact)return {clip:'Idle_Loop',pose:'peaceRelief'};
 if(c.activity?.task==='dress-game')return {clip:'Idle_Loop',pose:'gathering'};
 const pose=residentPose(c,null,0).kind;
 return {clip:!c.swimming&&(distance>.00001||pose==='dance')?'Walk_Loop':'Idle_Loop',pose:c.relic?'carry':c.activity&&!c.carrying?(!c.activity.stage||['working','strike','searching'].includes(c.activity.stage)?c.activity.kind:'idle'):c.swimming?'swim':['carry','unload','play','dance','elder'].includes(pose)?pose:c.phase==='working'||c.phase==='constructing'?'work':'idle'};
}
const carriedKind=k=>k==='basket'?'basket':['water','beer','pottery','oil','milk'].includes(k)?'vessel':
 ['wood','reed','timber','flax'].includes(k)?'bundle':'sack';
const MAX_WARM_RESIDENTS=32;
const loadGrips={
  sack:{height:1.02,reach:.34,left:[-.19,-.01,0],right:[.19,-.01,0]},
  basket:{height:.99,reach:.37,left:[-.26,.06,0],right:[.26,.06,0]},
  vessel:{height:1.04,reach:.37,left:[-.15,-.10,0],right:[.12,.16,0]},
  bundle:{height:1.02,reach:.34,left:[-.21,-.01,0],right:[.21,-.01,0]}
};
export function residentLoadGrip(resource,unloading=false,time=0){
 const grip=loadGrips[carriedKind(resource)];
 const lower=unloading?(1-Math.cos(Math.min(1,Math.max(0,time))*Math.PI))*.11:0;
 const height=grip.height-lower,reach=grip.reach+lower*.35;
 const palm=([x,y,z])=>[x,y+height,z+reach];
 return {height,reach,left:palm(grip.left),right:palm(grip.right)};
}

export function residentSwimmingPresentation(c,time=0,{reducedMotion=false}={}){return c.swimming?{height:WATER_HEIGHT-.48,pitch:1.12,stroke:reducedMotion?0:Math.sin(time*2.3),sway:reducedMotion?0:Math.sin(time*1.15)*.025}:null;}

/** Licensed articulated GLB actors following the real city. No decorative routes. */
export async function createGameActors(B,scene,materials,{includeFauna=true,includeFuneralFauna=includeFauna,deferFauna=false,warmHiddenResidents=false,homeCatalogue=()=>true,homePlatform=()=>null,floorHeight=(x,y,ground)=>ground}={}){
 const meshes=[],people=new Map(),sheep=new Map(),ownedMaterials=[],sheepCoats=new Map();
 let disposed=false,poseTime=0,poseClock=0,bier=null,riteState=null,riteView=null,presentedState=null;
 const reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
 const ritual=createFuneralRitual(B,scene,meshes),festivalCourt=createFestivalCourt(B,scene,meshes);
 const containers=[];
 try{
  // Keep source containers outside the scene: only their independent clones render.
  const load=name=>loadModel(B,scene,'assets/art-courtyard/models/',`${name}.glb?v=source-walk-cloth-20261026-1`,scene,undefined,'.glb');
  const human=async(name,native=false)=>{const asset=await load(name);if(/^source-walk-(male|female)$/.test(name))openResidentNeckline(B,asset);if(!['Walk_Loop','Idle_Loop'].every(clip=>asset.animationGroups.some(g=>g.name===clip))){asset.dispose();throw Error('Civilian clips missing: '+name);}const meta=[...(asset.transformNodes||[]),...(asset.meshes||[])].map(n=>n.metadata?.gltf?.extras?.native_resident).find(Boolean);asset.modelName=name;asset.sourceWalk=meta?.sourceWalk===true;asset.nativeResident=native&&(asset.sourceWalk||asset.skeletons.some(s=>s.bones.length===41));asset.residentVariant=name.replace(/^(?:human-native-|source-walk-)/,'');asset.walkMetres=meta?.strideMetres;return asset;};
  const sourceHuman=async variant=>{try{return await human('source-walk-'+variant,true);}catch(error){console.warn('Source walking resident unavailable; using previous model.',error);return human('human-native-'+variant,true);}};
  const resident=async()=>{try{return await sourceHuman('male');}catch(error){console.warn('Native civilian unavailable; using previous resident.',error);try{return await human('sumer-people');}catch{return human('resident');}}};
  const ageSource=async(age)=>{try{return await sourceHuman(age);}catch{return human('sumer-'+age);}};
  const loaded=await Promise.allSettled([resident(),load('sheep'),ageSource('child'),ageSource('adolescent'),sourceHuman('female')]);
  for(const r of loaded)containers.push(r.status==='fulfilled'?r.value:null);
  const failed=loaded.slice(0,2).find(r=>r.status==='rejected');if(failed)throw failed.reason;
 }catch(error){for(const c of containers)c?.dispose();throw error;}
 const [residentSource,sheepSource,childSource,adolescentSource,femaleSource]=containers;
 let historicalSource=null,historicalPromise=null,historicalFailed=false;
 function requestHistoricalResident(){
  if(historicalSource||historicalPromise||historicalFailed||disposed)return historicalPromise;
  historicalPromise=loadModel(B,scene,'assets/art-courtyard/models/','historical-man.glb',scene,undefined,'.glb').then(asset=>{
   if(disposed){asset.dispose();return;}
   const meta=[...(asset.transformNodes||[]),...(asset.meshes||[])].map(n=>n.metadata?.gltf?.extras?.native_resident).find(Boolean);
   if(!meta?.sourceWalk||!['Walk_Loop','Idle_Loop'].every(name=>asset.animationGroups.some(g=>g.name===name))){asset.dispose();throw Error('Historical resident walking skin unavailable');}
   asset.modelName='historical-man';asset.sourceWalk=true;asset.nativeResident=true;asset.residentVariant='historical-man';asset.walkMetres=meta.strideMetres;historicalSource=asset;containers.push(asset);
  }).catch(error=>{historicalFailed=true;if(!disposed)console.warn('Robed specialist unavailable; retaining native walking resident.',error);});
  return historicalPromise;
 }
 const geometryLOD=createResidentGeometryLOD();
 const homeVisits=createHomeVisits(homeCatalogue,homePlatform);
 const wildlife=createWildlife(B,scene,meshes);
 let goats=null,imported=null,ambient=null,jackals=null,supplied=null;
 const loadFauna=async()=>{
  const goatReady=(includeFauna?createGameGoats(B,scene,meshes,{variants:['pasture'],fallbackVariant:'downloaded'}):Promise.resolve(null)).catch(error=>{console.warn('Detailed goat models unavailable; herd remains in simulation.',error);return null;});
  const values=await Promise.all([
  goatReady,
  (includeFauna?createImportedFauna(B,scene,meshes):Promise.resolve(null)).catch(error=>{console.warn('Imported fauna unavailable; using legacy fauna.',error);return null;}),
  (includeFauna?createAmbientFauna(B,scene,meshes,{includeSkyBirds:false,includeShoreBirds:true,hidePlaceholderBirds:true,includeYardPig:true,includeTestLivestock:true,herdGoat:goatReady.then(view=>view?.sourceForHerd('pasture'))}):Promise.resolve(null)).catch(error=>{console.warn('Ambient fauna unavailable.',error);return null;}),
  (includeFuneralFauna?createJackals(B,scene,null,meshes):Promise.resolve(null)).catch(error=>{console.warn('Jackals unavailable; using legacy fauna.',error);return null;}),
  includeFauna?createSuppliedFauna(B,scene,meshes):Promise.resolve(null)]);if(disposed){for(const v of values)v?.dispose();return;}[goats,imported,ambient,jackals,supplied]=values;};
 let faunaReady=Promise.resolve();if(!deferFauna)await loadFauna();else faunaReady=new Promise(resolve=>setTimeout(resolve,150)).then(()=>{if(!disposed)return loadFauna();});
 const vec=(x=0,y=0,z=0)=>new B.Vector3(x,y,z);
 function mat(name,color){const m=new B.PBRMaterial(`game-actor-${name}`,scene);m.albedoColor=B.Color3.FromHexString(color).toLinearSpace();m.roughness=.94;ownedMaterials.push(m);return m;}
 const wood=materials.wood||mat('wood','#82603e'),clay=materials.terracotta||mat('clay','#ad7051'),reed=materials.reed||mat('reed','#baa577'),linen=materials.linen||mat('linen','#d6c3a0'),fishSkin=mat('fish','#829e91'),copper=mat('copper','#a5754c'),stone=mat('stone','#b7ac92'),dark=mat('dark','#433a2e'),gold=mat('inspiration','#dfb952'),lapis=mat('relic-lapis','#276b94');
 const shadowShape=B.MeshBuilder.CreateCapsule('resident-shadow-shape',{height:1.7,radius:.26,tessellation:6,capSubdivisions:2,subdivisions:1},scene);shadowShape.isVisible=false;shadowShape.isPickable=false;shadowShape.material=linen;const shadowFilter=createActorShadowFilter();
 gold.emissiveColor=B.Color3.FromHexString('#77541c').toLinearSpace();
 function register(root){for(const m of root.getChildMeshes()){m.receiveShadows=true;m.isPickable=true;if(!meshes.includes(m))meshes.push(m);}}
 function prune(root){for(const m of root.getChildMeshes()){const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);}}
 function box(name,parent,material,x,y,z,sx,sy,sz){const mesh=B.MeshBuilder.CreateBox(name,{width:sx,height:sy,depth:sz},scene);mesh.parent=parent;mesh.position.set(x,y,z);mesh.material=material;mesh.isPickable=true;mesh.receiveShadows=true;meshes.push(mesh);return mesh;}
 function sphere(name,parent,material,x,y,z,sx,sy,sz){const mesh=B.MeshBuilder.CreateSphere(name,{diameter:1,segments:8},scene);mesh.scaling.set(sx,sy,sz);mesh.parent=parent;mesh.position.set(x,y,z);mesh.material=material;mesh.isPickable=true;mesh.receiveShadows=true;meshes.push(mesh);return mesh;}
 // Babylon creates one scheduler entry per clip channel. Distant idle and
 // walk loops already sample authored poses here, without a clock tick.
 const manuallySampledChannels=new Set();
 function attachClock(a){
  if(!a.sampledChannels)return;
  for(const channel of a.sampledChannels){
   if(!manuallySampledChannels.delete(channel))scene.animatables.push(channel);
  }
  a.sampledChannels=null;
 }
 function queueManualChannels(a,group){
  a.sampledChannels=[...group.animatables];
  for(const channel of a.sampledChannels){channel.pause();manuallySampledChannels.add(channel);}
 }
 function detachManualChannels(){
  if(!manuallySampledChannels.size)return;
  const active=scene.animatables;
  let next=0;
  for(const channel of active)if(!manuallySampledChannels.has(channel))active[next++]=channel;
  active.length=next;manuallySampledChannels.clear();
 }
 function remove(a){attachClock(a);releaseSleepingRig(a);if(a.fishingLine){const i=meshes.indexOf(a.fishingLine);if(i>=0)meshes.splice(i,1);a.fishingLine.dispose();}prune(a.root);for(const g of a.groups?.values()||[])g.dispose();a.root.dispose();for(const s of a.skeletons||[])s.dispose();for(const m of a.materials||[])m.dispose();}
 function clayAnimal(name,parent,kind){
  const toy=new B.TransformNode(`${name}-clay-toy`,scene);
  toy.parent=parent;toy.position.set(0,.025,0);toy.scaling.setAll(.75);toy.setEnabled(false);
  sphere(`${kind}-clay-ram-body`,toy,clay,0,.08,0,.23,.13,.12);sphere(`${kind}-clay-ram-face`,toy,clay,.12,.14,0,.10,.10,.10);
  for(const x of [-.07,.07])for(const z of [-.04,.04])box(`${kind}-clay-ram-leg`,toy,clay,x,.025,z,.035,.07,.035);
  return toy;
 }
 let residentTextile;
 function wovenCloth(){
  if(residentTextile)return residentTextile;
  const size=128,pixels=new Uint8Array(size*size*4),tau=2*Math.PI;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const warp=Math.cos(tau*(x/4+.08*Math.sin(tau*y/size)));
   const weft=Math.cos(tau*(y/4+.09*Math.sin(tau*x/size)));
   const over=(Math.floor(x/4)+Math.floor(y/4))%2;
   const shade=241+Math.round(5*(over?warp:weft)+3*Math.min(warp,weft)+2*Math.sin(tau*(3*x+y)/size));
   const i=(y*size+x)*4;pixels[i]=shade;pixels[i+1]=shade;pixels[i+2]=shade;pixels[i+3]=255;
  }
  residentTextile=B.RawTexture.CreateRGBATexture(pixels,size,size,scene,true,false,B.Texture.TRILINEAR_SAMPLINGMODE);
  residentTextile.name='resident-fine-woven-cloth';residentTextile.uScale=2;residentTextile.vScale=2;
  return residentTextile;
 }
 function cloneResidentMaterial(material,name,prepare){
  // Babylon scans the whole scene for every PBR setter during clone. No mesh
  // uses the new material yet, so there are no draw caches to invalidate.
  const block=scene._forceBlockMaterialDirtyMechanism?.bind(scene),previous=scene.blockMaterialDirtyMechanism;
  block?.(true);
  try{const copy=material.clone(name);prepare(copy);return copy;}
  finally{block?.(previous);}
 }
 const bindBounds=new WeakMap();
 function instantiate(source,name,metadata){
  const copy=source.instantiateModelsToScene(n=>`${name}-${n}`,false,{doNotInstantiate:true});
  const root=new B.TransformNode(name,scene),model=new B.TransformNode(`${name}-model`,scene);model.parent=root;root.metadata=metadata;
  for(const n of copy.rootNodes)n.parent=model;
  const groups=new Map(),clipTargets=new Map();for(const g of copy.animationGroups){g.stop();const key=g.name.startsWith(`${name}-`)?g.name.slice(name.length+1):g.name;groups.set(key,g);
   // These cloned clips keep the same channels for the lifetime of this actor.
   const targets={all:new Set(),position:new Set(),rotationQuaternion:new Set()};
   for(const {target,animation} of g.targetedAnimations){targets.all.add(target);if(animation.targetProperty==='position')targets.position.add(target);else if(animation.targetProperty==='rotationQuaternion')targets.rotationQuaternion.add(target);}
   clipTargets.set(key,targets);
  }
  // Every fresh copy of the same GLB has the same bind-space soles and height.
  let bounds=bindBounds.get(source);
  if(!bounds){bounds=model.getHierarchyBoundingVectors(true);bindBounds.set(source,bounds);}
  const height=bounds.max.y-bounds.min.y;
  const unit=metadata.citizenId!==undefined&&height>0?1.7/height:1;
  model.scaling.setAll(unit);model.position.y=-bounds.min.y*unit;
  register(root);
  const a={root,model,unit,nativeResident:!!source.nativeResident,sourceWalk:!!source.sourceWalk,walkMetres:source.walkMetres||2.48,walkPhase:residentMotion(metadata.citizenId).phase/(Math.PI*2),groups,clipTargets,skeletons:copy.skeletons,materials:[],lastX:null,lastY:null,yaw:null,clip:null,cargoKey:null,pose:'idle',time:0,paused:false};
  if(metadata.citizenId!==undefined){root.metadata.nativeResident=a.nativeResident;root.metadata.sourceWalk=a.sourceWalk;root.metadata.residentVariant=source.residentVariant;root.metadata.nativeStrideMetres=a.walkMetres;}
  // Clone recolored surfaces per resident; shared source materials stay immutable.
  if(metadata.citizenId!==undefined){
   const surfaces=model.getChildMeshes(),cloned=new Map();a.cloth=[];a.skin=[];a.hair=[];a.upperCloth=new Set();
   a.lodParts=geometryLOD.parts(source,surfaces);a.geometryReduced=false;
   for(const m of surfaces)if(m.material&&/undyed|wool|cloth|skin|hair/i.test(m.material.name)){
    const original=m.material;let cloth=cloned.get(original);
    if(!cloth){
     const kind=/skin/i.test(original.name)?'skin':/hair/i.test(original.name)?'hair':'cloth';
     cloth=cloneResidentMaterial(original,`citizen-${kind}-${metadata.citizenId}-${cloned.size}`,copy=>{
      if(a.nativeResident&&kind==='cloth'&&surfaces.some(surface=>surface.material===original&&surface.isVerticesDataPresent(B.VertexBuffer.UVKind)))copy.albedoTexture=metadata.child?(materials.linen?.albedoTexture||null):wovenCloth();
     });
     cloned.set(original,cloth);a.materials.push(cloth);a[kind].push(cloth);
     if(a.sourceWalk&&/undyed linen/i.test(original.name))a.upperCloth.add(cloth);
    }
    m.material=cloth;
   }
   a.load=new B.TransformNode(`${name}-carried`,scene);a.load.parent=root;a.load.position.set(0,1,.37);
   a.details=new B.TransformNode(`${name}-details`,scene);a.details.parent=root;
   a.tool=new B.TransformNode(`${name}-tool`,scene);a.tool.parent=root;a.tool.setEnabled(false);a.toolKind=null;
   a.inspired=B.MeshBuilder.CreatePolyhedron(`${name}-inspired`,{type:1,size:1},scene);a.inspired.parent=root;a.inspired.material=gold;a.inspired.position.set(0,1.82,0);a.inspired.scaling.set(.035,.06,.035);a.inspired.setEnabled(false);a.inspired.isPickable=false;meshes.push(a.inspired);
   const nodes=model.getChildTransformNodes();a.hands={};a.arms={};a.lastHands={};
   a.spine=nodes.find(n=>n.name.endsWith('-spine_01'));a.spineBase=a.spine?.rotationQuaternion?.clone();a.pelvis=nodes.find(n=>n.name.endsWith('-pelvis'));a.pelvisBase=a.pelvis?.position.clone();a.legs={};
   for(const side of ['l','r'])a.legs[side]={upper:nodes.find(n=>n.name.endsWith(`-thigh_${side}`)),lower:nodes.find(n=>n.name.endsWith(`-calf_${side}`)),foot:nodes.find(n=>n.name.endsWith(`-foot_${side}`))};
   for(const leg of Object.values(a.legs))if(leg.upper){leg.basePosition=leg.upper.position.clone();leg.baseRotations=[leg.upper,leg.lower,leg.foot].map(n=>n?.rotationQuaternion?.clone());leg.toe=leg.foot?.getChildren().find(n=>/toe/i.test(n.name));}
   a.head=nodes.find(n=>n.name.endsWith('-head'));a.headBase=a.head?.scaling.clone();
   a.hairMeshes=model.getChildMeshes().filter(m=>/scalp hair/i.test(m.name));a.beardMeshes=model.getChildMeshes().filter(m=>/beard/i.test(m.name));
   if(!a.nativeResident&&a.head&&a.hairMeshes[0]){
    a.head.computeWorldMatrix(true);const inverse=a.head.getWorldMatrix().clone().invert();
    // Measure the authored scalp/jaw in the head's bind space. World guesses put
    // the bun outside the skull after the GLB's handedness and rest transforms.
    const bounds=mesh=>{mesh.computeWorldMatrix(true);const points=mesh.getBoundingInfo().boundingBox.vectorsWorld.map(p=>B.Vector3.TransformCoordinates(p,inverse)),min=vec(Infinity,Infinity,Infinity),max=vec(-Infinity,-Infinity,-Infinity);for(const p of points){min.minimizeInPlace(p);max.maximizeInPlace(p);}return {min,max,centre:min.add(max).scale(.5),size:max.subtract(min)};};
    const scalp=bounds(a.hairMeshes[0]),jaw=a.beardMeshes[0]?bounds(a.beardMeshes[0]):null;
    const attach=(label,centre,size,source)=>{const mesh=sphere(`${name}-${label}`,a.head,a.hair[0]||dark,0,0,0,size.x,size.y,size.z);mesh.position.copyFrom(centre);mesh.metadata={...metadata,attachmentBounds:{min:source.min.asArray(),max:source.max.asArray()}};return mesh;};
    // Hair is the real normal-separated, head-weighted GLB scalp; no sphere overlay.
    a.bun=attach('hair-bun',vec(scalp.centre.x,scalp.min.y+scalp.size.y*.67,scalp.min.z+scalp.size.z*.04),vec(scalp.size.x*.42,scalp.size.y*.40,scalp.size.z*.35),scalp);
    if(jaw){a.fullBeard=attach('full-beard',jaw.centre,vec(jaw.size.x*.97,jaw.size.y*1.5,jaw.size.z*.95),jaw);a.jawBounds=jaw;}
   }
   for(const side of ['l','r']){a.hands[side]=nodes.find(n=>n.name.endsWith(`-hand_${side}`));a.arms[side]={upper:nodes.find(n=>n.name.endsWith(`-upperarm_${side}`)),lower:nodes.find(n=>n.name.endsWith(`-lowerarm_${side}`))};}
   if(a.hands.r){a.tool.parent=a.hands.r;a.tool.position.set(0,.045,0);}
   if(metadata.child){a.playProps=new B.TransformNode(`${name}-play-props`,scene);a.playProps.parent=root;a.playProps.setEnabled(false);
   // Terracotta animal and simple counters are period-inspired materials; this
   // particular children's scene is a game interpretation, not an excavated rule.
   a.playAnimal=clayAnimal(name,a.hands.r||a.playProps,'child');
   a.playBoard=new B.TransformNode(`${name}-counters`,scene);a.playBoard.parent=a.playProps;
   box('child-clay-play-board',a.playBoard,clay,0,.025,.46,.39,.035,.30);
   for(let i=0;i<4;i++)sphere('child-play-counter',a.playBoard,i%2?stone:dark,(i%2-.5)*.15,.06,.39+Math.floor(i/2)*.13,.055,.035,.055);}
   a.armNodes=[];
   for(const n of model.getChildTransformNodes())if(/(?:upperarm|lowerarm)_[lr]$/.test(n.name))a.armNodes.push({node:n,base:n.rotationQuaternion?.clone()||B.Quaternion.FromEulerVector(n.rotation),last:null});
  }
  if(metadata.citizenId!==undefined){root.simplifiedShadow=false;
   // Shadow-only capsules share a source and submit one instanced draw while
   // retaining each resident's transform and the original caster silhouette.
   const proxy=shadowShape.createInstance(`${name}-shadow-lod`);proxy.parent=root;proxy.position.y=.85;proxy.isVisible=true;proxy.layerMask=0;proxy.isPickable=false;proxy.shadowProxy=true;meshes.push(proxy);
  }
  return a;
 }
 // Solve the authored y-axis upper/lower arm bones toward a palm target in world space.
 // This uses the real glTF joints, keeping skin, hands and attached tools connected.
 function aimJoint(node,child,end){
  const origin=node.getAbsolutePosition(),inverse=node.parent.getWorldMatrix().clone().invert();
  const vector=B.Vector3.TransformNormal(end.subtract(origin),inverse).normalize(),base=node.rotationQuaternion||B.Quaternion.FromEulerVector(node.rotation),axis=vec();child.position.normalizeToNew().rotateByQuaternionToRef(base,axis);node.rotationQuaternion=B.Quaternion.FromUnitVectorsToRef(axis,vector,new B.Quaternion()).multiply(base);node.computeWorldMatrix();
 }
 function poseArm(a,side,local){
  const {upper,lower}=a.arms[side],hand=a.hands[side];if(!upper||!lower||!hand)return;
  // Forcing the palm updates the full GLB ancestry, including helper/twist nodes.
  // The changed joint itself is dirty; only refresh the chain again at the elbow.
  hand.computeWorldMatrix(true);
  const shoulder=upper.getAbsolutePosition(),elbow=lower.getAbsolutePosition(),palm=hand.getAbsolutePosition();
  const l1=B.Vector3.Distance(shoulder,elbow),l2=B.Vector3.Distance(elbow,palm),goal=B.Vector3.TransformCoordinates(local,a.root.getWorldMatrix());
  const ray=goal.subtract(shoulder),length=Math.max(.001,Math.max(Math.abs(l1-l2)+.005,Math.min(ray.length(),l1+l2-.005))),direction=ray.normalize();
  const along=(l1*l1-l2*l2+length*length)/(2*length),height=Math.sqrt(Math.max(0,l1*l1-along*along));
  let bend=B.Vector3.TransformNormal(vec(side==='l'?-1:1,-.7,-.35),a.root.getWorldMatrix());bend=bend.subtract(direction.scale(B.Vector3.Dot(bend,direction))).normalize();
  const joint=shoulder.add(direction.scale(along)).add(bend.scale(height));
  aimJoint(upper,lower,joint);lower.computeWorldMatrix(true);aimJoint(lower,hand,shoulder.add(direction.scale(length)));
 }
 function milkingSeat(a,enabled){
  if(enabled&&!a.milkingSeat){a.milkingSeat=new B.TransformNode(`${a.root.name}-milking-seat`,scene);a.milkingSeat.parent=a.root;box('milking-stool-seat',a.milkingSeat,wood,0,.38,-.025,.30,.045,.26);for(const x of [-.11,.11])for(const z of [-.12,.07])box('milking-stool-leg',a.milkingSeat,wood,x,.18,z,.035,.36,.035);}
  a.milkingSeat?.setEnabled(!!enabled);
 }
 // Sit on a low stool using the native pelvis and bent leg chains. The feet
 // keep their authored ground points and every upper/lower segment keeps its length.
 function seatedMilking(a,seatHeight=.45){
  if(!a.pelvis)return;
  const planted=Object.values(a.legs).filter(l=>l.upper&&l.lower&&l.foot).map(leg=>{(leg.toe||leg.foot).computeWorldMatrix(true);return {leg,hip:leg.upper.getAbsolutePosition().clone(),knee:leg.lower.getAbsolutePosition().clone(),foot:leg.foot.getAbsolutePosition().clone(),toe:leg.toe?.getAbsolutePosition().clone()};});
  a.pelvis.computeWorldMatrix(true);
  const target=a.pelvis.getAbsolutePosition().clone();target.y=a.root.position.y+seatHeight*a.root.scaling.y;
  a.pelvis.position.copyFrom(B.Vector3.TransformCoordinates(target,a.pelvis.parent.getWorldMatrix().clone().invert()));a.pelvis.computeWorldMatrix(true);
  const floorSeat=['roof','mat'].includes(a.c.homeVisit?.stage);
  for(const {leg,hip,knee,foot,toe}of planted){
   const l1=B.Vector3.Distance(hip,knee),l2=B.Vector3.Distance(knee,foot);
   const side=leg===a.legs.l?-1:1;
   if(floorSeat||a.c.homeVisit?.stage==='bench'||a.workContact?.kind==='patient'){
    const reach=floorSeat?vec(-side*.09,0,.36):vec(0,0,.28);
    const forward=B.Vector3.TransformNormal(reach,a.root.getWorldMatrix());
    foot.addInPlace(forward);toe?.addInPlace(forward);
   }
   leg.upper.computeWorldMatrix(true);const origin=leg.upper.getAbsolutePosition(),ray=foot.subtract(origin),length=Math.max(.005,Math.min(ray.length(),l1+l2-.005)),direction=ray.normalize(),along=(l1*l1-l2*l2+length*length)/(2*length),height=Math.sqrt(Math.max(0,l1*l1-along*along));
   let forward=B.Vector3.TransformNormal(floorSeat?vec(side,.06,.32):vec(0,0,1),a.root.getWorldMatrix());forward=forward.subtract(direction.scale(B.Vector3.Dot(forward,direction))).normalize();const bend=origin.add(direction.scale(along)).add(forward.scale(height));
   aimJoint(leg.upper,leg.lower,bend);leg.lower.computeWorldMatrix(true);aimJoint(leg.lower,leg.foot,foot);if(leg.toe&&toe)aimJoint(leg.foot,leg.toe,toe);
  }
 }
 function musicianMallets(a,contact){
  const enabled=contact?.kind==='lithophone';
  if(enabled&&!a.musicMallets){a.musicMallets={};for(const side of ['l','r']){const node=new B.TransformNode(`${a.root.name}-music-mallet-${side}`,scene);node.parent=a.hands[side];box('music-mallet-handle-'+side,node,wood,0,.125,0,.022,.25,.022);sphere('music-mallet-head-'+side,node,wood,0,.28,0,.065,.06,.065);a.musicMallets[side]=node;}}
  for(const node of Object.values(a.musicMallets||{}))node.setEnabled(enabled);
  if(!enabled)return;
  const hands=workstationHands(contact,a.time);
  for(const side of ['l','r']){const node=a.musicMallets[side],target=hands.strikes[side==='l'?'left':'right'];a.hands[side].computeWorldMatrix(true);const origin=a.hands[side].getAbsolutePosition(),point=vec(target.x*6,surfaceElevation(target.x,target.y,a.state)+target.height,target.y*6),inverse=node.parent.getWorldMatrix().clone().invert(),local=B.Vector3.TransformNormal(point.subtract(origin),inverse);node.rotationQuaternion=B.Quaternion.FromUnitVectorsToRef(B.Axis.Y,local.normalizeToNew(),new B.Quaternion());node.scaling.y=local.length()/.28;node.computeWorldMatrix(true);}
 }
 function aimForward(node,end){
  node.computeWorldMatrix(true);const inverse=node.parent.getWorldMatrix().clone().invert(),origin=node.getAbsolutePosition();
  const z=B.Vector3.TransformNormal(end.subtract(origin),inverse).normalize(),up=B.Vector3.TransformNormal(vec(0,1,0),inverse).normalize(),x=B.Vector3.Cross(up,z).normalize(),y=B.Vector3.Cross(z,x).normalize();
  node.rotationQuaternion=B.Quaternion.FromRotationMatrix(B.Matrix.FromValues(x.x,x.y,x.z,0,y.x,y.y,y.z,0,z.x,z.y,z.z,0,0,0,0,1));node.computeWorldMatrix(true);
 }
 function workerTool(a,kind){
  if(a.toolKind===kind){a.tool.setEnabled(!!kind);return;}
  a.toolKind=kind;a.tool.scaling.setAll(1);const grip=kind==='hunting'?a.hands.l:a.hands.r;if(grip){a.tool.parent=grip;a.tool.position.set(0,kind==='hoe'?0:.045,0);a.tool.rotationQuaternion=B.Quaternion.Identity();}prune(a.tool);for(const n of a.tool.getChildren())n.dispose();
  if(a.fishingLine){const i=meshes.indexOf(a.fishingLine);if(i>=0)meshes.splice(i,1);a.fishingLine.dispose();a.fishingLine=null;}
  if(a.caughtFish){prune(a.caughtFish);a.caughtFish.dispose();a.caughtFish=null;}
  if(a.shotArrow){prune(a.shotArrow);a.shotArrow.dispose();a.shotArrow=null;}
  if(a.fillJar){prune(a.fillJar);a.fillJar.dispose();a.fillJar=null;const i=meshes.indexOf(a.fillRope);if(i>=0)meshes.splice(i,1);a.fillRope.dispose();a.fillRope=null;}
  if(a.scribeTablet){prune(a.scribeTablet);a.scribeTablet.dispose();a.scribeTablet=null;}
  a.tool.setEnabled(!!kind);if(!kind)return;
  // Every implement shares its grip origin with the GLB palm. No detached tools.
  if(kind==='reed-knife'||kind==='clay-hoe'||kind==='date-pole'){
   const h=kind==='reed-knife'?.15:kind==='clay-hoe'?.89:2.47;
   box('gathering-shaft',a.tool,wood,0,h/2,0,.038,h,.038);
   if(kind==='date-pole'){const hook=box('date-bunch-hook',a.tool,wood,.073,h-.015,0,.19,.033,.042);hook.rotation.z=-.48;}
   else {const blade=box(kind+'-edge',a.tool,stone,.035,h,0,kind==='reed-knife'?.22:.24,.038,kind==='reed-knife'?.04:.13);blade.rotation.z=-.22;}
   return;
  }
  if(kind==='herd-staff'){
   box('shepherd-staff',a.tool,wood,0,-.14,0,.041,1.46,.043);
   const curve=[vec(0,.57,0),vec(.025,.64,0),vec(.088,.67,0),vec(.143,.64,0),vec(.151,.58,0)];
   const crook=B.MeshBuilder.CreateTube('shepherd-crook',{path:curve,radius:.023,tessellation:6},scene);crook.parent=a.tool;crook.material=wood;meshes.push(crook);return;
  }
  if(kind==='care-pad'){box('healer-fibre-pad',a.tool,linen,0,.028,0,.102,.056,.09);return;}
  if(kind==='water-vessel'){
   a.fillJar=new B.TransformNode('water-jar',scene);a.fillJar.parent=a.root;
   sphere('water-fill-vessel',a.fillJar,clay,0,0,0,.266,.28,.266);sphere('water-fill-mouth',a.fillJar,dark,0,.124,0,.138,.022,.138);
   a.fillRope=B.MeshBuilder.CreateLines('water-vessel-cord',{points:[vec(),vec(0,1,0)],updatable:true},scene);a.fillRope.parent=a.root;a.fillRope.color=B.Color3.FromHexString('#98714a');meshes.push(a.fillRope);
   return;
  }
  if(kind==='scribe-stylus'){
   box('scribe-reed-stylus',a.tool,reed,0,.065,0,.025,.22,.024);
   a.scribeTablet=new B.TransformNode('scribe-tablet',scene);a.scribeTablet.parent=a.root;
   box('scribe-clay-tablet',a.scribeTablet,clay,0,0,0,.29,.055,.22);
   for(const x of [-.09,0,.09])for(const z of [-.063,0,.063]){
    const mark=box('scribe-impression',a.scribeTablet,dark,x,.029,z,.038,.005,.011);mark.rotation.y=.38;
   }
   return;
  }
  if(kind==='joinery-adze'||kind==='baking-paddle'||kind==='casting-cup'){
   const length=kind==='baking-paddle'?.48:.19;
   box('artisan-tool-shaft',a.tool,wood,0,length/2,0,.031,length,.033);
   if(kind==='joinery-adze')box('joinery-cutting-edge',a.tool,copper,.035,length+.02,0,.15,.03,.065);
   else if(kind==='baking-paddle')box('bread-paddle-blade',a.tool,wood,0,length+.12,0,.28,.29,.036);
   else sphere('casting-cup',a.tool,clay,0,length+.045,0,.16,.11,.145);
   return;
  }
  if(kind==='hunting'){
   const arc=[];for(let i=0;i<=10;i++){const t=i/10*Math.PI;arc.push(vec(Math.sin(t)*.20,Math.cos(t)*.48,0));}
   const bow=B.MeshBuilder.CreateTube('hunter-bow',{path:arc,radius:.017,tessellation:6},scene);bow.parent=a.tool;bow.material=wood;meshes.push(bow);
   const string=B.MeshBuilder.CreateLines('bow-string',{points:[arc[0],vec(0,0,0),arc[10]]},scene);string.parent=a.tool;string.color=B.Color3.FromHexString('#d7c9a6');meshes.push(string);
   a.nockedArrow=[box('hunter-arrow',a.tool,reed,0,0,.29,.015,.015,.75),box('hunter-arrowhead',a.tool,stone,0,0,.67,.04,.015,.07)];
   a.shotArrow=new B.TransformNode('hunter-shot',scene);a.shotArrow.parent=a.root;
   box('hunter-flight-shaft',a.shotArrow,reed,0,0,0,.018,.018,.70);box('hunter-flight-tip',a.shotArrow,stone,0,0,.37,.045,.025,.09);box('hunter-flight-feather',a.shotArrow,linen,0,0,-.28,.09,.018,.11);a.shotArrow.setEnabled(false);
  }else if(kind==='fishing'){
   const rod=box('fishing-rod',a.tool,reed,0,.59,0,.026,1.45,.026);rod.rotation.x=.4;
   a.rodTip=new B.TransformNode('fishing-rod-tip',scene);a.rodTip.parent=rod;a.rodTip.position.y=.725;
   a.fishingLine=B.MeshBuilder.CreateLines('fishing-line',{points:[vec(),vec(0,-1,0)],updatable:true},scene);a.fishingLine.color=B.Color3.FromHexString('#d7c9a6');a.fishingLine.metadata={citizenId:a.root.metadata.citizenId};meshes.push(a.fishingLine);
   a.caughtFish=new B.TransformNode('fish-on-line',scene);a.caughtFish.parent=a.root;
   sphere('lifted-fish-body',a.caughtFish,fishSkin,0,-.15,0,.13,.34,.09);
   const tail=box('lifted-fish-tail',a.caughtFish,fishSkin,0,-.34,0,.14,.10,.025);tail.rotation.z=.26;
   for(const x of [-.051,.051])sphere('lifted-fish-eye',a.caughtFish,dark,x,-.075,-.018,.026,.025,.018);
   a.caughtFish.setEnabled(false);
  }else{
   box('worker-tool-handle',a.tool,wood,0,kind==='quarry'?.30:kind==='hoe'?.40:.16,0,.035,kind==='hoe'?1.04:kind==='quarry'?1.12:.66,.035);
   if(kind==='quarry')box('quarry-pick-head',a.tool,copper,0,.83,0,.40,.045,.055);
   else if(kind==='hoe'){box('field-hoe-blade',a.tool,stone,0,.92,0,.28,.07,.13);}
   else if(kind==='sickle'){const blade=box('field-sickle-blade',a.tool,copper,.12,.38,0,.28,.045,.045);blade.rotation.z=-.45;}
   else if(kind==='stirring'){}
   else if(kind==='logging')box('logging-axe-head',a.tool,copper,.10,.46,0,.24,.13,.045);
   else box('builder-tool-blade',a.tool,stone,.065,.46,0,.16,.085,.045);
  }
 }
 function cargo(a,c,state,buildingTypes){
  const source=c.carrying&&c.cargo?.food>0&&c.districtJob&&state.district?.jobs.find(j=>j.id===c.districtJob)?.source;
  const fromHunt=!!source&&buildingTypes.get(source)==='hunting';
  const activity=c.activity?.task;
  const goods=c.carrying?Object.entries(c.cargo||{}).filter(([,n])=>n>0):[],key=goods.map(([k,n])=>`${k}:${n}`).sort().join('|')+`:${a.look?.work||''}:${!!c.relic}:${c.relicId||''}:${activity==='haul-game'||activity==='dress-game'?activity:''}:${!!fromHunt}`;
  if(a.cargoKey===key)return;a.cargoKey=key;prune(a.load);for(const m of a.load.getChildMeshes())m.dispose();
  a.towLine=null;
  if(activity==='haul-game'||activity==='dress-game'){
   if(activity==='haul-game'){
    const line=B.MeshBuilder.CreateLines('hunter-hauling-rope',{points:[vec(),vec(0,-1,0)],updatable:true},scene);
    line.color=B.Color3.FromHexString('#aa895b');line.parent=a.load;line.metadata={prey:c.activity.prey,citizenId:c.id};a.towLine=line;meshes.push(line);
   }
   return;
  }
  if(fromHunt&&goods.some(([k])=>k==='food')){
   box('packed-game-tray',a.load,reed,0,-.08,0,.47,.075,.36);
   for(const x of [-.13,0,.13]){sphere('wrapped-meat-portion',a.load,clay,x,.005,0,.16,.14,.32);box('meat-portion-tie',a.load,linen,x,.055,0,.15,.03,.032);}
   return;
  }
  if(c.relic&&c.carrying){
   sphere('carried-relic-lapis',a.load,c.relicId==='land'?clay:lapis,0,0,0,.36,.36,.10);
   const ring=B.MeshBuilder.CreateTorus('carried-relic-gold',{diameter:.40,thickness:.045,tessellation:16},scene);ring.parent=a.load;ring.rotation.x=Math.PI/2;ring.material=gold;meshes.push(ring);
   box('carried-relic-linen',a.load,linen,0,-.18,.005,.43,.045,.16);return;
  }
  const k=goods[0]?.[0];if(!k)return;
  if(k==='food'&&a.look.work==='fishing'){
   for(let i=0;i<2;i++){sphere('cargo-fish',a.load,fishSkin,0,i*.10-.04,0,.43,.12,.12);const tail=box('cargo-fish-tail',a.load,fishSkin,.23,i*.10-.04,0,.10,.14,.025);tail.rotation.z=.4; sphere('cargo-fish-eye',a.load,dark,-.16,i*.10-.01,-.055,.02,.02,.02);}
   box('cargo-fish-binding',a.load,reed,0,0,0,.025,.27,.14);
  }else if(k==='food'&&a.look.work==='hunting'){sphere('cargo-game-bundle',a.load,dark,0,0,0,.47,.28,.28);box('cargo-game-binding',a.load,linen,0,0,0,.035,.29,.29);}
  else if(k==='basket'){
   box('cargo-basket-base',a.load,reed,0,-.11,0,.52,.07,.35);
   for(const x of [-.245,.245])box('cargo-basket-side',a.load,reed,x,-.015,0,.045,.17,.35);
   for(const z of [-.158,.158])box('cargo-basket-side',a.load,reed,0,-.015,z,.52,.17,.045);
   for(const x of [-.255,.255])box('cargo-basket-grip',a.load,wood,x,.06,0,.035,.055,.22);
  }
  else if(carriedKind(k)==='vessel'){sphere('cargo-vessel',a.load,clay,0,0,0,.32,.36,.32);sphere('cargo-neck',a.load,clay,0,.19,0,.14,.12,.14);}
  else if(carriedKind(k)==='bundle'){
   for(let i=0;i<4;i++)box('cargo-bundle',a.load,['wood','timber'].includes(k)?wood:reed,0,i*.045-.067,0,.58,.043,.10);
   for(const x of [-.16,.16])box('cargo-bundle-binding',a.load,linen,x,0,0,.035,.20,.11);
  }
  else if(['clay','brick','firedBrick','stone'].includes(k))for(let i=0;i<3;i++)box('cargo-material',a.load,k==='stone'?stone:clay,(i%2-.5)*.15,Math.floor(i/2)*.1,0,.145,.09,.23);
  else sphere('cargo-sack',a.load,['cloth','clothing','wool'].includes(k)?linen:reed,0,0,0,.39,.31,.30);
 }
 function appearance(a,c,state,buildingTypes){
  const work=buildingTypes.get(c.work),wear=(c.clothing??100)>50?'new':(c.clothing??100)>25?'worn':'ragged',mourning=c.phase==='mourning',inspiration=!!state.buffs?.inspiration,previous=a.appearanceInputs;
  const profession=professionClothing(c,buildingTypes,state);
  // Only scalar inputs that can change the rendered surfaces belong here.
  // Clothing decays every tick; cargo, mood and animated head scale stay live.
  if(!previous||previous.profession!==profession||previous.age!==c.age||previous.sex!==c.sex||previous.robe!==c.robe||previous.wear!==wear||previous.work!==work||previous.role!==c.role||previous.calling!==c.calling||previous.futureRole!==c.futureRole||previous.pendingRole!==c.pendingRole||previous.inspiration!==inspiration||previous.mourning!==mourning||previous.siteDuty!==c.siteDuty||previous.guarding!==c.guarding||previous.nightWatch!==c.nightWatch){
  a.appearanceInputs={profession,age:c.age,sex:c.sex,robe:c.robe,wear,work,role:c.role,calling:c.calling,futureRole:c.futureRole,pendingRole:c.pendingRole,inspiration,mourning,siteDuty:c.siteDuty,guarding:c.guarding,nightWatch:c.nightWatch};
  const look=residentVisual(c,state,buildingTypes,profession),scale=look.scale,motion=look.motion;const width=a.nativeResident?.97+(motion.width-.80)*.15:motion.width,height=a.nativeResident?.97+(motion.height-.89)*.27:motion.height;a.root.scaling.set(scale*width,scale*height,scale*(a.nativeResident?1:(.96+motion.width*.04)));a.look=look;
  const identity=look.identity,adult=c.age>=16,bearded=adult&&c.sex!=='f'&&identity.beard>0;
  for(const m of a.beardMeshes)m.isVisible=bearded;
  for(const m of a.hairMeshes)m.isVisible=identity.hair!==0||!adult;
  if(a.head){a.head.scaling.set(a.headBase.x*(a.nativeResident?Math.max(.98,Math.min(1.03,identity.headWidth)):identity.headWidth),a.headBase.y*(a.nativeResident?Math.max(.98,Math.min(1.03,identity.headHeight)):identity.headHeight),a.headBase.z);
   a.fullHair?.setEnabled(identity.hair===2);a.bun?.setEnabled(identity.hair===3);
   if(a.fullBeard){a.fullBeard.setEnabled(bearded&&identity.beard>=2);a.fullBeard.scaling.y=a.jawBounds.size.y*(identity.beard===3?2.1:1.5);a.fullBeard.position.y=a.jawBounds.max.y-a.fullBeard.scaling.y*.5;}

  }
  const skin=['#855234','#a26a43','#b98155','#c69365','#70462f'][identity.skin],hair=c.age>=55?['#8c8372','#b0a693','#756b5d'][identity.beard%3]:['#241d18','#3d2a1c','#543724','#1d1b19'][identity.hair];
  for(const m of a.skin)m.albedoColor=B.Color3.FromHexString(skin).toLinearSpace();for(const m of a.hair)m.albedoColor=B.Color3.FromHexString(hair).toLinearSpace();
  // Keep neighbouring ochre values apart against the dry ground.
  const palette=['#e0cda4','#77523d','#c8af8a','#c7baa1','#76856b','#995f50','#d7d0bb'];
  const color=c.phase==='mourning'?'#c7c9ae':look.wear==='new'&&!look.craft?palette[identity.cloth]:look.robe;
  const clothTint=B.Color3.FromHexString(color);
  for(const m of a.cloth){m.albedoColor=(a.upperCloth.has(m)?B.Color3.Lerp(clothTint,B.Color3.FromHexString('#eee0c0'),.46):clothTint).toLinearSpace();m.roughness=look.wear==='new'?.88:look.wear==='worn'?.96:1;}
  a.inspired.setEnabled(look.inspired);
  if(a.garmentSpec!==profession){
   for(const mesh of a.professionGarments||[]){const i=meshes.indexOf(mesh);if(i>=0)meshes.splice(i,1);mesh.dispose();}
   a.professionGarments=[];a.garmentSpec=profession;
   Object.assign(a.root.metadata,{workClothing:profession?.id||null,clothShape:profession?.shape||null,clothColor:profession?.color||null});
   if(profession){
    if(!a.professionMaterial){
     a.professionMaterial=new B.PBRMaterial(`profession-cloth-${c.id}`,scene);
     a.professionMaterial.metallic=0;a.professionMaterial.albedoTexture=wovenCloth();
     a.materials.push(a.professionMaterial);
    }
    // A distant body's sparse indices are only for rendering. Tailor each new
    // piece to the full source once, then keep its independent skinned mesh.
    if(a.geometryReduced)geometryLOD.apply(a.lodParts,false);
    a.professionGarments=createProfessionClothing(B,scene,a.model,profession,a.professionMaterial);
    if(a.geometryReduced)geometryLOD.apply(a.lodParts,true);
    for(const mesh of a.professionGarments){
     mesh.metadata={...mesh.metadata,...a.root.metadata,profession:profession.id};meshes.push(mesh);
    }
   }
  }
  if(profession&&a.professionMaterial){
   const tint=B.Color3.FromHexString(profession.color),fade=look.wear==='ragged'?.38:look.wear==='worn'?.18:0;
   a.professionMaterial.albedoColor=B.Color3.Lerp(tint,B.Color3.FromHexString('#a69b80'),fade).toLinearSpace();
   a.professionMaterial.roughness=1;
  }
  const key=`${look.craft}:${c.role}:${c.siteDuty}:${c.guarding}:${c.nightWatch}`;
  if(a.detailKey!==key){a.detailKey=key;prune(a.details);for(const n of a.details.getChildren())n.dispose();a.torchNode=null;a.torch=false;
   // Wear is carried by the real skinned wool material; freestanding flat
   // patch meshes cannot follow the pleated robe and used to float off the body.
   if(c.role==='carrier'||c.siteDuty==='carrier')box('carrier-sling',a.details,reed,-.23,.87,.04,.17,.19,.12);
   if(c.role==='healer')box('healer-satchel',a.details,reed,.23,.92,.02,.18,.22,.12);
   if(look.craft==='weaver'||look.craft==='tailor')sphere('craft-thread',a.details,linen,-.24,.90,.12,.12,.16,.12);
   if(c.guarding&&!c.nightWatch)box('guard-staff',a.details,wood,.35,.83,.04,.035,1.6,.035);
  }

  }
  a.look.mood=c.mood??50;
  cargo(a,c,state,buildingTypes);
 }
 function coatSheep(actor,index){
  const tint=['#f4e5cc','#c7b094','#cfb595','#ead8bd'][index%4];
  for(const mesh of actor.model.getChildMeshes()){
   const original=mesh.material;
   if(!original?.albedoColor)continue;
   const key=original.uniqueId+'|'+tint;
   if(!sheepCoats.has(key)){
    const coat=original.clone('fold-fleece-'+index%4);
    coat.albedoColor.multiplyInPlace(B.Color3.FromHexString(tint).toLinearSpace());
    sheepCoats.set(key,coat);ownedMaterials.push(coat);
   }
   mesh.material=sheepCoats.get(key);
  }
 }
 function animate(a,c,state,dt,paused,speed,viewPosition=c){
  const plough=viewPosition.plough;
  a.ploughPoseChanged=!!plough!==!!a.wasPloughing;
  a.workContact=viewPosition.contact||null;a.presentationCitizen=c;
  let dx=0,dz=0,distance=0;
  const aisle=artisanWalk(a,a.workContact,c,dt,speed,paused);
  if(aisle){a.workContact=null;c={...c,walking:true,activity:null,phase:'toWork'};}
  const offsetX=(aisle?.x??viewPosition.x)-c.x,offsetY=(aisle?.y??viewPosition.y)-c.y;
  const eventContact=!!c.eventContact;
  if(a.lastX!==null&&a.eventContactActive!==undefined&&eventContact!==a.eventContactActive)a.ceremonyJoin={path:null,index:0,target:null};
  a.eventContactActive=eventContact;
  if(c.homeVisit||a.lastHomeStage||aisle||plough||a.wasPloughing||c.miracleContact||c.funeralContact||c.controlled){a.ceremonyJoin=null;a.viewOffsetX=offsetX;a.viewOffsetY=offsetY;}
  else if(a.ceremonyJoin){const point=ceremonyJoinStep(a,state,networkFor(state),viewPosition,dt,paused,speed);a.viewOffsetX=point.x-c.x;a.viewOffsetY=point.y-c.y;}
  else if(a.viewOffsetX===undefined){a.viewOffsetX=offsetX;a.viewOffsetY=offsetY;}else if(!paused){
   const fixed=!c.walking&&['working','constructing','waiting','treatment'].includes(c.phase),distance=Math.hypot(offsetX-a.viewOffsetX,offsetY-a.viewOffsetY);
   // Final gathering steps stay at walking speed instead of snapping to a spot.
   const blend=c.festivalContact?Math.min(1,.24*dt*speed/Math.max(.00001,distance)):fixed?1:1-Math.exp(-dt*9);a.viewOffsetX+=(offsetX-a.viewOffsetX)*blend;a.viewOffsetY+=(offsetY-a.viewOffsetY)*blend;
  }
  // Possession follows the exact authored route, including its water crossing;
  // pedestrian lane offsets must not slide the swimmer onto a different bank.
  if(c.controlled||c.miracleContact){a.viewOffsetX=0;a.viewOffsetY=0;}
  const shownX=c.x+a.viewOffsetX,shownY=c.y+a.viewOffsetY,swim=residentSwimmingPresentation(c,a.time,{reducedMotion});
  dx=a.lastX===null?0:shownX-a.lastX;dz=a.lastY===null?0:shownY-a.lastY;distance=Math.hypot(dx,dz)*6;
  a.root.position.set(shownX*6,swim?swim.height:onBridge(state.buildings,c.x,c.y,state)?.22:floorHeight(shownX,shownY,surfaceElevation(shownX,shownY,state)),shownY*6);a.root.metadata.swimming=!!swim;
  if(c.homeVisit){
   const home=c.homeVisit;
   a.root.position.y=(home.deck??a.root.position.y)+home.height;
   a.root.metadata.homeVisit=home;
  }else if(a.lastHomeStage)delete a.root.metadata.homeVisit;
  a.homePoseChanged=a.lastHomeStage!==c.homeVisit?.stage;a.lastHomeStage=c.homeVisit?.stage;
  if(a.details)a.details.setEnabled(!swim);
  if(c.homeVisit){
   if(!paused||a.yaw===null){a.yaw=c.homeVisit.yaw;a.root.rotation.y=a.yaw;}
  }
  else if(plough){a.yaw=plough.yaw;a.root.rotation.y=plough.yaw;}
  else if(c.miracleContact||c.funeralContact||c.eventContact&&!a.ceremonyJoin){
   // Both rail targets and the bearer share this ceremony orientation. Generic
   // path smoothing must not rotate them apart or snap the root when paused.
   if(!paused||a.yaw===null){a.yaw=(c.miracleContact||c.funeralContact||c.eventContact).yaw;a.root.rotation.y=a.yaw;}
  }else{
   if(c.clinicPlace&&!aisle){a.yaw=c.clinicPlace.yaw;a.root.rotation.y=a.yaw;}
   if(c.festivalContact&&!paused){const center=c.festivalContact.center,dx=center.x-shownX,dy=center.y-shownY;a.yaw=Math.hypot(dx,dy)>.001?Math.atan2(dx,dy):c.festivalContact.yaw;}
   if(c.activity?.target&&distance<.001&&(!paused||a.yaw===null)&&(!c.activity.stage||['working','strike'].includes(c.activity.stage))){
    const firstFacing=a.yaw===null,target=a.workContact?.target||c.activity.target;
    a.yaw=Math.atan2(target.x-viewPosition.x,target.y-viewPosition.y);
    if(firstFacing)a.root.rotation.y=a.yaw;
   }
   if(c.freightHandoff&&(!paused||a.yaw===null)){const point=c.freightHandoff.target,first=a.yaw===null;a.yaw=Math.atan2(point.x-shownX,point.y-shownY);if(first)a.root.rotation.y=a.yaw;}
   if(distance>.00001&&!paused&&!c.festivalContact){if(!c.freightHandoff)a.yaw=Math.atan2(dx,dz);const angle=Math.atan2(Math.sin(a.yaw-a.root.rotation.y),Math.cos(a.yaw-a.root.rotation.y));a.root.rotation.y+=angle*(1-Math.exp(-dt*10));}
   else if(a.yaw!==null&&!paused){const angle=Math.atan2(Math.sin(a.yaw-a.root.rotation.y),Math.cos(a.yaw-a.root.rotation.y));a.root.rotation.y+=angle*(1-Math.exp(-dt*10));}
  }
  a.lastX=shownX;a.lastY=shownY;
  const decision=c.homeVisit?{clip:c.walking?'Walk_Loop':'Idle_Loop',pose:c.carrying?'carry':'idle'}:plough?{clip:'Walk_Loop',pose:'idle'}:actorAnimation(c,['dairy','lithophone','lyre'].includes(a.workContact?.kind)&&!c.walking?0:distance<3?distance:0);
  // Changing UI modes on pause must not restart clips or alter their sampled pose.
  if(!paused||!a.clip||a.ploughPoseChanged||a.homePoseChanged){a.pose=decision.pose;a.c=c;if(a.clip!==decision.clip){
   attachClock(a);
   a.groups.get(a.clip)?.stop();
   const g=a.groups.get(decision.clip);if(!g)throw Error(`Missing actor animation: ${decision.clip}`);g.start(true,1,g.from,g.to,false);
   if(decision.clip==='Walk_Loop')queueManualChannels(a,g);
   if(g.to>g.from){const phase=a.look?a.look.motion.phase/(Math.PI*2):a.sheepClipPhase;if(phase!==undefined)g.goToFrame(g.from+phase*(g.to-g.from));}a.clip=decision.clip;
  }}
  a.wasPloughing=!!plough;
  a.plough=plough;
  a.paused=paused;
  if(!paused)a.unloadTime=a.pose==='unload'?Math.min(1,(a.unloadTime||0)+dt*speed):0;
  if(!paused||!a.hasModelPose){
   const playing=c.playing&&c.age<16,keepsake=a.pose==='peaceRelief'&&c.peaceKeepsake;
   if(a.playProps){a.playProps.setEnabled(!!playing);a.playBoard.setEnabled(!!playing&&!c.walking);}
   if(keepsake&&!a.playAnimal){a.playAnimal=clayAnimal(a.root.name,a.hands.r||a.root,'peace');if(!a.hands.r)a.playAnimal.position.set(.25,.05,.3);}
   a.playAnimal?.setEnabled(!!(playing||keepsake));
  }
  if(a.tool&&plough)workerTool(a,null);
  else if(a.tool&&(!paused||a.toolKind===null||a.ploughPoseChanged)){const active=WORK_POSES.has(a.pose),builder=c.role==='builder'||c.siteDuty==='builder'||c.phase==='constructing';
   const kind=c.activity?(a.workContact?workstationHands(a.workContact,a.time):workPose(c.activity.kind,a.time,c.activity.task)).tool??(['logging','quarry','hunting','fishing'].includes(c.activity.kind)?c.activity.kind:null):builder?'building':null;workerTool(a,c.herding?'herd-staff':!c.carrying&&(active||c.activity?.kind==='fishing'&&c.activity.stage==='approach')?kind:null);}
  for(const [name,g]of a.groups)g.speedRatio=paused||name==='Walk_Loop'?0:speed;
  if(a.clip==='Walk_Loop'&&!paused&&distance<3){
   a.walkPhase=a.pose==='dance'?(poseTime*.28+(a.look?.motion.phase||0)/(Math.PI*2))%1:residentWalkPhase(a.walkPhase,c.homeVisit?.climbing?Math.hypot(distance,a.root.position.y-(a.lastHomeHeight??a.root.position.y)):distance,a.unit*a.root.scaling.z,a.walkMetres);
   const g=a.groups.get(a.clip);a.walkFrame=g.from+a.walkPhase*(g.to-g.from);
  }
  if(!paused||!a.hasModelPose){if(!paused)a.time=poseTime*(a.look?.motion.gait||1)+(a.look?.motion.phase||0);a.hasModelPose=true;if(a.look){const beat=Math.sin(a.time*3.5);a.model.rotation.x=swim?swim.pitch:(c.age>=55?.06:0)+(a.look.mood<25?.045:0)+(a.pose==='petting'?.60:0);a.model.rotation.z=swim?swim.sway:a.pose==='dance'?beat*.055:0;
   const glow=1+Math.sin(a.time*2.3)*.08,inspiredHeight=a.workContact?.kind==='lithophone'?1.25:a.workContact?.kind==='dairy'?1.3:1.82;a.inspired.position.y=inspiredHeight+Math.sin(a.time*2.3)*.015;a.inspired.scaling.set(.035*glow,.06*glow,.035*glow);
   // Play and dance bounce is a presentation pose at the resident's exact route position.
   a.lastHomeHeight=c.homeVisit?.height===undefined?null:a.root.position.y;
   a.model.position.y=a.footOffset+(a.pose==='play'||a.pose==='dance'?Math.abs(beat)*.04:0);
  }}
 }
 // Keep every authored leg/ankle/toe rotation. The glTF ancestry contains a
 // reflection: decomposing world matrices into quaternions and reconstructing
 // foot rotations reversed the actual toe axis, even when knee points looked OK.
 // A small symmetric hip translation narrows the stance without solving or
 // rotating the limb; stride, knee flexion and the entire foot remain authored.
 function authoredStance(a,targets){
  for(const leg of Object.values(a.legs))if(leg.upper){
   // A clip can animate rotation without resetting translation. Always narrow
   // either this frame's authored position or the original rest position once.
   const animated=targets?.position.has(leg.upper);
   leg.upper.position.x=(animated?leg.upper.position.x:leg.basePosition.x)*(a.nativeResident?1:RESIDENT_STANCE.hipWidthScale);
   leg.lastPosition=leg.upper.position.clone();
  }
 }
 // Animation clips set the skeletal base, then apply small task-specific arm gestures.
 const observer=scene.onAfterAnimationsObservable.add(()=>{
  for(const a of people.values()){
   if(!a.root.isEnabled()||a.poseSample===false)continue;
   const plough=a.plough;
   if(a.manualIdle&&!a.paused){const g=a.groups.get(a.clip),fps=g.targetedAnimations[0]?.animation.framePerSecond||30,span=g.to-g.from;if(span>0)g.goToFrame(g.from+(a.time*fps)%span);}
   // Walking animatables are paused, avoiding a second clock-based evaluation.
   // Apply the distance sample once, before task IK and skeleton upload.
   if(!a.paused&&a.clip==='Walk_Loop'&&a.walkFrame!==undefined)a.groups.get(a.clip).goToFrame(a.walkFrame);
   if(a.head&&a.look){const i=a.look.identity;a.head.scaling.set(a.headBase.x*(a.nativeResident?Math.max(.98,Math.min(1.03,i.headWidth)):i.headWidth),a.headBase.y*(a.nativeResident?Math.max(.98,Math.min(1.03,i.headHeight)):i.headHeight),a.headBase.z);}
   if(a.paused&&!a.homePoseChanged&&!a.ploughPoseChanged&&!a.rainChanged&&!a.rainReaction&&a.armNodes.some(arm=>arm.last)){for(const arm of a.armNodes)if(arm.last)arm.node.rotationQuaternion=arm.last.clone();for(const leg of Object.values(a.legs)){if(leg.lastPosition)leg.upper.position.copyFrom(leg.lastPosition);for(const [i,n]of [leg.upper,leg.lower,leg.foot].entries())if(leg.lastRotations?.[i])n.rotationQuaternion=leg.lastRotations[i].clone();}if(a.lastPelvis)a.pelvis.position.copyFrom(a.lastPelvis);if(a.lastPelvisRotation)a.pelvis.rotationQuaternion=a.lastPelvisRotation.clone();for(const side of ['l','r'])if(a.lastHands?.[side])a.hands[side].rotationQuaternion=a.lastHands[side].clone();if(a.lastSpine)a.spine.rotationQuaternion=a.lastSpine.clone();continue;}
   const targets=a.clipTargets.get(a.clip);authoredStance(a,targets);
   const carry=['carry','unload'].includes(a.pose),work=WORK_POSES.has(a.pose),play=['play','dance'].includes(a.pose),taskPose=a.workContact?workstationPose(a.workContact,a.time):workPose(a.pose,a.time,a.c.activity?.task);
   const swimming=!!a.c.swimming,milking=work&&a.workContact?.kind==='dairy',music=work&&a.workContact?.kind==='lithophone',seatHeight=a.c.homeVisit?.seatHeight??a.workContact?.seatHeight??(a.c.freightHandoff?.target.height<1.02?.95-.25*a.c.freightHandoff.progress:undefined),seated=milking||music||Number.isFinite(seatHeight),resetSeated=swimming||a.wasSwimming&&a.clip==='Idle_Loop'||seated||a.wasSeated&&a.clip==='Idle_Loop'||a.wasDancing&&a.clip==='Idle_Loop';a.wasSwimming=swimming;a.wasDancing=a.pose==='dance';
   // Sample the real idle keys before sitting. A constant idle channel can
   // otherwise retain our previous IK transform instead of rewriting its value.
   if(resetSeated&&a.clip==='Idle_Loop'){const idle=a.groups.get('Idle_Loop');idle.goToFrame(idle.from);authoredStance(a,targets);}
   if(a.pelvis&&!targets?.position.has(a.pelvis))a.pelvis.position.copyFrom(a.pelvisBase);
   for(const leg of Object.values(a.legs))for(const [i,n]of [leg.upper,leg.lower,leg.foot].entries())if(n&&!targets?.rotationQuaternion.has(n)&&leg.baseRotations[i])n.rotationQuaternion=leg.baseRotations[i].clone();
   milkingSeat(a,milking);if(seated)seatedMilking(a,Number.isFinite(seatHeight)?seatHeight/a.root.scaling.y:music?.40:.45);a.wasSeated=seated;
   if(a.pelvis)a.lastPelvis=a.pelvis.position.clone();for(const leg of Object.values(a.legs))leg.lastRotations=[leg.upper,leg.lower,leg.foot].map(n=>n?.rotationQuaternion?.clone());
   if(swimming){const stroke=residentSwimmingPresentation(a.c,a.time,{reducedMotion}).stroke;for(const [side,leg]of Object.entries(a.legs))if(leg.upper?.rotationQuaternion){leg.upper.rotationQuaternion=leg.upper.rotationQuaternion.multiply(B.Quaternion.FromEulerAngles((side==='l'?1:-1)*stroke*.09,0,0));leg.lastRotations=[leg.upper,leg.lower,leg.foot].map(n=>n?.rotationQuaternion?.clone());}}
   if(a.spine){
    const animated=targets?.rotationQuaternion.has(a.spine);
    const base=animated?a.spine.rotationQuaternion:a.spineBase;
    if(base){a.spine.rotationQuaternion=base.multiply(B.Quaternion.FromEulerAngles(!swimming&&work?taskPose.bend:a.c.freightHandoff?a.c.freightHandoff.progress*.42:a.c.funeralContact?Math.min(.16,(a.c.funeralContact.bow||0)*.4):a.pose==='play'&&!a.c.walking?.12:0,!swimming&&work?taskPose.twist:0,0));a.lastSpine=a.spine.rotationQuaternion.clone();}
   }
   for(const arm of a.armNodes){const n=arm.node;
    // Restore authored/clip transforms before the two-bone task solve.
    const animated=targets?.all.has(n);
    const base=animated?n.rotationQuaternion:arm.base;
    if(!base)continue;
    const upper=/upperarm/.test(n.name),side=/_l$/.test(n.name)?1:-1;
    const angle=play&&upper?Math.sin(a.time*3.5+side)*.4:0;
    n.rotationQuaternion=angle?base.multiply(B.Quaternion.RotationAxis(B.Axis.X,angle)):base.clone();
   }
   if(a.c.funeralContact?.hands){
    const inverse=a.root.computeWorldMatrix(true).clone().invert(),local=p=>B.Vector3.TransformCoordinates(vec(p.x*6,surfaceElevation(p.x,p.y,a.state)+p.height,p.y*6),inverse);
    // Per-person nonuniform stature changes effective segment lengths after a
    // solve; iterate the actual GLB chain until both palms settle on the rails.
    const left=local(a.c.funeralContact.hands.left),right=local(a.c.funeralContact.hands.right);
    for(let solve=0;solve<4;solve++){poseArm(a,'l',left);poseArm(a,'r',right);}
   }else if(Number.isFinite(a.c.homeVisit?.seatHeight)){
    const floor=a.c.homeVisit.stage!=='bench',height=a.c.homeVisit.seatHeight/a.root.scaling.y+(floor?.13:.11);
    poseArm(a,'l',vec(floor?-.31:-.19,height,.32));poseArm(a,'r',vec(floor?.31:.19,height,.32));
   }else if(a.c.homeVisit?.climbing){
    // Both directions face the wall. Grip alternates with rung height so a pause
    // keeps each hand on the same rung, even at a high simulation speed.
    const lift=Math.sin(a.c.homeVisit.height*Math.PI/.30)*.17;
    poseArm(a,'l',vec(-.19,1.25+lift,.26));poseArm(a,'r',vec(.19,1.25-lift,.26));
   }else if(a.rainReaction){
    const covered=a.rainReaction==='cover',spread=covered?.12:.41,height=covered?1.42:1.06;
    poseArm(a,'l',vec(-spread,height,.36));poseArm(a,'r',vec(spread,height,.36));
   }else if(a.c.mourningTorch||a.c.festivalTorch||a.c.nightWatch){poseArm(a,'r',vec(.28,1.0,.30));poseArm(a,'l',vec(-.16,.85,.12));
   }else if(a.pose==='peaceRelief'){
    const breath=reducedMotion?0:Math.sin(a.time*1.4)*.015;
    poseArm(a,'l',vec(-.24,.81+breath,.18));poseArm(a,'r',vec(.23,a.c.peaceKeepsake?1.02:.81+breath,.22));
   }else if(swimming){
    const stroke=residentSwimmingPresentation(a.c,a.time,{reducedMotion}).stroke;
    if(carry){a.load.position.set(0,.50,1.05);for(let solve=0;solve<4;solve++){poseArm(a,'l',vec(-.21,.50,1.05));poseArm(a,'r',vec(.21,.50,1.05));}}
    else for(let solve=0;solve<3;solve++){poseArm(a,'l',vec(-.38-stroke*.10,.34,1.0+stroke*.18));poseArm(a,'r',vec(.38+stroke*.10,.34,1.0-stroke*.18));}
   }else if(a.c.herding){poseArm(a,'r',vec(.29,.92,.24));
   }else if(a.c.activity?.task==='dress-game'||a.c.activity?.task==='lift-game'){
    const dressing=a.c.activity.task==='dress-game',h=dressing?.83:.40,wave=Math.sin(a.time*3.7)*.065;
    poseArm(a,'r',vec(.13,h+wave,.46));poseArm(a,'l',vec(-.15,h,.46));
   }else if(a.towLine&&carry){
    a.load.position.set(0,0,0);
    poseArm(a,'l',vec(-.17,.77,.22));poseArm(a,'r',vec(.08,.8,.20));
    const k=a.state.gathering?.kills.find(k=>k.id===a.c.activity?.prey);
    if(k){
     const p=carcassPosition(a.c,k),end=vec(p.x*6,surfaceElevation(p.x,p.y,a.state)+.25,p.y*6);
     const inv=a.load.computeWorldMatrix(true).clone().invert(),palm=a.hands.r.getAbsolutePosition();
     B.MeshBuilder.CreateLines('hunter-hauling-rope',{points:[palm,end].map(q=>B.Vector3.TransformCoordinates(q,inv)),instance:a.towLine},scene);
    }
   }else if(carry||a.c.freightHandoff){
    const resource=Object.keys(a.c.cargo||{}).find(key=>a.c.cargo[key]>0);
    const grip=residentLoadGrip(resource,a.pose==='unload',a.unloadTime||0);
    const shift=vec(0,0,0),handoff=a.c.freightHandoff;
    if(handoff){
     const p=handoff.target,ground=Math.max(a.root.position.y,surfaceElevation(p.x,p.y,a.state));
     const world=vec(p.x*6,ground+p.height+(carry?.15:.04),p.y*6);
     const local=B.Vector3.TransformCoordinates(world,a.root.computeWorldMatrix(true).clone().invert());
     shift.copyFrom(local.subtract(vec(0,grip.height,grip.reach)).scale(handoff.progress));
    }
    a.load.position.set(shift.x,grip.height+shift.y,grip.reach+shift.z);
    for(let pass=0;pass<(handoff?3:1);pass++)for(const [side,point] of [['l',grip.left],['r',grip.right]])poseArm(a,side,vec(...point).addInPlace(shift));
   }else if(a.pose==='logging'||a.pose==='quarry'){
    const swing=a.c.activity?.stage==='strike'?0:(Math.sin(a.time*2.8)+1)*.5;
    poseArm(a,'r',vec(.17,.99+swing*.28,.39-swing*.11));
    poseArm(a,'l',vec(-.04,1.03+swing*.23,.44-swing*.10));
   }else if(a.pose==='hunting'){
    const pull=(Math.sin(a.time*2.5)+1)*.5;
    poseArm(a,'l',vec(-.11,1.22,.63));poseArm(a,'r',vec(.15,1.15,.22+pull*.25));
   }else if(a.pose==='fishing'){
    const grip=fishingHands(a.c.activity,a.time);poseArm(a,'r',vec(...grip.right));poseArm(a,'l',vec(...grip.left));
   }else if(a.pose==='petting'){
    const target=a.c.activity?.target,pet=target?B.Vector3.TransformCoordinates(vec(target.x*6,surfaceElevation(target.x,target.y,a.state)+.58,target.y*6),a.root.computeWorldMatrix(true).clone().invert()):vec(.15,.44,.65);
    pet.z+=Math.sin(a.time*4)*.07;poseArm(a,'r',pet);poseArm(a,'l',vec(-.24,.79,.30));
   }else if(plough){
    const inverse=a.root.computeWorldMatrix(true).clone().invert();
    const height=surfaceElevation(plough.x,plough.y,a.state)+PLOUGH_HANDLE_HEIGHT;
    for(const side of ['l','r']){
     const p=plough.handles[side],local=B.Vector3.TransformCoordinates(vec(p.x*6,height,p.y*6),inverse);
     poseArm(a,side,local);
    }
   }else if(work&&a.workContact?.kind==='healing'&&people.get(a.c.activity?.patientId)?.arms){
    const patient=people.get(a.c.activity.patientId),inverse=a.root.computeWorldMatrix(true).clone().invert();
    const arms=[patient.arms.r,patient.arms.l].filter(arm=>arm?.upper&&arm?.lower);
    for(const arm of arms){arm.upper.computeWorldMatrix(true);arm.lower.computeWorldMatrix(true);}
    const distance=arm=>B.Vector3.DistanceSquared(a.root.position,arm.upper.getAbsolutePosition());
    const arm=arms.sort((x,y)=>distance(x)-distance(y))[0];
    if(arm){const upper=arm.upper.getAbsolutePosition(),lower=arm.lower.getAbsolutePosition(),out=a.root.position.subtract(upper);out.y=0;out.normalize();
     const dressing=B.Vector3.Lerp(upper,lower,.26+.055*Math.sin(a.time*3)).add(out.scale(.07)),support=B.Vector3.Lerp(upper,lower,.70).add(out.scale(.06));
     const right=B.Vector3.TransformCoordinates(dressing,inverse),left=B.Vector3.TransformCoordinates(support,inverse);
     for(let n=0;n<3;n++){poseArm(a,'r',right);poseArm(a,'l',left);}
    }
   }else if(work&&a.workContact?.kind==='gathering-site'){
    poseArm(a,'r',vec(...taskPose.right));poseArm(a,'l',vec(...taskPose.left));
   }else if(work&&a.workContact){
    const hands=workstationHands(a.workContact,a.time),inverse=a.root.computeWorldMatrix(true).clone().invert();
    const local=p=>B.Vector3.TransformCoordinates(vec(p.x*6,surfaceElevation(p.x,p.y,a.state)+p.height,p.y*6),inverse);
    const right=local(hands.right),left=local(hands.left);
    for(let solve=0;solve<(music||a.workContact.kind==='artisan'?3:1);solve++){poseArm(a,'r',right);poseArm(a,'l',left);}
   }else if(work){
    poseArm(a,'r',vec(...taskPose.right));poseArm(a,'l',vec(...taskPose.left));
   }else if(a.pose==='dance'){
    // Celebrate with the actual palms and authored stepping legs. Each resident
    // keeps a stable place; no animation displacement enters the simulation.
    const opening=(1-Math.cos(a.time*3.5))*.5,spread=.045+.38*opening,lift=1.16+Math.sin(a.time*3.5)*.12;
    for(let solve=0;solve<4;solve++){poseArm(a,'l',vec(-spread,lift,.46));poseArm(a,'r',vec(spread,lift,.46));}
   }else if(a.pose==='play'&&!a.c.walking){
    const lift=Math.sin(a.time*3.5)*.06;poseArm(a,'r',vec(.13,.86+lift,.43));poseArm(a,'l',vec(-.06,.87+lift,.43));
   }
   if(a.toolKind==='water-vessel')dipWaterVessel(B,a,WATER_HEIGHT);
   musicianMallets(a,music?a.workContact:null);
   if(!a.c.homeVisit?.climbing&&!Number.isFinite(a.c.homeVisit?.seatHeight)&&!a.rainReaction&&!a.c.herding&&!plough&&!swimming&&!a.sourceWalk&&!carry&&!work&&!play&&!a.c.funeralContact?.hands&&!a.c.mourningTorch&&!a.c.festivalTorch&&!a.c.nightWatch&&a.pose!=='petting'){
    // The source idle/walk gesture was too broad for a close city crowd. Keep
    // the authored legs, and solve relaxed palms below their actual shoulders.
    const inverse=a.root.computeWorldMatrix(true).clone().invert(),swing=a.clip==='Walk_Loop'?Math.sin(a.walkPhase*Math.PI*4)*.075:Math.sin(a.time*1.2)*.008;
    for(const side of ['l','r']){const arm=a.arms[side],hand=a.hands[side];if(!arm?.upper||!arm.lower||!hand)continue;for(const n of [arm.upper,arm.lower,hand])n.computeWorldMatrix(true);const shoulder=B.Vector3.TransformCoordinates(arm.upper.getAbsolutePosition(),inverse),elbow=B.Vector3.TransformCoordinates(arm.lower.getAbsolutePosition(),inverse),palm=B.Vector3.TransformCoordinates(hand.getAbsolutePosition(),inverse),length=B.Vector3.Distance(shoulder,elbow)+B.Vector3.Distance(elbow,palm);poseArm(a,side,vec(shoulder.x+(side==='l'?-1:1)*(a.nativeResident?.12:.035),shoulder.y-length*.94,shoulder.z+.025+(side==='l'?swing:-swing)));}
   }
   if(a.tool.isEnabled()&&a.hands.r&&a.hands.l){
    a.hands.r.computeWorldMatrix(true);a.hands.l.computeWorldMatrix(true);
    let direction=['logging','quarry'].includes(a.pose)?a.hands.l.getAbsolutePosition().subtract(a.hands.r.getAbsolutePosition()):B.Vector3.TransformNormal(a.pose==='hunting'?vec(0,1,0):a.pose==='building'?vec(0,.12,.99):vec(0,.85,.55),a.root.getWorldMatrix());
    if(a.toolKind==='herd-staff')direction=vec(.07,1,.05);
    if(a.toolKind==='hoe'){
     // A rigid shaft pivots down from its palm grip. Solve its forward reach
     // from the desired blade height instead of pointing an axe shape skyward.
     const rootMatrix=a.root.computeWorldMatrix(true),inverse=rootMatrix.clone().invert(),grip=B.Vector3.TransformCoordinates(a.hands.r.getAbsolutePosition(),inverse),shaft=B.Vector3.TransformNormal(vec(0,.92,0),a.hands.r.getWorldMatrix().multiply(inverse)).length();
     const lift=(Math.sin(a.time*3.6)+1)*.5,drop=Math.max(-shaft*.98,Math.min(shaft*.98,.055+lift*.34-grip.y)),forward=Math.sqrt(Math.max(0,shaft*shaft-drop*drop));
     const end=B.Vector3.TransformCoordinates(vec(grip.x,grip.y+drop,grip.z+forward),rootMatrix);direction=end.subtract(a.hands.r.getAbsolutePosition());
    }
    if(a.workContact&&['building','farming'].includes(a.workContact.kind)){
     const target=a.workContact.target,lift=(1-Math.cos(a.time*3.6))*.5;
     const point=vec(target.x*6,surfaceElevation(target.x,target.y,a.state)+target.height+lift*.26,target.y*6);
     direction=point.subtract(a.hands.r.getAbsolutePosition());
    }
    if(a.workContact?.kind==='gathering-site'){
     const {target,task}=a.workContact,ground=floorHeight(target.x,target.y,surfaceElevation(target.x,target.y,a.state));
     const lift=a.c.activity.stage==='strike'?0:(1+Math.sin(a.time*3.1))*.5;
     const point=vec(target.x*6,ground+target.height+(['quarry','logging','clay'].includes(task)?lift*.30:0),target.y*6);
     const inverse=a.root.computeWorldMatrix(true).clone().invert(),grip=a.hands.r.getAbsolutePosition();
     const axis=grip.subtract(point).normalize(),shaft=B.Vector3.TransformNormal(vec(0,gatheringToolLength[task],0),a.hands.r.getWorldMatrix()).length();
     const right=B.Vector3.TransformCoordinates(point.add(axis.scale(shaft)),inverse),left=B.Vector3.TransformCoordinates(point.add(axis.scale(Math.max(.08,shaft-.25))),inverse);
     for(let i=0;i<2;i++){poseArm(a,'r',right);if(task!=='reed')poseArm(a,'l',left);}
     a.hands.r.computeWorldMatrix(true);a.tool.computeWorldMatrix(true);
     direction=point.subtract(a.tool.getAbsolutePosition());
    }
    if(a.workContact?.kind==='artisan'){
     const p=a.workContact.target,point=vec(p.x*6,a.root.position.y+p.height,p.y*6);
     direction=point.subtract(a.hands.r.getAbsolutePosition());
    }
    if(a.workContact?.kind==='vat'){
     const target=a.workContact.target,stand=a.workContact.stand,dx=target.x-stand.x,dz=target.y-stand.y,d=Math.hypot(dx,dz);
     direction=vec((target.x+dx/d*.18/6)*6,surfaceElevation(target.x,target.y,a.state)+target.height-.38,(target.y+dz/d*.18/6)*6).subtract(a.hands.r.getAbsolutePosition());
    }
    if(a.toolKind==='scribe-stylus'&&a.scribeTablet){
     const inverse=a.root.getWorldMatrix().clone().invert();
     const palm=B.Vector3.TransformCoordinates(a.hands.l.getAbsolutePosition(),inverse);
     a.scribeTablet.position.copyFrom(palm.add(vec(.105,.039,.025)));
     a.scribeTablet.computeWorldMatrix(true);
     const contact=a.scribeTablet.getAbsolutePosition().add(vec(0,.03,0));
     direction=contact.subtract(a.hands.r.getAbsolutePosition());
    }
    const local=B.Vector3.TransformNormal(direction,a.tool.parent.getWorldMatrix().clone().invert()).normalize();
    a.tool.rotationQuaternion=B.Quaternion.FromUnitVectorsToRef(B.Axis.Y,local,new B.Quaternion());a.tool.computeWorldMatrix(true);
   }
   if(a.pose==='hunting'&&a.shotArrow&&a.c.activity?.target){
    const target=a.c.activity.target,end=vec(target.x*6,surfaceElevation(target.x,target.y,a.state)+.95,target.y*6);
    // Aim in world space: a hand's authored glTF rotation must not turn the bow away.
    aimForward(a.tool,end);
    const progress=Math.max(0,Math.min(1,((a.c.activity.progress||0)-.88)/.12)),flying=progress>0;
    a.shotArrow.setEnabled(flying);for(const mesh of a.nockedArrow)mesh.setEnabled(!flying);
    if(flying){const start=a.tool.getAbsolutePosition().add(a.tool.getDirection(B.Axis.Z).normalize().scale(.35)),position=B.Vector3.Lerp(start,end,progress);
     position.y+=Math.sin(progress*Math.PI)*.12;
     a.shotArrow.position.copyFrom(B.Vector3.TransformCoordinates(position,a.root.getWorldMatrix().clone().invert()));
     aimForward(a.shotArrow,end.add(vec(0,-.01,0)));
    }
   }
   for(const arm of a.armNodes)arm.last=arm.node.rotationQuaternion?.clone();
   a.lastPelvisRotation=a.pelvis?.rotationQuaternion?.clone();for(const side of ['l','r'])a.lastHands[side]=a.hands[side]?.rotationQuaternion?.clone();
   if(a.fishingLine&&a.tool.isEnabled())updateFishingTackle(B,a,WATER_HEIGHT);
  }
  if(riteState)funeralProps(riteState,riteView);
 });
 function funeralProps(state,savedView){
  const f=savedView&&!savedView.participants?{...savedView,participants:(savedView.mourners||[]).map(id=>{const c=people.get(id)?.c;return c?{id,torch:!!c.mourningTorch}:null;}).filter(Boolean)}:savedView,grips=new Map(),extraTorches=[];
  for(const [id,a]of people){const current=a.presentationCitizen;if((current?.mourningTorch||current?.festivalTorch||current?.nightWatch)&&a.root.isEnabled()&&a.hands.r){a.hands.r.computeWorldMatrix(true);grips.set(id,a.hands.r.getAbsolutePosition());if(!current.mourningTorch&&(current.festivalTorch||current.nightWatch))extraTorches.push({id,torch:true,candle:!!current.festivalTorch});}}
  const torchView=extraTorches.length?{...f,participants:[...(f?.participants||[]),...extraTorches]}:f;
  ritual.update(torchView,state,poseTime,grips,id=>jackals?.mouthFor(id));
  if(f?.coffin){if(!bier){const root=new B.TransformNode('funeral-bier',scene);box('bier-cloth',root,linen,0,.58,0,.7,.22,1.8);for(const x of [-.35,.35])box('bier-pole',root,wood,x,.42,0,.045,.045,2.5);bier={root};}bier.root.position.set(f.coffin.x*6,surfaceElevation(f.coffin.x,f.coffin.y,state),f.coffin.y*6);}
  else if(bier){remove(bier);bier=null;}

 }
 function resetResidentPresentation(a){
  // Keep the rig and identity, but forget every sampled task/ceremony pose.
  // Hidden residents need this too: they can reappear after a skipped season.
  attachClock(a);a.groups.get(a.clip)?.stop();
  a.poseSlot=undefined;a.poseSample=true;a.manualIdle=false;a.appearanceInputs=null;a.clip=null;a.walkFrame=undefined;a.hasModelPose=false;a.lastX=null;a.lastY=null;a.yaw=null;a.viewOffsetX=undefined;a.viewOffsetY=undefined;a.eventContactActive=undefined;a.ceremonyJoin=null;a.wasSeated=true;a.wasSwimming=true;a.lastHands={};a.lastPelvis=null;a.lastPelvisRotation=null;a.lastSpine=null;a.toolKind=null;
  for(const arm of a.armNodes)arm.last=null;for(const leg of Object.values(a.legs)){leg.lastPosition=null;leg.lastRotations=null;}
  a.tool?.setEnabled(false);a.playProps?.setEnabled(false);a.playBoard?.setEnabled(false);a.playAnimal?.setEnabled(false);a.milkingSeat?.setEnabled(false);
 }
 function resetPresentation(state=presentedState){
  if(disposed)return;presentedState=null;
  if(state)update(state,0,{paused:true});
 }
 function storeSleepingRig(a){
  const rig={meshes:a.root.getChildMeshes(),transformNodes:[a.root,...a.root.getChildTransformNodes(false)],skeletons:[...a.skeletons],animationGroups:[...a.groups.values()],materials:[...a.materials]};
  // Plain membership lists avoid AssetContainer's scene/context observers.
  // These are already instantiated, actor-owned objects, not loader assets.
  for(const [key,kind]of sleepingLists)for(const asset of rig[key])scene[`remove${kind}`](asset);
  for(const mesh of rig.meshes){const i=meshes.indexOf(mesh);if(i>=0)meshes.splice(i,1);}a.sleepingRig=rig;
 }
 const sleepingLists=[['transformNodes','TransformNode'],['meshes','Mesh'],['skeletons','Skeleton'],['animationGroups','AnimationGroup'],['materials','Material']];
 function releaseSleepingRig(a,restore=false){
  const rig=a.sleepingRig;if(!rig)return;
  if(restore){for(const [key,kind]of sleepingLists)for(const asset of rig[key])scene[`add${kind}`](asset);for(const mesh of rig.meshes)meshes.push(mesh);}
  // Actor ownership/disposal remains with remove(a), including never-woken rigs.
  a.sleepingRig=null;
 }
 let courierCandidates=[],courierScanAt=-Infinity,lastCourierWarm=-Infinity;
 function update(state,dt=1/60,{paused=false,speed=1,camera=null,viewportHeight=0,focusId=null,rainReaction=null,blessingApproach=null}={}){
  if(disposed)return;dt=Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0));speed=Math.max(0,Number.isFinite(speed)?speed:1);paused=paused||dt===0||speed===0;
  const replacedState=presentedState!==state;presentedState=state;
  if(replacedState){courierScanAt=lastCourierWarm=-Infinity;courierCandidates=[];for(const a of people.values())resetResidentPresentation(a);}
  // Presentation seconds use the real frame delta and selected UI multiplier.
  // Calendar simTime intentionally advances more slowly and must not drive poses.
  if(!paused){poseTime+=dt*speed;poseClock+=dt;}
  const frame=actorViewFrame(state),visible=homeVisits(state,showBlessingApproach(showRainObserver(frame.citizens,state,rainReaction),state,blessingApproach)),positions=residentViewPositions(state,visible),pettingCats=new Set(frame.pettingPairs.map(p=>p.catId)),seen=new Set();
  for(const c of visible)if(c.homeVisit)positions.set(c.id,{x:c.x,y:c.y,homeVisit:c.homeVisit});
  const teams=ambient?.hasPloughTeams?ploughTeams(state,visible):[];
  for(const team of teams)positions.set(team.driverId,{...team.driver,plough:team});
  // Match residentAppearance's first array.find, including falsy-ID fallback.
  // Rebuild each update: a building may keep its ID while changing its type.
  const buildingTypes=new Map();for(const b of state.buildings||[]){const key=b.id||`${b.x},${b.y}`;if(!buildingTypes.has(key))buildingTypes.set(key,b.type);}
  if(visible.some(usesHistoricalMan))requestHistoricalResident();
  let geometrySwitches=0;
  for(const c of visible){
   seen.add(c.id);let a=people.get(c.id),continuity=null;
   const anatomy=residentAnatomy(c.age),historical=historicalSource&&usesHistoricalMan(c)&&(!paused||!a||a.anatomy==='historical-man'),variant=historical?'historical-man':anatomy.source==='adult'?(c.sex==='f'?'female':'male'):anatomy.source;
   // Only the presentation skin changes. Keep the real person's identity,
   // route sample, facing and gait phase when optional detail becomes ready.
   if(a&&a.anatomy!==variant){continuity={lastX:a.lastX,lastY:a.lastY,yaw:a.yaw,walkPhase:a.walkPhase,viewOffsetX:a.viewOffsetX,viewOffsetY:a.viewOffsetY,eventContactActive:a.eventContactActive,ceremonyJoin:a.ceremonyJoin,rotationY:a.root.rotation.y};remove(a);people.delete(c.id);a=null;}
   if(!a){const source=historical?historicalSource:anatomy.source==='child'?(childSource||residentSource):anatomy.source==='adolescent'?(adolescentSource||residentSource):c.sex==='f'?(femaleSource||residentSource):residentSource;a=instantiate(source,`citizen-${c.id}`,{citizenId:c.id,child:c.age<16});a.anatomy=variant;a.footOffset=a.model.position.y;if(continuity){const {rotationY,...fields}=continuity;Object.assign(a,fields);a.root.rotation.y=rotationY;}people.set(c.id,a);}
   releaseSleepingRig(a,true);a.root.setEnabled(true);
   const important=!!(c.controlled||c.relic||c.miracleContact||c.funeralContact||c.eventContact||c.festivalContact||c.swimming||c.id===focusId);
   const pixels=residentScreenHeight(camera,{x:c.x*6,y:1,z:c.y*6},viewportHeight,1.7*anatomy.scale);
   const reduced=useResidentGeometryLOD(pixels,a.geometryReduced,important);
   if(a.lodParts.length&&reduced!==a.geometryReduced&&(!reduced||geometrySwitches<6)){
    geometryLOD.apply(a.lodParts,reduced);a.geometryReduced=reduced;geometrySwitches++;
   }
   appearance(a,c,state,buildingTypes);a.state=state;
   const interval=important?0:residentPoseIntervalForPixels(pixels);
   const reaction=rainReaction?.id===c.id?rainReaction.phase:null;
   a.rainChanged=a.rainReaction!==reaction;
   a.rainReaction=reaction;
   const position=positions.get(c.id);
   a.root.simplifiedShadow=interval>0&&!c.swimming;const slot=residentPoseSlot(poseClock,interval,c.id);a.poseSample=c.homeVisit?.stage!==a.lastHomeStage||a.rainChanged||!!reaction||slot===null||slot!==a.poseSlot||a.paused!==paused||!!position?.plough!==!!a.wasPloughing||!a.hasModelPose;a.poseSlot=slot;
   animate(a,c,state,dt,paused,speed,position);
   // The root keeps following the real route each frame. Only small skeletal
   // gestures are sampled less often; near/inspected people stay full rate.
   const manualIdle=interval>0&&a.clip==='Idle_Loop',g=a.groups.get(a.clip);
   if(manualIdle&&!a.manualIdle){g.pause();queueManualChannels(a,g);}
   else if(!manualIdle&&a.manualIdle&&a.clip==='Idle_Loop'){attachClock(a);g.play(true);}
   a.manualIdle=manualIdle;if(a.fishingLine)a.fishingLine.setEnabled(a.tool.isEnabled()&&a.c?.activity?.task!=='take-rod'&&a.c?.activity?.stage!=='approach');
  }
  // Keep a small reserve in large cities and yield entirely on slow frames.
  // Visible residents still receive their real rig in the frame they emerge.
  const warmRoom=(state.citizens||[]).length<=MAX_WARM_RESIDENTS||dt<1/35&&people.size-seen.size<MAX_WARM_RESIDENTS;
  let courier;
  if(warmHiddenResidents&&!paused&&state.citizens?.length>=300&&dt<=.052&&poseClock-lastCourierWarm>=.12){
   if(state.simTime-courierScanAt>=.6||state.simTime<courierScanAt){courierCandidates=nearTermWaterCouriers(state);courierScanAt=state.simTime;}
   if(people.size-seen.size<72)courier=courierCandidates.find(c=>!seen.has(c.id)&&!people.has(c.id));
   if(courier)lastCourierWarm=poseClock;
  }
  if(warmHiddenResidents&&(warmRoom||courier)){const c=courier||(state.citizens||[]).find(c=>!seen.has(c.id)&&!people.has(c.id));if(c){
   const anatomy=residentAnatomy(c.age),historical=historicalSource&&usesHistoricalMan(c),variant=historical?'historical-man':anatomy.source==='adult'?(c.sex==='f'?'female':'male'):anatomy.source;
   const source=historical?historicalSource:anatomy.source==='child'?(childSource||residentSource):anatomy.source==='adolescent'?(adolescentSource||residentSource):c.sex==='f'?(femaleSource||residentSource):residentSource;
   const a=instantiate(source,`citizen-${c.id}`,{citizenId:c.id,child:c.age<16});a.anatomy=variant;a.footOffset=a.model.position.y;appearance(a,c,state,buildingTypes);a.root.setEnabled(false);storeSleepingRig(a);people.set(c.id,a);
  }}
  const living=new Set((state.citizens||[]).map(c=>c.id));for(const c of visible)if(c.visitor)living.add(c.id);for(const [id,a]of people)if(!living.has(id)){remove(a);people.delete(id);}else if(!seen.has(id)){a.root.setEnabled(false);a.lastX=null;a.lastY=null;if(a.fishingLine)a.fishingLine.setEnabled(false);for(const g of a.groups.values())g.speedRatio=0;}
  ambient?.updateHerds(state,dt,paused,speed);
  const fauna=animalsFor(state).filter(c=>!ambient?.herdClaims(c.id)).map(c=>c.kind==='sheep'&&ambient?ambient.herdSheepPose(c):c).map(c=>c.kind==='cat'&&pettingCats.has(c.id)?{...c,behavior:'petting',walking:false}:c),animals=fauna.filter(c=>c.kind==='sheep'&&!ambient?.supportsFoldSheep(c)),seenSheep=new Set();for(const c of animals){
   seenSheep.add(c.id);let a=sheep.get(c.id);const index=Number(c.id.split('-').at(-1));
   if(!a){a=instantiate(sheepSource,c.id,{animalId:c.id,animalKind:'sheep'});coatSheep(a,index);a.sheepClipPhase=index*.31%1;sheep.set(c.id,a);}
   if(Number.isFinite(c.yaw)){a.yaw=c.yaw;if(!a.clip)a.root.rotation.y=c.yaw;}
   a.root.scaling.setAll((c.young?.68:1)*(.91+(index%5)*.035));
   animate(a,c,state,dt,paused,speed);
  }
  for(const [id,a]of sheep)if(!seenSheep.has(id)){remove(a);sheep.delete(id);}
  detachManualChannels();
  if(goats)goats.update(state,fauna.filter(c=>c.kind==='goat'),dt,{paused,speed});
  imported?.update(state,fauna.filter(c=>imported.supports(c.kind)),dt,{paused,speed});ambient?.update(state,dt,{paused,speed,ploughPoses:teams,sheep:fauna.filter(c=>c.kind==='sheep')});
  const riteJackals=frame.funeral?.jackals||[];jackals?.update(state,[...fauna.filter(c=>c.kind==='jackal'),...riteJackals],dt,{paused,speed});
  const protectedSites=new Set((state.pests?.cats||[]).map(cat=>cat.site));
  const huntedMice=new Set((state.pests?.sites||[]).filter(q=>q.mice>0&&protectedSites.has(q.key)&&!(q.flash&&q.clock-q.flash.time<2))
   .map(q=>`mouse:${q.key}:${q.mice-1}`));
  const shore=courtyardFauna(state);
  if(supplied){
   const rodents=fauna.filter(c=>huntedMice.has(c.id)||c.kind==='pestCatch'&&c.by==='cat'&&c.progress<.26);
   supplied.update(state,[...shore,...rodents],fauna.filter(c=>c.kind==='fish'));
  }
  wildlife.update(state,[...shore.filter(c=>c.kind!=='common-quail'&&!supplied?.supports(c)&&!['white-pelican','onager','egret','otter','glossy-ibis','marsh-harrier','pied-kingfisher','pygmy-cormorant','turtle'].includes(c.kind)&&(c.kind!=='pig'||!ambient?.hasYardPig)),...fauna.filter(c=>c.kind!=='fish'&&cityAnimalVisible(c,huntedMice)&&c.kind!=='mouse'&&c.kind!=='sheep'&&!(goats&&c.kind==='goat')&&!(jackals&&c.kind==='jackal')&&!imported?.supports(c.kind)),...jackals?[]:riteJackals],dt,{paused,speed});riteState=state;riteView=frame.funeral;funeralProps(state,riteView);festivalCourt.update(festivalView(state),state,poseTime);
 }
 function dispose(){if(disposed)return;disposed=true;scene.onAfterAnimationsObservable.remove(observer);for(const a of people.values())remove(a);for(const a of sheep.values())remove(a);if(bier)remove(bier);ritual.dispose();festivalCourt.dispose();people.clear();sheep.clear();geometryLOD.dispose();residentTextile?.dispose();shadowShape.dispose();goats?.dispose();imported?.dispose();ambient?.dispose();jackals?.dispose();supplied?.dispose();wildlife.dispose();for(const c of containers)c?.dispose();for(const m of ownedMaterials)m.dispose();meshes.length=0;}
 return {update,resetPresentation,dispose,meshes,shadowMeshes:()=>meshes.filter(shadowFilter),faunaReady,residentDetailsReady:()=>historicalPromise||Promise.resolve(),rootFor(selection){return selection.citizenId!==undefined?people.get(selection.citizenId)?.root:sheep.get(selection.animalId)?.root||ambient?.rootForSheep(selection.animalId)||goats?.rootFor(selection)||imported?.rootFor(selection)||jackals?.rootFor(selection)||supplied?.rootFor(selection)||wildlife.rootFor(selection);}};
}
