import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameLandscape, landscapePlan, landscapeSignature, resourcePlacementSites,landscapeFallbackTufts} from '../game3d/landscape.js';
import {createGame} from '../engine.js';
import {terrain} from '../world.js';
import {strictScenario,legacyScenario} from '../scenario-profiles.js';

test('managed Sumerian gardens have two palm rows while surrounding and legacy palms stay scattered',()=>{
 const s=createGame({start:'established'});s.scenario=strictScenario();s.buildings=[];s.roads=[];
 const wild=landscapePlan(s).palms.filter(p=>Math.hypot(p.x-6,p.y-10)>2),garden={type:'garden',x:6,y:10,level:1};s.buildings=[garden];
 const before=JSON.stringify(s),palms=landscapePlan(s).palms,rows=palms.filter(p=>p.managed);
 assert.equal(rows.length,4,'four living palms belong to the managed plot');
 assert.ok(palms.filter(p=>!p.managed&&!p.resource).every(p=>shoreDistance(p.x,p.y,s)<5.4));
 assert.equal(new Set(rows.map(p=>p.x)).size,2);assert.equal(new Set(rows.map(p=>p.y)).size,2);
 assert.ok(rows.every(p=>Math.abs(p.x-6)<.4&&Math.abs(p.y-10)<.4));
 assert.deepEqual(palms.filter(p=>!p.managed&&Math.hypot(p.x-6,p.y-10)>2),wild,'unrelated wild positions do not turn into a grid');
 assert.equal(JSON.stringify(s),before);
 garden.construction={kind:'new'};assert.equal(landscapePlan(s).palms.filter(p=>p.managed).length,0,'an unfinished garden is not a mature grove');
 garden.construction={kind:'upgrade',target:2};assert.equal(landscapePlan(s).palms.filter(p=>p.managed).length,4,'upgrade retains existing trees');
 delete garden.construction;s.scenario=legacyScenario();assert.equal(landscapePlan(s).palms.filter(p=>p.managed).length,0,'old cities retain their former layout');
});

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
test('resource extraction and seasonal replenishment do not invalidate landscape geometry',()=>{
 const s=createGame({start:'established'}),signature=landscapeSignature(s),palms=landscapePlan(s).palms;
 for(const d of s.world.deposits){d.amount=0;d.capacity=999;d.regeneration=12;}
 assert.deepEqual(landscapePlan(s).palms,palms);
 assert.equal(landscapeSignature(s),signature);
 s.world.deposits[0].kind='stone';s.world.deposits[0].x+=1;
 assert.notEqual(landscapeSignature(s),signature);
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
  assert.ok(live.some(m=>m.name.startsWith('valley-grass-')&&m.thinInstanceCount>0));assert.ok(live.some(m=>m.name.startsWith('valley-reed-')&&m.thinInstanceCount>0));assert.ok(!live.some(m=>['volumetric-riparian-colonies','deposit-reed-bed'].includes(m.name)),'imported plants replace old grass ribbons and reed cylinders');
  for(const name of ['date-palm-trunks','date-palm-crowns','connected-earth-streets','living-river','saved-lakes'])for(const m of live.filter(m=>m.name===name))assert.equal(m.isEnabled(),false);
  const palms=live.filter(m=>m.name.startsWith('date-palm-')&&m.sourceMesh);assert.ok(palms.length);const palmBatches=live.filter(m=>m.metadata?.palmBatch),rendered=new Map();for(const batch of palmBatches)for(const id of batch.metadata.palmBatch.parts)rendered.set(id,(rendered.get(id)||0)+1);assert.ok(palms.every(m=>(m.isEnabled()?1:0)+(rendered.get(m.uniqueId)||0)===1),'every original part is rendered exactly once, individually or in its GPU batch');assert.equal(palmBatches.reduce((n,m)=>n+m.thinInstanceCount,0),palms.filter(m=>!m.isEnabled()).length);assert.ok(new Set(palms.map(m=>m.sourceMesh)).size<palms.length);
  for(const m of palms){assert.equal(m.overrideMaterialSideOrientation??null,m.sourceMesh.metadata?.nativeDates?null:B.Material.CounterClockWiseSideOrientation);assert.ok(m.getWorldMatrix().determinant()>0);}
  const waters=live.filter(m=>m.name==='actual-canal-water');assert.ok(waters.length);assert.ok(waters.every(m=>m.metadata.canalArm.a.x===canalX&&m.metadata.canalArm.a.y===8));assert.ok(waters.some(m=>m.metadata.canalArm.mouth));assert.ok(waters.some(m=>m.getVerticesData(B.VertexBuffer.ColorKind).some((v,i)=>i%4===2&&v>.9)),'wet canals use a visible canal-water tint');
  for(const m of live.filter(m=>m.metadata?.canalArm&&m.name!=='actual-canal-water')){assert.equal(m.material.name,'game-wet-channel-mud');const c=m.material.albedoColor;assert.ok(c.r<.5&&c.g<.5&&c.b<.5,'wet mud remains darker than the bank');assert.equal(m.material.albedoTexture,materials.soil.albedoTexture||null,'wet banks share the available ground texture');}
  const patches=live.filter(m=>m.name.startsWith('resource-site-'));assert.equal(patches.length,s.world.deposits.length);assert.ok(patches.every(m=>!m.isEnabled()),'ordinary city view has no deposit tile squares');
  for(const m of patches){const d=m.metadata.resourceSite;assert.equal(m.position.x,d.x*6);assert.equal(m.position.z,d.y*6);assert.ok(s.world.deposits.some(p=>p.kind===d.kind&&p.x===d.x&&p.y===d.y));}
  const firstPatch=patches[0];view.update(s,0,'clay');assert.ok(patches.every(m=>m.isEnabled()===(m.metadata.resourceSite.kind==='clay')));const highlights=live.filter(m=>m.metadata?.resourcePlacement);assert.ok(highlights.length);assert.ok(highlights.every(m=>m.metadata.resourcePlacement.type==='clay'));const marker=highlights[0];view.update(s,0,'clay');assert.ok(live.includes(marker),'unchanged selection shares its cached highlight instances');assert.ok(live.includes(firstPatch),'selection does not rebuild resource geology');
  view.update(s,0,'house');assert.ok(patches.every(m=>!m.isEnabled()));assert.equal(marker.isDisposed(),true);assert.equal(live.filter(m=>m.metadata?.resourcePlacement).length,0);view.update(s,0,'shrine');assert.equal(live.filter(m=>m.metadata?.resourcePlacement).length,0);assert.equal(JSON.stringify(s),before);
  const street=live.find(m=>m.name==='road-local-level-2');assert.equal(street.position.x,18);assert.equal(street.position.z,27);assert.equal(street.material.name,'game-road-clay-gravel');assert.ok(street.getTotalVertices()>30);assert.equal(street.hasVertexAlpha,true);
  const clear=live.find(m=>m.name==='clear-living-river');assert.ok(clear);assert.equal(clear.material.needAlphaBlending(),true);assert.equal(clear.material.disableDepthWrite,true);assert.ok(!live.some(m=>m.name==='clear-river-bed'),'one canonical terrain bed prevents intersecting shore triangles');assert.ok(live.some(m=>m.name.startsWith('submerged-pebble-')&&m.sourceMesh));assert.ok(!live.some(m=>/resource-name|resource-label/.test(m.name)));
  const valley=live.find(m=>m.name==='alluvial-valley'),positions=valley.getVerticesData(B.VertexBuffer.PositionKind);assert.ok(positions.some((v,i)=>i%3===1&&Math.abs(positions[i-1]-canalX*6)<.01&&Math.abs(positions[i+1]-48)<.01&&v<0),'real canal cuts a shallow inlet in this main-game terrain copy');
  const lake=s.world.lakes[0],cell=lake.cells.find(c=>lake.cells.some(n=>n.x===c.x+1&&n.y===c.y)),seamX=(cell.x+.5)*6,seamZ=cell.y*6,seam=positions.findIndex((v,i)=>i%3===0&&Math.abs(v-seamX)<1e-8&&Math.abs(positions[i+2]-seamZ)<1e-8);assert.ok(seam>=0);assert.ok(positions[seam+1]<-.85,'the physical lake basin has no raised ridge at a saved tile boundary');assert.ok(live.some(m=>m.name==='organic-lake-soft-banks'));
  const palm=palms[0],root=scene.getTransformNodeByName('actual-trade-caravan');assert.equal(root.position.x,75.6);assert.ok(Math.abs(root.position.z-48.6)<1e-9);assert.ok(live.some(m=>m.name==='cargo-food'));
  s.rain=1;view.update(s,0);assert.ok(live.some(m=>m.name==='weather-rain'&&m.isEnabled()));s.rain=0;view.update(s,0);
  const count=scene.meshes.length;view.update(s,1);view.update(s,2);assert.equal(scene.meshes.length,count);assert.ok(live.includes(palm));assert.equal(JSON.stringify(s),before);
  s.trade.caravan.x=14;view.update(s,3);assert.equal(root.position.x,84);assert.equal(view.meshes,live);assert.equal(scene.meshes.length,count);
  const retained=live.filter(m=>m===street||m===palm||m===firstPatch||m.name.startsWith('valley-grass-')||m.name.startsWith('valley-reed-'));
  for(const d of s.world.deposits)d.amount=(d.amount||0)+1;
  view.update(s,3.5);
  assert.ok(retained.every(m=>live.includes(m)&&!m.isDisposed()),'resource accounting retains existing road, palm, vegetation and geology meshes');
  const ground=live.find(m=>m.name==='alluvial-valley'),cover=live.find(m=>m.name==='soft-riparian-grass'),originalCover=cover.getVerticesData('color').slice();
  s.roadAnchors=[{type:'road',x:0,y:9}];view.update(s,3.6);
  assert.ok(live.includes(ground)&&!ground.isDisposed(),'caravan entry reuses physical terrain and refreshes only its road mask');
  assert.ok(live.find(m=>m.name==='road-local-level-2')===street,'a new caravan road does not rebuild unchanged road segments');
  const fresh=await createGameLandscape(B,scene,s,materials);
  try{assert.deepEqual(cover.getVerticesData('color'),fresh.meshes.find(m=>m.name==='soft-riparian-grass').getVerticesData('color'));assert.deepEqual(cover.getIndices(),fresh.meshes.find(m=>m.name==='soft-riparian-grass').getIndices());}finally{fresh.dispose();}
  delete s.roadAnchors;view.update(s,3.7);assert.deepEqual(cover.getVerticesData('color'),originalCover,'departed caravan restores the same grass cover');
  const upgradePalm=live.find(m=>m.name.startsWith('date-palm-')&&m.sourceMesh);
  s.roads[0].level=3;view.update(s,4);assert.equal(street.isDisposed(),true);assert.ok(live.some(m=>m.name==='road-local-level-3'));assert.ok(live.includes(upgradePalm),'road upgrade does not recreate licensed palms');
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
test('loaded grass and reeds skip the discarded procedural tuft plan entirely',()=>{
 const unreadable=new Proxy({}, {get(){throw Error('fully replaced fallback must not inspect terrain');}});
 assert.deepEqual(landscapeFallbackTufts(unreadable,unreadable,{grass:[{}],reed:[{}]}),[]);
});
test('missing plant species retain the exact former procedural fallback',()=>{
 const s=createGame({start:'established',seed:137}),before=JSON.stringify(s),roads=landscapePlan(s).roads,all=floodplainTufts(s,roads);
 assert.ok(all.some(p=>p.kind==='grass')&&all.some(p=>p.kind==='reed'));
 assert.deepEqual(landscapeFallbackTufts(s,roads,{}),all);
 assert.deepEqual(landscapeFallbackTufts(s,roads,{grass:[{}]}),all.filter(p=>p.kind==='reed'));
 assert.deepEqual(landscapeFallbackTufts(s,roads,{reed:[{}]}),all.filter(p=>p.kind==='grass'));
 assert.equal(JSON.stringify(s),before);
});
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
   if(['copper','axe','blade','chisel'].includes(kind)){
    assert.ok(src.isVerticesDataPresent(B.VertexBuffer.ColorKind),`${kind} bakes distinct material colors`);
    assert.equal(src.subMeshes.length,1,`${kind} keeps one shared draw range`);
   }else if(!['milk','water','beer','pottery'].includes(kind)){assert.ok(bounds.maximum.x-bounds.minimum.x>.6);assert.ok(bounds.maximum.z-bounds.minimum.z>.5);assert.ok(src.getIndices().length%36===0,`${kind} consists of straight rectangular goods, never round sacks`);}
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
test('building a 2 by 2 platform hides overlapping gathering features then restores them on removal',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),materials=Object.fromEntries(['soil','grass','wood','stone','terracotta','reed','linen'].map(k=>[k,new B.PBRMaterial(k,scene)]));
 const original=B.SceneLoader.LoadAssetContainerAsync;B.SceneLoader.LoadAssetContainerAsync=async(root,file)=>loadGeometry(scene,file);let view;
 const s=createGame({start:'established'}),z={type:'ziggurat',x:28,y:1,footprint:2,level:1};s.world.deposits=[{kind:'stone',x:29,y:2},{kind:'reed',x:28,y:2},{kind:'forest',x:29,y:1}];s.gathering={features:[{id:'platform-tree',kind:'tree',x:29,y:2,health:1,felledAt:null,recoverAt:null},{id:'platform-rock',kind:'rock',x:28,y:2,health:1}],jobs:[],kills:[]};
 try{
  view=await createGameLandscape(B,scene,s,materials);assert.ok(scene.getTransformNodeByName('gathering-feature-platform-tree'));assert.ok(!view.meshes.some(m=>m.name==='deposit-stone-pile'));
  s.buildings.push(z);const before=JSON.stringify(s);view.update(s,1);assert.equal(JSON.stringify(s),before);
  assert.equal(scene.getTransformNodeByName('gathering-feature-platform-tree'),null);assert.equal(scene.getTransformNodeByName('gathering-feature-platform-rock'),null);
  assert.ok(!view.meshes.some(m=>['deposit-stone-pile','deposit-reed-bed'].includes(m.name)));
  for(const m of view.meshes.filter(m=>m.name.startsWith('date-palm-')&&m.sourceMesh))assert.ok(!insideFootprint(z,m.position.x/6,m.position.z/6));
  const ground=view.meshes.find(m=>m.name==='soft-riparian-grass'),p=ground.getVerticesData(B.VertexBuffer.PositionKind),c=ground.getVerticesData(B.VertexBuffer.ColorKind);for(let i=0;i<p.length;i+=3)if(insideFootprint(z,p[i]/6,p[i+2]/6))assert.equal(c[i/3*4+3],0);
  s.buildings.pop();view.update(s,2);assert.ok(scene.getTransformNodeByName('gathering-feature-platform-tree'));assert.ok(!view.meshes.some(m=>m.name==='deposit-stone-pile'));assert.equal(s.gathering.features[0].health,1);
 }finally{B.SceneLoader.LoadAssetContainerAsync=original;view?.dispose();scene.dispose();engine.dispose();}
});

