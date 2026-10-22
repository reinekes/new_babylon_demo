import {canalNetworkGeometry,openCanalMouths} from './canal-network.js';
import {createDistrictTerrain, districtRoadEdges, surfaceElevation, TILE, shoreDistance} from '../district3d/terrain.js';
import {WIDTH, HEIGHT, terrain, river} from '../world.js';
import {vegetationFor, weatherAt} from '../environment.js';
import {irrigationFor, CARDINAL} from '../irrigation.js';
import {constructionProgress} from '../construction.js';
import {roadKey} from '../roads.js';
import {generateStreets} from '../city-life.js';
import {canPlace} from '../engine.js';
import {createGameWater,canalArm,wornRoadGeometry,canalSection} from './water.js';
import {createNatureDetails,resourceDisplayLayout} from './nature-details.js';
import {cargoLayout,createGoodsSources} from './goods.js';
import {lakeContours,lakeDistance,visualSurfaceElevation} from './lake-shore.js';
import {sceneryClear,lakebankGeometry,floodplainTufts,tuftGeometry,riverbankGeometry,rectangularSiteGeometry} from './nature.js';

import {createValleyVegetation,loadValleyPlantSources,VALLEY_PLANT_ASSETS,vegetationBankDistance} from './valley-vegetation.js';

const RESOURCE_SITES={clay:{label:'Глина',color:'#b88764'},reed:{label:'Тростник',color:'#82985c'},stone:{label:'Камень',color:'#a2a996'},forest:{label:'Дерево',color:'#6e8955'},wildlife:{label:'Дичь',color:'#ab9064'},dates:{label:'Финики',color:'#b79a4f'}};
const RESOURCE_BUILDINGS={clay:'clay',reed:'reed',quarry:'stone',logging:'forest',hunting:'wildlife',garden:'dates'};
export function resourcePlacementSites(s,selection){
 const kind=RESOURCE_BUILDINGS[selection],points=new Map(),put=(x,y)=>points.set(`${x},${y}`,{x,y});
 if(!kind&&selection!=='fishing')return [];
 if(kind){const radius=['forest','wildlife'].includes(kind)?2:0;for(const d of s.world?.deposits||[])if(d.kind===kind)for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++)if(Math.hypot(dx,dy)<=radius)put(d.x+dx,d.y+dy);}
 else{ // Inspect only river/lake banks, never every tile of the map.
  const water=[];for(let y=0;y<HEIGHT;y++)for(let x=Math.floor(river(y)-1.1);x<=Math.ceil(river(y)+1.1);x++)if(terrain(x,y,s)==='water')water.push({x,y});
  for(const lake of s.world?.lakes||[])water.push(...lake.cells);for(const p of water)for(const [dx,dy]of CARDINAL)put(p.x+dx,p.y+dy);
 }
 return [...points.values()].filter(p=>!canPlace(s,selection,p.x,p.y));
}

