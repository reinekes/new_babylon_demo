import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGame,miracle} from '../engine.js';
import {pestActors} from '../pests.js';
import {animalsFor} from '../fauna.js';
import {isDryPoint,onBridge,bridgeSpan} from '../world.js';
import {createGameActors,actorAnimation,residentVisual,actorViewCitizens,actorViewFrame,residentMotion,residentViewPositions} from '../game3d/actors.js';
const sandbox={exports:{},module:{exports:{}},console,setTimeout,clearTimeout,performance,window:{addEventListener(){},removeEventListener(){}},navigator:{userAgent:'node'}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.exports.NullEngine?sandbox.exports:sandbox.module.exports;
sandbox.BABYLON=B;sandbox.exports=undefined;sandbox.module=undefined;sandbox.TextDecoder=TextDecoder;sandbox.TextEncoder=TextEncoder;sandbox.URL=URL;sandbox.Blob=Blob;
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylonjs-loaders-9.31.0.min.js',import.meta.url),'utf8'),sandbox);

test('presentation preserves IDs, ages, occupation, clothing and funeral participants without changing state',()=>{
 const s=createGame(),c=s.citizens.find(c=>c.age>=16);c.phase='home';c.clothing=12;c.role='healer';
 s.funeral={style:'desert',scope:'family',stage:'returning',timer:0,boundary:{x:0,y:1},gather:{x:1,y:1},coffin:{x:1,y:1},deceased:[],actors:[{id:c.id}]};
 const before=JSON.stringify(s),p=actorViewCitizens(s).find(p=>p.id===c.id);
 assert.ok(p);assert.equal(p.phase,'mourning');assert.equal(p.carrying,false);
 assert.equal(residentVisual(p,s).wear,'ragged');assert.equal(residentVisual({...p,age:5},s).scale,.66);
 assert.equal(residentVisual({...p,age:40},s).scale,1);assert.equal(JSON.stringify(s),before);
});

test('individual calling and future vocation remain visible without a global inspiration buff',()=>{
 const state={buildings:[],buffs:{inspiration:0}},base={age:30,clothing:80,role:'carrier',calling:'auto'};
 assert.equal(residentVisual(base,state).inspired,false);
 assert.equal(residentVisual({...base,calling:'builder'},state).inspired,true);
 assert.equal(residentVisual({...base,futureRole:'tailor'},state).inspired,true);
 assert.equal(residentVisual({...base,futureRole:'auto'},state).inspired,false);
 assert.equal(residentVisual({...base,calling:''},state).inspired,false);
});

test('animation decisions use actual movement and activity rather than an invented route',()=>{
 assert.equal(actorAnimation({walking:true,phase:'toStore'},0).clip,'Idle_Loop');
 assert.equal(actorAnimation({walking:true,phase:'toStore'},.1).clip,'Walk_Loop');
 assert.equal(actorAnimation({playing:true},0).pose,'play');
 assert.equal(actorAnimation({phase:'working'},0).pose,'work');
 assert.equal(actorAnimation({carrying:true,phase:'toStore'},.1).pose,'carry');
 assert.equal(actorAnimation({phase:'working',activity:{kind:'logging',stage:'approach'}},.1).pose,'idle');
 assert.equal(actorAnimation({kind:'sheep',behavior:'grazing'},0).clip,'Graze');
 assert.equal(actorAnimation({kind:'sheep',behavior:'resting'},0).clip,'Idle');
});

function mockContainer(scene,name){
 const root=new B.TransformNode(`source-${name}`,scene),mesh=B.MeshBuilder.CreateBox(`source-${name}-mesh`,{width:.4,height:name==='resident'?1.7:.8},scene);mesh.position.y=name==='resident'?.85:.4;mesh.parent=root;
 mesh.material=new B.PBRMaterial(name==='resident'?'Undyed wool':'SheepFleece',scene);
 const container=new B.AssetContainer(scene);container.rootNodes=[root];container.meshes=[mesh];container.transformNodes=[root];container.materials=[mesh.material];container.removeAllFromScene();
 for(const clip of name==='resident'?['Walk_Loop','Idle_Loop']:['Walk','Graze','Idle']){
  const group=new B.AnimationGroup(clip,scene),animation=new B.Animation(`${clip}-breath`,'position.y',30,B.Animation.ANIMATIONTYPE_FLOAT,B.Animation.ANIMATIONLOOPMODE_CYCLE);animation.setKeys([{frame:0,value:mesh.position.y},{frame:30,value:mesh.position.y+.01}]);group.addTargetedAnimation(animation,mesh);container.animationGroups.push(group);scene.removeAnimationGroup(group);
 }
 return container;
}

test('GLB clones track exact simulation positions, pause, release vanished IDs, and keep live shadow list',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),originalLoader=B.SceneLoader.LoadAssetContainerAsync,loaded=[];
 B.SceneLoader.LoadAssetContainerAsync=async(path,file)=>{loaded.push(path+file);return mockContainer(scene,file.startsWith('resident')?'resident':'sheep');};
 let view;
 try{
  view=await createGameActors(B,scene,{});const live=view.meshes,s=createGame(),c=s.citizens.find(c=>c.age>=16);s.citizens=[c];c.phase='toStore';c.cargo={clay:2};
  c.calling='builder';c.role='builder';const before=JSON.stringify(s);view.update(s,1/60);assert.equal(JSON.stringify(s),before);assert.ok(loaded.some(p=>p.includes('resident.glb')));assert.ok(loaded.some(p=>p.includes('sheep.glb')));
  const root=view.rootFor({citizenId:c.id});assert.ok(root);assert.equal(root.position.x,c.x*6);assert.equal(root.position.z,c.y*6);
  assert.ok(!root.getChildMeshes().some(m=>m.name==='builder-tool-blade'),'a worker carrying cargo has no loose tool');
  const marker=root.getChildMeshes().find(m=>m.name.endsWith('-inspired'));assert.ok(marker.isEnabled());
  assert.ok(root.getChildMeshes().some(m=>m.name.includes('cargo')));assert.ok(live.includes(root.getChildMeshes()[0]));
  const owned=root.getChildMeshes().find(m=>m.material?.name.includes('citizen-cloth'));assert.ok(owned,'clothing gets a per-person material');
  const group=scene.animationGroups.find(g=>g.name.includes(`citizen-${c.id}`)&&g.name.includes('Walk_Loop'));assert.ok(group);
  c.x+=.1;view.update(s,1/60);assert.equal(root.position.x,c.x*6);assert.ok(root.rotation.y>0&&root.rotation.y<Math.PI/2);assert.ok(group.isPlaying);
  view.update(s,1/60,{paused:true,speed:4});assert.equal(group.speedRatio,0);const yaw=root.rotation.y,markerY=marker.position.y,markerScale=marker.scaling.x;
  view.update(s,1/60,{paused:true,speed:4});assert.equal(root.rotation.y,yaw);assert.equal(group.speedRatio,0);assert.equal(marker.position.y,markerY);assert.equal(marker.scaling.x,markerScale);
  s.buildings.push({id:'test-fold',type:'sheepfold',level:1,x:c.x,y:c.y});view.update(s,1/60);
  const flock=animalsFor(s).filter(a=>a.kind==='sheep');assert.ok(flock.length);
  assert.equal(scene.transformNodes.filter(n=>n.metadata?.animalKind==='sheep').length,flock.length,'licensed sheep must not overlap procedural copies');
  const animalRoot=view.rootFor({animalId:flock[0].id});assert.ok(animalRoot);assert.equal(animalRoot.position.x,flock[0].x*6);
  s.buildings.pop();view.update(s,1/60);assert.ok(animalRoot.isDisposed());
  c.cargo={};view.update(s,1/60);assert.equal(root.getChildMeshes().filter(m=>m.name.includes('cargo')).length,0);
  c.phase='home';view.update(s,1/60);assert.equal(root.isEnabled(),false);
  const oldMeshes=root.getChildMeshes();s.citizens=[];view.update(s,1/60);assert.ok(root.isDisposed());assert.ok(owned.material===null||owned.isDisposed());assert.ok(oldMeshes.every(m=>!live.includes(m)));assert.equal(view.meshes,live);
  view.dispose();assert.equal(live.length,0);
 }finally{view?.dispose();B.SceneLoader.LoadAssetContainerAsync=originalLoader;scene.dispose();engine.dispose();}
});


