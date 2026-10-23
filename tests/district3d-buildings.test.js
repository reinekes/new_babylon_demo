import test from 'node:test';
import assert from 'node:assert/strict';
import {districtBuildingPlan, districtHomeOccupancy} from '../district3d/buildings.js';

test('courtyard architecture retains a walkable doorway and roof rises with dwelling level',()=>{
 const a=districtBuildingPlan({type:'house',x:3,y:4,level:1});
 const b=districtBuildingPlan({type:'house',x:3,y:4,level:3});
 assert.deepEqual(a.position,[18,0,24]);
 assert.ok(a.doorWidth>=.8);
 assert.ok(a.footprint<=5.5);
 assert.ok(b.height>a.height);
 assert.equal(a.variant,districtBuildingPlan({type:'house',x:3,y:4,level:1}).variant);
});

test('unfinished sites stay below finished roofs while upgrade preserves existing rooms',()=>{
 const base={type:'house',x:0,y:0,level:2};
 const newSite=districtBuildingPlan({...base,construction:{kind:'new',target:2,required:{clay:10},delivered:{clay:0},work:0}});
 const upgrade=districtBuildingPlan({...base,construction:{kind:'upgrade',target:3,required:{},delivered:{},work:0}});
 assert.equal(newSite.construction,true);
 assert.ok(newSite.wallHeight<.5);
 assert.equal(upgrade.construction,false);
 assert.equal(upgrade.upgrading,true);
});

test('home occupancy counts real home keys and refreshes with simulation time',()=>{
 const s={tick:0,simTime:0,citizens:[{home:'a'},{home:'a'},{home:'b'}]};
 assert.equal(districtHomeOccupancy(s).get('a'),2);
 s.citizens[0].home='b';s.simTime=1;
 assert.equal(districtHomeOccupancy(s).get('a'),1);
 assert.equal(districtHomeOccupancy(s).get('b'),2);
});

// The real engine catches invalid geometry, parent transforms, and resource leaks.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {BUILDINGS} from '../definitions.js';
import {createDistrictBuilding} from '../district3d/buildings.js';
const sandbox={module:{exports:{}},console,setTimeout,clearTimeout,performance,self:{}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.BABYLON;
test('all architecture types produce bounded pickable merged meshes without double tile translation',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine);
 const materials=Object.fromEntries(['plaster','brick','wood','linen','reed','terracotta','soil','grass','stone'].map(name=>[name,new B.StandardMaterial(name,scene)]));
 for(const type of Object.keys(BUILDINGS)){
  const building=createDistrictBuilding(B,scene,{type,x:3,y:4,level:1},materials);
  assert.ok(building.meshes.length>0,type);
  assert.ok(building.meshes.length<=13,`${type}: ${building.meshes.length} draw meshes`);
  for(const mesh of building.meshes){
   mesh.computeWorldMatrix(true);const bounds=mesh.getBoundingInfo().boundingBox;
   assert.ok(type==='bridge'||bounds.minimumWorld.x>=15.15&&bounds.maximumWorld.x<=20.85,`${type} X bounds ${bounds.minimumWorld.x},${bounds.maximumWorld.x}`);
   assert.ok(type==='bridge'||bounds.minimumWorld.z>=21.15&&bounds.maximumWorld.z<=26.85,`${type} Z bounds`);
   assert.equal(mesh.parent,building.root);assert.ok(mesh.isPickable);
  }
  building.dispose();assert.equal(scene.meshes.length,0,`${type} leaks meshes`);
 }
 scene.dispose();engine.dispose();
});

test('occupied glow uses actual home identity and survives sibling disposal',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine);
 const materials=Object.fromEntries(['plaster','brick','wood','linen','reed','terracotta','soil','grass','stone'].map(name=>[name,new B.StandardMaterial(name,scene)]));
 const a=createDistrictBuilding(B,scene,{type:'house',id:'home-a',x:0,y:0},materials);
 const b=createDistrictBuilding(B,scene,{type:'house',id:'home-b',x:1,y:0},materials);
 const s={tick:0,simTime:0,citizens:[{home:'home-a'}]};
 a.update(s);b.update(s);
 assert.equal(a.meshes.find(m=>m.name.startsWith('home-lamp')).material.name,'district-occupied-lamp');
 assert.equal(b.meshes.find(m=>m.name.startsWith('home-lamp')).material.name,'district-interior');
 a.dispose();assert.ok(!materials.plaster.isDisposed);
 s.citizens[0].home='home-b';s.simTime=1;b.update(s);
 assert.equal(b.meshes.find(m=>m.name.startsWith('home-lamp')).material.name,'district-occupied-lamp');
 b.dispose();scene.dispose();engine.dispose();
});

