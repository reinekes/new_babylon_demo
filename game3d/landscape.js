import {createDistrictTerrain, districtRoadEdges, surfaceElevation, TILE, shoreDistance} from '../district3d/terrain.js';
import {WIDTH, HEIGHT, terrain, river} from '../world.js';
import {vegetationFor, weatherAt} from '../environment.js';
import {irrigationFor, CARDINAL} from '../irrigation.js';
import {constructionProgress} from '../construction.js';
import {roadKey} from '../roads.js';
import {generateStreets} from '../city-life.js';
import {canPlace} from '../engine.js';

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
export function landscapeSignature(s){return JSON.stringify([s.world?.lakes,s.world?.deposits,s.buildings?.map(b=>[b.type,b.x,b.y,b.construction?.kind,progress(b)]),s.roadAnchors,s.roads?.map(r=>[r.id,r.a,r.b,r.level,r.construction])]);}
export function landscapePlan(s){
 const edges=districtRoadEdges(s),network=irrigationFor(s),known=new Map((s.roads||[]).map(r=>[r.id,r]));
 const roads=edges.map(([a,b])=>{const id=roadKey(a,b),r=known.get(id);return {id,a,b,level:r?.level||1,target:r?.construction?.target||null,progress:r?progress(r):1};});
 // Saved roads remain visible during the same transition that rebuilds the derived network.
 for(const r of s.roads||[])if(r.a&&r.b&&!roads.some(v=>v.id===r.id))roads.push({id:r.id,a:r.a,b:r.b,level:r.level||1,target:r.construction?.target||null,progress:progress(r)});
 const canals=(s.buildings||[]).filter(b=>b.type==='canal').map(b=>{const id=`${b.x},${b.y}`;return {x:b.x,y:b.y,wet:network.wet.has(id),progress:progress(b),arms:network.arms.get(id)||CARDINAL.filter(([dx,dy])=>s.buildings.some(v=>v.type==='canal'&&v.x===b.x+dx&&v.y===b.y+dy)||terrain(b.x+dx,b.y+dy)==='water')};});
 const deposits=(s.world?.deposits||[]).filter(d=>RESOURCE_SITES[d.kind]&&terrain(d.x,d.y,s)!=='water').map(d=>({...d}));
 const palms=vegetationFor(s,{edges}).filter(p=>p.kind==='palm'&&shoreDistance(p.x,p.y,s)>.4&&!s.buildings.some(b=>Math.abs(b.x-p.x)<.7&&Math.abs(b.y-p.y)<.7)&&roads.every(r=>pointDistance(p,r.a,r.b)>.4));
 for(const d of deposits)if(['forest','dates'].includes(d.kind)&&!s.buildings.some(b=>b.x===d.x&&b.y===d.y))for(let i=0;i<3;i++)palms.push({id:`resource-${d.kind}-${d.x}-${d.y}-${i}`,x:d.x+(i-1)*.22,y:d.y+(i%2)*.18,resource:d.kind});
 const c=s.trade?.caravan,caravan=c&&Number.isFinite(c.x)&&Number.isFinite(c.y)?{x:c.x,y:c.y,river:c.transport==='river',stock:{...c.stock},route:c.route||[],routeIndex:c.routeIndex||0}:null;
 return {roads,canals,palms,caravan,deposits};
}
function groundStocks(s,net){
 if(s.buildings.some(b=>b.type==='granary'&&b.construction?.kind!=='new'))return null;
 const depot=s.buildings.find(b=>b.type==='shrine'&&b.construction?.kind!=='new')||s.buildings.find(b=>b.type==='house'&&b.construction?.kind!=='new');if(!depot)return null;
 const port=net.ports.find(p=>p.building.x===depot.x&&p.building.y===depot.y),stock={...s.resources};
 for(const q of s.trade?.sales||[])stock[q.resource]=(stock[q.resource]||0)+q.remaining;
 for(const b of [...s.buildings,...s.roads||[]])for(const [k,n]of Object.entries(b.construction?.remaining||{}))stock[k]=(stock[k]||0)+n;
 return {x:port?.x??depot.x+.5,y:port?.y??depot.y+.5,stock};
}

