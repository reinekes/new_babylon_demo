import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {river,HEIGHT,WIDTH} from '../world.js';
import {TILE,alluvialTerrainGeometry,alluvialSceneryGeometry} from '../district3d/terrain.js';
import {waterSurfaceGeometry,WATER_HEIGHT} from '../game3d/water.js';
import {riverCraftPose,riverCraftCargo} from '../game3d/river-craft.js';
import {createTradeRiverCraft} from '../game3d/river-craft.js';
import {createGoodsSources,GOODS_KINDS} from '../game3d/goods.js';
import vm from 'node:vm';

const state={buildings:[],world:{lakes:[]}};
function sampleHeight(g,x,z){
 for(let i=0;i<g.indices.length;i+=3){const q=g.indices.slice(i,i+3).map(k=>g.positions.slice(k*3,k*3+3));const [a,b,c]=q,den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-10)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den,w=1-u-v;if(Math.min(u,v,w)>-1e-7)return a[1]*u+b[1]*v+c[1]*w;}
 return null;
}
test('continuous banks use a common cross-section so no land triangles break through the river',()=>{
 const ground=alluvialTerrainGeometry(state),water=waterSurfaceGeometry(state).river,before=JSON.stringify(state);
 for(const y of [0,4.25,12.5,26.75,31.25])for(const side of [-1,1])for(const offset of [.55,.83,1,1.08]){
  const x=river(y)+side*offset,height=sampleHeight(ground,x*TILE,y*TILE);assert.ok(height!==null);assert.ok(height<WATER_HEIGHT-.002,`exposed bank patch at ${x},${y}: ${height}`);
 }
 assert.ok(water.points.some(p=>p.y<-.5-20));assert.ok(water.points.some(p=>p.y>HEIGHT-.5+20),'display river continues into the scenery');
 assert.equal(JSON.stringify(state),before);
});
test('outside terrain shares every playable rim vertex and stays below the continued river',()=>{
 const ground=alluvialTerrainGeometry(state),outside=alluvialSceneryGeometry(state),rim=new Map();
 for(let i=0;i<ground.positions.length;i+=3){const [x,y,z]=ground.positions.slice(i,i+3);if(Math.abs(z+.5*TILE)<1e-7||Math.abs(z-(HEIGHT-.5)*TILE)<1e-7||Math.abs(x+.5*TILE)<1e-7||Math.abs(x-(WIDTH-.5)*TILE)<1e-7)rim.set(`${x.toFixed(7)},${z.toFixed(7)}`,y);}
 const found=new Set();for(let i=0;i<outside.positions.length;i+=3){const [x,y,z]=outside.positions.slice(i,i+3),key=`${x.toFixed(7)},${z.toFixed(7)}`;if(rim.has(key)){assert.ok(Math.abs(y-rim.get(key))<1e-7);found.add(key);}}
 assert.equal(found.size,rim.size,'no coarse filler edge can cover the main river mouth');
 for(const y of [-.5,-1,-8,-24,HEIGHT-.5,HEIGHT+1,HEIGHT+12]){const h=sampleHeight(outside,river(y)*TILE,y*TILE);assert.ok(h!==null&&h<WATER_HEIGHT-.3,`unbroken scenic bed at ${y}: ${h}`);}
});
test('boat pose follows live trade coordinates, lowers the full rig at bridges and preserves stock',()=>{
 const s={...state,buildings:[{type:'bridge',x:river(8),y:8,level:1}]},c={id:'a',transport:'river',x:river(8.5),y:8.5,route:[{x:river(9),y:9}],routeIndex:0,stock:{food:90,wood:250,pottery:50}},before=JSON.stringify([s,c]);
 const a=riverCraftPose(s,c,12),paused=riverCraftPose(s,c,12);assert.deepEqual(paused,a);assert.equal(a.lowered,true);assert.equal(a.x,c.x*TILE);assert.equal(a.z,c.y*TILE);assert.ok(a.draft>.25&&a.draft<.4);
 c.y=15;c.x=river(15);const away=riverCraftPose(s,c,12);assert.equal(away.lowered,false);c.y=8.5;c.x=river(8.5);
 const stock=riverCraftCargo(c.stock);assert.ok(stock.length);assert.ok(stock.every(v=>Math.abs(v.x)<.6&&Math.abs(v.z)<1.8));assert.ok(stock.some(v=>v.kind==='food'));assert.equal(JSON.stringify([s,c]),before);
});
test('adapted boat is compact and credited, with independently lowerable rig and no external files',()=>{
 const bytes=readFileSync(new URL('../assets/art-courtyard/models/river-cargo-boat.glb',import.meta.url)),size=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+size));
 assert.ok(bytes.length<1_000_000);assert.equal(g.meshes.length,3);assert.equal(g.asset.extras.author,'Opus Poly (https://sketchfab.com/OpusPoly)');assert.equal(g.asset.extras.license,'CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)');assert.ok(g.nodes.some(n=>n.name==='RiverCraftLowerableRig'&&n.children.length===2));assert.ok(g.images.every(i=>!i.uri));assert.match(g.asset.extras.new_babylon_river_boat.adaptation,/not a Sumerian reconstruction/);assert.equal(g.asset.extras.new_babylon_river_boat.length_metres,6.4);
});

