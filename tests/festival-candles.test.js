import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createFestivalCandles} from '../game3d/festival-candles.js';
const sandbox={console,setTimeout,clearTimeout,performance,self:{},TextDecoder,TextEncoder,URL,Blob};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylonjs-loaders-9.31.0.min.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.BABYLON;
test('festival candles load once, follow palms and release all instances when the ceremony ends',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),meshes=[];let loads=0;
 const layer=createFestivalCandles(B,scene,meshes,{loadAsset:()=>{loads++;return B.SceneLoader.LoadAssetContainerAsync('',new Uint8Array(readFileSync(new URL('../assets/art-courtyard/models/festival-candle.glb',import.meta.url))),scene,undefined,'.glb');}});
 try{
  scene.activeCamera=new B.FreeCamera('camera',new B.Vector3(0,2,-4),scene);
  layer.update([],0,new Map());assert.equal(loads,0,'model never blocks initial loading');
  const people=[{id:21},{id:22}],grips=new Map([[21,new B.Vector3(1,2,3)],[22,new B.Vector3(3,2,1)]]);
  layer.update(people,12,grips);await layer.ready;layer.update(people,12,grips);scene.render();
  assert.equal(loads,1);assert.equal(scene.skeletons.length,0);assert.ok(!meshes.some(m=>m.name.includes('flame')),'emissive flames never enter shadow caster lists');
  for(const p of people){const root=layer.rootFor(p.id);assert.ok(root.isEnabled());assert.ok(B.Vector3.Distance(root.position,grips.get(p.id))<1e-6);assert.ok(root.getChildMeshes().some(m=>m.metadata?.importedCandle),'supplied candle replaces fallback');}
  const count=scene.meshes.length;for(let i=0;i<30;i++)layer.update(people,12,grips);assert.equal(scene.meshes.length,count);
  const root=layer.rootFor(21),pose=root.getChildMeshes().map(m=>m.scaling.asArray());layer.update(people,12,grips);assert.deepEqual(root.getChildMeshes().map(m=>m.scaling.asArray()),pose);
  for(let i=0;i<8;i++){layer.update([],12,new Map());assert.equal(layer.rootFor(21),undefined);layer.update(people,12,grips);assert.equal(scene.meshes.length,count);}
  layer.update([],12,new Map());assert.equal(meshes.length,0);assert.equal(scene.lights.length,0);
 }finally{layer.dispose();assert.equal(scene.meshes.length,0);assert.equal(scene.materials.length,0);scene.dispose();engine.dispose();}
});
test('a late asset response after cancellation or disposal cannot resurrect candle holders',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine);let resolve,disposed=0;
 const layer=createFestivalCandles(B,scene,[],{loadAsset:()=>new Promise(r=>resolve=r)});
 try{layer.update([{id:1}],0,new Map([[1,new B.Vector3(0,1,0)]]));await Promise.resolve();layer.dispose();resolve({dispose(){disposed++;}});await layer.ready;assert.equal(disposed,1);assert.equal(scene.meshes.length,0);assert.equal(scene.lights.length,0);}finally{layer.dispose();scene.dispose();engine.dispose();}
});