test('real resident GLB retains skeleton clips, independent clothing and a frozen working arm pose',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),originalLoader=B.SceneLoader.LoadAssetContainerAsync;
 const data=new Uint8Array(readFileSync(new URL('../assets/art-courtyard/models/resident.glb',import.meta.url)));
 B.SceneLoader.LoadAssetContainerAsync=async(path,file)=>file.startsWith('resident')?originalLoader.call(B.SceneLoader,'',data,scene,undefined,'.glb'):mockContainer(scene,'sheep');
 let view;
 try{
  scene.activeCamera=new B.FreeCamera('camera',new B.Vector3(0,5,-10),scene);
  view=await createGameActors(B,scene,{});const s=createGame(),c=s.citizens.find(c=>c.age>=16);c.phase='working';c.clothing=100;
  const other={...c,id:c.id+1000,role:'tailor',clothing:10};s.citizens=[c,other];view.update(s,1/60);scene.render();
  const root=view.rootFor({citizenId:c.id}),otherRoot=view.rootFor({citizenId:other.id});
  assert.ok(root.getChildMeshes().some(m=>m.skeleton?.bones.length===53));
  const cloth=root.getChildMeshes().find(m=>m.material?.name.startsWith('citizen-cloth')).material;
  const otherCloth=otherRoot.getChildMeshes().find(m=>m.material?.name.startsWith('citizen-cloth')).material;
  assert.notEqual(cloth,otherCloth);assert.notDeepEqual(cloth.albedoColor.asArray(),otherCloth.albedoColor.asArray());
  const arm=root.getChildTransformNodes().find(n=>/upperarm_r$/.test(n.name));assert.ok(arm.rotationQuaternion);
  const pose=arm.rotationQuaternion.asArray();view.update(s,1/60,{paused:true});for(let i=0;i<3;i++)scene.render();
  assert.deepEqual(arm.rotationQuaternion.asArray(),pose,'paused skeleton must retain the task gesture after animation sampling');
  c.clothing=5;view.update(s,1/60,{paused:true});assert.deepEqual(otherCloth.albedoColor.asArray(),B.Color3.FromHexString('#9b927b').toLinearSpace().asArray());
 }finally{view?.dispose();B.SceneLoader.LoadAssetContainerAsync=originalLoader;scene.dispose();engine.dispose();}
});