export async function createGameLandscape(B,scene,initialState,materials){
 const meshes=[],ownedMaterials=[],ownedTextures=[],palmSources=[],palmInstances=[],resourceMeshes=[],resourceSources=[],selectionMeshes=[];
 let base=null,staticMeshes=[],stockMeshes=[],traderMeshes=[],signature='',terrainSignature='',stockSignature='',traderSignature='',traderRoot=null,disposed=false,palmsSignature='',streetNetwork=null,resourceSignature='',selectionSignature='';
 const color=(r,g,b)=>new B.Color3(r,g,b);
 const material=(name,hex)=>{const m=new B.PBRMaterial(name,scene);m.albedoColor=B.Color3.FromHexString(hex).toLinearSpace();m.roughness=1;m.metallic=0;ownedMaterials.push(m);return m;};
 const earth=material('game-road-compacted-earth','#806443'),gravel=material('game-road-clay-gravel','#a18b63'),paving=material('game-road-bedded-stone','#afa68b'),work=material('game-road-work','#b99b6a'),bank=material('game-channel-bank','#a5885e'),channel=material('game-channel-bed','#65523b'),canalWater=material('game-irrigation-water','#487f78'),rainMaterial=material('game-rain','#a5c5ce');
 earth.albedoColor=color(1.05,1,.88);earth.albedoTexture=materials.soil?.albedoTexture||null;earth.bumpTexture=materials.soil?.bumpTexture||null;
 canalWater.roughness=.2;canalWater.alpha=.9;rainMaterial.alpha=.55;rainMaterial.emissiveColor=color(.12,.17,.19);
 const add=(m,collection=staticMeshes)=>{m.isPickable=false;if(!m.sourceMesh)m.receiveShadows=true;collection.push(m);meshes.push(m);return m;};
 const remove=collection=>{for(const m of collection){const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);m.dispose();}collection.length=0;};
 function box(name,x,y,z,width,height,depth,mat,collection=staticMeshes){const m=B.MeshBuilder.CreateBox(name,{width,height,depth},scene);m.position.set(x,y,z);m.material=mat;return add(m,collection);}
 function strip(name,a,b,width,height,mat){const length=Math.hypot(b.x-a.x,b.y-a.y)*TILE;if(!length)return;const m=box(name,(a.x+b.x)*TILE/2,height,(a.y+b.y)*TILE/2,width,.035,length,mat);m.rotation.y=Math.atan2(b.x-a.x,b.y-a.y);m.freezeWorldMatrix();return m;}
 function rebuildBase(s){
  const next=JSON.stringify([s.world?.lakes,s.buildings.map(b=>[b.type,b.x,b.y]),s.roadAnchors]);if(next===terrainSignature)return;terrainSignature=next;
  if(base){for(const m of base.meshes){const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);}base.dispose();}
  base=createDistrictTerrain(B,scene,s,materials);
  for(const m of base.meshes){if(['date-palm-trunks','date-palm-crowns','connected-earth-streets'].includes(m.name))m.setEnabled(false);meshes.push(m);}
 }
 // Bake the imported left-handed root, retain per-material batches, then explicitly
 // restore GLTF clockwise winding. No negative-scale parent remains on the instances.
 let palmContainer;
 try{
  palmContainer=await B.SceneLoader.LoadAssetContainerAsync('assets/art-courtyard/models/','date-palm.glb',scene);
  palmContainer.addAllToScene();const grouped=new Map();
  for(const m of palmContainer.meshes)if(m.getTotalVertices()>0){m.computeWorldMatrix(true);if(!grouped.has(m.material))grouped.set(m.material,[]);grouped.get(m.material).push(m);}
  for(const [mat,parts]of grouped){const m=B.Mesh.MergeMeshes(parts,true,true,undefined,false,false);m.name=`game-date-palm-source-${mat.name}`;m.material=mat;m.overrideMaterialSideOrientation=B.Material.ClockWiseSideOrientation;m.isPickable=false;m.receiveShadows=true;m.setEnabled(false);palmSources.push(m);meshes.push(m);}
 }catch(error){palmContainer?.dispose();throw new Error(`Не удалось загрузить финиковые пальмы: ${error.message}`,{cause:error});}
 const siteMaterials=Object.fromEntries(Object.entries(RESOURCE_SITES).map(([kind,spec])=>[kind,material(`resource-${kind}`,spec.color)]));
 const resourceModels=new Map(),labelModels=new Map();
 const source=(name,create,mat)=>{const m=create();m.name=name;m.material=mat;m.isPickable=false;m.receiveShadows=true;m.setEnabled(false);resourceSources.push(m);meshes.push(m);return m;};
 const stoneSource=source('resource-stone-source',()=>B.MeshBuilder.CreateIcoSphere('site-stone',{radius:1,subdivisions:1},scene),materials.stone);
 const claySource=source('resource-clay-source',()=>B.MeshBuilder.CreateIcoSphere('site-clay',{radius:1,subdivisions:1},scene),materials.terracotta);
 const reedSource=source('resource-reed-source',()=>B.MeshBuilder.CreateCylinder('site-reed',{height:1,diameterTop:.035,diameterBottom:.07,tessellation:5},scene),siteMaterials.reed);
 const hoofSource=source('resource-track-source',()=>B.MeshBuilder.CreateSphere('site-track',{diameter:1,segments:6},scene),materials.wood);
 for(const [kind,spec]of Object.entries(RESOURCE_SITES)){
  const patchMaterial=siteMaterials[kind].clone(`resource-selection-patch-${kind}`);patchMaterial.albedoColor=patchMaterial.albedoColor.toLinearSpace();patchMaterial.alpha=.14;patchMaterial.transparencyMode=B.Material.MATERIAL_ALPHABLEND;patchMaterial.forceDepthWrite=false;ownedMaterials.push(patchMaterial);
  const patch=source(`resource-patch-source-${kind}`,()=>B.MeshBuilder.CreateBox('site-patch',{width:5.25,height:.035,depth:5.25},scene),patchMaterial);resourceModels.set(kind,patch);
  // Labels are shared per resource kind, alongside geometry icons that also work
  // in headless WebGL. No downloaded artwork or per-frame canvas drawing.
  if(typeof document!=='undefined'||typeof OffscreenCanvas!=='undefined'){
   const texture=new B.DynamicTexture(`resource-label-${kind}`,{width:512,height:96},scene,false),ctx=texture.getContext();ctx.fillStyle='#30291fe8';ctx.fillRect(0,0,512,96);ctx.fillStyle='#f5e8c7';ctx.font='bold 56px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(spec.label,256,50);texture.hasAlpha=true;texture.update();ownedTextures.push(texture);
   const mat=new B.StandardMaterial(`resource-label-material-${kind}`,scene);mat.diffuseTexture=texture;mat.emissiveColor=color(1,1,1);mat.disableLighting=true;mat.backFaceCulling=false;mat.useAlphaFromDiffuseTexture=true;ownedMaterials.push(mat);
   const label=source(`resource-label-source-${kind}`,()=>B.MeshBuilder.CreatePlane('site-label',{width:3.2,height:.6},scene),mat);labelModels.set(kind,label);
  }
 }
 function instanceResource(src,name,x,y,z,scale,spec){const m=src.createInstance(name);m.setEnabled(true);m.position.set(x,y,z);m.scaling.set(...scale);m.metadata={resourceSite:{kind:spec.kind,x:spec.x,y:spec.y,label:RESOURCE_SITES[spec.kind].label}};add(m,resourceMeshes);m.freezeWorldMatrix();return m;}
 function updateResourceSites(s){
  const next=JSON.stringify([s.world?.deposits,s.world?.lakes,s.buildings.map(b=>[b.type,b.x,b.y])]);if(next===resourceSignature)return;resourceSignature=next;selectionSignature='';remove(resourceMeshes);
  for(const d of s.world?.deposits||[]){if(!RESOURCE_SITES[d.kind]||terrain(d.x,d.y,s)==='water')continue;const X=d.x*TILE,Z=d.y*TILE,Y=surfaceElevation(d.x,d.y,s),occupied=s.buildings.some(b=>b.x===d.x&&b.y===d.y);
   const patch=instanceResource(resourceModels.get(d.kind),`resource-site-${d.kind}-${d.x}-${d.y}`,X,Y+.045,Z,[1,1,1],d);patch.setEnabled(false);
   const label=labelModels.get(d.kind);if(label){const m=label.clone(`resource-name-${d.kind}-${d.x}-${d.y}`);m.setEnabled(true);m.position.set(X,Y+1.65,Z+2.3);m.billboardMode=B.Mesh.BILLBOARDMODE_ALL;m.metadata={resourceSite:{...d,label:RESOURCE_SITES[d.kind].label}};add(m,resourceMeshes);m.receiveShadows=false;}
   if(occupied)continue;
   if(['clay','stone'].includes(d.kind))for(let i=0;i<5;i++)instanceResource(d.kind==='clay'?claySource:stoneSource,`deposit-${d.kind}-pile`,X+Math.sin(i*2.4)*1.3,Y+.25+i*.03,Z+Math.cos(i*2.4)*1.1,[.55+i*.06,.25+i*.07,.65],d);
   if(d.kind==='reed')for(let i=0;i<15;i++){const h=1.2+(i%5)*.25;instanceResource(reedSource,'deposit-reed-bed',X+Math.sin(i*2.4)*1.6,Y+h/2,Z+Math.cos(i*2.4)*1.6,[1,h,1],d);}
   if(d.kind==='wildlife')for(let i=0;i<6;i++)instanceResource(hoofSource,'deposit-wildlife-track',X+(i%2)*.33-.16,Y+.07,Z+(i/2-1.5)*.6,[.13,.055,.23],d);
  }
 }
 const selectionMaterial=material('resource-placement-highlight','#d9ee8b');selectionMaterial.emissiveColor=color(.25,.32,.08);selectionMaterial.alpha=.8;
 const selectionSource=source('resource-highlight-source',()=>B.MeshBuilder.CreateTorus('site-placement-ring',{diameter:5.25,thickness:.09,tessellation:24},scene),selectionMaterial);
 function updateSelection(s,selection){const type=typeof selection==='string'?selection:null,key=`${type}|${resourceSignature}`;if(key===selectionSignature)return;selectionSignature=key;remove(selectionMeshes);
  for(const m of resourceMeshes)if(m.name.startsWith('resource-site-'))m.setEnabled(!!RESOURCE_BUILDINGS[type]&&m.metadata.resourceSite.kind===RESOURCE_BUILDINGS[type]);
  for(const p of resourcePlacementSites(s,type)){const m=selectionSource.createInstance(`resource-placement-${type}-${p.x}-${p.y}`);m.setEnabled(true);m.position.set(p.x*TILE,surfaceElevation(p.x,p.y,s)+.16,p.y*TILE);m.metadata={resourcePlacement:{type,x:p.x,y:p.y}};add(m,selectionMeshes);m.freezeWorldMatrix();}
 }
 function rebuildGeometry(s,plan){
  remove(staticMeshes);
  for(const r of plan.roads){if(shoreDistance((r.a.x+r.b.x)/2,(r.a.y+r.b.y)/2,s)<.08)continue;const mat=r.level>=3?paving:r.level===2?gravel:earth;
   strip(`road-${r.id}-level-${r.level}`,r.a,r.b,1.12,.04,mat);
   if(r.target){const end={x:r.a.x+(r.b.x-r.a.x)*r.progress,y:r.a.y+(r.b.y-r.a.y)*r.progress};strip(`road-upgrade-${r.id}`,r.a,end,.8,.075,r.target===3?paving:gravel);for(const t of [.1,.9])box('road-work-materials',(r.a.x+(r.b.x-r.a.x)*t)*TILE,.21,(r.a.y+(r.b.y-r.a.y)*t)*TILE+.9,.45,.35,.5,work);}
  }
  for(const c of plan.canals){const arms=c.arms.length?c.arms:[[1,0],[-1,0]];for(const [dx,dy]of arms){const a={x:c.x,y:c.y},b={x:c.x+dx*.5*c.progress,y:c.y+dy*.5*c.progress};strip('actual-canal-bank',a,b,1.36,.065,bank);strip('actual-canal-bed',a,b,.88,.09,channel);if(c.wet)strip('actual-canal-water',a,b,.63,.115,canalWater);
    // A real road intersecting the channel receives a small original plank crossing.
    const mid={x:c.x+dx*.5,y:c.y+dy*.5};if(plan.roads.some(r=>pointDistance(mid,r.a,r.b)<.09))for(const offset of [-.22,0,.22]){const center={x:mid.x+dx*offset/TILE,y:mid.y+dy*offset/TILE};strip('canal-road-crossing',{x:center.x-dy*.13,y:center.y+dx*.13},{x:center.x+dy*.13,y:center.y-dx*.13},.19,.18,materials.wood);}
   }}
  const nextPalms=JSON.stringify(plan.palms.map(p=>[p.id,p.x,p.y]));
  if(nextPalms!==palmsSignature){palmsSignature=nextPalms;remove(palmInstances);for(const p of plan.palms){const scale=p.resource?.55:.75+(p.id%7)*.045;for(const src of palmSources){const m=src.createInstance(`date-palm-${p.id}-${src.name}`);m.setEnabled(true);m.position.set(p.x*TILE,surfaceElevation(p.x,p.y,s),p.y*TILE);m.scaling.setAll(scale);m.rotation.y=p.resource?(p.x+p.y)*2.399:p.id*2.399;m.overrideMaterialSideOrientation=B.Material.ClockWiseSideOrientation;m.computeWorldMatrix(true);m.freezeWorldMatrix();add(m,palmInstances);}}}
 }
 function sack(name,x,y,z,mat,collection,parent){const m=B.MeshBuilder.CreateSphere(name,{diameter:.62,segments:6},scene);m.position.set(x,y,z);m.scaling.set(1,.8,.8);m.material=mat;m.parent=parent||null;return add(m,collection);}
 function cargo(stock,collection,parent,origin={x:0,y:0,z:0}){let i=0;for(const [kind,amount]of Object.entries(stock||{})){if(amount<=0)continue;for(let j=0;j<Math.min(3,Math.ceil(amount/50));j++){sack(`cargo-${kind}`,origin.x+(i%3-1)*.7,origin.y+.23+j*.34,origin.z+Math.floor(i/3)*.55,['stone','clay','wood','reed'].includes(kind)?materials[kind==='clay'?'terracotta':kind]:materials.reed,collection,parent);}if(++i===9)break;}}
 function updateStocks(s){const stocks=groundStocks(s,streetNetwork),next=JSON.stringify(stocks);if(next===stockSignature)return;stockSignature=next;remove(stockMeshes);if(stocks)cargo(stocks.stock,stockMeshes,null,{x:stocks.x*TILE,y:.1,z:stocks.y*TILE});}
 function updateTrader(c,time){const next=JSON.stringify(c?[c.river,c.stock]:null);if(next!==traderSignature){traderSignature=next;remove(traderMeshes);traderRoot?.dispose();traderRoot=null;if(c){traderRoot=new B.TransformNode('actual-trade-caravan',scene);
    if(c.river){const hull=box('trade-reed-boat',0,.04,0,1.65,.42,5.2,materials.reed,traderMeshes);hull.parent=traderRoot;for(const side of [-1,1]){const bow=B.MeshBuilder.CreateSphere('boat-raised-bow',{diameter:1,segments:6},scene);bow.scaling.set(.7,.5,1.2);bow.position.set(0,.17,side*2.2);bow.material=materials.reed;bow.parent=traderRoot;add(bow,traderMeshes);}for(const x of [-.8,.8]){const rim=box('boat-gunwale',x,.36,0,.13,.35,4.5,materials.wood,traderMeshes);rim.parent=traderRoot;}cargo(c.stock,traderMeshes,traderRoot,{x:0,y:.4,z:-.7});
    }else{ // Original pack donkey and merchant, deliberately modest beside licensed residents.
     const body=box('caravan-pack-donkey',0,.91,0,.65,.65,1.35,materials.wood,traderMeshes);body.parent=traderRoot;for(const x of [-.23,.23])for(const z of [-.45,.45]){const leg=box('donkey-leg',x,.35,z,.15,.7,.15,materials.wood,traderMeshes);leg.parent=traderRoot;}const head=box('donkey-head',0,1.3,.8,.36,.5,.6,materials.wood,traderMeshes);head.parent=traderRoot;for(const x of [-.13,.13]){const ear=box('donkey-ear',x,1.72,.8,.11,.4,.12,materials.wood,traderMeshes);ear.parent=traderRoot;}cargo(c.stock,traderMeshes,traderRoot,{x:0,y:1.25,z:-.6});const person=box('trade-merchant',1.1,.85,.1,.52,1.5,.4,materials.linen,traderMeshes);person.parent=traderRoot;sack('merchant-head',1.1,1.8,.1,materials.terracotta,traderMeshes,traderRoot);
    }}}
  if(!c||!traderRoot)return;traderRoot.position.set(c.x*TILE,c.river?-.08+Math.sin(time*1.7)*.025:surfaceElevation(c.x,c.y,currentState),c.y*TILE);const target=c.route[c.routeIndex];if(target&&Math.hypot(target.x-c.x,target.y-c.y)>.01)traderRoot.rotation.y=Math.atan2(target.x-c.x,target.y-c.y);
 }
 const drops=[];for(let i=0;i<90;i++){const m=box('weather-rain',0,0,0,.018,.8,.018,rainMaterial, drops);m.receiveShadows=false;m.setEnabled(false);}
 let weatherSignature='';
 function updateWeather(s,time){const weather=weatherAt(s),rain=weather.type==='rain',wind=weather.type==='wind',key=`${s.season}|${!!s.drought}|${rain}`;
  if(key!==weatherSignature){weatherSignature=key;const dry=s.drought>0,summer=s.season===1;const soil=materials.soil,grass=materials.grass;
   soil.albedoColor=color(rain?.82:.94,rain?.76:.86,rain?.62:.71);grass.albedoColor=dry?color(.83,.72,.42):summer?color(.8,.79,.5):color(.71,.87,.52);
   for(const m of base?.meshes||[])if(m.name==='soft-riparian-grass'&&m.material)m.material.albedoColor=grass.albedoColor.clone();
  }
  for(let i=0;i<drops.length;i++){const m=drops[i];m.setEnabled(rain);if(rain){const h=((i*.618+time*1.6)%1)*20;m.position.set(((i*53.71+time*3)% (WIDTH*TILE)),20-h,((i*37.29)% (HEIGHT*TILE)));m.rotation.z=.16;}}
  // Wind moves only shared source foliage instances, with no allocation or save edits.
  for(let i=0;i<palmInstances.length;i++){const m=palmInstances[i];if(!wind&&m.rotation.z===0)continue;m.unfreezeWorldMatrix();m.rotation.z=wind?Math.sin(time*1.7+Math.floor(i/palmSources.length))*.008:0;m.computeWorldMatrix(true);if(!wind)m.freezeWorldMatrix();}
 }
 function update(s,time=0,selection=null){if(disposed)return;currentState=s;rebuildBase(s);const next=landscapeSignature(s);if(next!==signature){signature=next;streetNetwork=generateStreets([...(s.buildings||[]),...(s.roadAnchors||[])],s);rebuildGeometry(s,landscapePlan(s));weatherSignature='';}base.light(night);base.update(s,time);for(const m of base.meshes){if(m.name==='connected-earth-streets')m.setEnabled(false);if(!meshes.includes(m))meshes.push(m);} // Terrain's road owner can replace its hidden batch.
  for(let i=meshes.length-1;i>=0;i--)if(meshes[i].isDisposed?.())meshes.splice(i,1);
  updateResourceSites(s);updateSelection(s,selection);updateStocks(s);const c=s.trade?.caravan;updateTrader(c&&Number.isFinite(c.x)&&Number.isFinite(c.y)?{...c,river:c.transport==='river',route:c.route||[],routeIndex:c.routeIndex||0}:null,time);updateWeather(s,time);
 }
 let night=0,currentState=initialState;update(initialState,initialState.simTime||0);
 return {meshes,update,light(n){night=n;base?.light(n);canalWater.albedoColor=color(.28*(1-n*.6),.5*(1-n*.55),.47*(1-n*.4));},dispose(){if(disposed)return;disposed=true;base?.dispose();for(const m of [...meshes])if(!m.isDisposed?.())m.dispose();meshes.length=0;traderRoot?.dispose();palmContainer?.dispose();for(const m of ownedMaterials)m.dispose(false,false);for(const t of ownedTextures)t.dispose();}};
}
