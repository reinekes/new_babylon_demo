import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGame} from '../engine.js';
import {createGameActors} from '../game3d/actors.js';
import {residentMotion,RESIDENT_STANCE} from '../game3d/resident-motion.js';
import {workPose} from '../game3d/work-poses.js';

const sandbox={exports:{},module:{exports:{}},console,setTimeout,clearTimeout,performance,window:{addEventListener(){},removeEventListener(){}},navigator:{userAgent:'node'},TextDecoder,TextEncoder,URL,Blob};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.exports.NullEngine?sandbox.exports:sandbox.module.exports;
sandbox.BABYLON=B;sandbox.exports=undefined;sandbox.module=undefined;
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylonjs-loaders-9.31.0.min.js',import.meta.url),'utf8'),sandbox);

// Keep the shipped geometry, skin, keys and bind matrices. Only remove the
// selected channels: glTF clips are allowed to leave these transforms at rest.
function withoutChannels({hips=false,spine=false,idleOnly=false}={}){
 const input=readFileSync(new URL('../assets/art-courtyard/models/resident.glb',import.meta.url)),length=input.readUInt32LE(12),gltf=JSON.parse(input.subarray(20,20+length).toString());
 let removed=0;
 for(const animation of gltf.animations){
  if(idleOnly&&animation.name!=='Idle_Loop')continue;
  animation.channels=animation.channels.filter(({target})=>{
   const name=gltf.nodes[target.node].name,drop=hips&&/^thigh_[lr]$/.test(name)&&target.path==='translation'||spine&&name==='spine_01'&&target.path==='rotation';
   if(drop)removed++;return !drop;
  });
 }
 assert.ok(removed>0,'fixture removes actual authored GLB channels');
 const json=Buffer.from(JSON.stringify(gltf)),padding=Buffer.alloc((4-json.length%4)%4,0x20),header=Buffer.from(input.subarray(0,20)),tail=input.subarray(20+length);
 header.writeUInt32LE(20+json.length+padding.length+tail.length,8);header.writeUInt32LE(json.length+padding.length,12);
 return {data:new Uint8Array(Buffer.concat([header,json,padding,tail])),gltf};
}

async function studio(fixture,check){
 const engine=new B.NullEngine(),scene=new B.Scene(engine),loader=B.SceneLoader.LoadAssetContainerAsync;let actors;
 B.SceneLoader.LoadAssetContainerAsync=async(path,file)=>loader.call(B.SceneLoader,'',file.startsWith('sheep')?new Uint8Array(readFileSync(new URL('../assets/art-courtyard/models/sheep.glb',import.meta.url))):fixture.data,scene,undefined,'.glb');
 try{
  scene.activeCamera=new B.FreeCamera('camera',new B.Vector3(0,3,-8),scene);
  actors=await createGameActors(B,scene,{},{includeFauna:false});
  const state=createGame({start:'established'}),base=state.citizens.find(c=>c.age>=16),citizen={...base,id:9781,age:30,phase:'waiting',work:null,site:null,x:7,y:10,cargo:{},buildCargo:{}};
  state.buildings=[];state.citizens=[citizen];
  await check({scene,actors,state,citizen});
 }finally{actors?.dispose();B.SceneLoader.LoadAssetContainerAsync=loader;scene.dispose();engine.dispose();}
}
function joint(root,name){const node=root.getChildTransformNodes().find(n=>n.name.endsWith('-'+name));assert.ok(node,`real ${name} joint`);return node;}
function quaternionDistance(a,b){return 2*Math.acos(Math.min(1,Math.abs(B.Quaternion.Dot(a,b))/Math.sqrt(B.Quaternion.Dot(a,a)*B.Quaternion.Dot(b,b))));}

