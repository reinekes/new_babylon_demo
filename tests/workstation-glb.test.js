import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';import {createGame} from '../engine.js';import {generateStreets} from '../city-life.js';import {createGameActors,actorViewCitizens,residentViewPositions,residentMotion} from '../game3d/actors.js';import {surfaceElevation} from '../district3d/terrain.js';import {workstationHands} from '../game3d/workstations.js';
const sandbox={exports:{},module:{exports:{}},console,setTimeout,clearTimeout,performance,window:{addEventListener(){},removeEventListener(){}},navigator:{userAgent:'node'}};vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);const B=sandbox.exports.NullEngine?sandbox.exports:sandbox.module.exports;sandbox.BABYLON=B;sandbox.exports=undefined;sandbox.module=undefined;sandbox.TextDecoder=TextDecoder;sandbox.TextEncoder=TextEncoder;sandbox.URL=URL;sandbox.Blob=Blob;vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylonjs-loaders-9.31.0.min.js',import.meta.url),'utf8'),sandbox);
test('real GLB palms meet port-gallery surfaces under rotations and freeze on pause',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),loader=B.SceneLoader.LoadAssetContainerAsync;let actors;B.SceneLoader.LoadAssetContainerAsync=async(path,file)=>loader.call(B.SceneLoader,'',new Uint8Array(readFileSync(new URL('../'+path+file.split('?')[0],import.meta.url))),scene,undefined,'.glb');
 try{scene.activeCamera=new B.FreeCamera('camera',new B.Vector3(0,5,-10),scene);actors=await createGameActors(B,scene,{},{includeFauna:false});const state=createGame({start:'established'}),base=state.citizens.find(c=>c.age>=16);state.simTime=4;let ticks=0,maxError=0,worst=null;
 for(const sex of ['m','f'])for(const type of ['pottery','weaver','tailor','brickyard','kiln','brewery'])for(const rotation of [0,1,2,3]){
  const b={type,x:6,y:10,level:1,rotation,artisan:{stage:type==='brewery'?'brewing':'forming'},weaving:{wool:3},tailoring:{cloth:2},brickmaking:{clay:4,reed:2,water:2,wet:0,ready:0,time:0},firing:{brick:0,reed:0,hot:0,ready:4,time:0}};state.buildings=[b];const port=generateStreets(state.buildings,state).ports[0];state.citizens=[1,2].map(id=>({...base,id:9900+id,sex,age:30,phase:'working',x:port.x,y:port.y,work:'6,10',cargo:{},buildCargo:{},guardPost:null,site:null}));
  for(let n=0;n<12;n++){actors.update(state,1/60);scene.render();ticks++;}
  const positions=residentViewPositions(state,actorViewCitizens(state));for(const c of state.citizens){const root=actors.rootFor({citizenId:c.id}),contact=positions.get(c.id).contact;assert.ok(contact,type);for(const side of ['l','r']){const hand=root.getChildTransformNodes().find(n=>n.name.endsWith(`-hand_${side}`));hand.computeWorldMatrix(true);const p=hand.getAbsolutePosition(),motion=residentMotion(c.id),time=ticks/60*motion.gait+motion.phase,expected=workstationHands(contact,time)[side==='l'?'left':'right'],target=new B.Vector3(expected.x*6,surfaceElevation(expected.x,expected.y,state)+expected.height,expected.y*6),error=B.Vector3.Distance(p,target);if(error>maxError){maxError=error;const upper=root.getChildTransformNodes().find(n=>n.name.endsWith(`-upperarm_${side}`)),lower=root.getChildTransformNodes().find(n=>n.name.endsWith(`-lowerarm_${side}`));upper.computeWorldMatrix(true);lower.computeWorldMatrix(true);worst={type,rotation,side,id:c.id,sex:c.sex,time,yaw:root.rotation.y,palm:p.asArray(),target:target.asArray(),reach:B.Vector3.Distance(upper.getAbsolutePosition(),lower.getAbsolutePosition())+B.Vector3.Distance(lower.getAbsolutePosition(),p),required:B.Vector3.Distance(upper.getAbsolutePosition(),target)};}const horizontal=Math.hypot(p.x-contact.target.x*6,p.z-contact.target.y*6);assert.ok(horizontal<.23,`${type}/${rotation}/${side} contact gap ${horizontal}`);assert.ok(Math.abs(p.y-contact.target.height)<.28,`${type}/${side} hand height ${p.y}`);const before=p.clone();actors.update(state,1/60,{paused:true});scene.render();hand.computeWorldMatrix(true);assert.ok(B.Vector3.Distance(before,hand.getAbsolutePosition())<.00001,'paused hand remains fixed');}}
 }
 console.log('Maximum actual palm/target error metres:',maxError);assert.ok(maxError<.05,`real palms reach the equipment contact target: ${JSON.stringify(worst)}`);
 }finally{actors?.dispose();B.SceneLoader.LoadAssetContainerAsync=loader;scene.dispose();engine.dispose();}
});

