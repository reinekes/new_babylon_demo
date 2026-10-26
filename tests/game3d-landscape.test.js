import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameLandscape, landscapePlan, landscapeSignature, resourcePlacementSites} from '../game3d/landscape.js';
import {createGame} from '../engine.js';
import {terrain} from '../world.js';

test('landscape derives actual canal water, arms and construction without changing city state',()=>{
 const s=createGame({start:'established'});s.buildings=[];s.roads=[];
 let x=0;while(terrain(x,8)==='water'||terrain(x+1,8)!=='water')x++;
 s.buildings=[{type:'canal',x,y:8,level:1},{type:'canal',x:x-1,y:8,level:1},{type:'canal',x:2,y:2,construction:{kind:'new',target:1,required:{clay:4},delivered:{clay:2},remaining:{clay:2},work:0}}];
 const before=JSON.stringify(s),plan=landscapePlan(s);
 assert.equal(plan.canals.find(c=>c.x===x&&c.y===8).wet,true);
 assert.equal(plan.canals.find(c=>c.x===x-1&&c.y===8).wet,true);
 assert.ok(plan.canals.find(c=>c.x===x&&c.y===8).arms.some(([dx,dy])=>dx===1&&dy===0));
 assert.ok(plan.canals.find(c=>c.x===x&&c.y===8).arms.some(([dx,dy])=>dx===-1&&dy===0));
 assert.equal(plan.canals.find(c=>c.x===2).wet,false);
 assert.equal(plan.canals.find(c=>c.x===2).progress,.2);
 assert.equal(JSON.stringify(s),before);
});
test('roads retain real endpoints, level and staged upgrade; unchanged state retains signature',()=>{
 const s=createGame({start:'established'});s.roads=[{id:'test',a:{x:2.5,y:4.5},b:{x:3.5,y:4.5},level:2,construction:{kind:'upgrade',target:3,required:{stone:2},delivered:{stone:2},remaining:{stone:0},work:9}}];
 const before=JSON.stringify(s),plan=landscapePlan(s),road=plan.roads.find(r=>r.id==='test');
 assert.deepEqual(road.a,{x:2.5,y:4.5});assert.deepEqual(road.b,{x:3.5,y:4.5});assert.equal(road.level,2);assert.equal(road.target,3);assert.ok(road.progress>.4);
 const signature=landscapeSignature(s);s.simTime+=1;assert.equal(landscapeSignature(s),signature);s.roads[0].level=3;assert.notEqual(landscapeSignature(s),signature);
 s.simTime-=1;s.roads[0].level=2;assert.equal(JSON.stringify(s),before);
});
test('palms are deterministic dry cells clear of buildings; caravan follows its actual coordinates and stocks',()=>{
 const s=createGame({start:'established'}),before=JSON.stringify(s),a=landscapePlan(s),b=landscapePlan(s);assert.deepEqual(a.palms,b.palms);assert.ok(a.palms.length);
 for(const p of a.palms){assert.notEqual(terrain(Math.round(p.x),Math.round(p.y),s),'water');assert.ok(!s.buildings.some(b=>Math.abs(b.x-p.x)<.7&&Math.abs(b.y-p.y)<.7));}
 assert.equal(JSON.stringify(s),before);
 s.trade.caravan={x:12.6,y:8.1,transport:'river',stock:{food:30}};const c=landscapePlan(s).caravan;assert.equal(c.x,12.6);assert.equal(c.y,8.1);assert.equal(c.river,true);assert.equal(c.stock.food,30);
 s.trade.caravan.x=null;assert.equal(landscapePlan(s).caravan,null);
});