test('missing imported palm files retain grounded procedural trunks and crowns, never floating fruit',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),materials=Object.fromEntries(['soil','grass','wood','stone','terracotta','reed','linen'].map(k=>[k,new B.PBRMaterial(k,scene)])),original=B.SceneLoader.LoadAssetContainerAsync;let view;
 B.SceneLoader.LoadAssetContainerAsync=async()=>{throw Error('optional asset offline');};
 try{const s=createGame({start:'established'}),before=JSON.stringify(s);view=await createGameLandscape(B,scene,s,materials);view.update(s,0);const parts=view.meshes.filter(m=>['date-palm-trunks','date-palm-crowns'].includes(m.name));assert.equal(parts.length,2);assert.ok(parts.every(m=>m.isEnabled()));assert.ok(!view.meshes.some(m=>m.metadata?.nativeDates));assert.equal(JSON.stringify(s),before);}finally{B.SceneLoader.LoadAssetContainerAsync=original;view?.dispose();scene.dispose();engine.dispose();}
});

import {catDiscoverySurfaceHeight} from '../game3d/cat-discovery.js';
test('landscape road batching preserves ground sampling, source caches and saved state across toggles',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),materials=Object.fromEntries(['soil','grass','wood','stone','terracotta','reed','linen'].map(k=>[k,new B.PBRMaterial(k,scene)])),original=B.SceneLoader.LoadAssetContainerAsync;
 B.SceneLoader.LoadAssetContainerAsync=async(_root,file)=>loadGeometry(scene,file.split('?')[0]);let view;
 const s=createGame({start:'established'});s.buildings=[];s.trade.caravan=null;s.roads=[0,1,2,3].map(i=>({id:'batch-test-'+i,a:{x:2.5+i,y:4.5},b:{x:3.5+i,y:4.5},level:2}));const before=JSON.stringify(s);
 try{view=await createGameLandscape(B,scene,s,materials);const groups=()=>view.meshes.filter(m=>m.metadata?.roadRenderGroup),sources=()=>view.meshes.filter(m=>m.metadata?.road?.a);assert.ok(groups().length>0);const source=sources()[0],geometry=source.geometry;assert.equal(source.isEnabled(),false);
 const mergedHeight=catDiscoverySurfaceHeight(B,scene,3,4.5,()=>999);assert.ok(mergedHeight<999);
 view.setRoadBatching(false);assert.equal(groups().length,0);assert.equal(source.isEnabled(),true);const directHeight=catDiscoverySurfaceHeight(B,scene,3,4.5,()=>999);assert.ok(Math.abs(mergedHeight-directHeight)<1e-5);
 view.setRoadBatching(true);assert.ok(groups().length>0);assert.equal(source.geometry,geometry);assert.equal(source.isEnabled(),false);assert.equal(JSON.stringify(s),before);
 }finally{view?.dispose();B.SceneLoader.LoadAssetContainerAsync=original;scene.dispose();engine.dispose();}
});

