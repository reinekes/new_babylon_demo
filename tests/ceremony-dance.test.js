import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGame} from '../engine.js';
import {createGameActors} from '../game3d/actors.js';

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