import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const sandbox={console,setTimeout,clearTimeout,performance,window:{addEventListener(){},removeEventListener(){}},navigator:{userAgent:'node'}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.BABYLON;
function loadGeometry(scene,file='date-palm.glb'){
 const bytes=readFileSync(new URL(`../assets/art-courtyard/models/${file}`,import.meta.url));
 const jsonSize=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+jsonSize)),binary=bytes.subarray(28+jsonSize);
 const container=new B.AssetContainer(scene),root=new B.TransformNode('gltf-reflection',scene);root.scaling.z=-1;container.transformNodes.push(root);
 const mats=g.materials.map(m=>new B.PBRMaterial(m.name,scene));container.materials.push(...mats);
 function data(i){
  const a=g.accessors[i],view=g.bufferViews[a.bufferView],n=({SCALAR:1,VEC2:2,VEC3:3,VEC4:4})[a.type],offset=(view.byteOffset||0)+(a.byteOffset||0),size=({5126:4,5125:4,5123:2,5121:1})[a.componentType],out=[];
  for(let k=0;k<a.count;k++)for(let j=0;j<n;j++){
   const p=offset+k*(view.byteStride||n*size)+j*size;
   out.push(a.componentType===5126?binary.readFloatLE(p):a.componentType===5125?binary.readUInt32LE(p):a.componentType===5123?binary.readUInt16LE(p):binary.readUInt8(p));
  }return out;
 }
 for(const node of g.nodes){
  if(node.mesh===undefined)continue;
  for(const p of g.meshes[node.mesh].primitives){
   const mesh=new B.Mesh(node.name,scene),v=new B.VertexData();v.positions=data(p.attributes.POSITION);v.normals=data(p.attributes.NORMAL);v.indices=data(p.indices);if(p.attributes.TEXCOORD_0!==undefined)v.uvs=data(p.attributes.TEXCOORD_0);v.applyToMesh(mesh);
   mesh.position.set(...(node.translation||[0,0,0]));mesh.scaling.set(...(node.scale||[1,1,1]));if(node.rotation)mesh.rotationQuaternion=new B.Quaternion(...node.rotation);
   mesh.parent=root;mesh.material=mats[p.material];container.meshes.push(mesh);
  }
 }container.removeAllFromScene();return container;
}