test('stable visual lanes separate neighbours without moving simulation people, entering water or leaving bridges',()=>{
 const state=createGame(),citizens=Array.from({length:16},(_,id)=>({id,x:7,y:10,cargo:{wood:2}})),before=JSON.stringify(citizens);
 const positions=residentViewPositions(state,citizens),again=residentViewPositions(state,[...citizens].reverse());
 assert.equal(JSON.stringify(citizens),before);assert.deepEqual(positions,again);
 const points=[...positions.values()];assert.ok(points.every(p=>isDryPoint(state,p.x,p.y)&&Math.hypot(p.x-7,p.y-10)<=.281));for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)assert.ok(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)>.095);
 const span=bridgeSpan(8),bridgeState={...state,buildings:[{type:'bridge',x:13,y:8}]},crowd=Array.from({length:4},(_,id)=>({id,x:(span.left+span.right)/2,y:span.y}));
 for(const p of residentViewPositions(bridgeState,crowd).values())assert.ok(onBridge(bridgeState.buildings,p.x,p.y));
 const a=residentMotion(1),b=residentMotion(2);assert.notEqual(a.phase,b.phase);assert.notEqual(a.width,b.width);assert.notEqual(a.gait,b.gait);assert.deepEqual(residentMotion(1),a);
});

test('real articulated palms touch cargo and hold role tools; casts, petting and disposal preserve state',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),originalLoader=B.SceneLoader.LoadAssetContainerAsync;
 const data=new Uint8Array(readFileSync(new URL('../assets/art-courtyard/models/resident.glb',import.meta.url)));
 B.SceneLoader.LoadAssetContainerAsync=async(path,file)=>file.startsWith('resident')?originalLoader.call(B.SceneLoader,'',data,scene,undefined,'.glb'):mockContainer(scene,'sheep');
 let view;
 try{
  scene.activeCamera=new B.FreeCamera('camera',new B.Vector3(0,5,-10),scene);view=await createGameActors(B,scene,{});
  const s=createGame(),c=s.citizens.find(c=>c.age>=16);s.citizens=[c];c.phase='toStore';c.carrying=true;c.cargo={wood:3};
  const before=JSON.stringify(s);view.update(s,1/60);scene.render();assert.equal(JSON.stringify(s),before);
  const root=view.rootFor({citizenId:c.id}),inverse=root.computeWorldMatrix(true).clone().invert();
  for(const side of ['l','r']){const hand=root.getChildTransformNodes().find(n=>n.name.endsWith(`-hand_${side}`));hand.computeWorldMatrix(true);
   const local=B.Vector3.TransformCoordinates(hand.getAbsolutePosition(),inverse),expected=new B.Vector3(side==='l'?-.21:.21,1.01,.34);
   assert.ok(B.Vector3.Distance(local,expected)<.12,`${side} palm must reach cargo: ${local.asArray()}`);
  }
  c.phase='working';c.carrying=false;c.cargo={};
  for(const [kind,meshName]of [['logging','logging-axe-head'],['quarry','quarry-pick-head'],['hunting','hunter-bow'],['fishing','fishing-rod']]){
   c.activity={kind,target:{x:c.x+.2,y:c.y+.2},progress:.4,stage:'working'};view.update(s,1/60);scene.render();
   const mesh=root.getChildMeshes().find(m=>m.name===meshName);assert.ok(mesh,`${kind} has the right implement`);assert.match(mesh.parent.parent.name,kind==='hunting'?/hand_l$/:/hand_r$/,'implement grip is a real skeletal palm');
   assert.equal(root.getChildMeshes().filter(m=>['logging-axe-head','quarry-pick-head','hunter-bow','fishing-rod'].includes(m.name)).length,1,'old tool disposed on task switch');
  }
  const line=scene.getMeshByName('fishing-line');assert.ok(line);c.activity={kind:'petting',target:{x:c.x+.1,y:c.y+.1}};view.update(s,1/60);scene.render();assert.ok(line.isDisposed());
  const petPalm=root.getChildTransformNodes().find(n=>n.name.endsWith('-hand_r'));petPalm.computeWorldMatrix(true);const petHead=new B.Vector3(c.activity.target.x*6,root.position.y+.58,c.activity.target.y*6);assert.ok(B.Vector3.Distance(petPalm.getAbsolutePosition(),petHead)<.17,'petting palm reaches the actual cat head');
  assert.equal(actorAnimation(c).pose,'petting');const model=root.getChildTransformNodes().find(n=>n.name.endsWith('-model'));assert.ok(model.rotation.x>.4);
  const arm=root.getChildTransformNodes().find(n=>n.name.endsWith('-upperarm_r')),pose=arm.rotationQuaternion.asArray();view.update(s,1/60,{paused:true});scene.render();assert.deepEqual(arm.rotationQuaternion.asArray(),pose);
  c.activity={kind:'hunting',target:{x:c.x+.65,y:c.y+.10},progress:.89,stage:'strike'};view.update(s,1/60);scene.render();
  const shot=root.getChildTransformNodes().find(n=>n.name==='hunter-shot'),tool=root.getChildTransformNodes().find(n=>n.name.endsWith('-tool')),end=new B.Vector3(c.activity.target.x*6,root.position.y+.95,c.activity.target.y*6);
  assert.ok(shot.isEnabled());const first=shot.getAbsolutePosition().clone(),distanceBefore=B.Vector3.Distance(first,end),meshCount=scene.meshes.length;
  assert.ok(B.Vector3.Dot(tool.getDirection(B.Axis.Z).normalize(),end.subtract(tool.getAbsolutePosition()).normalize())>.97,'held bow aims at the actual animal');
  c.activity.progress=.97;view.update(s,1/60);scene.render();assert.equal(scene.meshes.length,meshCount,'flight reuses its mesh');assert.ok(B.Vector3.Distance(shot.getAbsolutePosition(),end)<distanceBefore*.4,'arrow travels toward this prey');
  const frozen=shot.position.asArray();view.update(s,1/60,{paused:true});scene.render();assert.deepEqual(shot.position.asArray(),frozen,'flight freezes with the task on pause');
  c.activity.progress=.2;c.activity.stage='working';view.update(s,1/60);scene.render();assert.equal(shot.isEnabled(),false,'the next working cycle has a nocked arrow again');assert.equal(scene.meshes.length,meshCount);
  c.activity=null;c.phase='toStore';c.carrying=true;c.cargo={food:2};const source={id:'cargo-work',type:'fishing',x:7,y:10};s.buildings.push(source);c.work=source.id;
  view.update(s,1/60);scene.render();assert.ok(root.getChildMeshes().some(m=>m.name==='cargo-fish'));
  source.type='hunting';view.update(s,1/60);scene.render();assert.ok(root.getChildMeshes().some(m=>m.name==='cargo-game-bundle'));assert.ok(!root.getChildMeshes().some(m=>m.name==='cargo-fish'));
  assert.deepEqual(c.cargo,{food:2},'fish/game styling never converts real food cargo');
  view.dispose();assert.equal(view.meshes.length,0);assert.ok(root.isDisposed());
 }finally{view?.dispose();B.SceneLoader.LoadAssetContainerAsync=originalLoader;scene.dispose();engine.dispose();}
});