const sandbox={console,setTimeout,clearTimeout,performance,self:{},TextDecoder,TextEncoder,URL,Blob};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);const B=sandbox.BABYLON;
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylonjs-loaders-9.31.0.min.js',import.meta.url),'utf8'),sandbox);
async function actualBoat(scene){
 // Preserve the actual source geometry/hierarchy/handedness; NullEngine has no
 // image decoder, so only the browser test loads embedded PBR textures.
 const bytes=readFileSync(new URL('../assets/art-courtyard/models/river-cargo-boat.glb',import.meta.url)),size=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+size)),binary=bytes.subarray(28+size);
 for(const m of g.materials){delete m.normalTexture;delete m.occlusionTexture;delete m.pbrMetallicRoughness.baseColorTexture;delete m.pbrMetallicRoughness.metallicRoughnessTexture;}g.textures=[];g.images=[];
 let js=Buffer.from(JSON.stringify(g));js=Buffer.concat([js,Buffer.alloc((4-js.length%4)%4,32)]);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+js.length+binary.length,8);header.writeUInt32LE(js.length,12);header.writeUInt32LE(0x4e4f534a,16);const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length);binHeader.writeUInt32LE(0x004e4942,4);
 return B.SceneLoader.LoadAssetContainerAsync('',new Uint8Array(Buffer.concat([header,js,binHeader,binary])),scene,undefined,'.glb');
}
test('real imported hull has a dry tapered plank deck while retaining the keel and source original',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine);let asset;
 try{
  asset=await actualBoat(scene);asset.addAllToScene();const hull=asset.meshes.find(m=>m.name==='RiverCraftHull');assert.ok(hull);for(const n of asset.rootNodes)n.computeWorldMatrix(true);hull.computeWorldMatrix(true);
  const sections=[[-2.2,.19],[-1.8,.38],[-1.4,.49],[-1,.59],[-.6,.64],[0,.66],[.6,.63],[1,.57],[1.4,.47],[1.8,.33],[2.2,.15]];
  for(const [z,half]of sections)for(const fraction of [-.95,-.5,0,.5,.95]){
   const hit=new B.Ray(new B.Vector3(half*fraction,.195,z),B.Vector3.Down(),1).intersectsMesh(hull);
   assert.ok(hit.hit&&hit.pickedPoint.y>=.17,`water visible between ribs at ${half*fraction},${z}: ${hit.pickedPoint?.y}`);
  }
  for(const [x,z]of [[-.9,0],[.9,0],[-.6,2],[.6,2],[-.6,-2],[.6,-2]])assert.equal(new B.Ray(new B.Vector3(x,.195,z),B.Vector3.Down(),.2).intersectsMesh(hull).hit,false,'deck follows the narrow ends, not a rectangle over the river');
  const positions=hull.getVerticesData(B.VertexBuffer.PositionKind);let keel=Infinity;for(let i=1;i<positions.length;i+=3)keel=Math.min(keel,positions[i]);assert.ok(Math.abs(keel+.29)<1e-6,'original draft is unchanged');
  const bytes=readFileSync(new URL('../assets/art-courtyard/models/river-cargo-boat.glb',import.meta.url)),g=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));assert.equal(g.asset.extras.new_babylon_river_boat.input_sha256,'b094b8ad147572f990a8c416cd51820bc9b1c1210fcee78390cb00d75f4c4e18');
 }finally{asset?.dispose();scene.dispose();engine.dispose();}
});
test('real boat detail loads once after the first visit; stock updates keep hull, pause and save stable',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),materials=Object.fromEntries(['wood','stone','reed','linen','soil','terracotta'].map(k=>[k,new B.PBRMaterial(k,scene)])),goods=createGoodsSources(B,scene,materials),meshes=[];
 let loads=0;const view=createTradeRiverCraft(B,scene,meshes,materials,goods,{loadBoatAsset:async()=>{loads++;return actualBoat(scene);}}),s={...state,buildings:[]},c={id:'runtime',transport:'river',x:river(12),y:12,route:[{x:river(13),y:13}],routeIndex:0,stock:{wood:90,pottery:20}};
 try{
  view.update(s,null,1);assert.equal(loads,0);assert.equal(view.ready,null);
  const before=JSON.stringify([s,c]);view.update(s,c,2);assert.equal(view.root.metadata.detailLoaded,false);await view.ready;view.update(s,c,2);assert.equal(loads,1);assert.equal(view.root.metadata.detailLoaded,true);assert.equal(JSON.stringify([s,c]),before);
  const root=view.root,hull=root.getChildMeshes().find(m=>m.name.includes('RiverCraftHull')),rig=root.getDescendants().find(n=>n.name==='river-craft-RiverCraftLowerableRig');assert.ok(hull);assert.ok(rig);assert.equal(root.getChildMeshes().filter(m=>/river-craft-RiverCraft(?:Hull|Rig|Sail)$/.test(m.name)).length,3);
  const model=root.getDescendants().find(n=>n.name==='river-craft-NewBabylonRiverCraft');assert.ok(model);model.computeWorldMatrix(true);root.computeWorldMatrix(true);const local=model.getWorldMatrix().multiply(root.getWorldMatrix().clone().invert()),bow=B.Vector3.TransformCoordinates(new B.Vector3(0,.4,3.2),local),stern=B.Vector3.TransformCoordinates(new B.Vector3(0,.4,-3.2),local);assert.ok(bow.z>stern.z,'the actual glTF loader preserves +Z forward; boat must travel bow first');
  const bytes=readFileSync(new URL('../assets/art-courtyard/models/river-cargo-boat.glb',import.meta.url)),g=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12))),[offset,steeringCount]=g.asset.extras.new_babylon_river_boat.steering_oar_vertex_range,positions=hull.getVerticesData(B.VertexBuffer.PositionKind);hull.computeWorldMatrix(true);const hullLocal=hull.getWorldMatrix().multiply(root.getWorldMatrix().clone().invert());let steeringZ=0;for(let i=offset;i<offset+steeringCount;i++)steeringZ+=B.Vector3.TransformCoordinates(B.Vector3.FromArray(positions,i*3),hullLocal).z;assert.ok(steeringZ/steeringCount<-2,'the actual imported steering oar stays behind the direction of travel');
  const position=root.position.clone(),rotation=root.rotation.clone(),count=scene.meshes.length;
  for(let i=0;i<60;i++)view.update(s,c,2);assert.deepEqual(root.position,position);assert.deepEqual(root.rotation,rotation);assert.equal(scene.meshes.length,count);assert.equal(view.root,root);
  c.stock=Object.fromEntries(GOODS_KINDS.map(kind=>[kind,50]));const allGoods=JSON.stringify([s,c]);view.update(s,c,0);root.computeWorldMatrix(true);hull.computeWorldMatrix(true);const inverse=root.getWorldMatrix().clone().invert();
  for(const mesh of meshes.filter(m=>m.metadata?.riverCargo)){
   mesh.computeWorldMatrix(true);const corners=mesh.getBoundingInfo().boundingBox.vectorsWorld.map(p=>B.Vector3.TransformCoordinates(p,inverse));assert.ok(Math.min(...corners.map(p=>p.y))>=.19,'loaded goods sit above the actual deck');
   for(const corner of corners){const point=B.Vector3.TransformCoordinates(new B.Vector3(corner.x,.195,corner.z),root.getWorldMatrix()),hit=new B.Ray(point,B.Vector3.Down(),1).intersectsMesh(hull);assert.ok(hit.hit&&hit.pickedPoint.y>=root.position.y+.17,`${mesh.name} hangs outside the dry deck at ${corner.x},${corner.z}`);}
  }
  assert.equal(JSON.stringify([s,c]),allGoods,'deck placement never changes trade stock or quantities');
  const oldCargo=meshes.filter(m=>m.metadata?.riverCargo);c.stock={food:30};const stocked=JSON.stringify([s,c]);view.update(s,c,2);assert.equal(view.root,root);assert.equal(hull.isDisposed(),false);assert.ok(oldCargo.every(m=>m.isDisposed()));assert.equal(meshes.filter(m=>m.metadata?.riverCargo).length,1);assert.equal(JSON.stringify([s,c]),stocked);
  s.buildings=[{type:'bridge',y:11.5,x:river(12)}];view.update(s,c,2);assert.equal(rig.isEnabled(),false);assert.equal(root.metadata.loweredRig,true);s.buildings=[];view.update(s,c,2);assert.equal(rig.isEnabled(),true);
  view.update(s,null,2);assert.equal(root.isDisposed(),true);assert.equal(meshes.length,0);view.update(s,c,2);assert.equal(loads,1);assert.equal(view.root.metadata.detailLoaded,true);
 }finally{view.dispose();goods.meshes.forEach(m=>m.dispose());Object.values(materials).forEach(m=>m.dispose());assert.equal(meshes.length,0);assert.equal(scene.meshes.length,0);scene.dispose();engine.dispose();}
});
