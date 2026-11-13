import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';import {createGame} from '../engine.js';import {river} from '../world.js';import {createAmbientFauna,AMBIENT_MODELS,ambientDryPoint,ambientClearSegment,ambientAnchor} from '../game3d/ambient-fauna.js';
const box={exports:{},module:{exports:{}},console,setTimeout,clearTimeout,performance,window:{addEventListener(){},removeEventListener(){}},navigator:{userAgent:'node'}};vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),box);const B=box.exports.NullEngine?box.exports:box.module.exports;
function source(scene,name){const c=new B.AssetContainer(scene),root=new B.TransformNode(`${name}-source`,scene),body=B.MeshBuilder.CreateBox(`${name}-body`,{size:.2},scene);body.parent=root;c.rootNodes=[root];c.transformNodes=[root];c.meshes=[body];c.animationGroups=[];if(name.includes('orange')){const a=new B.Animation('anim','rotation.x',30,B.Animation.ANIMATIONTYPE_FLOAT,B.Animation.ANIMATIONLOOPMODE_CYCLE);a.setKeys([{frame:0,value:0},{frame:15,value:.03},{frame:30,value:0}]);const g=new B.AnimationGroup('anim',scene);g.addTargetedAnimation(a,body);c.animationGroups.push(g);}c.removeAllFromScene();return c;}
test('rejected pack goose stays archived and is neither fetched nor rendered even in an older populated save',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),state=createGame({start:'established'}),loads=[];state.ecology.populations.goose.count=6;const saved=JSON.stringify(state);let view;
 try{view=await createAmbientFauna(B,scene,[],{loadAsset:async file=>{loads.push(file);return source(scene,file);}});for(let i=0;i<4;i++)view.update(state,.05,{speed:4});assert.ok(!loads.includes('imported-goose.glb'),'the unwanted model must not be requested');assert.ok(view.roots().every(r=>r.metadata.ambientSpecies!=='goose'),'saved goose counts cannot recreate a visual');assert.equal(JSON.stringify(state),saved,'legacy ecology and the save remain intact');assert.ok(readFileSync(new URL('../assets/art-courtyard/models/imported-goose.glb',import.meta.url)).length>0,'the licensed source remains available in the archive');}
 finally{view?.dispose();scene.dispose();engine.dispose();}
});
test('ambient placements respect actual river, lakes, buildings and whole path',()=>{const s={buildings:[{type:'house',x:8,y:8}],world:{lakes:[{cells:[{x:4,y:4}]}]}};assert.equal(ambientDryPoint(s,river(10),10),false);assert.equal(ambientDryPoint(s,4,4),false);assert.equal(ambientDryPoint(s,8,8),false);assert.equal(ambientClearSegment(s,{x:3,y:4},{x:5,y:4}),false);assert.equal(ambientClearSegment(s,{x:3,y:10},{x:25,y:10}),false);assert.equal(ambientDryPoint(s,NaN,4),false);for(const kind of Object.keys(AMBIENT_MODELS)){const p=ambientAnchor(s,kind);assert.ok(p);assert.ok(ambientDryPoint(s,p.x,p.y));assert.deepEqual(p,ambientAnchor(s,kind));}});
test('ambient actor counts are bounded, source geometry shared, pause exact and saves untouched',async()=>{const engine=new B.NullEngine(),scene=new B.Scene(engine),s=createGame({start:'established'}),before=JSON.stringify(s),meshes=[],loads=[];const view=await createAmbientFauna(B,scene,meshes,{loadAsset:async f=>{loads.push(f);return source(scene,f);}});view.update(s,.05);assert.equal(loads.length,10);assert.ok(loads.includes('sky-bird-single.glb'));assert.ok(!loads.includes('imported-sky-birds.glb'));assert.equal(view.roots().length,20);const birds=view.roots().filter(r=>r.metadata.ambientSpecies==='orange-bird');assert.equal(birds.length,2);assert.equal(birds[0].getChildMeshes()[0].geometry,birds[1].getChildMeshes()[0].geometry);for(const r of view.roots())assert.equal(r.metadata.animalId,undefined);for(const m of meshes)assert.equal(m.isPickable,false);const snap=()=>JSON.stringify(view.roots().flatMap(r=>[r,...r.getDescendants()]).map(n=>[n.position?.asArray(),n.rotation?.asArray(),n.rotationQuaternion?.asArray(),n.scaling?.asArray()]));const frozen=snap();for(let i=0;i<20;i++)view.update(s,.05,{paused:true,speed:4});assert.equal(snap(),frozen);for(let i=0;i<100;i++)view.update(s,.05,{speed:4});assert.notEqual(snap(),frozen);assert.equal(JSON.stringify(s),before);for(const r of birds)assert.ok(ambientDryPoint(s,r.position.x/6,r.position.z/6));const roots=view.roots();view.dispose();view.dispose();assert.equal(meshes.length,0);assert.ok(roots.every(r=>r.isDisposed()));scene.dispose();engine.dispose();});
test('missing ambient asset has isolated failure and original flying fallback',async()=>{const e=new B.NullEngine(),scene=new B.Scene(e),warnings=[];const v=await createAmbientFauna(B,scene,[],{warn:(...args)=>warnings.push(args),loadAsset:async()=>{throw Error('unavailable')}});assert.equal(warnings.length,10);assert.equal(v.roots().length,2);v.update(createGame({start:'established'}),.05);assert.ok(v.roots().every(r=>r.position.y>14));v.dispose();scene.dispose();e.dispose();});
test('derived public fauna are credited and expose actual articulated motion',()=>{for(const [kind,c]of Object.entries(AMBIENT_MODELS)){const raw=readFileSync(new URL(`../assets/art-courtyard/models/${c.file}`,import.meta.url));assert.ok(raw.length<6_000_000);const g=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)));assert.ok(g.asset.extras.author);assert.ok(g.asset.extras.source);assert.match(g.asset.extras.license,/CC-BY/);if(kind==='orange-bird'){assert.equal(g.skins[0].joints.length,43);assert.equal(g.animations[0].name,'anim');}else{assert.ok(g.animations.some(a=>a.name==='Walk'));assert.ok(g.animations.some(a=>a.name==='Idle'));assert.ok(g.asset.extras.animal_motion);if(['fox','boar','lioness'].includes(kind)){assert.equal(g.meshes.length,1);assert.ok(g.meshes[0].primitives[0].targets.length>=5);}else assert.ok(g.skins.length>0);}for(const a of g.accessors){const v=g.bufferViews[a.bufferView];assert.ok(a.count>0);assert.ok(v.byteLength>0);}}});
test('provided flying flock retains five separate source rigs and Scene clip with Standard credit',()=>{const raw=readFileSync(new URL('../assets/art-courtyard/models/imported-sky-birds.glb',import.meta.url)),g=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)));assert.equal(g.skins.length,5);assert.ok(g.skins.every(s=>s.joints.length===10));assert.equal(g.animations[0].name,'Scene');assert.match(g.asset.extras.author,/Zacxophone/);assert.match(g.asset.extras.license,/SKETCHFAB Standard/);assert.ok(raw.length<250_000);});
test('paused loading of another world relocates ambient animals before pause freezes their new placement',async()=>{
 const e=new B.NullEngine(),scene=new B.Scene(e),first=createGame({seed:1}),second=createGame({seed:96}),view=await createAmbientFauna(B,scene,[],{loadAsset:async f=>source(scene,f)});
 try{view.update(first,.05);const animals=()=>view.roots().filter(r=>Object.hasOwn(AMBIENT_MODELS,r.metadata.ambientSpecies));const old=animals().map(r=>({root:r,x:r.position.x/6,y:r.position.z/6}));
  // Saved buildings can occupy the previous world's decorative animal spots.
  second.buildings.push(...old.map(p=>({type:'house',x:Math.round(p.x),y:Math.round(p.y),level:1})));
  const before=JSON.stringify(second);view.update(second,0,{paused:true,speed:4});assert.equal(animals().length,old.length);
  for(const {root,x,y}of old){assert.ok(root.isEnabled(),'a new dry anchor exists');assert.ok(ambientDryPoint(second,root.position.x/6,root.position.z/6),root.metadata.ambientId);assert.ok(Math.hypot(root.position.x/6-x,root.position.z/6-y)>.2);}
  const pose=()=>JSON.stringify(animals().map(r=>[r.position.asArray(),r.rotation.asArray()])),frozen=pose();for(let i=0;i<5;i++)view.update(second,.1,{paused:true,speed:4});assert.equal(pose(),frozen);assert.equal(JSON.stringify(second),before);
 }finally{view.dispose();scene.dispose();e.dispose();}
});
test('paused load re-centres sky birds over a larger saved world without adding actors',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),first=createGame({start:'established'}),second=structuredClone(first);Object.assign(second.world,{width:64,height:64});const view=await createAmbientFauna(B,scene,[],{loadAsset:async file=>source(scene,file)});
 try{view.update(first,0,{paused:true});const birds=view.roots().filter(r=>r.metadata.ambientSpecies==='sky-birds'),positions=birds.map(r=>r.position.clone()),count=view.roots().length;view.update(second,0,{paused:true});assert.equal(view.roots().length,count);for(const [i,bird]of birds.entries()){assert.equal(bird.position.x-positions[i].x,72);assert.equal(bird.position.z-positions[i].z,96);}const frozen=birds.map(r=>r.position.asArray());view.update(second,.1,{paused:true});assert.deepEqual(birds.map(r=>r.position.asArray()),frozen);}finally{view.dispose();scene.dispose();engine.dispose();}
});