test('the GLB kilnworkers carry a rigid taper in their palm and touch the fuel at all four rotations',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),loader=B.SceneLoader.LoadAssetContainerAsync;let actors;
 B.SceneLoader.LoadAssetContainerAsync=async(path,file)=>loader.call(B.SceneLoader,'',new Uint8Array(readFileSync(new URL('../'+path+file.split('?')[0],import.meta.url))),scene,undefined,'.glb');
 try{
  scene.activeCamera=new B.FreeCamera('camera',new B.Vector3(0,5,-10),scene);
  actors=await createGameActors(B,scene,{},{includeFauna:false});
  const s=createGame({start:'established'}),base=s.citizens.find(c=>c.age>=16);
  s.simTime=4;let maxGap=0;
  for(const sex of ['m','f'])for(const rotation of [0,1,2,3])for(const lead of [0,1]){
   const b={type:'kiln',x:6,y:10,level:1,rotation,firing:{brick:4,reed:3,hot:0,ready:0,time:0}};
   s.buildings=[b];const port=generateStreets(s.buildings,s).ports[0];
   s.citizens=[0,1].map(slot=>({...base,id:16000+slot+rotation*2+(sex==='m'?0:8)+lead*16,sex,age:32,phase:'working',x:port.x,y:port.y,work:'6,10',workElapsed:slot===lead?4.9:2,cargo:{},buildCargo:{},guardPost:null,site:null}));
   for(let i=0;i<4;i++){actors.update(s,1/60);scene.render();}
   const poses=residentViewPositions(s,actorViewCitizens(s));
   for(const c of s.citizens){
    const root=actors.rootFor({citizenId:c.id}),tip=root.getChildMeshes().find(n=>n.name==='kiln-taper-ember'),hand=root.getChildTransformNodes().find(n=>n.name.endsWith('-hand_r'));
    if(c!==s.citizens[lead]){assert.ok(!tip?.isEnabled(),'only one taper per charge');continue;}
    assert.ok(tip?.isEnabled());assert.equal(tip.parent.parent,hand);
    const contact=poses.get(c.id).contact,p=contact.target;
    const fire=new B.Vector3(p.x*6,surfaceElevation(p.x,p.y,s)+p.height,p.y*6);
    tip.computeWorldMatrix(true);hand.computeWorldMatrix(true);
    maxGap=Math.max(maxGap,B.Vector3.Distance(fire,tip.getAbsolutePosition()));
    assert.ok(B.Vector3.Distance(hand.getAbsolutePosition(),tip.parent.getAbsolutePosition())<.002);
   }
  }
  console.log('Maximum rigid taper-to-fuel gap in metres',maxGap);
  assert.ok(maxGap<.025,'ember reaches the fuel with each resident and building rotation');
 }finally{actors?.dispose();B.SceneLoader.LoadAssetContainerAsync=loader;scene.dispose();engine.dispose();}
});