test('real GLB palms share baked geometry; canals, road work and trade update a live mesh list read-only',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),materials=Object.fromEntries(['soil','grass','wood','stone','terracotta','reed','linen'].map(k=>[k,new B.PBRMaterial(k,scene)]));
 const original=B.SceneLoader.LoadAssetContainerAsync;let loads=0;
 B.SceneLoader.LoadAssetContainerAsync=async(root,file)=>{loads++;file=file.split('?')[0];assert.equal(root,'assets/art-courtyard/models/');assert.match(file,/^(?:valley-(?:dry-grass-[123]|reed-[123]|date-palm)|miracle-green-grass-[123]|caravan-(?:merchant|camel)|river-cargo-boat)\.glb$/);return loadGeometry(scene,file);};
 let view;const s=createGame({start:'established'});s.roads=[{id:'local',a:{x:2.5,y:4.5},b:{x:3.5,y:4.5},level:2}];
 let canalX=0;while(terrain(canalX,8)==='water'||terrain(canalX+1,8)!=='water')canalX++;
 s.buildings.push({type:'canal',x:canalX,y:8,level:1});
 s.trade.caravan={x:12.6,y:8.1,transport:'river',stock:{food:30},route:[],routeIndex:0};
 const before=JSON.stringify(s);
 try{
  view=await createGameLandscape(B,scene,s,materials);const live=view.meshes;assert.equal(loads,12);assert.equal(JSON.stringify(s),before);
  assert.ok(live.some(m=>m.name.startsWith('valley-grass-')&&m.sourceMesh));assert.ok(live.some(m=>m.name.startsWith('valley-reed-')&&m.sourceMesh));assert.ok(!live.some(m=>['volumetric-riparian-colonies','deposit-reed-bed'].includes(m.name)),'imported plants replace old grass ribbons and reed cylinders');
  for(const name of ['date-palm-trunks','date-palm-crowns','connected-earth-streets','living-river','saved-lakes'])for(const m of live.filter(m=>m.name===name))assert.equal(m.isEnabled(),false);
  const palms=live.filter(m=>m.name.startsWith('date-palm-')&&m.sourceMesh);assert.ok(palms.length);assert.ok(palms.every(m=>m.isEnabled()));assert.ok(new Set(palms.map(m=>m.sourceMesh)).size<palms.length);
  for(const m of palms){assert.equal(m.overrideMaterialSideOrientation??null,m.sourceMesh.metadata?.nativeDates?null:B.Material.CounterClockWiseSideOrientation);assert.ok(m.getWorldMatrix().determinant()>0);}
  const waters=live.filter(m=>m.name==='actual-canal-water');assert.ok(waters.length);assert.ok(waters.every(m=>m.metadata.canalArm.a.x===canalX&&m.metadata.canalArm.a.y===8));assert.ok(waters.some(m=>m.metadata.canalArm.mouth));assert.ok(waters.some(m=>m.getVerticesData(B.VertexBuffer.ColorKind).some((v,i)=>i%4===2&&v>.9)),'wet canals use a visible canal-water tint');
  for(const m of live.filter(m=>m.metadata?.canalArm&&m.name!=='actual-canal-water')){assert.equal(m.material.name,'game-wet-channel-mud');const c=m.material.albedoColor;assert.ok(c.r<.5&&c.g<.5&&c.b<.5,'wet mud remains darker than the bank');assert.equal(m.material.albedoTexture,materials.soil.albedoTexture||null,'wet banks share the available ground texture');}
  const patches=live.filter(m=>m.name.startsWith('resource-site-'));assert.equal(patches.length,s.world.deposits.length);assert.ok(patches.every(m=>!m.isEnabled()),'ordinary city view has no deposit tile squares');
  for(const m of patches){const d=m.metadata.resourceSite;assert.equal(m.position.x,d.x*6);assert.equal(m.position.z,d.y*6);assert.ok(s.world.deposits.some(p=>p.kind===d.kind&&p.x===d.x&&p.y===d.y));}
  const firstPatch=patches[0];view.update(s,0,'clay');assert.ok(patches.every(m=>m.isEnabled()===(m.metadata.resourceSite.kind==='clay')));const highlights=live.filter(m=>m.metadata?.resourcePlacement);assert.ok(highlights.length);assert.ok(highlights.every(m=>m.metadata.resourcePlacement.type==='clay'));const marker=highlights[0];view.update(s,0,'clay');assert.ok(live.includes(marker),'unchanged selection shares its cached highlight instances');assert.ok(live.includes(firstPatch),'selection does not rebuild resource geology');
  view.update(s,0,'house');assert.ok(patches.every(m=>!m.isEnabled()));assert.equal(marker.isDisposed(),true);assert.equal(live.filter(m=>m.metadata?.resourcePlacement).length,0);view.update(s,0,'shrine');assert.equal(live.filter(m=>m.metadata?.resourcePlacement).length,0);assert.equal(JSON.stringify(s),before);
  const street=live.find(m=>m.name==='road-local-level-2');assert.equal(street.position.x,18);assert.equal(street.position.z,27);assert.equal(street.material.name,'game-road-clay-gravel');assert.ok(street.getTotalVertices()>30);assert.equal(street.hasVertexAlpha,true);
  const clear=live.find(m=>m.name==='clear-living-river');assert.ok(clear);assert.equal(clear.material.needAlphaBlending(),true);assert.equal(clear.material.disableDepthWrite,true);assert.ok(live.some(m=>m.name==='clear-river-bed'));assert.ok(live.some(m=>m.name.startsWith('submerged-pebble-')&&m.sourceMesh));assert.ok(!live.some(m=>/resource-name|resource-label/.test(m.name)));
  const valley=live.find(m=>m.name==='alluvial-valley'),positions=valley.getVerticesData(B.VertexBuffer.PositionKind);assert.ok(positions.some((v,i)=>i%3===1&&Math.abs(positions[i-1]-canalX*6)<.01&&Math.abs(positions[i+1]-48)<.01&&v<0),'real canal cuts a shallow inlet in this main-game terrain copy');
  const lake=s.world.lakes[0],cell=lake.cells.find(c=>lake.cells.some(n=>n.x===c.x+1&&n.y===c.y)),seamX=(cell.x+.5)*6,seamZ=cell.y*6,seam=positions.findIndex((v,i)=>i%3===0&&Math.abs(v-seamX)<1e-8&&Math.abs(positions[i+2]-seamZ)<1e-8);assert.ok(seam>=0);assert.ok(positions[seam+1]<-.85,'the physical lake basin has no raised ridge at a saved tile boundary');assert.ok(live.some(m=>m.name==='organic-lake-soft-banks'));
  const palm=palms[0],root=scene.getTransformNodeByName('actual-trade-caravan');assert.equal(root.position.x,75.6);assert.ok(Math.abs(root.position.z-48.6)<1e-9);assert.ok(live.some(m=>m.name==='cargo-food'));
  s.rain=1;view.update(s,0);assert.ok(live.some(m=>m.name==='weather-rain'&&m.isEnabled()));s.rain=0;view.update(s,0);
  const count=scene.meshes.length;view.update(s,1);view.update(s,2);assert.equal(scene.meshes.length,count);assert.ok(live.includes(palm));assert.equal(JSON.stringify(s),before);
  s.trade.caravan.x=14;view.update(s,3);assert.equal(root.position.x,84);assert.equal(view.meshes,live);assert.equal(scene.meshes.length,count);
  s.roads[0].level=3;view.update(s,4);assert.equal(street.isDisposed(),true);assert.ok(live.some(m=>m.name==='road-local-level-3'));assert.ok(live.includes(palm),'road upgrade does not recreate licensed palms');
  s.trade.caravan=null;view.update(s,5);assert.equal(root.isDisposed(),true);assert.ok(!live.some(m=>m.name==='trade-reed-boat'));
  s.world.deposits.pop();view.update(s,6);assert.equal(firstPatch.isDisposed(),true);assert.equal(live.filter(m=>m.name.startsWith('resource-site-')).length,s.world.deposits.length);
  view.dispose();assert.equal(live.length,0);assert.equal(scene.meshes.length,0);
 }finally{B.SceneLoader.LoadAssetContainerAsync=original;view?.dispose();scene.dispose();engine.dispose();}
});