test('petting pairs use visible child positions once and the matching cat receives its affectionate pose',async()=>{
 const s=createGame();miracle(s,'cat');s.pests.sites[0].mice=0;s.simTime=0;
 const cat=pestActors(s).find(a=>a.kind==='cat'),child=s.citizens.find(c=>c.age>=3&&c.age<16);
 child.phase='home';child.x=cat.x;child.y=cat.y;
 const frame=actorViewFrame(s),visible=frame.citizens.find(c=>c.id===child.id);
 assert.ok(Math.hypot(visible.x-cat.x,visible.y-cat.y)>.5);assert.notEqual(visible.activity?.kind,'petting','canonical proximity cannot make a distant visible child stroke a cat');
 const adult=s.citizens.find(c=>c.age>=16);Object.assign(adult,{guardPost:'9,8',work:'9,8',phase:'working',x:cat.x,y:cat.y,cargo:{},buildCargo:{}});
 const before=JSON.stringify(s),paired=actorViewFrame(s);assert.equal(JSON.stringify(s),before);
 assert.equal(paired.pettingPairs.length,1);assert.equal(paired.pettingPairs[0].citizenId,adult.id);assert.equal(paired.citizens.find(c=>c.id===adult.id).activity.kind,'petting');
 const engine=new B.NullEngine(),scene=new B.Scene(engine),originalLoader=B.SceneLoader.LoadAssetContainerAsync;let view;
 B.SceneLoader.LoadAssetContainerAsync=async(path,file)=>mockContainer(scene,file.startsWith('resident')?'resident':'sheep');
 try{view=await createGameActors(B,scene,{});view.update(s,1/60);const root=view.rootFor({animalId:cat.id}),tail=root.getChildTransformNodes().find(n=>n.name===`${cat.id}-tail`);assert.equal(tail.rotation.x,-1.25,'the exact paired cat gets the petting pose');assert.equal(JSON.stringify(s),before);}
 finally{view?.dispose();B.SceneLoader.LoadAssetContainerAsync=originalLoader;scene.dispose();engine.dispose();}
});

