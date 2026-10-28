import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGame} from '../engine.js';
import {createGameActors} from '../game3d/actors.js';
import {orderFestival,cancelFestival,festivalCitizenView} from '../festival.js';
import {navigationSegmentClear} from '../navigation.js';
import {isDryPoint} from '../world.js';
import {testingCity,advanceUntil} from './helpers/testing-ceremonies.js';
import {advanceTime} from '../engine.js';

const sandbox={console,setTimeout,clearTimeout,performance,self:{},TextDecoder,TextEncoder,URL,Blob};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.BABYLON;
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylonjs-loaders-9.31.0.min.js',import.meta.url),'utf8'),sandbox);
const joint=(root,name)=>root.getChildTransformNodes().find(n=>n.name.endsWith('-'+name));
function position(root,name){const n=joint(root,name);assert.ok(n);n.computeWorldMatrix(true);return B.Vector3.TransformCoordinates(n.getAbsolutePosition(),root.computeWorldMatrix(true).clone().invert());}

test('real male and female feast guests clap, step in place and freeze without changing the city',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),loader=B.SceneLoader.LoadAssetContainerAsync;let actors;
 B.SceneLoader.LoadAssetContainerAsync=(path,file)=>loader.call(B.SceneLoader,'',new Uint8Array(readFileSync(new URL('../'+path+file.split('?')[0],import.meta.url))),scene,undefined,'.glb');
 try{
  scene.activeCamera=new B.FreeCamera('camera',new B.Vector3(0,3,-8),scene);
  actors=await createGameActors(B,scene,{},{includeFauna:false,includeFuneralFauna:false});
  const s=createGame({start:'established'}),base=s.citizens.find(c=>c.age>=16);
  s.citizens=['m','f'].map((sex,i)=>({...structuredClone(base),id:9810+i,sex,age:30,phase:'waiting',x:7+i,y:10,work:null,site:null,guardPost:null,calling:'auto',cargo:{},buildCargo:{},celebrating:true}));
  const before=JSON.stringify(s),samples=new Map(s.citizens.map(c=>[c.id,[]]));
  for(let frame=0;frame<240;frame++){
   actors.update(s,1/60);scene.render();
   for(const c of s.citizens){const root=actors.rootFor({citizenId:c.id});assert.equal(root.metadata.sourceWalk,true);samples.get(c.id).push({l:position(root,'hand_l'),r:position(root,'hand_r'),foot:position(root,'foot_l')});}
  }
  assert.equal(JSON.stringify(s),before,'rendering keeps identities, coordinates and resources intact');
  for(const c of s.citizens){
   const poses=samples.get(c.id),separation=poses.map(p=>B.Vector3.Distance(p.l,p.r)),first=poses[0].foot;
   assert.ok(Math.min(...separation)<.22,`${c.sex}: palms come together for a clap`);
   assert.ok(Math.max(...separation)>.65,`${c.sex}: arms open visibly between claps`);
   assert.ok(Math.max(...poses.map(p=>B.Vector3.Distance(p.foot,first)))>.08,`${c.sex}: feet actually step rather than retaining idle stance`);
   const root=actors.rootFor({citizenId:c.id}),frozen=['hand_l','hand_r','foot_l'].map(n=>position(root,n).asArray());
   actors.update(s,.1,{paused:true,speed:4});for(let n=0;n<4;n++)scene.render();
   assert.deepEqual(['hand_l','hand_r','foot_l'].map(n=>position(root,n).asArray()),frozen,'pause freezes the entire dance');
  }
  for(const c of s.citizens)c.celebrating=false;
  actors.update(s,1/60);scene.render();
  for(const c of s.citizens){const root=actors.rootFor({citizenId:c.id});for(const side of ['l','r'])assert.ok(position(root,'hand_'+side).y<position(root,'upperarm_'+side).y-.2,'leaving the feast releases raised hands');}
 }finally{actors?.dispose();B.SceneLoader.LoadAssetContainerAsync=loader;scene.dispose();engine.dispose();}
});

test('real Night of Lights guests carry torches on their street patrol without duplicating residents',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),loader=B.SceneLoader.LoadAssetContainerAsync;let actors;
 B.SceneLoader.LoadAssetContainerAsync=(path,file)=>loader.call(B.SceneLoader,'',new Uint8Array(readFileSync(new URL('../'+path+file.split('?')[0],import.meta.url))),scene,undefined,'.glb');
 try{
  scene.activeCamera=new B.FreeCamera('camera',new B.Vector3(0,3,-8),scene);
  actors=await createGameActors(B,scene,{},{includeFauna:false,includeFuneralFauna:false});
  const s=testingCity();assert.ok(orderFestival(s).ok);assert.ok(advanceUntil(s,state=>state.festival?.stage==='celebrating'));advanceTime(s,3);
  const before=JSON.stringify(s);actors.update(s,.05);scene.render();
  const torchPeople=s.citizens.filter(c=>festivalCitizenView(s,c).festivalTorch);assert.ok(torchPeople.length>=2);
  for(const c of torchPeople){
   const contact=festivalCitizenView(s,c).eventContact,root=actors.rootFor({citizenId:c.id});
   assert.ok(Math.hypot(root.position.x-contact.x*6,root.position.z-contact.y*6)<.001,'actual resident follows the dry street contact');
   const hand=joint(root,'hand_r');hand.computeWorldMatrix(true);
   const torch=scene.getTransformNodeByName('festival-candle-'+c.id);assert.ok(torch?.isEnabled(),'a real flame prop must be visible');
   assert.ok(B.Vector3.Distance(torch.position,hand.getAbsolutePosition())<.001,'torch handle remains in the actual right palm');
  }
  assert.equal(JSON.stringify(s),before,'no resident, route or cargo changes during drawing');
  const owned=scene.transformNodes.filter(n=>n.metadata?.citizenId!==undefined&&/^citizen-\d+$/.test(n.name));
  assert.equal(new Set(owned.map(n=>n.metadata.citizenId)).size,owned.length,'torch bearers are existing people, never duplicate actors');
 }finally{actors?.dispose();B.SceneLoader.LoadAssetContainerAsync=loader;scene.dispose();engine.dispose();}
});