test('real GLB without hip translation channels keeps the same stance for 300 frames and pause',async()=>{
 const fixture=withoutChannels({hips:true});
 await studio(fixture,({scene,actors,state,citizen})=>{
  const rest=Object.fromEntries(fixture.gltf.nodes.filter(n=>/^thigh_[lr]$/.test(n.name)).map(n=>[n.name,n.translation[0]]));
  for(let frame=0;frame<300;frame++){
   citizen.phase=frame<100?'waiting':frame<200?'working':'toStore';citizen.walking=frame>=200;if(citizen.walking)citizen.y+=.005;
   const before=JSON.stringify(state);actors.update(state,1/60);scene.render();assert.equal(JSON.stringify(state),before,'pose remains view-only');
   const root=actors.rootFor({citizenId:citizen.id});
   assert.ok(root.getChildMeshes().some(m=>m.skeleton?.bones.length===53),'actual skinned GLB geometry is instantiated');
   for(const side of ['l','r'])assert.ok(Math.abs(joint(root,`thigh_${side}`).position.x-rest[`thigh_${side}`]*RESIDENT_STANCE.hipWidthScale)<1e-7,`${side} hip keeps one narrowing at frame ${frame}`);
  }
  const root=actors.rootFor({citizenId:citizen.id}),snapshot=['l','r'].map(side=>joint(root,`thigh_${side}`).position.asArray());
  actors.update(state,.1,{paused:true});for(let frame=0;frame<12;frame++)scene.render();
  assert.deepEqual(['l','r'].map(side=>joint(root,`thigh_${side}`).position.asArray()),snapshot,'pause freezes the adjusted pose');
 });
});

test('real GLB without spine rotation channels applies only the current work bend across 300 frames',async()=>{
 const fixture=withoutChannels({spine:true}),rest=B.Quaternion.FromArray(fixture.gltf.nodes.find(n=>n.name==='spine_01').rotation);
 await studio(fixture,({scene,actors,state,citizen})=>{
  citizen.phase='working';const motion=residentMotion(citizen.id);let time=0;
  for(let frame=0;frame<300;frame++){
   time+=1/60;actors.update(state,1/60);scene.render();
   const root=actors.rootFor({citizenId:citizen.id}),spine=joint(root,'spine_01'),pose=workPose('work',time*motion.gait+motion.phase),expected=rest.multiply(B.Quaternion.FromEulerAngles(pose.bend,pose.twist,0));
   assert.ok(quaternionDistance(spine.rotationQuaternion,expected)<1e-6,`spine adds one work bend at frame ${frame}`);
  }
  const spine=joint(actors.rootFor({citizenId:citizen.id}),'spine_01'),frozen=spine.rotationQuaternion.asArray();
  actors.update(state,.1,{paused:true});for(let frame=0;frame<12;frame++)scene.render();assert.deepEqual(spine.rotationQuaternion.asArray(),frozen);
  citizen.phase='waiting';actors.update(state,1/60);scene.render();assert.ok(quaternionDistance(spine.rotationQuaternion,rest)<1e-6,'leaving work restores the authored rest rotation');
 });
});

test('real GLB switches from animated walk channels to unanimated idle rest without retaining an offset',async()=>{
 const fixture=withoutChannels({hips:true,spine:true,idleOnly:true}),restSpine=B.Quaternion.FromArray(fixture.gltf.nodes.find(n=>n.name==='spine_01').rotation);
 await studio(fixture,({scene,actors,state,citizen})=>{
  citizen.phase='toStore';citizen.walking=true;actors.update(state,1/60);scene.render();
  for(let frame=0;frame<20;frame++){citizen.y+=.005;actors.update(state,1/60);scene.render();}
  citizen.phase='waiting';citizen.walking=false;actors.update(state,1/60);scene.render();
  const root=actors.rootFor({citizenId:citizen.id});
  for(const side of ['l','r']){const rest=fixture.gltf.nodes.find(n=>n.name===`thigh_${side}`).translation[0];assert.ok(Math.abs(joint(root,`thigh_${side}`).position.x-rest*RESIDENT_STANCE.hipWidthScale)<1e-7,'missing position channel uses the original rest pose');}
  assert.ok(quaternionDistance(joint(root,'spine_01').rotationQuaternion,restSpine)<1e-6,'missing rotation channel uses the original rest pose');
 });
});