// Measure the shipped skeleton, so changing clips cannot silently invalidate cadence.
test('authored planted foot travel agrees with the two-stride GLB distance calibration',async()=>{
 const {RESIDENT_WALK}=await import('../game3d/resident-motion.js');
 const engine=new B.NullEngine(),scene=new B.Scene(engine);
 try{
  scene.activeCamera=new B.FreeCamera('camera',new B.Vector3(0,5,-10),scene);
  const data=new Uint8Array(readFileSync(new URL('../assets/art-courtyard/models/resident.glb',import.meta.url)));
  const asset=await B.SceneLoader.LoadAssetContainerAsync('',data,scene,undefined,'.glb');asset.addAllToScene();
  const clip=asset.animationGroups.find(g=>g.name==='Walk_Loop');assert.ok(Math.abs(clip.to-RESIDENT_WALK.frames)<.001);assert.equal(clip.targetedAnimations[0].animation.framePerSecond,RESIDENT_WALK.fps);
  clip.start(true,1);clip.speedRatio=0;const foot=scene.getTransformNodeByName('foot_l');
  const sample=frame=>{scene.render();clip.goToFrame(frame);foot.computeWorldMatrix(true);return foot.getAbsolutePosition().clone();};
  const start=sample(30),end=sample(48),groundTravel=RESIDENT_WALK.authoredMetres*18/RESIDENT_WALK.frames;
  assert.ok(Math.abs(start.z-end.z-groundTravel)<.065,'planted ankle should counter the calibrated ground travel within 6.5cm');
  assert.ok(Math.abs(start.y-end.y)<.035,'sample is a planted stance, not the swinging foot');
  const repeat=sample(82);assert.ok(B.Vector3.Distance(start,repeat)<.01,'the 104-frame clip repeats its gait after 52 frames');
 }finally{scene.dispose();engine.dispose();}
});

