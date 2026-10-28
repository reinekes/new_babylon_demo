import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGame} from '../engine.js';
import {startFuneral,advanceFuneral,funeralView} from '../funerals.js';
import {createGameActors} from '../game3d/actors.js';

const sandbox={console,setTimeout,clearTimeout,performance,self:{},TextDecoder,TextEncoder,URL,Blob};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.BABYLON;
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylonjs-loaders-9.31.0.min.js',import.meta.url),'utf8'),sandbox);

test('farewell bows bend the supplied rigs gently above planted legs, remain stable and freeze on pause',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),loader=B.SceneLoader.LoadAssetContainerAsync;let actors;
 B.SceneLoader.LoadAssetContainerAsync=(path,file)=>loader.call(B.SceneLoader,'',new Uint8Array(readFileSync(new URL('../'+path+file.split('?')[0],import.meta.url))),scene,undefined,'.glb');
 try{
  scene.activeCamera=new B.FreeCamera('camera',new B.Vector3(0,5,-10),scene);
  actors=await createGameActors(B,scene,{},{includeFauna:false,includeFuneralFauna:false});
  const state=createGame({start:'established'}),base=state.citizens.find(c=>c.age>=16);
  state.citizens=['m','f'].map((sex,i)=>({...structuredClone(base),sex,id:8960+i,age:30,phase:'waiting',work:null,site:null,guardPost:null,calling:'auto',cargo:{},buildCargo:{},clothingTarget:undefined,waterTrip:undefined,craftSite:undefined,seedField:undefined,pantryTrip:undefined}));state.population=2;
  startFuneral(state,[{id:8990,name:'Покойный',x:8,y:8}]);
  for(let frame=0;frame<3000&&state.funeral.stage!=='farewell';frame++)advanceFuneral(state,.2);
  assert.equal(state.funeral.stage,'farewell');advanceFuneral(state,2.5);
  assert.ok(funeralView(state).biers.every(b=>b.carriers.length===0),'mourners stand after setting the bier down');
  const before=JSON.stringify(state);let first=null;
  const sample=()=>state.citizens.map(c=>{
   const root=actors.rootFor({citizenId:c.id}),nodes=root.getChildTransformNodes(),model=nodes.find(n=>n.name.endsWith('-model'));
   assert.equal(root.metadata.sourceWalk,true,'exercise each supplied GLB, never a legacy fallback');
   assert.equal(root.metadata.residentVariant,c.sex==='f'?'female':'male');
   assert.ok(Math.abs(model.rotation.x)<.08,`${c.sex}: a bow must not tilt the entire body around its feet (${model.rotation.x})`);
   return {root:root.position.asArray(),joints:nodes.filter(n=>/head$|pelvis$|spine_01$|upperarm_[lr]$|lowerarm_[lr]$|hand_[lr]$|thigh_[lr]$|calf_[lr]$|foot_[lr]$/.test(n.name)).map(n=>{n.computeWorldMatrix(true);return [n.name,...n.getAbsolutePosition().asArray(),...n.rotationQuaternion.asArray()];})};
  });
  for(let frame=0;frame<300;frame++){
   actors.update(state,1/60);scene.render();const current=sample();
   if(first===null)first=current;
   else for(let i=0;i<current.length;i++)for(let joint=0;joint<current[i].joints.length;joint++)for(let k=1;k<current[i].joints[joint].length;k++)assert.ok(Math.abs(current[i].joints[joint][k]-first[i].joints[joint][k])<1e-4,'a held farewell pose cannot accumulate skeletal rotations');
  }
  const frozen=sample();actors.update(state,.1,{paused:true,speed:4});for(let frame=0;frame<8;frame++)scene.render();assert.deepEqual(sample(),frozen,'pause freezes the actual model, hands and torch grips');assert.equal(JSON.stringify(state),before,'view-only farewell leaves identities, routes and cargo intact');
 }finally{actors?.dispose();B.SceneLoader.LoadAssetContainerAsync=loader;scene.dispose();engine.dispose();}
});