test('deposit plans use saved coordinates/kinds and resource selections examine only matching local sites',()=>{
 const s=createGame({start:'established'});s.buildings=[];s.world.deposits=[{kind:'clay',x:2,y:3},{kind:'stone',x:3,y:4},{kind:'forest',x:6,y:6},{kind:'wildlife',x:28,y:17},{kind:'dates',x:20,y:6},{kind:'reed',x:4,y:4}];
 const before=JSON.stringify(s),signature=landscapeSignature(s),plan=landscapePlan(s);
 assert.deepEqual(plan.deposits,s.world.deposits);assert.equal(JSON.stringify(s),before);
 assert.deepEqual(resourcePlacementSites(s,'clay'),[{x:2,y:3}]);assert.deepEqual(resourcePlacementSites(s,'quarry'),[{x:3,y:4}]);assert.deepEqual(resourcePlacementSites(s,'garden'),[{x:20,y:6}]);
 assert.equal(resourcePlacementSites(s,'logging').length,13);assert.equal(resourcePlacementSites(s,'hunting').length,13);
 assert.deepEqual(resourcePlacementSites(s,'house'),[]);assert.deepEqual(resourcePlacementSites(s,'shrine'),[]);assert.deepEqual(resourcePlacementSites(s,null),[]);
 const guarded={get world(){throw Error('ordinary buildings must not scan deposits');},get buildings(){throw Error('ordinary buildings must not scan the city');}};assert.deepEqual(resourcePlacementSites(guarded,'house'),[]);assert.deepEqual(resourcePlacementSites(guarded,'shrine'),[]);
 s.buildings.push({type:'house',x:2,y:3});assert.deepEqual(resourcePlacementSites(s,'clay'),[]);s.buildings=[];
 s.world.deposits[0].x++;assert.notEqual(landscapeSignature(s),signature);s.world.deposits[0].x--;assert.equal(JSON.stringify(s),before);
});

test('main landscape never creates deposit text labels or dynamic text textures',()=>{
 const source=readFileSync(new URL('../game3d/landscape.js',import.meta.url),'utf8');
 assert.ok(!source.includes('DynamicTexture'));assert.ok(!source.includes('fillText('));assert.ok(!source.includes('resource-name-'));assert.ok(!source.includes('resource-label-'));
});