import {weatherAt} from '../environment.js';
test('real licensed palm parts retain their wind matrices and save through GPU/individual toggles',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),materials=Object.fromEntries(['soil','grass','wood','stone','terracotta','reed','linen'].map(k=>[k,new B.PBRMaterial(k,scene)])),original=B.SceneLoader.LoadAssetContainerAsync;
 B.SceneLoader.LoadAssetContainerAsync=async(_root,file)=>loadGeometry(scene,file.split('?')[0]);let view;const s=createGame({start:'established'});
 for(let time=0;time<1000;time++)if(weatherAt({...s,simTime:time}).type==='wind'){s.simTime=time;break;}assert.equal(weatherAt(s).type,'wind');const before=JSON.stringify(s);
 try{view=await createGameLandscape(B,scene,s,materials);const parts=view.meshes.filter(m=>m.name.startsWith('date-palm-')&&m.sourceMesh),count=new Set(parts.map(m=>m.sourceMesh)).size;assert.ok(count>1);
 const expected=parts.map((m,i)=>B.Matrix.Compose(m.scaling,B.Quaternion.RotationYawPitchRoll(m.rotation.y,m.rotation.x,Math.sin(s.simTime*1.7+Math.floor(i/count))*.008),m.position));
 const compare=(a,b)=>{for(let i=0;i<16;i++)assert.ok(Math.abs(a.m[i]-b.m[i])<1e-4);};
 for(const batch of view.meshes.filter(m=>m.metadata?.palmBatch)){const matrices=batch.thinInstanceGetWorldMatrices();for(const [i,id]of batch.metadata.palmBatch.parts.entries())compare(matrices[i],expected[parts.findIndex(m=>m.uniqueId===id)]);}
 view.setPalmBatching(false);assert.ok(parts.every(m=>m.isEnabled()));parts.forEach((m,i)=>compare(m.getWorldMatrix(),expected[i]));view.setPalmBatching(true);assert.ok(view.meshes.some(m=>m.metadata?.palmBatch));assert.equal(JSON.stringify(s),before);
 }finally{view?.dispose();B.SceneLoader.LoadAssetContainerAsync=original;scene.dispose();engine.dispose();}
});

