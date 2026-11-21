import {createTestLivestock} from '../game3d/test-livestock.js';
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

test('normal 3D settlements show six mallards, five yard pigs and groups of quail and frogs',async()=>{
 const {createNewCity}=await import('../new-game.js'),{courtyardFauna}=await import('../game3d/ambient-fauna.js');
 const engine=new B.NullEngine(),scene=new B.Scene(engine),state=createNewCity({mode:'mature',seed:137}),before=JSON.stringify(state);
 const view=await createAmbientFauna(B,scene,[],{includeSkyBirds:false,includeShoreBirds:true,hidePlaceholderBirds:true,includeYardPig:true,loadAsset:async f=>source(scene,f)});
 try{
  view.update(state,0,{paused:true});
  const roots=kind=>view.roots().filter(r=>r.isEnabled()&&kind.test(r.metadata.ambientSpecies));
  const ducks=roots(/^mallard/),pigs=roots(/^yard-pig$/),quail=courtyardFauna(state).filter(a=>a.kind==='common-quail');
  assert.equal(ducks.length,6);assert.equal(pigs.length,5);assert.equal(quail.length,10);
  const frogsAt=t=>courtyardFauna(state,t).filter(a=>a.kind==='savigny-tree-frog');
  const frogs=frogsAt(0);assert.equal(frogs.length,5);
  assert.ok(frogs.filter(a=>a.id!=='ambient-savigny-tree-frog').every(a=>ambientDryPoint(state,a.x,a.y)));
  const jumping=new Set();
  for(let t=0;t<20;t+=.07){const active=frogsAt(t).filter(a=>a.hop>0);if(active.length===1)jumping.add(active[0].id);}
  assert.ok(jumping.size>=4,'frogs hop at individual times');
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

test('mallards make a long riverbank circuit with separate feeding and lookout stops',async()=>{
 const {createNewCity}=await import('../new-game.js'),{mallardRoute,mallardPose}=await import('../game3d/mallard-motion.js');
 const {waterDepth}=await import('../game3d/water.js');
 for(const seed of [1,9,137]){
  const s=createNewCity({mode:'mature',seed});
  const plan=mallardRoute(s,p=>ambientDryPoint(s,p.x,p.y,-Infinity));assert.ok(plan);
  assert.ok(plan.distance>=62,`seed ${seed}: ${plan.distance}m route`);
  assert.ok(plan.time>=85,`seed ${seed}: ${plan.time}s walk and swim`);
  const phases=new Set(),feedSites=[];
  for(let t=0;t<plan.time+9;t+=.25){
   const p=mallardPose(plan,t);phases.add(p.phase);
   assert.ok(ambientDryPoint(s,p.x/6,p.z/6,-Infinity));
   if(p.phase==='feeding'){
    assert.ok(waterDepth(p.x/6,p.z/6,s)>.12);
    if(feedSites.every(q=>Math.hypot(p.x-q.x,p.z-q.z)>5))feedSites.push(p);
   }
  }
  assert.ok(['walking','swimming','feeding','scanning'].every(phase=>phases.has(phase)));
  assert.ok(feedSites.length>=2,'two distinct feeding patches');
 }
});


test('complete free herds move forward between distant dry pastures, preserve spacing and stop on pause',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),state=createGame({start:'established',seed:73129});
 const names=['pig','goat','bull','cow','ram'].map(kind=>'pasture-'+kind+'.glb');
 const shared=new Map(names.map(file=>[file,source(scene,file)]));
 const view=createTestLivestock(B,scene,[],ambientDryPoint,ambientClearSegment,shared);
 try{
  await new Promise(resolve=>setImmediate(resolve));
  view.update(state,0,true,1);
  const herd=scene.transformNodes.filter(n=>n.metadata?.herdSpecies&&n.isEnabled());
  assert.deepEqual(new Set(herd.map(n=>n.metadata.herdSpecies)),new Set(['pig','goat','bull','sheep']));
  const previous=new Map(),recent=new Map(),species=new Map();
  for(const n of herd){
   const kind=n.metadata.herdSpecies;
   if(!species.has(kind))species.set(kind,{group:[],first:null,maximum:0,forward:0,reverse:0,displacements:[]});
   const stats=species.get(kind);
   stats.group.push(n);stats.displacements.push({from:n.position.clone(),maximum:0});
  }
  let reverseSteps=0;
  for(let frame=0;frame<3000;frame++){
   view.update(state,.05,false,2);
   for(const n of herd){
    const {x,z}=n.position,yaw=n.rotation.y,last=previous.get(n);
    if(frame%12===0)assert.ok(ambientDryPoint(state,x/6,z/6),'unsafe grazing path for '+n.name);
    if(last){
     const dx=x-last.x,dz=z-last.z,distance=Math.hypot(dx,dz);
     if(distance>1e-6){
      recent.set(n,(recent.get(n)||0)+distance);
      const stats=species.get(n.metadata.herdSpecies);
      if(dx*Math.sin(yaw)+dz*Math.cos(yaw)<0){reverseSteps++;stats.reverse+=distance;}
      else stats.forward+=distance;
     }else assert.equal(yaw,last.yaw,'stationary turn '+n.name);
    }
    for(const other of herd)if(other!==n&&other.metadata.herdSpecies===n.metadata.herdSpecies){
     const space={bull:.32,sheep:.21,goat:.22,pig:.22}[n.metadata.herdSpecies];
     assert.ok(Math.hypot(x-other.position.x,z-other.position.z)>=space*.92*6-1e-6,'overlap '+n.name);
    }
    previous.set(n,{x,z,yaw});
   }
   for(const stats of species.values()){
    const {group}=stats;
    const center={x:group.reduce((sum,n)=>sum+n.position.x,0)/group.length,z:group.reduce((sum,n)=>sum+n.position.z,0)/group.length};
    stats.first??=center;
    stats.maximum=Math.max(stats.maximum,Math.hypot(center.x-stats.first.x,center.z-stats.first.z));
    assert.ok(group.every(n=>Math.hypot(n.position.x-center.x,n.position.z-center.z)<12),'the moving herd stays together');
    for(const [i,n] of group.entries()){
     const q=stats.displacements[i];q.maximum=Math.max(q.maximum,Math.hypot(n.position.x-q.from.x,n.position.z-q.from.z));
    }
   }
   if((frame+1)%600===0){
    for(const n of herd)assert.ok((recent.get(n)||0)>.1,n.name+' stalled for a minute');
    recent.clear();
   }
  }
  for(const [kind,stats]of species){
   assert.ok(stats.maximum>22,kind+' herd center travelled only '+stats.maximum+' m');
   assert.ok(stats.displacements.every(q=>q.maximum>15),kind+' left an animal at the old pasture');
   assert.ok(stats.reverse/(stats.forward+stats.reverse)<.035,kind+' spends too much distance backing');
  }
  assert.ok(reverseSteps>0,'at least one blocked animal backs out');
  view.update(state,.1,true,4);
  for(const n of herd)assert.deepEqual({x:n.position.x,z:n.position.z,yaw:n.rotation.y},previous.get(n));
 }finally{view.dispose();for(const asset of shared.values())asset.dispose();scene.dispose();engine.dispose();}
});

test('an arriving herd leaves the adult cow at the milking rail throughout the transfer',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),state=createGame({start:'established',seed:73129});
 const shared=new Map(['pig','goat','bull','cow','ram'].map(kind=>['pasture-'+kind+'.glb',source(scene,kind)]));
 const view=createTestLivestock(B,scene,[],()=>true,()=>true,shared);
 try{
  await new Promise(resolve=>setImmediate(resolve));
  view.update(state,0,true,1);
  const leader=scene.transformNodes.find(n=>n.metadata?.herdSpecies==='bull'&&n.isEnabled());
  const x=Math.round(leader.position.x/6),y=Math.round(leader.position.z/6);
  const farm={type:'cowshed',x,y,level:1,dairy:{cows:3,calves:1}};
  state.buildings.push(farm);
  let incoming=false;
  for(let i=0;i<120;i++){
   view.update(state,.1,false,4);
   assert.equal(view.claims('dairy-'+x+','+y+'-0'),false);
   if(view.claims('dairy-'+x+','+y+'-1'))incoming=true;
  }
  assert.ok(incoming,'another livestock place was claimed by the approaching herd');
 }finally{view.dispose();for(const asset of shared.values())asset.dispose();scene.dispose();engine.dispose();}
});

