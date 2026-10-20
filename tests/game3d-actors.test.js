import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGame} from '../engine.js';
import {animalsFor} from '../fauna.js';
import {createGameActors,actorAnimation,residentVisual,actorViewCitizens} from '../game3d/actors.js';
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
  assert.ok(root.getChildMeshes().some(m=>m.name==='builder-tool-blade'));
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