test('road edits retain channel-cut ground buffers; mask and canal edits remain exact',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),materials=Object.fromEntries(['soil','grass','wood','stone','terracotta','reed','linen'].map(k=>[k,new B.PBRMaterial(k,scene)])),loader=B.SceneLoader.LoadAssetContainerAsync;
 B.SceneLoader.LoadAssetContainerAsync=async(_root,file)=>loadGeometry(scene,file.split('?')[0]);let view,fresh;
 const s=createGame({start:'established'});s.roads=[{id:'probe',a:{x:2.5,y:4.5},b:{x:3.5,y:4.5},level:1}];
 s.buildings.push({type:'canal',x:3,y:3,level:1,construction:{kind:'new',target:1,required:{clay:4},delivered:{clay:4},remaining:{clay:0},work:0}});
 try{view=await createGameLandscape(B,scene,s,materials);const ground=view.meshes.find(m=>m.name==='alluvial-valley'),grass=view.meshes.find(m=>m.name==='soft-riparian-grass'),writes=new Map([[ground,0],[grass,0]]);
 const plants=view.meshes.filter(m=>m.metadata?.valleyBatch||m.name==='nature-ground-reeds-shards-dust');assert.ok(plants.some(m=>m.metadata?.valleyBatch));assert.ok(plants.some(m=>m.name==='nature-ground-reeds-shards-dust'));
 for(const m of writes.keys()){const set=m.setVerticesData;m.setVerticesData=function(...args){writes.set(m,writes.get(m)+1);return set.apply(this,args);};}
 s.roads[0].level=2;view.update(s,1);assert.equal(writes.get(ground),0,'a road level must not upload unchanged canal-cut ground');assert.equal(writes.get(grass),0,'a road level must not upload unchanged grass cuts');assert.ok(plants.every(m=>view.meshes.includes(m)&&!m.isDisposed()),'paving must retain imported plants and natural debris');
 s.roadAnchors=[...(s.roadAnchors||[]),{x:5,y:5}];view.update(s,2);assert.ok(view.meshes.includes(ground));assert.equal(writes.get(ground),0,'road mask must not invalidate ground cuts');assert.ok(writes.get(grass)>0,'road mask must update grass');
 writes.set(ground,0);s.buildings.at(-1).construction.work=9;view.update(s,3);assert.ok(writes.get(ground)>0,'growing canal must update ground');
 const before=JSON.stringify(s);fresh=await createGameLandscape(B,scene,s,materials);for(const name of ['alluvial-valley','soft-riparian-grass','distant-alluvial-plain','nature-ground-reeds-shards-dust'])for(const kind of [B.VertexBuffer.PositionKind,B.VertexBuffer.NormalKind,B.VertexBuffer.ColorKind])assert.deepEqual(Array.from(view.meshes.find(m=>m.name===name).getVerticesData(kind)),Array.from(fresh.meshes.find(m=>m.name===name).getVerticesData(kind)),`${name}/${kind} must match a fresh landscape`);const distribution=v=>v.meshes.filter(m=>m.metadata?.valleyBatch).map(m=>JSON.stringify([m.metadata.valleyBatch.kind,m.metadata.valleyBatch.cell,m.metadata.valleyBatch.points,m.getTotalVertices(),m.thinInstanceGetWorldMatrices().map(matrix=>Array.from(matrix.m))])).sort();assert.deepEqual(distribution(view),distribution(fresh),'changed footprint must match fresh imported vegetation');assert.equal(JSON.stringify(s),before);
 }finally{B.SceneLoader.LoadAssetContainerAsync=loader;fresh?.dispose();view?.dispose();scene.dispose();engine.dispose();}
});