test('walk phase follows rendered metres for adults, children and smoothed lanes and freezes on pause',async()=>{
 const {residentWalkPhase}=await import('../game3d/resident-motion.js');
 const engine=new B.NullEngine(),scene=new B.Scene(engine),originalLoader=B.SceneLoader.LoadAssetContainerAsync;
 const data=new Uint8Array(readFileSync(new URL('../assets/art-courtyard/models/resident.glb',import.meta.url)));let view;
 B.SceneLoader.LoadAssetContainerAsync=async(path,file)=>file.startsWith('resident')?originalLoader.call(B.SceneLoader,'',data,scene,undefined,'.glb'):mockContainer(scene,'sheep');
 try{
  scene.activeCamera=new B.FreeCamera('camera',new B.Vector3(0,5,-10),scene);view=await createGameActors(B,scene,{});
  const s=createGame(),adult={...s.citizens.find(c=>c.age>=16),id:10001,phase:'toStore',x:7,y:10,cargo:{},carrying:false},child={...adult,id:10002,age:7,x:8};s.citizens=[adult,child];
  view.update(s,1/60);scene.render();
  for(const c of [adult,child]){
   const root=view.rootFor({citizenId:c.id}),model=root.getChildTransformNodes().find(n=>n.name.endsWith('-model')),g=scene.animationGroups.find(g=>g.name===`citizen-${c.id}-Walk_Loop`);
   let phase=residentMotion(c.id).phase/(Math.PI*2);
   // Same physical route and same frame cadence, regardless of selected simulation speed.
   for(const speed of [1,4,2]){c.y+=.02;view.update(s,1/60,{speed});scene.render();phase=residentWalkPhase(phase,.12,model.scaling.z*root.scaling.z);
    assert.ok(Math.abs(g.animatables[0].masterFrame-(g.from+phase*(g.to-g.from)))<.001,`${c.id} ${speed} actual=${g.animatables[0].masterFrame} expected=${phase*(g.to-g.from)} root=${root.position.asArray()}`);assert.equal(g.speedRatio,0);
   }
   const frame=g.animatables[0].masterFrame,foot=root.getChildTransformNodes().find(n=>n.name.endsWith('-foot_l'));foot.computeWorldMatrix(true);const sole=foot.getAbsolutePosition().clone();
   view.update(s,1/60,{paused:true,speed:4});for(let n=0;n<3;n++)scene.render();foot.computeWorldMatrix(true);
   assert.equal(g.animatables[0].masterFrame,frame);assert.ok(B.Vector3.Distance(sole,foot.getAbsolutePosition())<1e-6,'pause holds the rendered foot as well as the clip frame');
  }
  // Give a later ID a lane offset, then remove its neighbour: smoothing itself moves the figure.
  adult.x=child.x=7;adult.y=child.y=10;view.update(s,1/60);scene.render();view.update(s,1/60);scene.render();const root=view.rootFor({citizenId:child.id}),model=root.getChildTransformNodes().find(n=>n.name.endsWith('-model')),g=scene.animationGroups.find(g=>g.name===`citizen-${child.id}-Walk_Loop`);
  const before=root.position.clone(),frame=g.animatables[0].masterFrame;s.citizens=[child];view.update(s,1/60);scene.render();
  const metres=B.Vector3.Distance(before,root.position),expected=residentWalkPhase((frame-g.from)/(g.to-g.from),metres,model.scaling.z*root.scaling.z);
  assert.ok(metres>.001);assert.ok(Math.abs(g.animatables[0].masterFrame-(g.from+expected*(g.to-g.from)))<.001,'smoothed visible offset advances feet by the actual rendered distance');
 }finally{view?.dispose();B.SceneLoader.LoadAssetContainerAsync=originalLoader;scene.dispose();engine.dispose();}
});

