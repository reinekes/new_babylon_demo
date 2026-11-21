import {hasCivicApron,civicEntranceBricks,civicBrickGeometry} from '../civic-entrance-bricks.js';
import {workshopSurfaces} from './workshop-surfaces.js';
import {extractionKinds,extractionOwner} from '../extraction-courts.js';
import {extractionStockFraction} from '../extraction-stock.js';
import {localFerryVessel} from '../river-stores.js';
import {floodMapView} from '../river-flood.js';
import {createPalmRenderGroups} from './palm-render-groups.js';
import {orchardMaturity,orchardPalms} from '../orchard-layout.js';
import {isStrictSumer} from '../scenario-profiles.js';
import {createRoadRenderGroups} from './road-render-groups.js';
import {createCatDiscoveryScenery,catDiscoverySurfaceHeight} from './cat-discovery.js';
import {createLazyFeature} from './asset-loading.js';
import {createTradeCaravan} from './caravan.js';
import {createTradeRiverCraft} from './river-craft.js';
import {createDateClusters,createBotanicalMaterial} from './crop-varieties.js';
import {canalNetworkGeometry,openCanalMouths} from './canal-network.js';
import {createDistrictTerrain, surfaceElevation, TILE, shoreDistance} from '../district3d/terrain.js';
import {worldWidth,worldHeight,riverLength,worldFromRiver,terrain,river} from '../world.js';
import {vegetationFor, weatherAt} from '../environment.js';
import {irrigationFor, CARDINAL} from '../irrigation.js';
import {constructionProgress} from '../construction.js';
import {roadIsBuilt,roadKey} from '../roads.js';
import {footpathRibbonPoint} from '../footpaths.js';
import {streetSurfaceLayout} from '../street-surfaces.js';
import {obstacleIndex} from '../navigation.js';
import {generateStreets} from '../city-life.js';
import {cachedStreetsFor} from '../workforce.js';
import {canPlace} from '../engine.js';
import {createGameWater,canalArm,wornRoadGeometry,canalSection} from './water.js';
import {createNatureDetails,resourceDisplayLayout} from './nature-details.js';
import {deformedTerrainNormals,stitchTerrainRim} from './terrain-deformation.js';
import {cargoLayout,createGoodsSources} from './goods.js';
import {lakeContours,lakeDistance,visualSurfaceElevation} from './lake-shore.js';
import {sceneryClear,lakebankGeometry,siltLensesGeometry,floodplainTufts,tuftGeometry,riverbankGeometry,rectangularSiteGeometry} from './nature.js';

import {createValleyVegetation,loadValleyPlantSources,VALLEY_PLANT_ASSETS,vegetationBankDistance} from './valley-vegetation.js';

// Keep each assignment: Float32 colors round after every original operation.
export function applyTerrainAlphaClips(colors,clips){
 for(const index of clips.zero)colors[index]=0;
 for(let i=0;i<clips.indices.length;i++)colors[clips.indices[i]]*=clips.factors[i];
 return colors;
}

const RESOURCE_SITES={clay:{label:'Глина',color:'#b88764'},reed:{label:'Тростник',color:'#82985c'},stone:{label:'Камень',color:'#a2a996'},forest:{label:'Дерево',color:'#6e8955'},wildlife:{label:'Дичь',color:'#ab9064'},dates:{label:'Финики',color:'#b79a4f'}};

export function resourcePlacementSites(s,selection){
 const kind=extractionKinds[selection],points=new Map(),put=(x,y)=>points.set(`${x},${y}`,{x,y});
 if(!kind&&selection!=='fishing')return [];
 if(kind){for(const d of s.world?.deposits||[])if(d.kind===kind)put(d.x,d.y);}
 else{ // Inspect only river/lake banks, never every tile of the map.
  const water=[];for(let along=0;along<riverLength(s);along++)for(let across=Math.floor(river(along,s)-1.1);across<=Math.ceil(river(along,s)+1.1);across++){const p=worldFromRiver(across,along,s);if(terrain(p.x,p.y,s)==='water')water.push(p);}
  for(const lake of s.world?.lakes||[])water.push(...lake.cells);for(const p of water)for(const [dx,dy]of CARDINAL)put(p.x+dx,p.y+dy);
 }
 return [...points.values()].filter(p=>!canPlace(s,selection,p.x,p.y));
}