test('road work retains static banks and fallback tufts; topology edits match fresh geometry',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),materials=Object.fromEntries(['soil','grass','wood','stone','terracotta','reed','linen'].map(k=>[k,new B.PBRMaterial(k,scene)])),loader=B.SceneLoader.LoadAssetContainerAsync;
 B.SceneLoader.LoadAssetContainerAsync=async()=>{throw Error('test optional-art fallback');};let view,fresh;const s=createGame({start:'established'});
 s.roads=[{id:'probe',a:{x:2.5,y:4.5},b:{x:3.5,y:4.5},level:1,construction:{kind:'upgrade',target:2,required:{clay:3,reed:1},delivered:{clay:3,reed:1},remaining:{clay:0,reed:0},work:0}}];s.buildings.push({type:'canal',x:3,y:3,level:1});
 try{view=await createGameLandscape(B,scene,s,materials);const names=['actual-dry-canal-bank','volumetric-riparian-colonies','irregular-physical-riverbanks','organic-lake-soft-banks'],old=names.map(name=>view.meshes.find(m=>m.name===name));assert.ok(old.every(Boolean));
 s.roads[0].construction.work=9;view.update(s,1);assert.ok(old.every(m=>view.meshes.includes(m)&&!m.isDisposed()),'work changes must retain static ground scenery');
 s.roads[0].level=2;delete s.roads[0].construction;view.update(s,2);assert.ok(old.every(m=>view.meshes.includes(m)&&!m.isDisposed()),'completed paving must retain banks and tufts');
 s.roads[0].b={x:4.5,y:4.5};view.update(s,3);assert.ok(old.every(m=>m.isDisposed()),'changed road footprint must invalidate its scenery mask');
 const before=JSON.stringify(s);fresh=await createGameLandscape(B,scene,s,materials);for(const name of names)for(const kind of [B.VertexBuffer.PositionKind,B.VertexBuffer.NormalKind,B.VertexBuffer.ColorKind,B.VertexBuffer.UVKind])assert.deepEqual(Array.from(view.meshes.find(m=>m.name===name).getVerticesData(kind)),Array.from(fresh.meshes.find(m=>m.name===name).getVerticesData(kind)),`${name}/${kind} must match fresh topology`);assert.equal(JSON.stringify(s),before);
 }finally{B.SceneLoader.LoadAssetContainerAsync=loader;fresh?.dispose();view?.dispose();scene.dispose();engine.dispose();}
});