test('yard pigs and shore turtles follow dry decorative routes without touching save state',async()=>{
 const {waterDepth,WATER_HEIGHT}=await import('../game3d/water.js');
 const {courtyardFauna,ambientDryPoint}=await import('../game3d/ambient-fauna.js');
 for(const seed of [1,4,9,96]){
  const state=createGame({seed}),before=JSON.stringify(state);
  const positions=new Map();
  const [surface,dive,resurface]=[0,6,12].map(t=>courtyardFauna(state,t).find(a=>a.kind==='otter'));
  assert.ok(surface.elevation>WATER_HEIGHT&&dive.elevation<WATER_HEIGHT-.2);
  assert.equal(resurface.elevation,surface.elevation);
  assert.ok(Math.hypot(resurface.x-surface.x,resurface.y-surface.y)>1);
  for(let t=0;t<25;t+=.5){
   state.simTime=t;const snapshot=JSON.stringify(state),animals=courtyardFauna(state);
   assert.equal(JSON.stringify(state),snapshot);
   assert.deepEqual(animals.slice(0,2).map(a=>a.kind),['pig','turtle']);
   const regional=animals.slice(4);
   assert.deepEqual(regional.map(a=>a.kind),['pygmy-cormorant','glossy-ibis','pied-kingfisher','marsh-harrier','savigny-tree-frog',...Array(5).fill('common-quail'),...Array(5).fill('onager')]);
   const herd=regional.filter(a=>a.kind==='onager');
   assert.equal(new Set(herd.map(a=>a.id)).size,5);
   for(const [i,a] of herd.entries())for(const b of herd.slice(i+1))assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>.25);
   for(const a of regional){
    assert.ok(a.decorative);
    if(['onager','savigny-tree-frog','common-quail'].includes(a.kind))assert.ok(ambientDryPoint(state,a.x,a.y));
    if(['pygmy-cormorant','pied-kingfisher'].includes(a.kind))assert.ok(waterDepth(a.x,a.y,state)>.40);
    if(a.kind==='glossy-ibis')assert.ok(waterDepth(a.x,a.y,state)>.105&&waterDepth(a.x,a.y,state)<.31);
   }
   for(const a of animals.slice(0,4)){
    if(a.kind==='otter'){
     assert.ok(a.decorative&&waterDepth(a.x,a.y,state)>.45);
     continue;
    }
    if(a.kind==='egret'){
     assert.ok(a.decorative&&waterDepth(a.x,a.y,state)>.13&&waterDepth(a.x,a.y,state)<.24);
     continue;
    }
    assert.ok(a.decorative&&ambientDryPoint(state,a.x,a.y));
    const seen=positions.get(a.kind)||new Set();
    seen.add(`${a.x},${a.y}`);positions.set(a.kind,seen);
   }
  }
  assert.ok([...positions.values()].every(p=>p.size>1));
  state.simTime=0;
  assert.equal(JSON.stringify(state),before);
 }
});