test('resident identities are stable, visibly varied and respect age/sex without mutating source materials',async()=>{
 const {residentIdentity}=await import('../game3d/resident-motion.js');const identities=Array.from({length:32},(_,id)=>residentIdentity(id));
 for(const key of ['hair','beard','skin','cloth'])assert.ok(new Set(identities.map(i=>i[key])).size>=4,key);
 assert.deepEqual(residentIdentity(37),residentIdentity(37));assert.ok(Math.max(...identities.map((_,id)=>residentMotion(id).height))-Math.min(...identities.map((_,id)=>residentMotion(id).height))>.18);
 const engine=new B.NullEngine(),scene=new B.Scene(engine),originalLoader=B.SceneLoader.LoadAssetContainerAsync;
 const data=new Uint8Array(readFileSync(new URL('../assets/art-courtyard/models/resident.glb',import.meta.url)));let view,source;
 B.SceneLoader.LoadAssetContainerAsync=async(path,file)=>file.startsWith('resident')?(source=await originalLoader.call(B.SceneLoader,'',data,scene,undefined,'.glb')):mockContainer(scene,'sheep');
 try{
  view=await createGameActors(B,scene,{});const sourceSkin=source.materials.find(m=>/skin/i.test(m.name)),original=sourceSkin.albedoColor.asArray(),s=createGame(),base=s.citizens.find(c=>c.age>=16);
  s.citizens=Array.from({length:16},(_,id)=>({...base,id,age:id===0?8:30,sex:id===1?'f':'m',phase:'toStore',x:7+id*.2,y:10,clothing:100}));view.update(s,1/60);
  const skins=new Set(),robes=new Set(),hair=new Set();
  for(const c of s.citizens){const root=view.rootFor({citizenId:c.id}),meshes=root.getChildMeshes();skins.add(meshes.find(m=>m.material?.name.startsWith('citizen-skin')).material.albedoColor.toHexString());robes.add(meshes.find(m=>m.material?.name.startsWith('citizen-cloth')).material.albedoColor.toHexString());hair.add(meshes.find(m=>m.name.endsWith('-full-hair')).isEnabled());
   if(c.age<16||c.sex==='f')assert.ok(meshes.filter(m=>/beard/i.test(m.name)).every(m=>!m.isEnabled()||!m.isVisible));
   const head=root.getChildTransformNodes().find(n=>n.name.endsWith('-head'));head.computeWorldMatrix(true);const inverse=head.getWorldMatrix().clone().invert();
   const localBounds=mesh=>{mesh.computeWorldMatrix(true);const p=mesh.getBoundingInfo().boundingBox.vectorsWorld.map(v=>B.Vector3.TransformCoordinates(v,inverse));return {min:[0,1,2].map(k=>Math.min(...p.map(v=>v.asArray()[k]))),max:[0,1,2].map(k=>Math.max(...p.map(v=>v.asArray()[k])))};};
   const cap=meshes.find(m=>m.name.endsWith('-full-hair')),bun=meshes.find(m=>m.name.endsWith('-hair-bun')),beard=meshes.find(m=>m.name.endsWith('-full-beard')),scalp=cap.metadata.attachmentBounds,jaw=beard.metadata.attachmentBounds,capBox=localBounds(cap),bunBox=localBounds(bun),beardBox=localBounds(beard);
   const scalpWidth=scalp.max[0]-scalp.min[0],scalpDepth=scalp.max[2]-scalp.min[2];
   assert.ok(capBox.max[0]-capBox.min[0]<scalpWidth*1.04,'cap hugs the actual GLB scalp width');
   assert.ok(Math.abs((bunBox.min[0]+bunBox.max[0])*.5-(scalp.min[0]+scalp.max[0])*.5)<.001,'one bun is centred behind the skull, never beside it');
   assert.ok(bunBox.min[2]<scalp.min[2]&&bunBox.max[2]>scalp.min[2],'compact bun intersects the measured rear scalp');
   assert.ok(scalp.min[2]-bunBox.min[2]<scalpDepth*.14,'bun protrusion stays below 14 percent of scalp depth');
   assert.ok(beardBox.max[1]<=jaw.max[1]+.001,'beard starts below the measured jaw top, not across the face');

  }
  assert.ok(skins.size>=4);assert.ok(robes.size>=5);assert.equal(hair.size,2);assert.deepEqual(sourceSkin.albedoColor.asArray(),original);
 }finally{view?.dispose();B.SceneLoader.LoadAssetContainerAsync=originalLoader;scene.dispose();engine.dispose();}
});