test('landscape registry contains no disposed owner meshes after each quality change',async(t)=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),materials=Object.fromEntries(['soil','grass','wood','stone','terracotta','reed','linen'].map(k=>[k,new B.PBRMaterial(k,scene)])),loader=B.SceneLoader.LoadAssetContainerAsync;
 B.SceneLoader.LoadAssetContainerAsync=async(_root,file)=>loadGeometry(scene,file.split('?')[0]);let view;const s=createGame({start:'established'}),before=JSON.stringify(s);
 try{view=await createGameLandscape(B,scene,s,materials);const registry=view.meshes,sources=registry.filter(m=>m.name.startsWith('game-date-palm-source-'));assert.ok(sources.length);
 for(const [i,tier]of ['low','high','low'].entries()){view.setQuality(tier);view.update(s,i+1);assert.equal(view.meshes,registry);assert.equal(registry.filter(m=>m.isDisposed()).length,0,'removed owner meshes must leave registry in the same update');assert.ok(sources.every(m=>registry.includes(m)&&!m.isDisposed()),'live disabled source meshes must stay registered');for(const m of registry.filter(m=>m.metadata?.valleyBatch))for(let column=0;column<4;column++)assert.equal(m.getVertexBuffer('world'+column).getBuffer(),m._thinInstanceDataStorage.matrixBuffer.getBuffer(),'actual GLB regions retain independent GPU matrices at every tier');const batches=registry.filter(m=>m.metadata?.valleyBatch);t.diagnostic(JSON.stringify({tier,batches:batches.length,instances:batches.reduce((n,m)=>n+m.thinInstanceCount,0),geometryPayloadUpperBoundBytes:batches.reduce((n,m)=>n+m.getVerticesDataKinds().filter(k=>!k.startsWith('world')).reduce((a,k)=>a+(m.getVerticesData(k)?.length||0)*4,0)+m.getIndices().length*4,0),matrixBytes:batches.reduce((n,m)=>n+m.thinInstanceCount*16*4,0)}));}const anchors=s.roadAnchors;s.roadAnchors=[...(anchors||[]),{type:'road',x:5,y:5}];const changed=JSON.stringify(s);view.update(s,4);assert.equal(registry.filter(m=>m.isDisposed()).length,0,'topology replacement must also prune immediately');assert.equal(JSON.stringify(s),changed);s.roadAnchors=anchors;view.update(s,5);assert.equal(registry.filter(m=>m.isDisposed()).length,0);assert.equal(JSON.stringify(s),before);
 }finally{B.SceneLoader.LoadAssetContainerAsync=loader;view?.dispose();scene.dispose();engine.dispose();}
});