test('winter pelican lands, swims and departs without persisting a migration flag',async()=>{
 const {courtyardFauna}=await import('../game3d/ambient-fauna.js');
 const {WATER_HEIGHT,waterDepth}=await import('../game3d/water.js');
 for(const seed of [1,4,9,96]){
  const state=createGame({seed});
  const pelican=()=>courtyardFauna(state).find(a=>a.kind==='white-pelican');
  for(const season of [0,1,2]){
   state.season=season;
   assert.equal(pelican(),undefined);
  }
  state.season=3;
  const poseAt=elapsed=>{
   state.seasonElapsed=elapsed;
   const before=JSON.stringify(state),pose=pelican();
   assert.equal(JSON.stringify(state),before);
   return pose;
  };
  const arrival=poseAt(0),landing=poseAt(5.84),swimming=poseAt(5.86),departure=poseAt(44.99);
  assert.equal(arrival.behavior,'landing');
  assert.ok(arrival.elevation>WATER_HEIGHT+5);
  assert.equal(swimming.behavior,'swimming');
  assert.ok(waterDepth(swimming.x,swimming.y,state)>.4);
  assert.ok(Math.hypot(landing.x-swimming.x,landing.y-swimming.y)<.01);
  assert.equal(departure.behavior,'taking-off');
  assert.ok(departure.elevation>WATER_HEIGHT+5);
  state.season=0;
  assert.equal(pelican(),undefined);
 }
});