test('25× flight and grazing follow the same routes as four shorter 4× updates, including on pause',async()=>{
 const state=createGame({start:'established'}),engine=new B.NullEngine(),scene=new B.Scene(engine);
 const views=[];
 try{
  for(let i=0;i<2;i++)views.push(await createAmbientFauna(B,scene,[],{includeShoreBirds:true,loadAsset:async f=>source(scene,f)}));
  const snapshot=v=>v.roots().map(r=>[r.name,...r.position.asArray(),...r.rotation.asArray()]);
  for(const v of views)v.update(state,0,{paused:true});
  const start=snapshot(views[0]);
  for(let frame=0;frame<12;frame++){
   views[0].update(state,1/16,{speed:25});
   for(let sub=0;sub<4;sub++)views[1].update(state,25/256,{speed:4});
   assert.deepEqual(snapshot(views[0]),snapshot(views[1]));
  }
  const end=snapshot(views[0]);
  for(const name of ['ambient-sky-birds-0','ambient-fox-0','ambient-seagull-0']){
   const locate=rows=>rows.find(r=>r[0]===name)?.slice(1,4);
   assert.ok(locate(end),name);
   assert.notDeepEqual(locate(start),locate(end),name);
  }
  views[0].update(state,1/16,{speed:25,paused:true});
  assert.deepEqual(snapshot(views[0]),end);
 }finally{for(const view of views)view.dispose();scene.dispose();engine.dispose();}
});