test('recorded grass clips preserve sequential Float32 rounding and RGB/zero operations',async()=>{
 const {applyTerrainAlphaClips}=await import('../game3d/landscape.js'),colors=new Float32Array([.2,.3,.4,.7,.5,.6,.7,.9]),expected=colors.slice();expected[3]*=.78;expected[3]*=.84;expected[7]=0;expected[7]*=.49;
 const combined=colors.slice();combined[3]*=.78*.84;assert.notEqual(combined[3],expected[3],'fixture must detect incorrectly combined factors');
 const clips={zero:new Uint32Array([7]),indices:new Uint32Array([3,3,7]),factors:new Float64Array([.78,.84,.49])};const result=applyTerrainAlphaClips(colors,clips);assert.equal(result,colors);assert.deepEqual(colors,expected);assert.deepEqual(Array.from(clips.factors),[.78,.84,.49]);
});

test('road color changes retain grass positions and match fresh channel cuts, including changed indices',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),materials=Object.fromEntries(['soil','grass','wood','stone','terracotta','reed','linen'].map(k=>[k,new B.PBRMaterial(k,scene)])),loader=B.SceneLoader.LoadAssetContainerAsync;
 B.SceneLoader.LoadAssetContainerAsync=async(_root,file)=>loadGeometry(scene,file.split('?')[0]);let view,fresh;const s=createGame({start:'established',seed:137});s.trade.caravan=null;s.buildings.push({type:'canal',x:3,y:3,level:1,construction:{kind:'new',target:1,required:{clay:2},delivered:{clay:2},remaining:{clay:0},work:0}});
 try{view=await createGameLandscape(B,scene,s,materials);const grass=view.meshes.find(m=>m.name==='soft-riparian-grass'),set=grass.setVerticesData,writes=[];grass.setVerticesData=function(...args){writes.push(args[0]);return set.apply(this,args);};const initialAnchors=s.roadAnchors;let sameIndexCases=0,changedIndexCases=0;
 for(const anchors of [[{type:'road',x:5,y:5}],[{x:5,y:5,type:'road'}],[{type:'road',x:0,y:10}],initialAnchors]){const buffer=grass.getVertexBuffer('position').getBuffer(),indices=Array.from(grass.getIndices());writes.length=0;s.roadAnchors=anchors;const before=JSON.stringify(s);view.update(s,1);assert.equal(writes.filter(k=>k==='position').length,0,'color-only road update must not upload positions');assert.equal(grass.getVertexBuffer('position').getBuffer(),buffer);if(JSON.stringify(indices)===JSON.stringify(Array.from(grass.getIndices()))){sameIndexCases++;assert.equal(writes.filter(k=>k==='normal').length,0,'same index topology retains normals');}else changedIndexCases++;
 fresh=await createGameLandscape(B,scene,s,materials);const expected=fresh.meshes.find(m=>m.name==='soft-riparian-grass');for(const kind of ['position','normal','color'])assert.deepEqual(Array.from(grass.getVerticesData(kind)),Array.from(expected.getVerticesData(kind)),kind);assert.deepEqual(Array.from(grass.getIndices()),Array.from(expected.getIndices()));assert.equal(JSON.stringify(s),before);fresh.dispose();fresh=null;}
 assert.ok(sameIndexCases>0&&changedIndexCases>0,'fixture must cover both unchanged and changed index topology');writes.length=0;s.buildings.at(-1).construction.work=9;view.update(s,2);assert.ok(writes.includes('position'),'changed canal height must invalidate cached positions/clips');
 fresh=await createGameLandscape(B,scene,s,materials);for(const kind of ['position','normal','color'])assert.deepEqual(Array.from(grass.getVerticesData(kind)),Array.from(fresh.meshes.find(m=>m.name==='soft-riparian-grass').getVerticesData(kind)),kind);
 }finally{B.SceneLoader.LoadAssetContainerAsync=loader;fresh?.dispose();view?.dispose();scene.dispose();engine.dispose();}
});