test('mixed fold sheep reuse the licensed rig without changing flock identity or decorative counts',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),state=createGame({seed:137}),meshes=[];
 const animals=Array.from({length:4},(_,i)=>({id:`sheep-6-12-${i}`,kind:'sheep',young:i===3,x:6+i*.3,y:12,walking:false}));
 const before=JSON.stringify(state);
 const view=await createAmbientFauna(B,scene,meshes,{includeSkyBirds:false,loadAsset:async file=>{
  const asset=source(scene,file);
  if(file==='ambient-sheep-kenchoo.glb')for(const name of ['Walk','Idle']){
   const animation=new B.Animation(name,'rotation.x',30,B.Animation.ANIMATIONTYPE_FLOAT);
   animation.setKeys([{frame:0,value:0},{frame:30,value:.03}]);
   const group=new B.AnimationGroup(name,scene);
   group.addTargetedAnimation(animation,asset.meshes[0]);
   asset.animationGroups.push(group);
  }
  return asset;
 }});
 try{
  view.update(state,0,{paused:true,sheep:animals});
  assert.deepEqual(animals.map(view.supportsFoldSheep),[false,true,false,false]);
  const adult=view.rootForSheep(animals[1].id);
  assert.equal(adult.metadata.animalId,animals[1].id);
  assert.equal(adult.metadata.clip,'Idle');
  assert.equal(view.roots().filter(r=>r.metadata.ambientSpecies==='sheep-kenchoo').length,2);
  view.update(state,.1,{sheep:animals.map(a=>({...a,x:a.x+.02,walking:true}))});
  assert.equal(adult.metadata.clip,'Walk');
  assert.equal(adult.position.x,(animals[1].x+.02)*6);
  view.update(state,0,{paused:true});
  assert.ok(adult.isDisposed());
  assert.equal(JSON.stringify(state),before);
 }finally{view.dispose();scene.dispose();engine.dispose();}
});

test('normal 3D settlements have one flock of six mallards, five yard pigs and five nearby quail',async()=>{
 const {createNewCity}=await import('../new-game.js'),{courtyardFauna}=await import('../game3d/ambient-fauna.js');
 const engine=new B.NullEngine(),scene=new B.Scene(engine),state=createNewCity({mode:'mature',seed:137}),before=JSON.stringify(state);
 const view=await createAmbientFauna(B,scene,[],{includeSkyBirds:false,includeShoreBirds:true,hidePlaceholderBirds:true,includeYardPig:true,loadAsset:async f=>source(scene,f)});
 try{
  view.update(state,0,{paused:true});
  const roots=kind=>view.roots().filter(r=>r.isEnabled()&&kind.test(r.metadata.ambientSpecies));
  const ducks=roots(/^mallard/),pigs=roots(/^yard-pig$/),quail=courtyardFauna(state).filter(a=>a.kind==='common-quail');
  assert.equal(ducks.length,6);assert.equal(pigs.length,5);assert.equal(quail.length,5);
  assert.equal(ducks.filter(r=>r.metadata.shoreRole==='female').length,3);
  const behaviors=new Set(),started=new Map(),initial=pigs.map(r=>r.position.clone());
  let travel=0;
  for(let i=0;i<90;i++){
   view.update(state,.06,{speed:4});
   behaviors.add(pigs.map(r=>r.metadata.pigBehavior).join(','));
   for(const [j,pig] of pigs.entries()){
    const distance=B.Vector3.Distance(pig.position,initial[j]);
    travel=Math.max(travel,distance);
    if(distance>.02&&!started.has(pig.name))started.set(pig.name,i);
   }
   for(const [j,a] of ducks.entries())for(const b of ducks.slice(j+1))assert.ok(B.Vector3.Distance(a.position,b.position)>.52,a.name+' overlaps '+b.name);
   for(const [j,a] of pigs.entries()){
    assert.ok(ambientDryPoint(state,a.position.x/6,a.position.z/6),a.name);
    for(const b of pigs.slice(j+1))assert.ok(B.Vector3.Distance(a.position,b.position)>1.55,a.name+' overlaps '+b.name);
   }
  }
  assert.ok(new Set(started.values()).size>=3,'pigs start walking at different times');
  assert.ok(behaviors.size>=5,'foraging, walking and resting vary through the group');
  assert.ok(travel>.8,'a pig can take more than one short step in place');
  assert.equal(JSON.stringify(state),before);
 }finally{view.dispose();scene.dispose();engine.dispose();}
});