import {floodplainTufts,tuftGeometry,riverbankGeometry,rectangularSiteGeometry} from '../game3d/nature.js';
import {lakeDistance} from '../game3d/lake-shore.js';
import {shoreDistance,surfaceElevation,TILE} from '../district3d/terrain.js';
test('volumetric floodplain colonies preserve dry open ground, foundations and real roads',()=>{
 const s=createGame({start:'established'}),plan=landscapePlan(s),before=JSON.stringify(s),a=floodplainTufts(s,plan.roads);
 assert.deepEqual(a,floodplainTufts(s,plan.roads));assert.ok(a.length>250);assert.ok(a.length<4000);
 assert.ok(a.some(p=>p.kind==='reed'));assert.ok(a.some(p=>p.kind==='grass'));
 for(const p of a){assert.ok(shoreDistance(p.x,p.y,s)>=.23||(p.kind==='reed'&&lakeDistance(p.x,p.y,s)>=.07));assert.ok(!s.buildings.some(b=>Math.abs(b.x-p.x)<.79&&Math.abs(b.y-p.y)<.79));
  for(const r of plan.roads){const dx=r.b.x-r.a.x,dy=r.b.y-r.a.y,t=Math.max(0,Math.min(1,((p.x-r.a.x)*dx+(p.y-r.a.y)*dy)/(dx*dx+dy*dy||1)));assert.ok(Math.hypot(p.x-r.a.x-dx*t,p.y-r.a.y-dy*t)>.29);}}
 const g=tuftGeometry(s,a);assert.ok(g.positions.length>10000);assert.ok(g.positions.length<180000);assert.equal(g.colors.length,g.positions.length/3*4);assert.equal(g.uvs.length,g.positions.length/3*2);assert.ok(g.positions.every(Number.isFinite));
 assert.ok(g.positions.some((v,i)=>i%3===1&&v>.7),'grass has real height and bent upright leaves');assert.equal(JSON.stringify(s),before);
});
test('shore margin has irregular width and lies directly on the canonical physical bank',()=>{
 const s=createGame({start:'established'}),before=JSON.stringify(s),g=riverbankGeometry(s),widths=[];assert.equal(g.colors.length,g.positions.length/3*4);
 for(let i=0;i<g.positions.length;i+=3){const x=g.positions[i]/TILE,y=g.positions[i+2]/TILE;assert.ok(Math.abs(g.positions[i+1]-surfaceElevation(x,y,s)-.024)<1e-9);if(i%(7*3)===18)widths.push(shoreDistance(x,y,s));}
 assert.ok(new Set(widths.map(v=>v.toFixed(3))).size>40);assert.ok(g.colors.some((v,i)=>i%4===3&&v===0));assert.equal(JSON.stringify(s),before);
});
test('resource placement uses four straight rectangular edges with no circular footprint',()=>{
 const g=rectangularSiteGeometry();assert.equal(g.positions.length,48);assert.equal(g.indices.length,24);
 const xs=g.positions.filter((_,i)=>i%3===0),zs=g.positions.filter((_,i)=>i%3===2);assert.ok(Math.max(...xs)>2.6&&Math.max(...zs)>2.6);assert.ok(g.positions.filter((_,i)=>i%3===1).every(v=>v===0));
});

test('real gathering tree falls at saved target, leaves a stump and recovers without new geometry or save edits',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),materials=Object.fromEntries(['soil','grass','wood','stone','terracotta','reed','linen'].map(k=>[k,new B.PBRMaterial(k,scene)]));
 const original=B.SceneLoader.LoadAssetContainerAsync;B.SceneLoader.LoadAssetContainerAsync=async(root,file)=>loadGeometry(scene,file);let view;
 const s=createGame({start:'established'});s.gathering={features:[{id:'tree:test:0',kind:'tree',x:4,y:5,health:1,felledAt:null,recoverAt:null},{id:'rock:test:0',kind:'rock',x:5,y:5,health:1,felledAt:null,recoverAt:null}],jobs:[],kills:[]};
 try{const before=JSON.stringify(s);view=await createGameLandscape(B,scene,s,materials);const tree=scene.getTransformNodeByName('gathering-feature-tree:test:0'),parts=view.meshes.filter(m=>m.name.startsWith('working-tree-')),stump=view.meshes.find(m=>m.name==='felled-tree-stump-tree:test:0'),rock=view.meshes.find(m=>m.name==='working-rock-rock:test:0');
  assert.equal(tree.position.x,24);assert.equal(tree.position.z,30);assert.ok(parts.length);assert.equal(stump.isEnabled(),false);assert.equal(JSON.stringify(s),before);const count=scene.meshes.length;
  for(const m of parts){assert.equal(m.overrideMaterialSideOrientation??null,m.sourceMesh.metadata?.nativeDates?null:B.Material.CounterClockWiseSideOrientation);m.computeWorldMatrix(true);assert.ok(m.getWorldMatrix().determinant()>0);}
  s.gathering.features[0].health=0;s.gathering.features[0].felledAt=1;s.gathering.features[0].recoverAt=121;s.gathering.features[1].health=.2;
  const fallen=JSON.stringify(s);view.update(s,1.4);assert.ok(tree.rotation.z<-.5);assert.equal(stump.isEnabled(),true);assert.ok(parts.every(m=>m.isEnabled()));assert.ok(rock.scaling.y<.4);assert.equal(scene.meshes.length,count);assert.equal(JSON.stringify(s),fallen);
  view.update(s,15);assert.ok(parts.every(m=>!m.isEnabled()));assert.equal(stump.isEnabled(),true);assert.equal(scene.meshes.length,count);
  s.gathering.features[0].health=1;s.gathering.features[0].felledAt=null;s.gathering.features[0].recoverAt=null;view.update(s,121);assert.equal(tree.rotation.z,0);assert.equal(stump.isEnabled(),false);assert.ok(parts.every(m=>m.isEnabled()));assert.equal(scene.meshes.length,count);
  s.gathering.features=[];view.update(s,122);assert.equal(tree.isDisposed(),true);assert.equal(stump.isDisposed(),true);view.dispose();assert.equal(scene.meshes.length,0);
 }finally{B.SceneLoader.LoadAssetContainerAsync=original;view?.dispose();scene.dispose();engine.dispose();}
});