import {createGame,build,advanceTime} from '../engine.js';
import {constructionProgress,createOrder} from '../construction.js';
test('construction model uses the engine ratio, including no-material orders',()=>{
 const b={type:'house',x:0,y:0,construction:createOrder({})};
 assert.equal(districtBuildingPlan(b).progress,constructionProgress(b).ratio);
});
test('real build deliveries and labor raise the construction walls through completion',()=>{
 const s=createGame({start:'established'});assert.ok(build(s,'house',10,9).ok);const b=s.buildings.at(-1);
 let previous=districtBuildingPlan(b).wallHeight,materialsSeen=false,workSeen=false;
 for(let i=0;i<2400&&b.construction;i++){
  if(s.event)s.event=null;advanceTime(s,.1);
  if(!b.construction)break;
  const p=districtBuildingPlan(b),live=constructionProgress(b);
  assert.equal(p.progress,live.ratio);
  assert.ok(p.wallHeight>=previous);previous=p.wallHeight;
  if(live.materials>0&&live.materials<1)materialsSeen=true;
  if(live.work>0&&live.work<1)workSeen=true;
 }
 assert.ok(materialsSeen,'actual partial delivery was rendered');
 assert.ok(workSeen,'actual construction labor was rendered');
 assert.equal(b.construction,undefined);assert.equal(districtBuildingPlan(b).construction,false);
});

import {bridgeSpan} from '../world.js';
import {districtCropVisual} from '../district3d/buildings.js';
test('bridge deck follows the complete engine crossing, including the front tile boundary',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),wood=new B.StandardMaterial('wood',scene);
 const b={type:'bridge',x:13,y:8,level:1},v=createDistrictBuilding(B,scene,b,{wood});
 const span=bridgeSpan(8),deck=v.meshes.find(m=>m.name==='bridge-wood');deck.computeWorldMatrix(true);
 const bounds=deck.getBoundingInfo().boundingBox;
 assert.ok(bounds.minimumWorld.x<=span.left*6+.01);
 assert.ok(bounds.maximumWorld.x>=span.right*6-.01);
 assert.ok(bounds.minimumWorld.z>span.y*6-1.1&&bounds.maximumWorld.z<span.y*6+1.1);
 // Deck vertices along the center line are exactly the actor support height.
 const points=deck.getVerticesData(B.VertexBuffer.PositionKind),matrix=deck.getWorldMatrix();let support=false;
 for(let i=0;i<points.length;i+=3){const p=B.Vector3.TransformCoordinates(new B.Vector3(points[i],points[i+1],points[i+2]),matrix);if(Math.abs(p.y-.22)<1e-5)support=true;}
 assert.ok(support,'walking surface must be at .22 m');v.dispose();scene.dispose();engine.dispose();
});
test('crop visual stages follow actual sowing, growth and harvested remaining stock',()=>{
 const crop={year:2,sown:0,growth:0,remaining:0,total:0,harvested:0,sheaves:0};
 assert.equal(districtCropVisual({crop}).stage,'empty');
 crop.sown=.5;assert.equal(districtCropVisual({crop}).stage,'sown');
 crop.sown=1;crop.growth=.7;assert.equal(districtCropVisual({crop}).stage,'growing');
 const growingKey=districtCropVisual({crop}).signature;
 crop.growth=1;crop.total=84;crop.remaining=84;assert.equal(districtCropVisual({crop}).stage,'ripe');
 crop.remaining=0;crop.harvested=84;crop.sheaves=14;
 const harvested=districtCropVisual({crop});assert.equal(harvested.stage,'harvested');assert.equal(harvested.standing,0);assert.ok(harvested.sheaves>0);assert.notEqual(harvested.signature,growingKey);
});

test('actual field geometry is bare when empty or harvested and taller only when crops grow',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine);
 const materials=Object.fromEntries(['soil','grass','straw','silt','reed'].map(name=>[name,new B.StandardMaterial(name,scene)]));
 const highest=crop=>{
  const v=createDistrictBuilding(B,scene,{type:'field',x:0,y:0,crop},materials);let highest=0;
  for(const mesh of v.meshes){mesh.computeWorldMatrix(true);highest=Math.max(highest,mesh.getBoundingInfo().boundingBox.maximumWorld.y);}
  v.dispose();return highest;
 };
 const empty=highest({sown:0,growth:0}),seedlings=highest({sown:1,growth:0}),grown=highest({sown:1,growth:1,total:84,remaining:84}),harvested=highest({sown:1,growth:1,total:84,remaining:0,harvested:84});
 assert.ok(empty<.18);assert.ok(seedlings>empty);assert.ok(grown>seedlings+.5);assert.equal(harvested,empty);
 scene.dispose();engine.dispose();
});