const clamp=v=>Math.max(0,Math.min(1,v));
const progress=b=>b.construction?constructionProgress(b).ratio:1;
const pointDistance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);};
// These plans contain display data only. Never initialize resources, roads or trade here.
// Resource quantities change during work and at season boundaries; only kind and
// coordinates affect these static meshes (resourceDisplayLayout uses the same data).
const depositGeometry=s=>s.world?.deposits?.map(d=>[d.kind,d.x,d.y]);
const datePalmGround=(s,p)=>vegetationBankDistance(p.x,p.y,s)>.22;
// Orders and endpoints can change in place, including in an imported save.
// Check the fields that feed the mesh plan. Idle roads allocate nothing each frame.
const roadSnapshots=new WeakMap();
let nextRoadRevision=0;
function landscapeRoadRevision(s){
 const roads=s.roads;
 if(!roads?.length)return 0;
 let previous=roadSnapshots.get(s);
 if(!previous){previous={rows:[],revision:0};roadSnapshots.set(s,previous);}
 const rows=previous.rows;
 let changed=rows.length!==roads.length;
 for(let i=0;i<roads.length;i++){
  const road=roads[i],a=road.a,b=road.b,order=road.construction,row=rows[i];
  const ratio=order?progress(road):1;
  if(row&&row.id===road.id&&row.ax===a?.x&&row.ay===a?.y&&row.ak===a?.key&&
    row.bx===b?.x&&row.by===b?.y&&row.bk===b?.key&&row.level===road.level&&row.built===road.built&&
    row.kind===order?.kind&&row.target===order?.target&&row.ratio===ratio)continue;
  rows[i]={id:road.id,ax:a?.x,ay:a?.y,ak:a?.key,bx:b?.x,by:b?.y,bk:b?.key,
   level:road.level,built:road.built,kind:order?.kind,target:order?.target,ratio};
  changed=true;
 }
 rows.length=roads.length;
 if(changed)previous.revision=++nextRoadRevision;
 return previous.revision;
}
export function landscapeSignature(s){return JSON.stringify([isStrictSumer(s),worldWidth(s),worldHeight(s),s.world?.seed,s.world?.river,s.world?.lakes,depositGeometry(s),s.gathering?.features?.map(f=>[f.id,f.kind,f.x,f.y]),s.buildings?.map(b=>[b.type,b.x,b.y,b.footprint||1,b.construction?.kind,progress(b),b.type==='garden'?[b.rotation||0,orchardMaturity(s,b).growth]:hasCivicApron(b)?[b.rotation||0,b.level||1]:b.type==='cityGate'?b.rotation||0:0]),s.roadAnchors,landscapeRoadRevision(s)]);}
export function landscapeFallbackTufts(s,roads=[],sources={}){
 if(sources.grass?.length&&sources.reed?.length)return [];
 return floodplainTufts(s,roads).filter(p=>!sources[p.kind]?.length);
}
export function landscapePlan(s,streets=cachedStreetsFor(s)||generateStreets([...(s.buildings||[]),...(s.roadAnchors||[])],s)){
 const edges=streets.edges,network=irrigationFor(s),known=new Map((s.roads||[]).map(r=>[r.id,r]));
 const displayRoad=(id,a,b,r)=>({id,a,b,level:r?.level||1,built:!!r&&roadIsBuilt(r),target:r?.construction?.target||null,progress:r?progress(r):1});
 const roads=edges.map(([a,b])=>{const id=roadKey(a,b);return displayRoad(id,a,b,known.get(id));});
 const ids=new Set(roads.map(r=>r.id));
 // Saved roads remain eligible during the transition that rebuilds the derived network.
 for(const r of known.values())if(r.a&&r.b&&!ids.has(r.id))roads.push(displayRoad(r.id,r.a,r.b,r));
 const canals=(s.buildings||[]).filter(b=>b.type==='canal').map(b=>{const id=`${b.x},${b.y}`;return {x:b.x,y:b.y,wet:network.wet.has(id),...(b.drain?{drain:true}:{}),...(b.silt>=.5?{flowWidth:b.silt>=.75?.42:.65}:{}),progress:progress(b),arms:network.arms.get(id)||CARDINAL.filter(([dx,dy])=>s.buildings.some(v=>v.type==='canal'&&v.x===b.x+dx&&v.y===b.y+dy)||terrain(b.x+dx,b.y+dy,s)==='water')};});
 const deposits=(s.world?.deposits||[]).filter(d=>RESOURCE_SITES[d.kind]&&terrain(d.x,d.y,s)!=='water').map(d=>({...d}));
 const palms=vegetationFor(s,{edges}).filter(p=>p.kind==='palm'&&shoreDistance(p.x,p.y,s)>.4&&(!isStrictSumer(s)||vegetationBankDistance(p.x,p.y,s)<5.2)&&sceneryClear(s,p,.2)&&roads.every(r=>pointDistance(p,r.a,r.b)>.4));
 for(const d of deposits){
  if(!['forest','dates'].includes(d.kind))continue;
  const court=extractionOwner(s,d);
  if(court&&d.kind==='forest')continue; // Working groves are scaled by their real stock below.
  for(const [i,display]of resourceDisplayLayout(d).entries()){
   const p={id:`resource-${d.kind}-${d.x}-${d.y}-${i}`,x:display.x,y:display.y,resource:d.kind,...court&&d.kind==='dates'?{workingDates:true}:{}};
   if(datePalmGround(s,p)&&(p.workingDates||sceneryClear(s,p,.2)&&roads.every(r=>pointDistance(p,r.a,r.b)>.4)))palms.push(p);
  }
 }
 for(const b of s.buildings||[])if(!b.deposit)for(const p of orchardPalms(b,s))if(vegetationBankDistance(p.x,p.y,s)>.22&&sceneryClear({buildings:s.buildings.filter(other=>other!==b)},p,.08)&&roads.every(r=>pointDistance(p,r.a,r.b)>.22))palms.push(p);
 const c=s.trade?.caravan,caravan=c&&Number.isFinite(c.x)&&Number.isFinite(c.y)?{x:c.x,y:c.y,river:c.transport==='river',stock:{...c.stock},route:c.route||[],routeIndex:c.routeIndex||0}:null;
 return {roads,canals,palms,caravan,deposits};
}
const groundYards=new WeakMap();
// Full four-column/four-row parcel footprint, in map tiles, plus trunk clearance.
const yardTreeClear=(yard,tree)=>Math.hypot(Math.max(Math.abs(tree.x-yard.x)-.26,0),Math.max(yard.y-.05-tree.y,tree.y-yard.y-.38,0))>=.45;
function findGroundYard(s,net){
 if(s.buildings.some(b=>b.starterHut))return null;
 if(s.buildings.some(b=>b.type==='granary'&&b.construction?.kind!=='new'))return null;
 const depot=s.buildings.find(b=>b.type==='shrine'&&b.construction?.kind!=='new')||s.buildings.find(b=>b.type==='house'&&b.construction?.kind!=='new');if(!depot)return null;
 const port=net.ports.find(p=>p.building.x===depot.x&&p.building.y===depot.y);
 // Tree and palm planning is done only on topology changes, never per animation frame.
 const trees=[...landscapePlan(s).palms,...(s.gathering?.features||[]).filter(f=>f.kind==='tree')];
 const anchor=port||{x:depot.x+.5,y:depot.y+.5},candidates=[];
 for(let radius=1;radius<=4;radius+=.5)for(const [dx,dy]of [[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[-1,-1],[1,-1]]){
  const x=depot.x+dx*radius,y=depot.y+dy*radius;
  if(x<.5||y<.5||x>worldWidth(s)-1.5||y>worldHeight(s)-1.5||shoreDistance(x,y,s)<.55)continue;
  if(!sceneryClear(s,{x,y},.45))continue;
  if(net.edges.some(([a,b])=>pointDistance({x,y},a,b)<.6))continue;
  if(trees.some(t=>!yardTreeClear({x,y},t)))continue;
  candidates.push({x,y,d:Math.hypot(x-anchor.x,y-anchor.y)});
 }
 candidates.sort((a,b)=>a.d-b.d);const yard=candidates[0];
 return yard?{x:yard.x,y:yard.y}:null;
}
export function groundStocks(s,net,topologySignature=landscapeSignature(s)){
 let cached=groundYards.get(s);
 if(!cached||cached.net!==net||cached.signature!==topologySignature){cached={net,signature:topologySignature,yard:findGroundYard(s,net)};groundYards.set(s,cached);}
 if(!cached.yard)return null;
 const stock={...s.resources};
 for(const q of s.trade?.sales||[])stock[q.resource]=(stock[q.resource]||0)+q.remaining;
 for(const b of [...s.buildings,...s.roads||[]])for(const [k,n]of Object.entries(b.construction?.remaining||{}))stock[k]=(stock[k]||0)+n;
 return {...cached.yard,stock};
}

export async function createGameLandscape(B,scene,initialState,materials,options={}){
 let currentState=initialState,roadObstacles;
 const registeredMeshes=new WeakSet();
 const meshes=[],ownedMaterials=[],palmSources=[],palmInstances=[],resourceMeshes=[],resourceSources=[],selectionMeshes=[],workFeatureMeshes=[],workFeatureRoots=[],workFeatures=new Map(),roadBatches=new Map(),trailMeshes=[];
 let pavedRoads=[],roadWorldKey='',roadWorldRevision=0,trailSignature='',trailGeometry=new Map(),trailState=null,trailBucket=-1,siltSurface=null;
 let base=null,staticMeshes=[],stockMeshes=[],signature='',terrainSignature='',terrainRoadSignature='',stockSignature='',disposed=false,palmsSignature='',streetNetwork=null,resourceSignature='',selectionSignature='',staticScenerySignature='',natureGeometrySignature='';
 const roadRenderGroups=createRoadRenderGroups(B,scene,meshes);let batchRoads=options.batchRoads!==false;
 const palmRenderGroups=createPalmRenderGroups(B,scene,meshes);let batchPalms=options.batchPalms!==false;
 const updatePalmGroups=()=>palmRenderGroups.sync(palmInstances,palmSources.length,batchPalms);
 const updateRoadGroups=()=>roadRenderGroups.update(batchRoads?[...roadBatches.values()].map(r=>r.road):[]);
 const color=(r,g,b)=>new B.Color3(r,g,b);
 const material=(name,hex)=>{const m=new B.PBRMaterial(name,scene);m.albedoColor=B.Color3.FromHexString(hex).toLinearSpace();m.roughness=1;m.metallic=0;ownedMaterials.push(m);return m;};
 const apronMaterial=material('dusty-mudbrick-paving','#ffffff');
 const catGroundHeights=new Map();
 const catDiscovery=createCatDiscoveryScenery(B,scene,{tileSize:TILE,groundHeight:(x,y,s)=>{const key=`${x},${y}`;if(!catGroundHeights.has(key))catGroundHeights.set(key,catDiscoverySurfaceHeight(B,scene,x,y,(x,y)=>visualSurfaceElevation(x,y,s),TILE));return catGroundHeights.get(key);}});
 const waterView=createGameWater(B,scene,materials);
 const natureDetails=createNatureDetails(B,scene,materials,options);
 const valleyVegetation=await createValleyVegetation(B,scene,options);meshes.push(...valleyVegetation.meshes);
 const meadow=material('volumetric-floodplain-grass','#7b8750'),shore=materials.bankSilt||material('irregular-wet-sand-margin','#ffffff');meadow.backFaceCulling=false;shore.transparencyMode=B.Material.MATERIAL_ALPHABLEND;shore.forceDepthWrite=false;
 if(!materials.bankSilt)shore.albedoTexture=materials.soil?.albedoTexture||null;
 const streetTextures=new Map();
 const trail=material('game-footpath-trodden-soil','#ffffff'),earth=material('game-road-compacted-earth','#ffffff'),gravel=material('game-road-clay-gravel','#ffffff'),paving=material('game-road-bedded-stone','#ffffff');
 const work=material('game-road-work','#b99b6a'),bank=material('game-channel-bank','#a5885e'),wetMud=material('game-wet-channel-mud','#4d584a'),rainMaterial=material('game-rain','#a5c5ce');
 // Dirt, crushed aggregate and bedded paving share the floodplain sediment.
 // Load only finishes seen in this settlement. Both dirt surfaces reuse one pair.
 function streetFinish(mat,kind){
  if(typeof Image!=='undefined'&&!mat.albedoTexture){
   let maps=streetTextures.get(kind);
   if(!maps){
    // The trodden surface is the same local alluvium as the ground. Its fine
    // normal is flattened by footfall; grit remains visible on upgraded roads.
    const load=slot=>new B.Texture(kind==='silt'?`assets/3d/textures/floodplain-alluvium_${slot}.webp?v=fines-1`:`assets/3d/textures/street-${kind}-${slot}.webp`,scene,false,true);
    maps={color:load('color'),normal:load('normal')};maps.normal.gammaSpace=false;maps.normal.level=kind==='silt'?.09:kind==='paving'?.53:.28;streetTextures.set(kind,maps);
   }
   mat.albedoTexture=maps.color;mat.bumpTexture=maps.normal;
  }
  return mat;
 }
 earth.roughness=trail.roughness=.94;
 gravel.albedoColor=color(.87,.77,.66);paving.albedoColor=color(.92,.87,.75);
 const groundMaps=workshopSurfaces(B,scene).textures('earth');
 apronMaterial.albedoTexture=groundMaps.color||null;apronMaterial.bumpTexture=groundMaps.normal||null;
 for(const mat of [bank,wetMud]){
  mat.albedoTexture=groundMaps.color||materials.soil?.albedoTexture||null;
  mat.bumpTexture=groundMaps.normal||materials.soil?.bumpTexture||null;
 }
 bank.albedoColor=B.Color3.FromHexString('#b69e80').toLinearSpace();
 wetMud.albedoColor=B.Color3.FromHexString('#81735e').toLinearSpace();
 for(const mat of [earth,gravel,paving,trail]){mat.transparencyMode=B.Material.MATERIAL_ALPHABLEND;mat.forceDepthWrite=false;}
 rainMaterial.alpha=.55;rainMaterial.emissiveColor=color(.12,.17,.19);
 const add=(m,collection=staticMeshes)=>{m.isPickable=false;if(!m.sourceMesh)m.receiveShadows=true;collection.push(m);meshes.push(m);return m;};
 function registerMeshes(collection,disableOldWater=false){
  for(const mesh of collection){
   if(registeredMeshes.has(mesh)||mesh.isDisposed?.())continue;
   registeredMeshes.add(mesh);
   if(disableOldWater&&['connected-earth-streets','living-river','saved-lakes'].includes(mesh.name))mesh.setEnabled(false);
   meshes.push(mesh);
  }
 }
 const remove=collection=>{for(const m of collection){const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);m.dispose();}collection.length=0;};
 function box(name,x,y,z,width,height,depth,mat,collection=staticMeshes){const m=B.MeshBuilder.CreateBox(name,{width,height,depth},scene);m.position.set(x,y,z);m.material=mat;return add(m,collection);}
 function strip(name,a,b,width,height,mat){const length=Math.hypot(b.x-a.x,b.y-a.y)*TILE;if(!length)return;const m=box(name,(a.x+b.x)*TILE/2,height,(a.y+b.y)*TILE/2,width,.035,length,mat);m.rotation.y=Math.atan2(b.x-a.x,b.y-a.y);m.freezeWorldMatrix();return m;}
 function rebuildBase(s){
  // Imported palms/scenery have their own road-aware plans. An anchor-only
  // change needs a new grass mask, not a new valley, lake and horizon mesh.
  // Keep full rebuilds for the legacy scenery fallback, which owns its palms.
  const roads=JSON.stringify(s.roadAnchors),next=JSON.stringify([worldWidth(s),worldHeight(s),s.world?.seed,s.world?.river,s.world?.lakes,s.buildings.map(b=>[b.type,b.x,b.y,b.footprint||1,...(b.type==='clay'||b.type==='quarry'?[b.construction?.kind==='new',b.deposit?.x,b.deposit?.y]:[])]),depositGeometry(s),palmSources.length?null:s.roadAnchors]);
  if(next===terrainSignature){
   if(roads===terrainRoadSignature)return;
   const mask=base.refreshRoadMask(s);
   if(mask){terrainRoadSignature=roads;for(let i=3;i<mask.colors.length;i+=4)mask.colors[i]*=.43;mask.mesh.setVerticesData(B.VertexBuffer.ColorKind,mask.colors,true);const original=originalTerrain.get(mask.mesh);if(original)original.colors=mask.colors;registerMeshes([mask.mesh]);return;}
   // A completely masked initial cover has no mesh; rebuild to restore it.
  }
  terrainSignature=next;terrainRoadSignature=roads;catGroundHeights.clear();
  if(base){for(const m of base.meshes){const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);}base.dispose();}
  base=createDistrictTerrain(B,scene,s,materials,{renderRoads:false,curvedLakeBeds:true});
  for(const m of base.meshes){if(['connected-earth-streets','living-river','saved-lakes','valley-scrub','river-reed-beds'].includes(m.name)||palmSources.length&&['date-palm-trunks','date-palm-crowns'].includes(m.name))m.setEnabled(false);if(m.name==='soft-riparian-grass'){const c=m.getVerticesData(B.VertexBuffer.ColorKind);for(let i=3;i<c.length;i+=4)c[i]*=.43;m.setVerticesData(B.VertexBuffer.ColorKind,c,true);}registerMeshes([m]);}
 }
 // Use the supplied CC BY 4.0 date palm; retain the existing licensed palm as a
 // graceful fallback if the new optional asset is unavailable.
 const palmContainers=[];
 palmSources.push(...await loadValleyPlantSources(B,scene,VALLEY_PLANT_ASSETS.palm,meshes,palmContainers,'palm'));
 if(!palmSources.length)palmSources.push(...await loadValleyPlantSources(B,scene,['date-palm.glb'],meshes,palmContainers,'palm'));
 if(palmSources.length){const dateMaterial=createBotanicalMaterial(B,scene);ownedMaterials.push(dateMaterial);const dateSource=createDateClusters(B,scene,{height:5.15,radius:.5},dateMaterial);dateSource.setEnabled(false);dateSource.metadata={nativeDates:true};meshes.push(dateSource);palmSources.push(dateSource);}
 for(const m of palmSources)m.name=`game-date-palm-source-${m.material?.name||m.name}`;
 const siteMaterials=Object.fromEntries(Object.entries(RESOURCE_SITES).map(([kind,spec])=>[kind,material(`resource-${kind}`,spec.color)]));
 const resourceModels=new Map();
 const source=(name,create,mat)=>{const m=create();m.name=name;m.material=mat;m.isPickable=false;m.receiveShadows=true;m.setEnabled(false);resourceSources.push(m);meshes.push(m);return m;};
 const stoneSource=source('resource-stone-source',()=>B.MeshBuilder.CreateIcoSphere('site-stone',{radius:1,subdivisions:1},scene),materials.stone);
 const reedSource=source('resource-reed-source',()=>B.MeshBuilder.CreateCylinder('site-reed',{height:1,diameterTop:.035,diameterBottom:.07,tessellation:5},scene),siteMaterials.reed);
 const hoofSource=source('resource-track-source',()=>B.MeshBuilder.CreateSphere('site-track',{diameter:1,segments:6},scene),materials.wood);
 for(const [kind,spec]of Object.entries(RESOURCE_SITES)){
  const patchMaterial=siteMaterials[kind].clone(`resource-selection-patch-${kind}`);patchMaterial.albedoColor=patchMaterial.albedoColor.toLinearSpace();patchMaterial.alpha=.14;patchMaterial.transparencyMode=B.Material.MATERIAL_ALPHABLEND;patchMaterial.forceDepthWrite=false;ownedMaterials.push(patchMaterial);
  const patch=source(`resource-patch-source-${kind}`,()=>B.MeshBuilder.CreateBox('site-patch',{width:5.25,height:.035,depth:5.25},scene),patchMaterial);resourceModels.set(kind,patch);

 }
 function instanceResource(src,name,x,y,z,scale,spec){const m=src.createInstance(name);m.setEnabled(true);m.position.set(x,y,z);m.scaling.set(...scale);m.metadata={resourceSite:{kind:spec.kind,x:spec.x,y:spec.y,label:RESOURCE_SITES[spec.kind].label}};add(m,resourceMeshes);m.freezeWorldMatrix();return m;}
 const activePlots=[];
 function plotPart(plot,src,name,p,scale,height=0,crown=0){
  const y=surfaceElevation(p.x,p.y,plot.state),mesh=instanceResource(src,name,p.x*TILE,y+height,p.y*TILE,scale,plot.site);
  plot.parts.push({mesh,scale,height,y,crown});return mesh;
 }
 function updatePlotStock(s){
  for(const plot of activePlots){
   const fraction=extractionStockFraction(s,plot.site);
   if(fraction===plot.fraction)continue;
   plot.fraction=fraction;
   const size=Math.cbrt(fraction);
   for(const {mesh,scale,height,y,crown} of plot.parts){
    mesh.setEnabled(fraction>1e-8);
    if(fraction<=1e-8)continue;
    mesh.unfreezeWorldMatrix();mesh.scaling.set(...scale.map(value=>value*size));mesh.position.y=y+height*size+crown*(1-size);mesh.freezeWorldMatrix();
   }
  }
 }
 function updateResourceSites(s){
  const next=JSON.stringify([worldWidth(s),worldHeight(s),s.world?.river,depositGeometry(s),s.world?.lakes,s.buildings.map(b=>[b.type,b.x,b.y,b.footprint||1,b.deposit?.x,b.deposit?.y])]);if(next===resourceSignature){updatePlotStock(s);return;}resourceSignature=next;selectionSignature='';remove(resourceMeshes);activePlots.length=0;
  for(const d of s.world?.deposits||[]){if(!RESOURCE_SITES[d.kind]||terrain(d.x,d.y,s)==='water')continue;const X=d.x*TILE,Z=d.y*TILE,Y=surfaceElevation(d.x,d.y,s),court=extractionOwner(s,d),occupied=!court&&!sceneryClear(s,d,.12);
   const patch=instanceResource(resourceModels.get(d.kind),`resource-site-${d.kind}-${d.x}-${d.y}`,X,Y+.045,Z,[1,1,1],d);patch.setEnabled(false);

   if(occupied)continue;
   const plot=court&&!['clay','stone'].includes(d.kind)&&{state:s,site:d,parts:[],fraction:null};
   if(plot)activePlots.push(plot);
   if(plot&&d.kind==='forest')for(const p of resourceDisplayLayout(d))for(const src of palmSources){
    if(src.metadata?.nativeDates)continue;
    const mesh=plotPart(plot,src,`deposit-open-forest-${d.x}-${d.y}`,p,[.72,.72,.72]);
    mesh.unfreezeWorldMatrix();mesh.rotation.y=p.angle;mesh.freezeWorldMatrix();
   }
   if(plot&&d.kind==='dates')for(const p of resourceDisplayLayout(d).filter(p=>datePalmGround(s,p)))for(const src of palmSources.filter(m=>m.metadata?.nativeDates)){
    const scale=.72,mesh=plotPart(plot,src,`deposit-open-dates-${d.x}-${d.y}`,p,[scale,scale,scale],0,5.15*scale);
    mesh.unfreezeWorldMatrix();mesh.rotation.y=(p.x+p.y)*2.399;mesh.freezeWorldMatrix();
   }
   if(plot&&d.kind==='reed')for(const [i,p]of resourceDisplayLayout(d).entries()){
    const sources=valleyVegetation.sources.reed,variant=i%2===0&&sources.some(m=>m.metadata.valleyVariant===3)?3:i%3,selected=sources.filter(m=>m.metadata?.valleyVariant===variant);
    for(const src of selected.length?selected:[reedSource]){
     const h=1.25+p.size*.38,mesh=plotPart(plot,src,`deposit-open-reed-${d.x}-${d.y}`,p,src===reedSource?[1,h,1]:[p.size,p.size,p.size],src===reedSource?h/2:0);
     mesh.unfreezeWorldMatrix();mesh.rotation.y=p.angle;mesh.freezeWorldMatrix();
    }
   }
   if(!plot&&d.kind==='reed'&&!valleyVegetation.sources.reed.length)for(const p of resourceDisplayLayout(d)){
    if(!court&&!sceneryClear(s,p,.05))continue;const ground=surfaceElevation(p.x,p.y,s);
    const h=1.25+p.size*.38,m=instanceResource(reedSource,'deposit-reed-bed',p.x*TILE,ground+h/2,p.y*TILE,[1,h,1],d);m.unfreezeWorldMatrix();m.rotation.z=Math.sin(p.angle)*.09;m.freezeWorldMatrix();
   }
   if(d.kind==='wildlife')for(let i=0;i<6;i++)instanceResource(hoofSource,'deposit-wildlife-track',X+(i%2)*.33-.16,Y+.07,Z+(i/2-1.5)*.6,[.13,.055,.23],d);
  }
  updatePlotStock(s);
 }
 const selectionMaterial=material('resource-placement-highlight','#d9ee8b');selectionMaterial.emissiveColor=color(.25,.32,.08);selectionMaterial.alpha=.8;
 const selectionSource=source('resource-highlight-source',()=>{const m=new B.Mesh('site-placement-rectangle',scene),d=new B.VertexData(),g=rectangularSiteGeometry();d.positions=g.positions;d.indices=g.indices;d.normals=[];B.VertexData.ComputeNormals(d.positions,d.indices,d.normals);d.applyToMesh(m);return m;},selectionMaterial);selectionMaterial.backFaceCulling=false;
 function updateSelection(s,selection){const type=typeof selection==='string'?selection:null,key=`${type}|${resourceSignature}`;if(key===selectionSignature)return;selectionSignature=key;remove(selectionMeshes);
  for(const m of resourceMeshes)if(m.name.startsWith('resource-site-'))m.setEnabled(!!extractionKinds[type]&&m.metadata.resourceSite.kind===extractionKinds[type]);
  for(const p of resourcePlacementSites(s,type)){const m=selectionSource.createInstance(`resource-placement-${type}-${p.x}-${p.y}`);m.setEnabled(true);m.position.set(p.x*TILE,surfaceElevation(p.x,p.y,s)+.16,p.y*TILE);m.metadata={resourcePlacement:{type,x:p.x,y:p.y}};add(m,selectionMeshes);m.freezeWorldMatrix();}
 }
 function meshData(name,g,mat,collection=staticMeshes){if(!g.indices.length)return null;const m=new B.Mesh(name,scene),d=new B.VertexData();d.positions=g.positions;d.indices=g.indices;d.colors=g.colors;d.uvs=g.uvs||g.positions.filter((_,i)=>i%3!==1).map(v=>v/3);d.normals=[];B.VertexData.ComputeNormals(d.positions,d.indices,d.normals);
  if(d.normals.find((v,i)=>i%3===1&&Math.abs(v)>.01)<0){for(let i=0;i<d.indices.length;i+=3)[d.indices[i+1],d.indices[i+2]]=[d.indices[i+2],d.indices[i+1]];B.VertexData.ComputeNormals(d.positions,d.indices,d.normals);}d.applyToMesh(m);m.material=mat;m.useVertexColors=true;add(m,collection);return m;
 }
 function road(name,s,a,b,width,height,mat,level,collection,control,progress=1){const g=wornRoadGeometry(s,a,b,width,height,level,2,control,roadObstacles,progress),m=meshData(name,g,mat,collection);if(!m)return;m.position.set(g.origin.x,0,g.origin.z);m.hasVertexAlpha=true;m.metadata={road:{a:{...a},b:{...b},level}};m.freezeWorldMatrix();return m;}
 const originalTerrain=new WeakMap(),terrainCuts=new WeakMap();
 function carveChannels(s,arms){
  const cutKey=JSON.stringify(arms.map(a=>[a.a.x,a.a.y,a.b.x,a.b.y,a.startHeight,a.endHeight]));let groundChanged=false;
  // This main-game copy alone cuts shallow depressions; the legacy terrain module
  // and the saved map/canal coordinates are never changed.
  for(const m of base.meshes){if(!['alluvial-valley','soft-riparian-grass'].includes(m.name))continue;let original=originalTerrain.get(m);if(!original){original={positions:m.getVerticesData(B.VertexBuffer.PositionKind).slice(),normals:m.getVerticesData(B.VertexBuffer.NormalKind).slice(),colors:m.getVerticesData(B.VertexBuffer.ColorKind)?.slice()};originalTerrain.set(m,original);}
   // Base identity covers world/building footprints. A road-mask replacement
   // changes the original colour array, but never the alluvial ground cut.
   const previous=terrainCuts.get(m);if(previous?.key===cutKey&&previous.colors===original.colors)continue;
   if(previous?.key===cutKey&&previous.alphaClips&&original.colors){
    const colors=applyTerrainAlphaClips(original.colors.slice(),previous.alphaClips),indices=m.getIndices(),sameIndices=previous.indices.length===indices.length&&previous.indices.every((v,i)=>v===indices[i]);
    m.setVerticesData(B.VertexBuffer.ColorKind,colors,true);
    // Road masks can add/remove triangles without moving their vertices. Those
    // triangles still affect the deformed normals around a lake/canal edge.
    if(!sameIndices)m.setVerticesData(B.VertexBuffer.NormalKind,deformedTerrainNormals(B,original,previous.positions,indices),true);
    terrainCuts.set(m,{...previous,colors:original.colors,indices});continue;
   }
   const positions=original.positions.slice(),colors=original.colors?.slice(),contours=lakeContours(s),alphaClips=colors&&m.name==='soft-riparian-grass'?{zero:[],indices:[],factors:[]}:null;
   for(let i=0;i<positions.length;i+=3){const X=positions[i],Z=positions[i+2],p={x:X/TILE,y:Z/TILE};if(colors&&m.name==='soft-riparian-grass'&&!sceneryClear(s,p,.12)){colors[i/3*4+3]=0;alphaClips.zero.push(i/3*4+3);}const lakeD=lakeDistance(p.x,p.y,s,contours);if(lakeD<.6){positions[i+1]=visualSurfaceElevation(p.x,p.y,s,contours)+(m.name==='soft-riparian-grass'?.025:0);if(colors&&m.name==='soft-riparian-grass'){const factor=clamp((lakeD-.09)/.26);colors[i/3*4+3]*=factor;alphaClips.indices.push(i/3*4+3);alphaClips.factors.push(factor);}else if(colors){const wet=1-clamp((lakeD+.02)/.4),fleck=Math.sin(X*3+Z)*.015,blend=clamp((.6-lakeD)/.2),offset=i/3*4;for(const [k,tone]of [.88-wet*.24+fleck,.80-wet*.21+fleck,.62-wet*.19+fleck].entries())colors[offset+k]=colors[offset+k]*(1-blend)+tone*blend;}}for(const arm of arms){const dx=arm.b.x-arm.a.x,dy=arm.b.y-arm.a.y,t=clamp(((p.x-arm.a.x)*dx+(p.y-arm.a.y)*dy)/(dx*dx+dy*dy||1)),dist=Math.hypot(p.x-arm.a.x-dx*t,p.y-arm.a.y-dy*t)*TILE,width=1.85;
     if(dist>width)continue;const h=arm.startHeight+(arm.endHeight-arm.startHeight)*t,cut=h-.2,inner=.85,weight=1-clamp((dist-inner)/(width-inner));positions[i+1]=Math.min(positions[i+1],original.positions[i+1]*(1-weight)+cut*weight);if(colors&&m.name==='soft-riparian-grass'){const factor=1-Math.min(1,weight*2);colors[i/3*4+3]*=factor;alphaClips.indices.push(i/3*4+3);alphaClips.factors.push(factor);}
    }}
   m.setVerticesData(B.VertexBuffer.PositionKind,positions,true);if(colors)m.setVerticesData(B.VertexBuffer.ColorKind,colors,true);m.setVerticesData(B.VertexBuffer.NormalKind,deformedTerrainNormals(B,original,positions,m.getIndices()),true);m.refreshBoundingInfo();
   terrainCuts.set(m,{key:cutKey,colors:original.colors,positions,indices:m.getIndices(),alphaClips:alphaClips&&{zero:new Uint32Array(alphaClips.zero),indices:new Uint32Array(alphaClips.indices),factors:new Float64Array(alphaClips.factors)}});if(m.name==='alluvial-valley')groundChanged=true;
  }
  if(groundChanged)stitchTerrainRim(B,base.meshes,s);
 }
 function updatePavedSurfaces(s,surfaces){
  const seen=new Set();let changed=false;
  for(const r of pavedRoads){
   const profile=surfaces.get(r.id);if(!profile)continue;
   seen.add(r.id);
   const key=[roadWorldRevision,r.a.x,r.a.y,r.b.x,r.b.y,r.level,r.target,r.progress,profile.start,profile.width,profile.end,profile.startTip,profile.endTip,profile.shapeKey].join('|');
   const previous=roadBatches.get(r.id);
   if(previous?.key===key)continue;
   changed=true;if(previous)remove(previous.meshes);
   const batch=[],record={key,meshes:batch,road:{id:r.id,a:r.a,b:r.b,working:!!r.target}};
   roadBatches.set(r.id,record);
   const control=profile.control,mat=r.level>=3?streetFinish(paving,'paving'):r.level===2?streetFinish(gravel,'aggregate'):streetFinish(earth,'silt');
   record.road.mesh=road(`road-${r.id}-level-${r.level}`,s,r.a,r.b,profile,.038,mat,r.level,batch,control);
   if(r.target){
    const inset={...profile,start:profile.start*.74,width:profile.width*.74,end:profile.end*.74};
    road(`road-upgrade-${r.id}`,s,r.a,r.b,inset,.063,r.target===3?streetFinish(paving,'paving'):streetFinish(gravel,'aggregate'),r.target,batch,control,r.progress);
    for(const t of [.1,.9]){const p=footpathRibbonPoint(r.a,r.b,control,t);box('road-work-materials',p.x*TILE,.21,p.y*TILE+.9,.45,.35,.5,work,batch);}
   }
  }
  for(const [id,batch] of roadBatches)if(!seen.has(id)){remove(batch.meshes);roadBatches.delete(id);changed=true;}
  if(changed){catGroundHeights.clear();updateRoadGroups();}
 }
 function updateTrails(s){
  const bucket=Math.floor((s.simTime||0)/2);
  if(trailState===s&&trailBucket===bucket)return;
  if(trailState!==s)trailSignature='';
  trailState=s;trailBucket=bucket;
  const surfaces=streetSurfaceLayout(s,pavedRoads);updatePavedSurfaces(s,surfaces);
  const paths=[...surfaces.values()].filter(r=>!r.built);
  const keys=paths.map(r=>`${r.id}:${r.start}/${r.width}/${r.end}/${+!!r.startTip}${+!!r.endTip}/${r.shapeKey}`),key=keys.join(';');
  if(key===trailSignature&&(paths.length||!trailMeshes.length)&&paths.every((r,i)=>trailGeometry.get(keys[i])?.control===r.control))return;
  trailSignature=key;remove(trailMeshes);
  const geometry={positions:[],indices:[],colors:[],uvs:[]},previous=trailGeometry;
  trailGeometry=new Map();
  for(const [i,r] of paths.entries()){
   const prior=previous.get(keys[i]);
   const g=prior&&prior.control===r.control?prior.geometry:wornRoadGeometry(s,r.a,r.b,r,.029,1,.85,r.control,roadObstacles);
   trailGeometry.set(keys[i],{control:r.control,geometry:g});
   const first=geometry.positions.length/3;
   for(let i=0;i<g.positions.length;i+=3)geometry.positions.push(g.positions[i]+g.origin.x,g.positions[i+1],g.positions[i+2]+g.origin.z);
   for(const value of g.colors)geometry.colors.push(value);
   for(const i of g.indices)geometry.indices.push(first+i);
   for(const uv of g.uvs)geometry.uvs.push(uv);
  }
  const mesh=geometry.indices.length&&meshData('resident-footpaths',geometry,streetFinish(trail,'silt'),trailMeshes);
  if(mesh){mesh.hasVertexAlpha=true;mesh.freezeWorldMatrix();}
 }
 function rebuildGeometry(s,plan){catGroundHeights.clear();
  roadObstacles=obstacleIndex(s.buildings||[]);trailGeometry.clear();
  pavedRoads=plan.roads.filter(r=>(r.built||r.target)&&shoreDistance((r.a.x+r.b.x)/2,(r.a.y+r.b.y)/2,s)>=.08);trailState=null;trailSignature='';stockSignature='';remove(trailMeshes);
  const worldKey=JSON.stringify([worldWidth(s),worldHeight(s),s.world?.seed,s.world?.river,s.world?.lakes,s.buildings.map(b=>[b.type,b.x,b.y,b.footprint||1,b.type==='cityGate'?b.rotation||0:0,b.type==='cityGate'||b.type==='bridge'?b.construction?.kind:null])]);
  if(roadWorldKey!==worldKey){roadWorldKey=worldKey;roadWorldRevision++;}
  // Natural placement follows occupied footprints and path endpoints, not work
  // counters, paving level or resource quantities. Weather still advances below.
  natureGeometrySignature=JSON.stringify([worldKey,s.buildings.map(b=>[b.type,b.footprint||1]),depositGeometry(s),plan.roads.map(r=>[r.a,r.b])]);
  const channels=canalNetworkGeometry(s,plan.canals),arms=channels.arms;
  // Road work changes paving only. Static scenery uses footprints/endpoints,
  // while canal progress remains part of its exact geometry dependency key.
  const nextScenery=JSON.stringify([isStrictSumer(s),worldWidth(s),worldHeight(s),s.world?.river,s.world?.lakes,s.buildings.map(b=>[b.type,b.x,b.y,b.footprint||1,hasCivicApron(b)?[b.rotation||0,b.construction?.kind==='new',b.level||1]:0]),plan.canals,plan.roads.map(r=>[r.a,r.b])]);
  if(nextScenery!==staticScenerySignature){remove(staticMeshes);
  const bricks=civicEntranceBricks(s);
  if(bricks.length){const mesh=meshData('civic-entrance-bricks',civicBrickGeometry(bricks,s),apronMaterial);mesh.freezeWorldMatrix();}
  for(const [name,g,mat]of [['actual-canal-bank',channels.wetBed,wetMud],['actual-dry-canal-bank',channels.dryBed,bank],['actual-canal-water',channels.water,waterView.material]]){const m=meshData(name,g,mat);if(m){m.metadata={canalArms:arms,canalArm:arms[0]};m.receiveShadows=name!=='actual-canal-water';m.freezeWorldMatrix();}}
  for(const c of plan.canals)for(const [dx,dy]of c.arms.length?c.arms:[[1,0],[-1,0]]){const mid={x:c.x+dx*.5,y:c.y+dy*.5};if(plan.roads.some(r=>pointDistance(mid,r.a,r.b)<.09))for(const offset of [-.22,0,.22]){const center={x:mid.x+dx*offset/TILE,y:mid.y+dy*offset/TILE};strip('canal-road-crossing',{x:center.x-dy*.13,y:center.y+dx*.13},{x:center.x+dy*.13,y:center.y-dx*.13},.19,.18,materials.wood);}}
  const tufts=landscapeFallbackTufts(s,plan.roads,valleyVegetation.sources),grass=meshData('volumetric-riparian-colonies',tuftGeometry(s,tufts),meadow);if(grass){grass.metadata={natureTufts:tufts};grass.freezeWorldMatrix();}
  const margin=meshData('irregular-physical-riverbanks',openCanalMouths(riverbankGeometry(s),arms),shore);if(margin){margin.hasVertexAlpha=true;margin.freezeWorldMatrix();}
  siltSurface=meshData('laminated-flood-silt-bars',openCanalMouths(siltLensesGeometry(s,plan.roads),arms),shore);if(siltSurface){siltSurface.hasVertexAlpha=true;siltSurface.freezeWorldMatrix();}
  const lakeMargin=meshData('organic-lake-soft-banks',openCanalMouths(lakebankGeometry(s),arms),shore);if(lakeMargin){lakeMargin.hasVertexAlpha=true;lakeMargin.freezeWorldMatrix();}
   staticScenerySignature=nextScenery;
  }
  carveChannels(s,arms);
  const visiblePalms=plan.palms.filter(p=>p.managed||!(s.gathering?.features||[]).some(f=>f.kind==='tree'&&Math.hypot(f.x-p.x,f.y-p.y)<.85));
  const nextPalms=JSON.stringify(visiblePalms.map(p=>[p.id,p.x,p.y,p.growth,p.workingDates]));
  if(nextPalms!==palmsSignature){palmsSignature=nextPalms;remove(palmInstances);for(const p of visiblePalms){const scale=p.managed?.62*p.growth:p.resource?.72:.88+(p.id%7)*.035;for(const src of palmSources){if(p.workingDates&&src.metadata?.nativeDates)continue;const m=src.createInstance(`date-palm-${p.id}-${src.name}`);m.setEnabled(true);m.position.set(p.x*TILE,surfaceElevation(p.x,p.y,s),p.y*TILE);m.scaling.setAll(scale);m.rotation.y=p.resource?(p.x+p.y)*2.399:p.id*2.399;if(!src.metadata?.nativeDates)m.overrideMaterialSideOrientation=B.Material.CounterClockWiseSideOrientation;m.computeWorldMatrix(true);m.freezeWorldMatrix();add(m,palmInstances);}}updatePalmGroups();}
 }

 let featureSignature='',featureGeometry='';
 const cutWood=material('actual-felled-tree-heartwood','#ac8052');
 function updateWorkFeatures(s,time){
  const features=s.gathering?.features||[],next=JSON.stringify(features.map(f=>[f.id,f.kind,f.x,f.y]));
  if(next!==featureSignature||featureGeometry!==natureGeometrySignature){featureSignature=next;featureGeometry=natureGeometrySignature;remove(workFeatureMeshes);for(const r of workFeatureRoots)r.dispose();workFeatureRoots.length=0;workFeatures.clear();
   for(const f of features){if(!sceneryClear(s,f,.2)||vegetationBankDistance(f.x,f.y,s)<.2||landscapePlanRoads.some(r=>pointDistance(f,r.a,r.b)<.4))continue;const Y=surfaceElevation(f.x,f.y,s),root=new B.TransformNode(`gathering-feature-${f.id}`,scene);root.position.set(f.x*TILE,Y,f.y*TILE);workFeatureRoots.push(root);const parts=[];
    if(f.kind==='tree'){
     for(const src of palmSources){const m=src.createInstance(`working-tree-${f.id}-${src.name}`);m.setEnabled(true);m.parent=root;m.scaling.setAll(.72);if(!src.metadata?.nativeDates)m.overrideMaterialSideOrientation=B.Material.CounterClockWiseSideOrientation;parts.push(add(m,workFeatureMeshes));}
     const stump=B.MeshBuilder.CreateCylinder(`felled-tree-stump-${f.id}`,{height:.32,diameterTop:.26,diameterBottom:.34,tessellation:8},scene);stump.position.set(f.x*TILE,Y+.16,f.y*TILE);stump.material=cutWood;add(stump,workFeatureMeshes);stump.setEnabled(false);
     const scar=box(`axe-cut-${f.id}`,f.x*TILE-.17,Y+.43,f.y*TILE,.05,.12,.21,cutWood,workFeatureMeshes);scar.setEnabled(false);
     workFeatures.set(f.id,{root,parts,stump,scar});
    }else{const m=stoneSource.createInstance(`working-rock-${f.id}`);m.setEnabled(true);m.parent=root;m.scaling.set(.75,.58,.7);parts.push(add(m,workFeatureMeshes));workFeatures.set(f.id,{root,parts});}
   }
  }
  for(const f of features){const record=workFeatures.get(f.id);if(!record)continue;const {root,parts,stump,scar}=record;
   if(f.kind==='tree'){const felled=f.health<=0,age=felled?Math.max(0,time-(f.felledAt??time)):0,t=clamp(age/.8),ease=t*t*(3-2*t);root.rotation.z=felled?-ease*1.48:0;root.position.y=surfaceElevation(f.x,f.y,s)+(felled?ease*.15:0);stump.setEnabled(felled);scar.setEnabled(!felled&&f.health<1);if(scar)scar.scaling.y=.6+(1-f.health)*2;
    for(const m of parts)m.setEnabled(!felled||age<10);
   }else{const health=Math.max(.15,f.health);for(const m of parts)m.scaling.set(.45+.30*health,.23+.35*health,.43+.27*health);}
  }
 }
 const goods=createGoodsSources(B,scene,materials);meshes.push(...goods.meshes);
 function updateStocks(s){
  const stocks=groundStocks(s,streetNetwork,signature),next=JSON.stringify(stocks);
  if(next===stockSignature)return;
  stockSignature=next;remove(stockMeshes);
  if(!stocks)return;
  for(const p of cargoLayout(stocks.stock)){
   const x=stocks.x*TILE+p.x,z=stocks.y*TILE+p.z,y=surfaceElevation(x/TILE,z/TILE,s)+p.y;
   const m=goods.sources.get(p.kind).createInstance(`cargo-${p.kind}`);
   m.setEnabled(true);m.position.set(x,y,z);m.metadata={goods:{...p,supportY:y}};add(m,stockMeshes);
  }
 }
 const caravanView=options.deferOptional?createLazyFeature(()=>createTradeCaravan(B,scene,meshes,materials,goods,{...options,initialState:currentState}),{required:(_s,c)=>!!c,onError:error=>console.warn('Caravan detail unavailable',error)}):await createTradeCaravan(B,scene,meshes,materials,goods,{...options,initialState:currentState});
 const riverCraftView=createTradeRiverCraft(B,scene,meshes,materials,goods,options);
 let ferryView;
 function updateTrader(c,time){
  caravanView.update(currentState,c?.river?null:c,time);
  riverCraftView.update(currentState,c?.river?{...c,transport:'river'}:null,time);
  const ferry=localFerryVessel(currentState);
  if(ferry)ferryView??=createTradeRiverCraft(B,scene,meshes,materials,goods,options);
  ferryView?.update(currentState,ferry,time);
 }
 const drops=[];for(let i=0;i<90;i++){const m=box('weather-rain',0,0,0,.018,.8,.018,rainMaterial, drops);m.receiveShadows=false;m.setEnabled(false);}
 function updatePalmWind(time,wind){palmRenderGroups.updateWind(time,wind);
  for(let i=0;i<palmInstances.length;i++){const m=palmInstances[i];if(!m.isEnabled()||!wind&&m.rotation.z===0)continue;m.unfreezeWorldMatrix();m.rotation.z=wind?Math.sin(time*1.7+Math.floor(i/palmSources.length))*.008:0;m.computeWorldMatrix(true);if(!wind)m.freezeWorldMatrix();}
 }
 let weatherSignature='',landscapePlanRoads=[];
 function updateWeather(s,time){const weather=weatherAt(s),rain=weather.type==='rain',wind=weather.type==='wind',key=`${s.season}|${!!s.drought}|${rain}`;
  if(key!==weatherSignature){weatherSignature=key;const dry=s.drought>0,summer=s.season===1;const soil=materials.soil,grass=materials.grass;
   if(materials.bankSilt){materials.bankSilt.albedoColor=rain?color(.66,.68,.63):dry?color(1,.92,.78):color(.85,.83,.73);materials.bankSilt.roughness=rain?.72:.92;}
   for(const kind of ['greenGrass','reed'])for(const src of valleyVegetation.sources[kind]){
    if(src.metadata.valleyVariant>=3)src.material.albedoColor=dry?color(1,.85,.61):summer?color(1,.94,.78):color(.95,1,.95);
   }
   soil.albedoColor=color(rain?.82:.94,rain?.76:.86,rain?.62:.71);grass.albedoColor=dry?color(.83,.72,.42):summer?color(.8,.79,.5):color(.71,.87,.52);
   earth.albedoColor=trail.albedoColor=rain?color(.95,.83,.67):color(1.09,.98,.79);
   for(const m of base?.meshes||[])if(m.name==='soft-riparian-grass'&&m.material)m.material.albedoColor=grass.albedoColor.clone();
   meadow.albedoColor=dry?color(.57,.43,.21):summer?color(.48,.47,.25):rain?color(.32,.43,.19):color(.40,.48,.24);
  }
  // At town overview scale the relief is subpixel; the physical banks and
  // world-mapped silt textures continue to show the wet/dry transition.
  if(siltSurface){const visible=(scene.activeCamera?.radius??0)<120;if(siltSurface.isEnabled()!==visible)siltSurface.setEnabled(visible);}
  natureDetails.update(s,time,weather,landscapePlanRoads,natureGeometrySignature);
  if(valleyVegetation.update(s,landscapePlanRoads,natureGeometrySignature)){const registered=new Set(meshes);for(const m of valleyVegetation.meshes)if(!registered.has(m))meshes.push(m);}
  registerMeshes(natureDetails.meshes);
  for(let i=0;i<drops.length;i++){const m=drops[i];m.setEnabled(rain);if(rain){const h=((i*.618+time*1.6)%1)*20;m.position.set(((i*53.71+time*3)% (worldWidth(s)*TILE)),20-h,((i*37.29)% (worldHeight(s)*TILE)));m.rotation.z=.16;}}
  // Wind moves only shared source foliage instances, with no allocation or save edits.
  updatePalmWind(time,wind);
 }
 const floodMeshes=[];
 let previousFlood=null,floodMaterial=null;
 function updateFlood(s){
  const view=floodMapView(s);
  if(view===previousFlood)return;
  previousFlood=view;
  remove(floodMeshes);
  if(!view?.tiles.length)return;
  floodMaterial??=material('floodplain-water-tint','#78857a');
  floodMaterial.backFaceCulling=false;
  floodMaterial.transparencyMode=B.Material.MATERIAL_ALPHABLEND;
  floodMaterial.alpha=view.phase==='active'?.6:.27;
  const positions=[],indices=[],normals=[];
  for(const {x,y} of view.tiles){
   const first=positions.length/3;
   for(const [dx,dy] of [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]]){
    const px=x+dx,py=y+dy;
    positions.push(px*TILE,visualSurfaceElevation(px,py,s)+.09,py*TILE);
    normals.push(0,1,0);
   }
   indices.push(first,first+2,first+1,first,first+3,first+2);
  }
  const mesh=new B.Mesh('temporary-river-flood',scene),data=new B.VertexData();
  Object.assign(data,{positions,indices,normals});data.applyToMesh(mesh);
  mesh.material=floodMaterial;add(mesh,floodMeshes);mesh.freezeWorldMatrix();
 }
 function update(s,time=0,selection=null){if(disposed)return;currentState=s;rebuildBase(s);const next=landscapeSignature(s);if(next!==signature){signature=next;streetNetwork=cachedStreetsFor(s)||generateStreets([...(s.buildings||[]),...(s.roadAnchors||[])],s);const plan=landscapePlan(s,streetNetwork);landscapePlanRoads=plan.roads;rebuildGeometry(s,plan);weatherSignature='';}base.light(night);base.update(s,time);registerMeshes(base.meshes,true);
  catDiscovery.update(s);registerMeshes(catDiscovery.meshes);
  waterView.update(s,time);waterView.light(night);registerMeshes(waterView.meshes);
  updateFlood(s);
  updateTrails(s);
  updateWorkFeatures(s,time);updateResourceSites(s);updateSelection(s,selection);updateStocks(s);const c=s.trade?.caravan;updateTrader(c&&Number.isFinite(c.x)&&Number.isFinite(c.y)?{...c,river:c.transport==='river',route:c.route||[],routeIndex:c.routeIndex||0}:null,time);updateWeather(s,time);
  // Owners can replace batches during updateWeather; expose only live meshes.
  for(let i=meshes.length-1;i>=0;i--)if(meshes[i].isDisposed?.())meshes.splice(i,1);
 }
 let night=0;update(initialState,initialState.simTime||0);
 return {mineralHeightAt:(x,y,ground)=>base?.mineralHeightAt(x,y,ground)??ground,get waterMaterial(){return waterView.material;},meshes,update,setPalmBatching(enabled){batchPalms=enabled!==false;updatePalmGroups();updatePalmWind(currentState.simTime||0,weatherAt(currentState).type==='wind');},setRoadBatching(enabled){batchRoads=enabled!==false;updateRoadGroups();catGroundHeights.clear();},setQuality(tier){natureDetails.setQuality(tier);valleyVegetation.setQuality(tier);},light(n){night=n;base?.light(n);waterView.light(n);},dispose(){if(disposed)return;disposed=true;roadRenderGroups.dispose();palmRenderGroups.dispose();catDiscovery.dispose();caravanView.dispose();riverCraftView.dispose();ferryView?.dispose();base?.dispose();waterView.dispose();natureDetails.dispose();valleyVegetation.dispose();for(const m of [...meshes])if(!m.isDisposed?.())m.dispose();meshes.length=0;roadBatches.clear();for(const r of workFeatureRoots)r.dispose();for(const c of palmContainers)c.dispose();for(const m of ownedMaterials)m.dispose(false,false);for(const maps of streetTextures.values()){maps.color.dispose();maps.normal.dispose();}}};
}