import {cargoLayout,createGoodsSources,GOODS_HEIGHT,GOODS_KINDS} from '../game3d/goods.js';
import {groundStocks} from '../game3d/landscape.js';
import {generateStreets} from '../city-life.js';
test('goods are detailed shared rectangular geometry resting on exact support planes',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),materials=Object.fromEntries(['wood','stone','terracotta','reed','linen'].map(k=>[k,new B.PBRMaterial(k,scene)]));
 try{const goods=createGoodsSources(B,scene,materials),stock=Object.fromEntries(GOODS_KINDS.map(k=>[k,150])),before=JSON.stringify(stock),layout=cargoLayout(stock);
  assert.equal(layout.length,GOODS_KINDS.length*3);assert.equal(JSON.stringify(stock),before);assert.deepEqual(cargoLayout({faith:100,prestige:100}),[]);
  for(const [kind,src]of goods.sources){src.computeWorldMatrix(true);const bounds=src.getBoundingInfo().boundingBox;
   assert.ok(Math.abs(bounds.minimum.y)<1e-6,`${kind} bottom rests on ground`);assert.ok(bounds.maximum.y<=GOODS_HEIGHT+1e-6);assert.ok(src.getTotalVertices()>24,`${kind} includes physical details`);assert.equal(src.isEnabled(),false);
   if(!['milk','water','beer','pottery'].includes(kind)){assert.ok(bounds.maximum.x-bounds.minimum.x>.6);assert.ok(bounds.maximum.z-bounds.minimum.z>.5);assert.ok(src.getIndices().length%36===0,`${kind} consists of straight rectangular goods, never round sacks`);}
   const parcel=src.createInstance('support-test');parcel.setEnabled(true);
   for(const p of layout.filter(p=>p.kind===kind)){parcel.position.set(p.x,p.y,p.z);parcel.computeWorldMatrix(true);const b=parcel.getBoundingInfo().boundingBox;assert.ok(Math.abs(b.minimumWorld.y-p.layer*GOODS_HEIGHT)<1e-6);if(p.layer)assert.ok(layout.some(q=>q.kind===kind&&q.x===p.x&&q.z===p.z&&q.layer===p.layer-1));}
   assert.equal(parcel.sourceMesh,src);parcel.dispose();
  }
  for(const src of goods.meshes)src.dispose();assert.equal(scene.meshes.length,0);
 }finally{scene.dispose();engine.dispose();}
});
test('ground stock yard avoids real roads and building footprints without editing quantities',()=>{
 const s=createGame({start:'established'}),net=generateStreets(s.buildings,s),before=JSON.stringify(s),yard=groundStocks(s,net);assert.ok(yard);assert.equal(JSON.stringify(s),before);
 assert.ok(shoreDistance(yard.x,yard.y,s)>=.55);
 for(const b of s.buildings)assert.ok(Math.abs(b.x-yard.x)>=.85||Math.abs(b.y-yard.y)>=.95);
 for(const [a,b]of net.edges){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((yard.x-a.x)*dx+(yard.y-a.y)*dy)/(dx*dx+dy*dy||1)));assert.ok(Math.hypot(yard.x-a.x-dx*t,yard.y-a.y-dy*t)>=.6);}
 const quantities=JSON.stringify(yard.stock);cargoLayout(yard.stock);assert.equal(JSON.stringify(yard.stock),quantities);assert.equal(JSON.stringify(s),before);
});
test('changing actual stock recreates only display instances and disposes old piles',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),materials=Object.fromEntries(['soil','grass','wood','stone','terracotta','reed','linen'].map(k=>[k,new B.PBRMaterial(k,scene)])),original=B.SceneLoader.LoadAssetContainerAsync;
 B.SceneLoader.LoadAssetContainerAsync=async(root,file)=>loadGeometry(scene,file);let view;
 try{const s=createGame({start:'established'});view=await createGameLandscape(B,scene,s,materials);const old=view.meshes.filter(m=>m.metadata?.goods&&!m.parent);assert.ok(old.length);for(const m of old){m.computeWorldMatrix(true);const b=m.getBoundingInfo().boundingBox;assert.ok(Math.abs(b.minimumWorld.y-m.metadata.goods.supportY)<1e-6);if(!m.metadata.goods.layer)assert.ok(Math.abs(b.minimumWorld.y-surfaceElevation(m.position.x/TILE,m.position.z/TILE,s))<1e-6);}
  const src=old[0].sourceMesh,before=JSON.stringify(s);view.update(s,3);assert.equal(JSON.stringify(s),before);assert.ok(view.meshes.includes(old[0]));
  s.resources.food+=75;const changed=JSON.stringify(s);view.update(s,4);assert.equal(JSON.stringify(s),changed);assert.ok(old.every(m=>m.isDisposed()));assert.ok(view.meshes.some(m=>m.sourceMesh===src));assert.equal(src.isDisposed(),false);
  const sources=view.meshes.filter(m=>m.name.startsWith('goods-source-'));assert.equal(sources.length,GOODS_KINDS.length);view.dispose();assert.ok(sources.every(m=>m.isDisposed()));assert.equal(scene.meshes.length,0);
 }finally{B.SceneLoader.LoadAssetContainerAsync=original;view?.dispose();scene.dispose();engine.dispose();}
});