test('an invisible saved gathering tree inside a garden cannot erase its living orchard',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),materials=Object.fromEntries(['soil','grass','wood','stone','terracotta','reed','linen'].map(k=>[k,new B.PBRMaterial(k,scene)])),original=B.SceneLoader.LoadAssetContainerAsync;
 B.SceneLoader.LoadAssetContainerAsync=async(root,file)=>loadGeometry(scene,file);let view;
 try{
  const s=createGame({start:'established'});s.scenario=strictScenario();s.buildings=[{type:'garden',x:6,y:10,level:1}];s.roads=[];s.gathering.features=[];
  view=await createGameLandscape(B,scene,s,materials);
  const points=()=>new Set(view.meshes.filter(m=>m.name.startsWith('date-palm-garden-6-10-')).map(m=>`${m.position.x},${m.position.z}`));
  assert.equal(points().size,4);s.gathering.features.push({id:'tree:inside-garden',kind:'tree',x:6,y:10,health:1,felledAt:null,recoverAt:null});
  const before=JSON.stringify(s);view.update(s,0);assert.equal(points().size,4,'the hidden gathering tree must not hide all garden palms');assert.equal(JSON.stringify(s),before);
  const initial=points();s.buildings[0].rotation=1;s.buildings[0].construction={kind:'upgrade',target:2,required:{brick:10},delivered:{brick:0},work:0};view.update(s,0);assert.equal(points().size,4);assert.notDeepEqual(points(),initial,'rotation updates actual grove meshes');
  const palmScale=()=>view.meshes.find(m=>m.name.startsWith('date-palm-garden-6-10-')).scaling.x;
  const mature=palmScale();s.buildings[0].orchardPlantedTick=s.tick;view.update(s,0);
  assert.equal(palmScale(),mature*.35);
  s.tick+=4;view.update(s,0);assert.equal(palmScale(),mature*.58);
  s.tick+=8;view.update(s,0);assert.equal(palmScale(),mature);
  s.buildings=[];view.update(s,0);assert.equal(points().size,0,'demolition removes the managed palms');
 }finally{view?.dispose();B.SceneLoader.LoadAssetContainerAsync=original;scene.dispose();engine.dispose();}
});

test('the flood map shows a single warning surface, strengthens it in spring and removes it after recession',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine);
 const materials=Object.fromEntries(['soil','grass','wood','stone','terracotta','reed','linen'].map(k=>[k,new B.PBRMaterial(k,scene)]));
 const original=B.SceneLoader.LoadAssetContainerAsync;
 B.SceneLoader.LoadAssetContainerAsync=async()=>{throw Error('optional asset offline');};
 let view;
 try{
  const s=createGame({start:'established',scenario:strictScenario()});
  Object.assign(s,{year:3,season:3,riverFlood:{year:4,along:9,bank:-1}});
  const before=JSON.stringify(s);
  view=await createGameLandscape(B,scene,s,materials);
  const find=()=>view.meshes.filter(m=>m.name==='temporary-river-flood');
  assert.equal(find().length,1);
  const [warning]=find(),alpha=warning.material.alpha;
  assert.equal(warning.isPickable,false);
  assert.equal(JSON.stringify(s),before);
  Object.assign(s,{year:4,season:0});
  view.update(s);
  assert.equal(find().length,1);
  assert.ok(warning.isDisposed());
  assert.ok(find()[0].material.alpha>alpha);
  s.season=1;
  view.update(s);
  assert.equal(find().length,0);
 }finally{B.SceneLoader.LoadAssetContainerAsync=original;view?.dispose();scene.dispose();engine.dispose();}
});


test('resident wear has one fading 3D ground batch and automatic edges have no solid surface',async()=>{
 const {recordFootsteps}=await import('../footpaths.js');
 const {layRoad}=await import('../roads.js');
 const engine=new B.NullEngine(),scene=new B.Scene(engine),materials=Object.fromEntries(['soil','grass','wood','stone','terracotta','reed','linen'].map(k=>[k,new B.PBRMaterial(k,scene)]));
 const s=createGame({start:'established'}),a={x:1.5,y:1.5},b={x:2.5,y:2.5};
 const original=B.SceneLoader.LoadAssetContainerAsync;
 B.SceneLoader.LoadAssetContainerAsync=async(root,file)=>loadGeometry(scene,file.split('?')[0]);
 let view;
 try{
  view=await createGameLandscape(B,scene,s,materials);
  assert.ok(!view.meshes.some(m=>m.name==='resident-footpaths'||m.name.startsWith('road-road:')));
  for(let i=0;i<4;i++)recordFootsteps(s,a,b,Math.SQRT2);
  s.simTime+=2;view.update(s,s.simTime);
  const trail=view.meshes.find(m=>m.name==='resident-footpaths');
  assert.ok(trail?.hasVertexAlpha);assert.ok(trail.getTotalVertices()>0);
  assert.equal(view.meshes.filter(m=>m.name==='resident-footpaths').length,1);
  const before=JSON.stringify(s);view.update(s,s.simTime);assert.equal(JSON.stringify(s),before);assert.ok(view.meshes.includes(trail));
  assert.ok(layRoad(s,{x:1,y:1},{x:2,y:1}).ok);view.update(s,s.simTime);
  const finished=view.meshes.find(m=>m.name.startsWith('road-road:')&&m.name.endsWith('-level-1'));
  assert.ok(finished);
  s.simTime+=400;view.update(s,s.simTime);
  assert.ok(!view.meshes.some(m=>m.name==='resident-footpaths'));
  assert.ok(view.meshes.includes(finished));
 }finally{B.SceneLoader.LoadAssetContainerAsync=original;view?.dispose();scene.dispose();engine.dispose();}
});
