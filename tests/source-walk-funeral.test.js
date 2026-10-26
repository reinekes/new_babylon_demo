import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGame} from '../engine.js';
import {startFuneral,advanceFuneral,funeralView} from '../funerals.js';
import {createGameActors} from '../game3d/actors.js';
import {surfaceElevation} from '../district3d/terrain.js';

const sandbox={console,setTimeout,clearTimeout,performance,self:{},TextDecoder,TextEncoder,URL,Blob};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.BABYLON;
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylonjs-loaders-9.31.0.min.js',import.meta.url),'utf8'),sandbox);

function palm(root,side){
 const hand=root.getChildTransformNodes().find(n=>n.name.endsWith('-hand_'+side));
 assert.ok(hand,'the supplied source has its own real palm joint');
 hand.computeWorldMatrix(true);return hand.getAbsolutePosition().clone();
}

test('the supplied male and female source rigs keep four moving bearers on their own funeral rails and freeze on pause',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),loader=B.SceneLoader.LoadAssetContainerAsync;
 let actors;
 // Read each requested actual GLB. Returning a legacy body for every request
 // would conceal failures specific to the two new native skeletons.
 B.SceneLoader.LoadAssetContainerAsync=(path,file)=>loader.call(B.SceneLoader,'',new Uint8Array(readFileSync(new URL('../'+path+file.split('?')[0],import.meta.url))),scene,undefined,'.glb');
 try{
  scene.activeCamera=new B.FreeCamera('camera',new B.Vector3(0,5,-10),scene);
  actors=await createGameActors(B,scene,{},{includeFauna:false,includeFuneralFauna:false});
  const state=createGame({start:'established'}),base=state.citizens.find(c=>c.age>=16);
  state.citizens=[{sex:'m',age:28},{sex:'f',age:38},{sex:'m',age:50},{sex:'f',age:64}].map((p,i)=>({...structuredClone(base),...p,id:7960+i,phase:'waiting',work:null,site:null,guardPost:null,calling:'auto',cargo:{},buildCargo:{},clothingTarget:undefined,waterTrip:undefined,craftSite:undefined,seedField:undefined,pantryTrip:undefined}));
  state.population=state.citizens.length;
  startFuneral(state,[{id:7990,name:'Покойный',x:8,y:8}]);
  for(let n=0;n<2500&&state.funeral.stage!=='procession';n++)advanceFuneral(state,.2);
  assert.equal(state.funeral.stage,'procession');
  let maximum=0;
  const roots=new Map(),locations=new Set();
  for(const seconds of [.2,.5,1,2,3]){
   advanceFuneral(state,seconds);assert.equal(state.funeral.stage,'procession','measure real moving route positions');
   const before=JSON.stringify(state);actors.update(state,.1);scene.render();assert.equal(JSON.stringify(state),before,'drawing preserves identities, inventories and funeral state');
   const view=funeralView(state),carriers=view.biers.flatMap(b=>b.carriers);assert.equal(carriers.length,4);
   assert.deepEqual(new Set(carriers.map(c=>state.citizens.find(p=>p.id===c.id).sex)),new Set(['m','f']));
   for(const carrier of carriers){
    const root=actors.rootFor({citizenId:carrier.id}),person=state.citizens.find(p=>p.id===carrier.id);
    assert.equal(root.metadata.sourceWalk,true,'exercise the supplied walking rig, never a fallback');
    assert.equal(root.metadata.residentVariant,person.sex==='f'?'female':'male');
    if(roots.has(person.id))assert.equal(root,roots.get(person.id),'moving contact never replaces the resident');else roots.set(person.id,root);
    locations.add(`${carrier.id}:${carrier.x.toFixed(6)},${carrier.y.toFixed(6)}`);
    for(const [side,key]of [['l','left'],['r','right']]){
     const target=carrier.hands[key],expected=new B.Vector3(target.x*6,surfaceElevation(target.x,target.y,state)+target.height,target.y*6),error=B.Vector3.Distance(palm(root,side),expected);
     maximum=Math.max(maximum,error);assert.ok(error<.05,`${person.sex}/${person.age}/${side}: actual palm ${error.toFixed(4)}m from its rail`);
    }
   }
  }
  assert.ok(locations.size>=16,'all four native bearers move through at least four route positions');
  console.log(`Source native funeral maximum actual palm/rail error: ${(maximum*100).toFixed(2)}cm`);
  const frozen=[...roots].map(([id,root])=>[id,palm(root,'l').asArray(),palm(root,'r').asArray()]),before=JSON.stringify(state);
  actors.update(state,.1,{paused:true,speed:4});for(let n=0;n<5;n++)scene.render();
  assert.deepEqual([...roots].map(([id,root])=>[id,palm(root,'l').asArray(),palm(root,'r').asArray()]),frozen,'pause freezes actual source palms while carrying');
  assert.equal(JSON.stringify(state),before);
 }finally{actors?.dispose();B.SceneLoader.LoadAssetContainerAsync=loader;scene.dispose();engine.dispose();}
});