import {MATERIALS} from '../definitions.js';
test('ground display represents every actual material including clothing and raw/fired bricks',()=>{
 const stock=Object.fromEntries(MATERIALS.map(k=>[k,1000])),before=JSON.stringify(stock),layout=cargoLayout(stock);
 for(const kind of MATERIALS)assert.ok(layout.some(p=>p.kind===kind),kind);
 assert.equal(JSON.stringify(stock),before);
 const engine=new B.NullEngine(),scene=new B.Scene(engine),materials=Object.fromEntries(['soil','wood','stone','terracotta','reed','linen'].map(k=>[k,new B.PBRMaterial(k,scene)]));
 try{const goods=createGoodsSources(B,scene,materials);assert.equal(goods.sources.get('brick').material,materials.soil);assert.equal(goods.sources.get('firedBrick').material,materials.terracotta);assert.equal(goods.sources.get('clothing').material,materials.linen);
  assert.ok(goods.sources.get('clothing').getTotalVertices()>24);for(const key of ['brick','firedBrick'])assert.ok(goods.sources.get(key).getTotalVertices()>=120);
  for(const src of goods.meshes)src.dispose();assert.equal(scene.meshes.length,0);
 }finally{scene.dispose();engine.dispose();}
});

test('stock yard clears complete parcel bounds around actual palms and gathering trees, with cached search',()=>{
 const s=createGame({start:'established'}),net=generateStreets(s.buildings,s);let edgeReads=0;const edges=net.edges;Object.defineProperty(net,'edges',{get(){edgeReads++;return edges;}});
 const before=JSON.stringify(s),yard=groundStocks(s,net);assert.ok(yard);assert.ok(edgeReads>0);const coldReads=edgeReads;
 const clear=(yard,tree)=>Math.hypot(Math.max(Math.abs(tree.x-yard.x)-.26,0),Math.max(yard.y-.05-tree.y,tree.y-yard.y-.38,0));
 for(const tree of landscapePlan(s).palms)assert.ok(clear(yard,tree)>=.45);
 for(let i=0;i<20;i++){const next=groundStocks(s,net);assert.equal(next.x,yard.x);assert.equal(next.y,yard.y);}
 assert.equal(edgeReads,coldReads,'warm stock updates never search candidate roads');assert.equal(JSON.stringify(s),before);
 s.resources.food+=20;const changed=JSON.stringify(s),next=groundStocks(s,net);assert.equal(next.stock.food,yard.stock.food+20);assert.equal(edgeReads,coldReads);assert.equal(JSON.stringify(s),changed);
 s.gathering.features.push({id:'stock-yard-tree',kind:'tree',x:yard.x,y:yard.y,health:1,felledAt:null,recoverAt:null});const treesChanged=JSON.stringify(s),moved=groundStocks(s,net);assert.ok(moved);assert.ok(edgeReads>coldReads);assert.ok(clear(moved,s.gathering.features.at(-1))>=.45);assert.equal(JSON.stringify(s),treesChanged);
 const readAfterTree=edgeReads;s.world.deposits.push({kind:'dates',x:moved.x,y:moved.y});groundStocks(s,net);assert.ok(edgeReads>readAfterTree,'changed deposit palms invalidate the yard cache');
});