const clamp=v=>Math.max(0,Math.min(1,v));
const progress=b=>b.construction?constructionProgress(b).ratio:1;
const pointDistance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);};
// These plans contain display data only. Never initialize resources, roads or trade here.
export function landscapeSignature(s){return JSON.stringify([s.world?.lakes,s.world?.deposits,s.gathering?.features?.map(f=>[f.id,f.kind,f.x,f.y]),s.buildings?.map(b=>[b.type,b.x,b.y,b.footprint||1,b.construction?.kind,progress(b)]),s.roadAnchors,s.roads?.map(r=>[r.id,r.a,r.b,r.level,r.construction])]);}
export function landscapePlan(s){
 const edges=districtRoadEdges(s),network=irrigationFor(s),known=new Map((s.roads||[]).map(r=>[r.id,r]));
 const roads=edges.map(([a,b])=>{const id=roadKey(a,b),r=known.get(id);return {id,a,b,level:r?.level||1,target:r?.construction?.target||null,progress:r?progress(r):1};});
 // Saved roads remain visible during the same transition that rebuilds the derived network.
 for(const r of s.roads||[])if(r.a&&r.b&&!roads.some(v=>v.id===r.id))roads.push({id:r.id,a:r.a,b:r.b,level:r.level||1,target:r.construction?.target||null,progress:progress(r)});
 const canals=(s.buildings||[]).filter(b=>b.type==='canal').map(b=>{const id=`${b.x},${b.y}`;return {x:b.x,y:b.y,wet:network.wet.has(id),progress:progress(b),arms:network.arms.get(id)||CARDINAL.filter(([dx,dy])=>s.buildings.some(v=>v.type==='canal'&&v.x===b.x+dx&&v.y===b.y+dy)||terrain(b.x+dx,b.y+dy,s)==='water')};});
 const deposits=(s.world?.deposits||[]).filter(d=>RESOURCE_SITES[d.kind]&&terrain(d.x,d.y,s)!=='water').map(d=>({...d}));
 const palms=vegetationFor(s,{edges}).filter(p=>p.kind==='palm'&&shoreDistance(p.x,p.y,s)>.4&&sceneryClear(s,p,.2)&&roads.every(r=>pointDistance(p,r.a,r.b)>.4));
 for(const d of deposits)if(['forest','dates'].includes(d.kind))for(const [i,display]of resourceDisplayLayout(d).entries()){const p={id:`resource-${d.kind}-${d.x}-${d.y}-${i}`,x:display.x,y:display.y,resource:d.kind};if(vegetationBankDistance(p.x,p.y,s)>.22&&sceneryClear(s,p,.2)&&roads.every(r=>pointDistance(p,r.a,r.b)>.4))palms.push(p);}
 const c=s.trade?.caravan,caravan=c&&Number.isFinite(c.x)&&Number.isFinite(c.y)?{x:c.x,y:c.y,river:c.transport==='river',stock:{...c.stock},route:c.route||[],routeIndex:c.routeIndex||0}:null;
 return {roads,canals,palms,caravan,deposits};
}
const groundYards=new WeakMap();
// Full four-column/four-row parcel footprint, in map tiles, plus trunk clearance.
const yardTreeClear=(yard,tree)=>Math.hypot(Math.max(Math.abs(tree.x-yard.x)-.26,0),Math.max(yard.y-.05-tree.y,tree.y-yard.y-.38,0))>=.45;
function findGroundYard(s,net){
 if(s.buildings.some(b=>b.type==='granary'&&b.construction?.kind!=='new'))return null;
 const depot=s.buildings.find(b=>b.type==='shrine'&&b.construction?.kind!=='new')||s.buildings.find(b=>b.type==='house'&&b.construction?.kind!=='new');if(!depot)return null;
 const port=net.ports.find(p=>p.building.x===depot.x&&p.building.y===depot.y);
 // Tree and palm planning is done only on topology changes, never per animation frame.
 const trees=[...landscapePlan(s).palms,...(s.gathering?.features||[]).filter(f=>f.kind==='tree')];
 const anchor=port||{x:depot.x+.5,y:depot.y+.5},candidates=[];
 for(let radius=1;radius<=4;radius+=.5)for(const [dx,dy]of [[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[-1,-1],[1,-1]]){
  const x=depot.x+dx*radius,y=depot.y+dy*radius;
  if(x<.5||y<.5||x>WIDTH-1.5||y>HEIGHT-1.5||shoreDistance(x,y,s)<.55)continue;
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
 const meshes=[],ownedMaterials=[],palmSources=[],palmInstances=[],resourceMeshes=[],resourceSources=[],selectionMeshes=[],workFeatureMeshes=[],workFeatureRoots=[],workFeatures=new Map();
 let base=null,staticMeshes=[],stockMeshes=[],traderMeshes=[],signature='',terrainSignature='',stockSignature='',traderSignature='',traderRoot=null,disposed=false,palmsSignature='',streetNetwork=null,resourceSignature='',selectionSignature='';
 const color=(r,g,b)=>new B.Color3(r,g,b);
 const material=(name,hex)=>{const m=new B.PBRMaterial(name,scene);m.albedoColor=B.Color3.FromHexString(hex).toLinearSpace();m.roughness=1;m.metallic=0;ownedMaterials.push(m);return m;};
 const waterView=createGameWater(B,scene,materials);
 const natureDetails=createNatureDetails(B,scene,materials,options);
 const valleyVegetation=await createValleyVegetation(B,scene,options);meshes.push(...valleyVegetation.meshes);
 const meadow=material('volumetric-floodplain-grass','#7b8750'),shore=material('irregular-wet-sand-margin','#ffffff');meadow.backFaceCulling=false;shore.transparencyMode=B.Material.MATERIAL_ALPHABLEND;shore.forceDepthWrite=false;shore.albedoTexture=materials.soil?.albedoTexture||null;
 const earth=material('game-road-compacted-earth','#806443'),gravel=material('game-road-clay-gravel','#a18b63'),paving=material('game-road-bedded-stone','#afa68b'),work=material('game-road-work','#b99b6a'),bank=material('game-channel-bank','#a5885e'),wetMud=material('game-wet-channel-mud','#4d584a'),rainMaterial=material('game-rain','#a5c5ce');
 for(const mat of [bank,wetMud]){mat.albedoTexture=materials.soil?.albedoTexture||null;mat.bumpTexture=materials.soil?.bumpTexture||null;}
 bank.albedoColor=color(1,.91,.76);wetMud.albedoColor=color(.42,.37,.28);
 earth.albedoColor=color(1.05,1,.88);earth.albedoTexture=materials.soil?.albedoTexture||null;earth.bumpTexture=materials.soil?.bumpTexture||null;
 for(const mat of [earth,gravel,paving]){mat.transparencyMode=B.Material.MATERIAL_ALPHABLEND;mat.forceDepthWrite=false;}
 rainMaterial.alpha=.55;rainMaterial.emissiveColor=color(.12,.17,.19);
 const add=(m,collection=staticMeshes)=>{m.isPickable=false;if(!m.sourceMesh)m.receiveShadows=true;collection.push(m);meshes.push(m);return m;};
 const remove=collection=>{for(const m of collection){const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);m.dispose();}collection.length=0;};
 function box(name,x,y,z,width,height,depth,mat,collection=staticMeshes){const m=B.MeshBuilder.CreateBox(name,{width,height,depth},scene);m.position.set(x,y,z);m.material=mat;return add(m,collection);}
 function strip(name,a,b,width,height,mat){const length=Math.hypot(b.x-a.x,b.y-a.y)*TILE;if(!length)return;const m=box(name,(a.x+b.x)*TILE/2,height,(a.y+b.y)*TILE/2,width,.035,length,mat);m.rotation.y=Math.atan2(b.x-a.x,b.y-a.y);m.freezeWorldMatrix();return m;}
 function rebuildBase(s){
  const next=JSON.stringify([s.world?.lakes,s.buildings.map(b=>[b.type,b.x,b.y,b.footprint||1]),s.roadAnchors]);if(next===terrainSignature)return;terrainSignature=next;
  if(base){for(const m of base.meshes){const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);}base.dispose();}
  base=createDistrictTerrain(B,scene,s,materials);
  for(const m of base.meshes){if(['connected-earth-streets','living-river','saved-lakes','valley-scrub','river-reed-beds'].includes(m.name)||palmSources.length&&['date-palm-trunks','date-palm-crowns'].includes(m.name))m.setEnabled(false);if(m.name==='soft-riparian-grass'){const c=m.getVerticesData(B.VertexBuffer.ColorKind);for(let i=3;i<c.length;i+=4)c[i]*=.43;m.setVerticesData(B.VertexBuffer.ColorKind,c,true);}meshes.push(m);}
 }
 // Use the supplied CC BY 4.0 date palm; retain the existing licensed palm as a
 // graceful fallback if the new optional asset is unavailable.
 const palmContainers=[];
 palmSources.push(...await loadValleyPlantSources(B,scene,VALLEY_PLANT_ASSETS.palm,meshes,palmContainers,'palm'));
 if(!palmSources.length)palmSources.push(...await loadValleyPlantSources(B,scene,['date-palm.glb'],meshes,palmContainers,'palm'));
 for(const m of palmSources)m.name=`game-date-palm-source-${m.material?.name||m.name}`;
 const siteMaterials=Object.fromEntries(Object.entries(RESOURCE_SITES).map(([kind,spec])=>[kind,material(`resource-${kind}`,spec.color)]));
 const resourceModels=new Map();
 const source=(name,create,mat)=>{const m=create();m.name=name;m.material=mat;m.isPickable=false;m.receiveShadows=true;m.setEnabled(false);resourceSources.push(m);meshes.push(m);return m;};
 const stoneSource=source('resource-stone-source',()=>B.MeshBuilder.CreateIcoSphere('site-stone',{radius:1,subdivisions:1},scene),materials.stone);
 const claySource=source('resource-clay-source',()=>B.MeshBuilder.CreateIcoSphere('site-clay',{radius:1,subdivisions:1},scene),materials.terracotta);
 const reedSource=source('resource-reed-source',()=>B.MeshBuilder.CreateCylinder('site-reed',{height:1,diameterTop:.035,diameterBottom:.07,tessellation:5},scene),siteMaterials.reed);
 const hoofSource=source('resource-track-source',()=>B.MeshBuilder.CreateSphere('site-track',{diameter:1,segments:6},scene),materials.wood);
 for(const [kind,spec]of Object.entries(RESOURCE_SITES)){
  const patchMaterial=siteMaterials[kind].clone(`resource-selection-patch-${kind}`);patchMaterial.albedoColor=patchMaterial.albedoColor.toLinearSpace();patchMaterial.alpha=.14;patchMaterial.transparencyMode=B.Material.MATERIAL_ALPHABLEND;patchMaterial.forceDepthWrite=false;ownedMaterials.push(patchMaterial);
  const patch=source(`resource-patch-source-${kind}`,()=>B.MeshBuilder.CreateBox('site-patch',{width:5.25,height:.035,depth:5.25},scene),patchMaterial);resourceModels.set(kind,patch);

 }
 function instanceResource(src,name,x,y,z,scale,spec){const m=src.createInstance(name);m.setEnabled(true);m.position.set(x,y,z);m.scaling.set(...scale);m.metadata={resourceSite:{kind:spec.kind,x:spec.x,y:spec.y,label:RESOURCE_SITES[spec.kind].label}};add(m,resourceMeshes);m.freezeWorldMatrix();return m;}
 function updateResourceSites(s){
  const next=JSON.stringify([s.world?.deposits,s.world?.lakes,s.buildings.map(b=>[b.type,b.x,b.y,b.footprint||1])]);if(next===resourceSignature)return;resourceSignature=next;selectionSignature='';remove(resourceMeshes);
  for(const d of s.world?.deposits||[]){if(!RESOURCE_SITES[d.kind]||terrain(d.x,d.y,s)==='water')continue;const X=d.x*TILE,Z=d.y*TILE,Y=surfaceElevation(d.x,d.y,s),occupied=!sceneryClear(s,d,.12);
   const patch=instanceResource(resourceModels.get(d.kind),`resource-site-${d.kind}-${d.x}-${d.y}`,X,Y+.045,Z,[1,1,1],d);patch.setEnabled(false);

   if(occupied)continue;
   if(['clay','stone','reed'].includes(d.kind))for(const [i,p]of resourceDisplayLayout(d).entries()){
    if(!sceneryClear(s,p,.05))continue;const ground=surfaceElevation(p.x,p.y,s);
    if(d.kind==='reed'){if(valleyVegetation.sources.reed.length)continue;const h=1.25+p.size*.38,m=instanceResource(reedSource,'deposit-reed-bed',p.x*TILE,ground+h/2,p.y*TILE,[1,h,1],d);m.unfreezeWorldMatrix();m.rotation.z=Math.sin(p.angle)*.09;m.freezeWorldMatrix();}
    else{const m=instanceResource(d.kind==='clay'?claySource:stoneSource,`deposit-${d.kind}-pile`,p.x*TILE,ground+.19*p.size,p.y*TILE,[.56*p.size,.32*p.size,.51*p.size],d);m.unfreezeWorldMatrix();m.rotation.y=p.angle;m.freezeWorldMatrix();}
   }
   if(d.kind==='wildlife')for(let i=0;i<6;i++)instanceResource(hoofSource,'deposit-wildlife-track',X+(i%2)*.33-.16,Y+.07,Z+(i/2-1.5)*.6,[.13,.055,.23],d);
  }
 }
 const selectionMaterial=material('resource-placement-highlight','#d9ee8b');selectionMaterial.emissiveColor=color(.25,.32,.08);selectionMaterial.alpha=.8;
 const selectionSource=source('resource-highlight-source',()=>{const m=new B.Mesh('site-placement-rectangle',scene),d=new B.VertexData(),g=rectangularSiteGeometry();d.positions=g.positions;d.indices=g.indices;d.normals=[];B.VertexData.ComputeNormals(d.positions,d.indices,d.normals);d.applyToMesh(m);return m;},selectionMaterial);selectionMaterial.backFaceCulling=false;
 function updateSelection(s,selection){const type=typeof selection==='string'?selection:null,key=`${type}|${resourceSignature}`;if(key===selectionSignature)return;selectionSignature=key;remove(selectionMeshes);
  for(const m of resourceMeshes)if(m.name.startsWith('resource-site-'))m.setEnabled(!!RESOURCE_BUILDINGS[type]&&m.metadata.resourceSite.kind===RESOURCE_BUILDINGS[type]);
  for(const p of resourcePlacementSites(s,type)){const m=selectionSource.createInstance(`resource-placement-${type}-${p.x}-${p.y}`);m.setEnabled(true);m.position.set(p.x*TILE,surfaceElevation(p.x,p.y,s)+.16,p.y*TILE);m.metadata={resourcePlacement:{type,x:p.x,y:p.y}};add(m,selectionMeshes);m.freezeWorldMatrix();}
 }
 function meshData(name,g,mat){if(!g.indices.length)return null;const m=new B.Mesh(name,scene),d=new B.VertexData();d.positions=g.positions;d.indices=g.indices;d.colors=g.colors;d.uvs=g.uvs||g.positions.filter((_,i)=>i%3!==1).map(v=>v/3);d.normals=[];B.VertexData.ComputeNormals(d.positions,d.indices,d.normals);
  if(d.normals.find((v,i)=>i%3===1&&Math.abs(v)>.01)<0){for(let i=0;i<d.indices.length;i+=3)[d.indices[i+1],d.indices[i+2]]=[d.indices[i+2],d.indices[i+1]];B.VertexData.ComputeNormals(d.positions,d.indices,d.normals);}d.applyToMesh(m);m.material=mat;m.useVertexColors=true;add(m);return m;
 }
 function road(name,s,a,b,width,height,mat,level){const g=wornRoadGeometry(s,a,b,width,height,level),m=meshData(name,g,mat);if(!m)return;m.position.set(g.origin.x,0,g.origin.z);m.hasVertexAlpha=true;m.metadata={road:{a:{...a},b:{...b},level}};m.freezeWorldMatrix();}
 const originalTerrain=new WeakMap();
 function carveChannels(s,arms){
  // This main-game copy alone cuts shallow depressions; the legacy terrain module
  // and the saved map/canal coordinates are never changed.
  for(const m of base.meshes){if(!['alluvial-valley','soft-riparian-grass'].includes(m.name))continue;let original=originalTerrain.get(m);if(!original){original={positions:m.getVerticesData(B.VertexBuffer.PositionKind).slice(),colors:m.getVerticesData(B.VertexBuffer.ColorKind)?.slice()};originalTerrain.set(m,original);}
   const positions=original.positions.slice(),colors=original.colors?.slice(),contours=lakeContours(s);
   for(let i=0;i<positions.length;i+=3){const X=positions[i],Z=positions[i+2],p={x:X/TILE,y:Z/TILE};if(colors&&m.name==='soft-riparian-grass'&&!sceneryClear(s,p,.12))colors[i/3*4+3]=0;const lakeD=lakeDistance(p.x,p.y,s,contours);if(lakeD<.6){positions[i+1]=visualSurfaceElevation(p.x,p.y,s,contours)+(m.name==='soft-riparian-grass'?.025:0);if(colors&&m.name==='soft-riparian-grass')colors[i/3*4+3]*=clamp((lakeD-.09)/.26);else if(colors){const wet=1-clamp((lakeD+.02)/.4),fleck=Math.sin(X*3+Z)*.015,blend=clamp((.6-lakeD)/.2),offset=i/3*4;for(const [k,tone]of [.88-wet*.24+fleck,.80-wet*.21+fleck,.62-wet*.19+fleck].entries())colors[offset+k]=colors[offset+k]*(1-blend)+tone*blend;}}for(const arm of arms){const dx=arm.b.x-arm.a.x,dy=arm.b.y-arm.a.y,t=clamp(((p.x-arm.a.x)*dx+(p.y-arm.a.y)*dy)/(dx*dx+dy*dy||1)),dist=Math.hypot(p.x-arm.a.x-dx*t,p.y-arm.a.y-dy*t)*TILE,width=1.85;
     if(dist>width)continue;const h=arm.startHeight+(arm.endHeight-arm.startHeight)*t,cut=h-.2,inner=.85,weight=1-clamp((dist-inner)/(width-inner));positions[i+1]=Math.min(positions[i+1],original.positions[i+1]*(1-weight)+cut*weight);if(colors&&m.name==='soft-riparian-grass')colors[i/3*4+3]*=1-Math.min(1,weight*2);
    }}
   m.setVerticesData(B.VertexBuffer.PositionKind,positions,true);if(colors)m.setVerticesData(B.VertexBuffer.ColorKind,colors,true);const normals=[];B.VertexData.ComputeNormals(positions,m.getIndices(),normals);m.setVerticesData(B.VertexBuffer.NormalKind,normals,true);m.refreshBoundingInfo();
  }
 }
 function rebuildGeometry(s,plan){
  remove(staticMeshes);
  for(const r of plan.roads){if(shoreDistance((r.a.x+r.b.x)/2,(r.a.y+r.b.y)/2,s)<.08)continue;const mat=r.level>=3?paving:r.level===2?gravel:earth;
   road(`road-${r.id}-level-${r.level}`,s,r.a,r.b,1.22,.038,mat,r.level);
   if(r.target){const end={x:r.a.x+(r.b.x-r.a.x)*r.progress,y:r.a.y+(r.b.y-r.a.y)*r.progress};road(`road-upgrade-${r.id}`,s,r.a,end,.89,.063,r.target===3?paving:gravel,r.target);for(const t of [.1,.9])box('road-work-materials',(r.a.x+(r.b.x-r.a.x)*t)*TILE,.21,(r.a.y+(r.b.y-r.a.y)*t)*TILE+.9,.45,.35,.5,work);}
  }
  const channels=canalNetworkGeometry(s,plan.canals),arms=channels.arms;
  for(const [name,g,mat]of [['actual-canal-bank',channels.wetBed,wetMud],['actual-dry-canal-bank',channels.dryBed,bank],['actual-canal-water',channels.water,waterView.material]]){const m=meshData(name,g,mat);if(m){m.metadata={canalArms:arms,canalArm:arms[0]};m.receiveShadows=name!=='actual-canal-water';m.freezeWorldMatrix();}}
  for(const c of plan.canals)for(const [dx,dy]of c.arms.length?c.arms:[[1,0],[-1,0]]){const mid={x:c.x+dx*.5,y:c.y+dy*.5};if(plan.roads.some(r=>pointDistance(mid,r.a,r.b)<.09))for(const offset of [-.22,0,.22]){const center={x:mid.x+dx*offset/TILE,y:mid.y+dy*offset/TILE};strip('canal-road-crossing',{x:center.x-dy*.13,y:center.y+dx*.13},{x:center.x+dy*.13,y:center.y-dx*.13},.19,.18,materials.wood);}}
  carveChannels(s,arms);
  const tufts=floodplainTufts(s,plan.roads).filter(p=>!valleyVegetation.sources[p.kind]?.length),grass=meshData('volumetric-riparian-colonies',tuftGeometry(s,tufts),meadow);if(grass){grass.metadata={natureTufts:tufts};grass.freezeWorldMatrix();}
  const margin=meshData('irregular-physical-riverbanks',openCanalMouths(riverbankGeometry(s),arms),shore);if(margin){margin.hasVertexAlpha=true;margin.freezeWorldMatrix();}
  const lakeMargin=meshData('organic-lake-soft-banks',openCanalMouths(lakebankGeometry(s),arms),shore);if(lakeMargin){lakeMargin.hasVertexAlpha=true;lakeMargin.freezeWorldMatrix();}
  const visiblePalms=plan.palms.filter(p=>!(s.gathering?.features||[]).some(f=>f.kind==='tree'&&Math.hypot(f.x-p.x,f.y-p.y)<.85));
  const nextPalms=JSON.stringify(visiblePalms.map(p=>[p.id,p.x,p.y]));
  if(nextPalms!==palmsSignature){palmsSignature=nextPalms;remove(palmInstances);for(const p of visiblePalms){const scale=p.resource?.72:.88+(p.id%7)*.035;for(const src of palmSources){const m=src.createInstance(`date-palm-${p.id}-${src.name}`);m.setEnabled(true);m.position.set(p.x*TILE,surfaceElevation(p.x,p.y,s),p.y*TILE);m.scaling.setAll(scale);m.rotation.y=p.resource?(p.x+p.y)*2.399:p.id*2.399;m.overrideMaterialSideOrientation=B.Material.ClockWiseSideOrientation;m.computeWorldMatrix(true);m.freezeWorldMatrix();add(m,palmInstances);}}}
 }

 let featureSignature='';
 const cutWood=material('actual-felled-tree-heartwood','#ac8052');
 function updateWorkFeatures(s,time){
  const features=s.gathering?.features||[],next=JSON.stringify([features.map(f=>[f.id,f.kind,f.x,f.y]),s.buildings.map(b=>[b.type,b.x,b.y,b.footprint||1]),landscapePlanRoads]);
  if(next!==featureSignature){featureSignature=next;remove(workFeatureMeshes);for(const r of workFeatureRoots)r.dispose();workFeatureRoots.length=0;workFeatures.clear();
   for(const f of features){if(!sceneryClear(s,f,.2)||vegetationBankDistance(f.x,f.y,s)<.2||landscapePlanRoads.some(r=>pointDistance(f,r.a,r.b)<.4))continue;const Y=surfaceElevation(f.x,f.y,s),root=new B.TransformNode(`gathering-feature-${f.id}`,scene);root.position.set(f.x*TILE,Y,f.y*TILE);workFeatureRoots.push(root);const parts=[];
    if(f.kind==='tree'){
     for(const src of palmSources){const m=src.createInstance(`working-tree-${f.id}-${src.name}`);m.setEnabled(true);m.parent=root;m.scaling.setAll(.72);m.overrideMaterialSideOrientation=B.Material.ClockWiseSideOrientation;parts.push(add(m,workFeatureMeshes));}
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
 function cargo(stock,collection,parent,origin={x:0,y:0,z:0},options={}){
  for(const p of cargoLayout(stock,options)){const m=goods.sources.get(p.kind).createInstance(`cargo-${p.kind}`);m.setEnabled(true);m.parent=parent||null;m.position.set(origin.x+p.x,origin.y+p.y,origin.z+p.z);m.metadata={goods:{...p,supportY:origin.y+p.y}};add(m,collection);}
 }
 function updateStocks(s){const stocks=groundStocks(s,streetNetwork,signature),next=JSON.stringify(stocks);if(next===stockSignature)return;stockSignature=next;remove(stockMeshes);if(stocks)cargo(stocks.stock,stockMeshes,null,{x:stocks.x*TILE,y:surfaceElevation(stocks.x,stocks.y,s),z:stocks.y*TILE});}
 function updateTrader(c,time){const next=JSON.stringify(c?[c.river,c.stock]:null);if(next!==traderSignature){traderSignature=next;remove(traderMeshes);traderRoot?.dispose();traderRoot=null;if(c){traderRoot=new B.TransformNode('actual-trade-caravan',scene);
    if(c.river){const hull=box('trade-reed-boat',0,.04,0,1.65,.42,5.2,materials.reed,traderMeshes);hull.parent=traderRoot;for(const side of [-1,1]){const bow=B.MeshBuilder.CreateSphere('boat-raised-bow',{diameter:1,segments:6},scene);bow.scaling.set(.7,.5,1.2);bow.position.set(0,.17,side*2.2);bow.material=materials.reed;bow.parent=traderRoot;add(bow,traderMeshes);}for(const x of [-.8,.8]){const rim=box('boat-gunwale',x,.36,0,.13,.35,4.5,materials.wood,traderMeshes);rim.parent=traderRoot;}cargo(c.stock,traderMeshes,traderRoot,{x:0,y:.25,z:-1.35},{columns:2,layers:1,maxKinds:10});
    }else{ // Original pack donkey and merchant, deliberately modest beside licensed residents.
     const body=box('caravan-pack-donkey',0,.91,0,.65,.65,1.35,materials.wood,traderMeshes);body.parent=traderRoot;for(const x of [-.23,.23])for(const z of [-.45,.45]){const leg=box('donkey-leg',x,.35,z,.15,.7,.15,materials.wood,traderMeshes);leg.parent=traderRoot;}const head=box('donkey-head',0,1.3,.8,.36,.5,.6,materials.wood,traderMeshes);head.parent=traderRoot;for(const x of [-.13,.13]){const ear=box('donkey-ear',x,1.72,.8,.11,.4,.12,materials.wood,traderMeshes);ear.parent=traderRoot;}const rack=box('donkey-wood-pack-support',0,1.2,-.1,1.5,.07,.6,materials.wood,traderMeshes);rack.parent=traderRoot;cargo(c.stock,traderMeshes,traderRoot,{x:0,y:1.235,z:-.1},{columns:2,layers:1,maxKinds:2});const person=box('trade-merchant',1.1,.85,.1,.52,1.5,.4,materials.linen,traderMeshes);person.parent=traderRoot;const merchantHead=B.MeshBuilder.CreateSphere('merchant-head',{diameter:.48,segments:6},scene);merchantHead.position.set(1.1,1.8,.1);merchantHead.material=materials.terracotta;merchantHead.parent=traderRoot;add(merchantHead,traderMeshes);
    }}}
  if(!c||!traderRoot)return;traderRoot.position.set(c.x*TILE,c.river?-.08+Math.sin(time*1.7)*.025:surfaceElevation(c.x,c.y,currentState),c.y*TILE);const target=c.route[c.routeIndex];if(target&&Math.hypot(target.x-c.x,target.y-c.y)>.01)traderRoot.rotation.y=Math.atan2(target.x-c.x,target.y-c.y);
 }
 const drops=[];for(let i=0;i<90;i++){const m=box('weather-rain',0,0,0,.018,.8,.018,rainMaterial, drops);m.receiveShadows=false;m.setEnabled(false);}
 let weatherSignature='',landscapePlanRoads=[];
 function updateWeather(s,time){const weather=weatherAt(s),rain=weather.type==='rain',wind=weather.type==='wind',key=`${s.season}|${!!s.drought}|${rain}`;
  if(key!==weatherSignature){weatherSignature=key;const dry=s.drought>0,summer=s.season===1;const soil=materials.soil,grass=materials.grass;
   soil.albedoColor=color(rain?.82:.94,rain?.76:.86,rain?.62:.71);grass.albedoColor=dry?color(.83,.72,.42):summer?color(.8,.79,.5):color(.71,.87,.52);
   for(const m of base?.meshes||[])if(m.name==='soft-riparian-grass'&&m.material)m.material.albedoColor=grass.albedoColor.clone();
   meadow.albedoColor=dry?color(.57,.43,.21):summer?color(.48,.47,.25):rain?color(.32,.43,.19):color(.40,.48,.24);
  }
  natureDetails.update(s,time,weather,landscapePlanRoads,signature);
  if(valleyVegetation.update(s,landscapePlanRoads,signature)){const registered=new Set(meshes);for(const m of valleyVegetation.meshes)if(!registered.has(m))meshes.push(m);}
  for(const m of natureDetails.meshes)if(!meshes.includes(m))meshes.push(m);
  for(let i=0;i<drops.length;i++){const m=drops[i];m.setEnabled(rain);if(rain){const h=((i*.618+time*1.6)%1)*20;m.position.set(((i*53.71+time*3)% (WIDTH*TILE)),20-h,((i*37.29)% (HEIGHT*TILE)));m.rotation.z=.16;}}
  // Wind moves only shared source foliage instances, with no allocation or save edits.
  for(let i=0;i<palmInstances.length;i++){const m=palmInstances[i];if(!wind&&m.rotation.z===0)continue;m.unfreezeWorldMatrix();m.rotation.z=wind?Math.sin(time*1.7+Math.floor(i/palmSources.length))*.008:0;m.computeWorldMatrix(true);if(!wind)m.freezeWorldMatrix();}
 }
 function update(s,time=0,selection=null){if(disposed)return;currentState=s;rebuildBase(s);const next=landscapeSignature(s);if(next!==signature){signature=next;streetNetwork=generateStreets([...(s.buildings||[]),...(s.roadAnchors||[])],s);const plan=landscapePlan(s);landscapePlanRoads=plan.roads;rebuildGeometry(s,plan);weatherSignature='';}base.light(night);base.update(s,time);for(const m of base.meshes){if(['connected-earth-streets','living-river','saved-lakes'].includes(m.name))m.setEnabled(false);if(!meshes.includes(m))meshes.push(m);} // Terrain's road owner can replace its hidden batch.
  waterView.update(s,time);waterView.light(night);for(const m of waterView.meshes)if(!meshes.includes(m))meshes.push(m);
  for(let i=meshes.length-1;i>=0;i--)if(meshes[i].isDisposed?.())meshes.splice(i,1);
  updateWorkFeatures(s,time);updateResourceSites(s);updateSelection(s,selection);updateStocks(s);const c=s.trade?.caravan;updateTrader(c&&Number.isFinite(c.x)&&Number.isFinite(c.y)?{...c,river:c.transport==='river',route:c.route||[],routeIndex:c.routeIndex||0}:null,time);updateWeather(s,time);
 }
 let night=0,currentState=initialState;update(initialState,initialState.simTime||0);
 return {meshes,update,setQuality(tier){natureDetails.setQuality(tier);valleyVegetation.setQuality(tier);},light(n){night=n;base?.light(n);waterView.light(n);},dispose(){if(disposed)return;disposed=true;base?.dispose();waterView.dispose();natureDetails.dispose();valleyVegetation.dispose();for(const m of [...meshes])if(!m.isDisposed?.())m.dispose();meshes.length=0;traderRoot?.dispose();for(const r of workFeatureRoots)r.dispose();for(const c of palmContainers)c.dispose();for(const m of ownedMaterials)m.dispose(false,false);}};
}