test('torchbearers walk back safely after the feast instead of jumping to the saved courtyard position',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),loader=B.SceneLoader.LoadAssetContainerAsync;let actors;
 B.SceneLoader.LoadAssetContainerAsync=(path,file)=>loader.call(B.SceneLoader,'',new Uint8Array(readFileSync(new URL('../'+path+file.split('?')[0],import.meta.url))),scene,undefined,'.glb');
 try{
  scene.activeCamera=new B.FreeCamera('camera',new B.Vector3(0,3,-8),scene);actors=await createGameActors(B,scene,{},{includeFauna:false,includeFuneralFauna:false});
  const s=testingCity();assert.ok(orderFestival(s).ok);assert.ok(advanceUntil(s,state=>state.festival?.stage==='celebrating'));advanceTime(s,3);s.festival.elapsed=89.99;
  actors.update(s,1/60);scene.render();const ids=s.citizens.filter(c=>festivalCitizenView(s,c).festivalTorch).map(c=>c.id),initial=new Map(ids.map(id=>[id,actors.rootFor({citizenId:id}).position.clone()]));
  assert.ok(ids.length>=2);advanceTime(s,.02);assert.equal(s.festival,null);const before=JSON.stringify(s);let previous=initial;
  for(let frame=0;frame<40;frame++){
   actors.update(s,.1,{speed:4});scene.render();const next=new Map();
   for(const id of ids){const p=actors.rootFor({citizenId:id}).position.clone(),last=previous.get(id);next.set(id,p);
    assert.ok(B.Vector3.Distance(p,last)<.75,'leaving the patrol must stay at walking speed, including at 4x');
    const from={x:last.x/6,y:last.z/6},to={x:p.x/6,y:p.z/6};assert.ok(isDryPoint(s,to.x,to.y));assert.ok(navigationSegmentClear(s,from,to),'the return cannot cut across buildings or water');
   }previous=next;
  }
  assert.equal(JSON.stringify(s),before,'the return is presentation-only and cannot move saved people or cargo');
  assert.equal(scene.transformNodes.filter(n=>n.metadata?.festivalCandle).length,0);
  for(const id of ids){const c=s.citizens.find(c=>c.id===id),root=actors.rootFor({citizenId:id});assert.ok(Math.hypot(root.position.x-c.x*6,root.position.z-c.y*6)<2,'each former torchbearer returns to their ordinary crowd position');}
 }finally{actors?.dispose();B.SceneLoader.LoadAssetContainerAsync=loader;scene.dispose();engine.dispose();}
});

test('canceling a paused feast removes its torches while preserving frozen resident positions and poses',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),loader=B.SceneLoader.LoadAssetContainerAsync;let actors;
 B.SceneLoader.LoadAssetContainerAsync=(path,file)=>loader.call(B.SceneLoader,'',new Uint8Array(readFileSync(new URL('../'+path+file.split('?')[0],import.meta.url))),scene,undefined,'.glb');
 try{
  scene.activeCamera=new B.FreeCamera('camera',new B.Vector3(0,3,-8),scene);actors=await createGameActors(B,scene,{},{includeFauna:false,includeFuneralFauna:false});
  const s=testingCity();assert.ok(orderFestival(s).ok);assert.ok(advanceUntil(s,state=>state.festival?.stage==='celebrating'));advanceTime(s,3);actors.update(s,1/60);scene.render();
  const ids=s.citizens.filter(c=>festivalCitizenView(s,c).festivalTorch).map(c=>c.id),snapshot=()=>ids.map(id=>{const root=actors.rootFor({citizenId:id});return {position:root.position.asArray(),hands:['hand_l','hand_r'].map(name=>joint(root,name).rotationQuaternion.asArray())};}),frozen=snapshot();
  assert.ok(ids.length>=2);assert.ok(cancelFestival(s).ok);const before=JSON.stringify(s);
  actors.update(s,.1,{paused:true,speed:4});for(let n=0;n<3;n++)scene.render();
  assert.equal(scene.transformNodes.filter(n=>n.metadata?.festivalCandle).length,0,'removed ceremonies cannot retain their old torch props on pause');
  assert.deepEqual(snapshot(),frozen,'structural cleanup must not advance the frozen walking pose or coordinates');assert.equal(JSON.stringify(s),before);
 }finally{actors?.dispose();B.SceneLoader.LoadAssetContainerAsync=loader;scene.dispose();engine.dispose();}
});
