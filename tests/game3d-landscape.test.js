import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameLandscape, landscapePlan, landscapeSignature, resourcePlacementSites} from '../game3d/landscape.js';
import {createGame} from '../engine.js';
import {terrain} from '../world.js';

test('landscape derives actual canal water, arms and construction without changing city state',()=>{
 const s=createGame();s.buildings=[];s.roads=[];
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
 const s=createGame();s.roads=[{id:'test',a:{x:2.5,y:4.5},b:{x:3.5,y:4.5},level:2,construction:{kind:'upgrade',target:3,required:{stone:2},delivered:{stone:2},remaining:{stone:0},work:9}}];
 const before=JSON.stringify(s),plan=landscapePlan(s),road=plan.roads.find(r=>r.id==='test');
 assert.deepEqual(road.a,{x:2.5,y:4.5});assert.deepEqual(road.b,{x:3.5,y:4.5});assert.equal(road.level,2);assert.equal(road.target,3);assert.ok(road.progress>.4);
 const signature=landscapeSignature(s);s.simTime+=1;assert.equal(landscapeSignature(s),signature);s.roads[0].level=3;assert.notEqual(landscapeSignature(s),signature);
 s.simTime-=1;s.roads[0].level=2;assert.equal(JSON.stringify(s),before);
});
test('palms are deterministic dry cells clear of buildings; caravan follows its actual coordinates and stocks',()=>{
 const s=createGame(),before=JSON.stringify(s),a=landscapePlan(s),b=landscapePlan(s);assert.deepEqual(a.palms,b.palms);assert.ok(a.palms.length);
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
function loadGeometry(scene){
 const bytes=readFileSync(new URL('../assets/art-courtyard/models/date-palm.glb',import.meta.url));
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
 B.SceneLoader.LoadAssetContainerAsync=async(root,file)=>{loads++;assert.equal(root+file,'assets/art-courtyard/models/date-palm.glb');return loadGeometry(scene);};
 let view;const s=createGame();s.roads=[{id:'local',a:{x:2.5,y:4.5},b:{x:3.5,y:4.5},level:2}];
 let canalX=0;while(terrain(canalX,8)==='water'||terrain(canalX+1,8)!=='water')canalX++;
 s.buildings.push({type:'canal',x:canalX,y:8,level:1});
 s.trade.caravan={x:12.6,y:8.1,transport:'river',stock:{food:30},route:[],routeIndex:0};
 const before=JSON.stringify(s);
 try{
  view=await createGameLandscape(B,scene,s,materials);const live=view.meshes;assert.equal(loads,1);assert.equal(JSON.stringify(s),before);
  for(const name of ['date-palm-trunks','date-palm-crowns','connected-earth-streets'])for(const m of live.filter(m=>m.name===name))assert.equal(m.isEnabled(),false);
  const palms=live.filter(m=>m.name.startsWith('date-palm-')&&m.sourceMesh);assert.ok(palms.length);assert.ok(palms.every(m=>m.isEnabled()));assert.ok(new Set(palms.map(m=>m.sourceMesh)).size<palms.length);
  for(const m of palms){assert.equal(m.overrideMaterialSideOrientation,B.Material.ClockWiseSideOrientation);assert.ok(m.getWorldMatrix().determinant()>0);}
  const waters=live.filter(m=>m.name==='actual-canal-water');assert.ok(waters.length);assert.ok(waters.every(m=>Math.abs(m.position.x-canalX*6)<=1.5&&Math.abs(m.position.z-48)<=1.5));
  const patches=live.filter(m=>m.name.startsWith('resource-site-'));assert.equal(patches.length,s.world.deposits.length);assert.ok(patches.every(m=>!m.isEnabled()),'ordinary city view has no deposit tile squares');
  for(const m of patches){const d=m.metadata.resourceSite;assert.equal(m.position.x,d.x*6);assert.equal(m.position.z,d.y*6);assert.ok(s.world.deposits.some(p=>p.kind===d.kind&&p.x===d.x&&p.y===d.y));}
  const firstPatch=patches[0];view.update(s,0,'clay');assert.ok(patches.every(m=>m.isEnabled()===(m.metadata.resourceSite.kind==='clay')));const highlights=live.filter(m=>m.metadata?.resourcePlacement);assert.ok(highlights.length);assert.ok(highlights.every(m=>m.metadata.resourcePlacement.type==='clay'));const marker=highlights[0];view.update(s,0,'clay');assert.ok(live.includes(marker),'unchanged selection shares its cached highlight instances');assert.ok(live.includes(firstPatch),'selection does not rebuild resource geology');
  view.update(s,0,'house');assert.ok(patches.every(m=>!m.isEnabled()));assert.equal(marker.isDisposed(),true);assert.equal(live.filter(m=>m.metadata?.resourcePlacement).length,0);view.update(s,0,'shrine');assert.equal(live.filter(m=>m.metadata?.resourcePlacement).length,0);assert.equal(JSON.stringify(s),before);
  const street=live.find(m=>m.name==='road-local-level-2');assert.equal(street.position.x,18);assert.equal(street.position.z,27);assert.equal(street.material.name,'game-road-clay-gravel');
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
 const s=createGame();s.buildings=[];s.world.deposits=[{kind:'clay',x:2,y:3},{kind:'stone',x:3,y:4},{kind:'forest',x:6,y:6},{kind:'wildlife',x:28,y:17},{kind:'dates',x:20,y:6},{kind:'reed',x:4,y:4}];
 const before=JSON.stringify(s),signature=landscapeSignature(s),plan=landscapePlan(s);
 assert.deepEqual(plan.deposits,s.world.deposits);assert.equal(JSON.stringify(s),before);
 assert.deepEqual(resourcePlacementSites(s,'clay'),[{x:2,y:3}]);assert.deepEqual(resourcePlacementSites(s,'quarry'),[{x:3,y:4}]);assert.deepEqual(resourcePlacementSites(s,'garden'),[{x:20,y:6}]);
 assert.equal(resourcePlacementSites(s,'logging').length,13);assert.equal(resourcePlacementSites(s,'hunting').length,13);
 assert.deepEqual(resourcePlacementSites(s,'house'),[]);assert.deepEqual(resourcePlacementSites(s,'shrine'),[]);assert.deepEqual(resourcePlacementSites(s,null),[]);
 const guarded={get world(){throw Error('ordinary buildings must not scan deposits');},get buildings(){throw Error('ordinary buildings must not scan the city');}};assert.deepEqual(resourcePlacementSites(guarded,'house'),[]);assert.deepEqual(resourcePlacementSites(guarded,'shrine'),[]);
 s.buildings.push({type:'house',x:2,y:3});assert.deepEqual(resourcePlacementSites(s,'clay'),[]);s.buildings=[];
 s.world.deposits[0].x++;assert.notEqual(landscapeSignature(s),signature);s.world.deposits[0].x--;assert.equal(JSON.stringify(s),before);
});
