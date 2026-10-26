import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGame} from '../engine.js';
import {createAmbientFauna} from '../game3d/ambient-fauna.js';

const sandbox={exports:{},module:{exports:{}},console,setTimeout,clearTimeout,performance,window:{addEventListener(){},removeEventListener(){}},navigator:{userAgent:'node'}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.exports.NullEngine?sandbox.exports:sandbox.module.exports;

function source(scene,name){
 const container=new B.AssetContainer(scene),root=new B.TransformNode(name,scene),mesh=B.MeshBuilder.CreateBox(name+'-body',{size:.2},scene);mesh.parent=root;
 container.rootNodes=[root];container.transformNodes=[root];container.meshes=[mesh];container.animationGroups=[];
 for(const name of ['Walk','Idle']){const a=new B.Animation(name,'rotation.x',30,B.Animation.ANIMATIONTYPE_FLOAT,B.Animation.ANIMATIONLOOPMODE_CYCLE);a.setKeys([{frame:0,value:0},{frame:15,value:.04},{frame:30,value:0}]);const group=new B.AnimationGroup(name,scene);group.addTargetedAnimation(a,mesh);container.animationGroups.push(group);}
 container.removeAllFromScene();return container;
}
const farmRoots=view=>view.roots().filter(r=>r.metadata.dairyBuilding);
const udderMaterials=scene=>scene.materials.filter(m=>m.name.endsWith('-udder-clay'));
const snapshot=view=>JSON.stringify(farmRoots(view).flatMap(r=>[r,...r.getDescendants()]).map(n=>[n.name,n.position?.asArray(),n.rotation?.asArray(),n.rotationQuaternion?.asArray(),n.scaling?.asArray()]));

test('farm scale, udder ownership, exact pause and source lifetime survive class changes and rebuilding',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),meshes=[],containers=[],disposed=new Map();let view;
 try{
  view=await createAmbientFauna(B,scene,meshes,{loadAsset:async name=>{const asset=source(scene,name),dispose=asset.dispose.bind(asset);containers.push(asset);asset.dispose=()=>{disposed.set(asset,(disposed.get(asset)||0)+1);dispose();};return asset;}});
  const state=createGame(),b={type:'cowshed',x:3,y:4,level:1,dairy:{cows:3,calves:2}};state.buildings.push(b);const initial=JSON.stringify(state);
  view.update(state,0,{paused:true});assert.equal(farmRoots(view).length,5);assert.equal(udderMaterials(scene).length,3);assert.equal(JSON.stringify(state),initial);
  assert.equal(farmRoots(view).find(r=>r.name==='dairy-3,4-0').metadata.clip,'Idle');
  for(let i=0;i<12;i++)view.update(state,.1,{speed:4});const frozen=snapshot(view);for(let i=0;i<20;i++)view.update(state,.1,{paused:true,speed:4});assert.equal(snapshot(view),frozen);
  const formerCalf=farmRoots(view).find(r=>r.name==='dairy-3,4-3');assert.equal(formerCalf.metadata.calf,true);
  b.dairy.cows=5;b.dairy.calves=0;view.update(state,0,{paused:true});const grown=farmRoots(view).find(r=>r.name==='dairy-3,4-3');assert.notEqual(grown,formerCalf);assert.equal(formerCalf.isDisposed(),true);assert.equal(grown.metadata.calf,false);assert.equal(grown.getChildren().find(n=>n.name.endsWith('-model')).scaling.x,.75);assert.equal(grown.getChildMeshes().filter(m=>m.name.endsWith('-udder')).length,1);assert.equal(udderMaterials(scene).length,5);
  const asset=containers.find(c=>c.transformNodes[0].name==='ambient-bull.glb'),geometry=asset.meshes[0].geometry;
  for(let i=0;i<3;i++){
   const roots=farmRoots(view);state.buildings=state.buildings.filter(v=>v!==b);view.update(state,0,{paused:true});assert.equal(farmRoots(view).length,0);assert.equal(udderMaterials(scene).length,0);assert.ok(roots.every(r=>r.isDisposed()));assert.equal(disposed.get(asset),undefined,'removing a herd keeps its shared source alive');
   state.buildings.push(b);view.update(state,0,{paused:true});assert.equal(farmRoots(view).length,5);assert.equal(udderMaterials(scene).length,5);assert.ok(farmRoots(view).every(r=>r.getChildMeshes().some(m=>m.geometry===geometry)));
  }
  const roots=view.roots();view.dispose();view.dispose();assert.equal(meshes.length,0);assert.equal(udderMaterials(scene).length,0);assert.ok(roots.every(r=>r.isDisposed()));assert.ok(containers.every(c=>disposed.get(c)===1));
 }finally{view?.dispose();scene.dispose();engine.dispose();}
});