import {insideFootprint} from '../footprints.js';
import {sceneryClear} from '../game3d/nature.js';
test('expanded monument clears palms and tuft colonies across all four cells; legacy footprint stays small',()=>{
 const s=createGame({start:'established'}),z={type:'ziggurat',x:28,y:1,footprint:2,level:1};s.buildings.push(z);s.world.deposits.push({kind:'forest',x:29,y:2},{kind:'dates',x:28,y:2});const before=JSON.stringify(s),plan=landscapePlan(s);
 assert.ok(plan.palms.every(p=>!insideFootprint(z,p.x,p.y)),'both ambient and deposit palms clear the complete platform');
 assert.ok(!plan.palms.some(p=>p.id===109),'the reproducible palm on the formerly ignored corner is excluded');
 for(const p of floodplainTufts(s,plan.roads))assert.ok(!insideFootprint(z,p.x,p.y));
 assert.equal(sceneryClear(s,{x:29,y:2},.2),false);assert.equal(JSON.stringify(s),before);
 delete z.footprint;assert.equal(sceneryClear(s,{x:29,y:2},.2),true,'saved legacy monument does not reserve new neighbouring cells');
});
test('building a 2 by 2 platform hides overlapping gathering trees, stones and deposit fixtures then restores them on removal',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),materials=Object.fromEntries(['soil','grass','wood','stone','terracotta','reed','linen'].map(k=>[k,new B.PBRMaterial(k,scene)]));
 const original=B.SceneLoader.LoadAssetContainerAsync;B.SceneLoader.LoadAssetContainerAsync=async(root,file)=>loadGeometry(scene,file);let view;
 const s=createGame({start:'established'}),z={type:'ziggurat',x:28,y:1,footprint:2,level:1};s.world.deposits=[{kind:'stone',x:29,y:2},{kind:'reed',x:28,y:2},{kind:'forest',x:29,y:1}];s.gathering={features:[{id:'platform-tree',kind:'tree',x:29,y:2,health:1,felledAt:null,recoverAt:null},{id:'platform-rock',kind:'rock',x:28,y:2,health:1}],jobs:[],kills:[]};
 try{
  view=await createGameLandscape(B,scene,s,materials);assert.ok(scene.getTransformNodeByName('gathering-feature-platform-tree'));assert.ok(view.meshes.some(m=>m.name==='deposit-stone-pile'));
  s.buildings.push(z);const before=JSON.stringify(s);view.update(s,1);assert.equal(JSON.stringify(s),before);
  assert.equal(scene.getTransformNodeByName('gathering-feature-platform-tree'),null);assert.equal(scene.getTransformNodeByName('gathering-feature-platform-rock'),null);
  assert.ok(!view.meshes.some(m=>['deposit-stone-pile','deposit-reed-bed'].includes(m.name)));
  for(const m of view.meshes.filter(m=>m.name.startsWith('date-palm-')&&m.sourceMesh))assert.ok(!insideFootprint(z,m.position.x/6,m.position.z/6));
  const ground=view.meshes.find(m=>m.name==='soft-riparian-grass'),p=ground.getVerticesData(B.VertexBuffer.PositionKind),c=ground.getVerticesData(B.VertexBuffer.ColorKind);for(let i=0;i<p.length;i+=3)if(insideFootprint(z,p[i]/6,p[i+2]/6))assert.equal(c[i/3*4+3],0);
  s.buildings.pop();view.update(s,2);assert.ok(scene.getTransformNodeByName('gathering-feature-platform-tree'));assert.ok(view.meshes.some(m=>m.name==='deposit-stone-pile'));assert.equal(s.gathering.features[0].health,1);
 }finally{B.SceneLoader.LoadAssetContainerAsync=original;view?.dispose();scene.dispose();engine.dispose();}
});

test('missing imported palm files retain grounded procedural trunks and crowns, never floating fruit',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),materials=Object.fromEntries(['soil','grass','wood','stone','terracotta','reed','linen'].map(k=>[k,new B.PBRMaterial(k,scene)])),original=B.SceneLoader.LoadAssetContainerAsync;let view;
 B.SceneLoader.LoadAssetContainerAsync=async()=>{throw Error('optional asset offline');};
 try{const s=createGame({start:'established'}),before=JSON.stringify(s);view=await createGameLandscape(B,scene,s,materials);view.update(s,0);const parts=view.meshes.filter(m=>['date-palm-trunks','date-palm-crowns'].includes(m.name));assert.equal(parts.length,2);assert.ok(parts.every(m=>m.isEnabled()));assert.ok(!view.meshes.some(m=>m.metadata?.nativeDates));assert.equal(JSON.stringify(s),before);}finally{B.SceneLoader.LoadAssetContainerAsync=original;view?.dispose();scene.dispose();engine.dispose();}
});
