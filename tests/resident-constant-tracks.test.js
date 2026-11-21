import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {prepareResidentClip} from '../game3d/resident-constant-tracks.js';

const sandbox={console,setTimeout,clearTimeout,performance,self:{},TextEncoder,TextDecoder,URL,Blob};
const read=path=>readFileSync(new URL('../'+path,import.meta.url));
vm.createContext(sandbox);
vm.runInContext(read('assets/vendor/babylon-9.31.0.js'),sandbox);
vm.runInContext(read('assets/vendor/babylonjs-loaders-9.31.0.min.js'),sandbox);
const B=sandbox.BABYLON;

test('manual samples of the shipped rig preserve exact TRS, IK corrections and the resumed playback clock',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine);
 try{
  const asset=await B.SceneLoader.LoadAssetContainerAsync('',new Uint8Array(read('assets/art-courtyard/models/source-walk-male.glb')),scene,undefined,'.glb');
  const copies=['vanilla','optimized'].map(id=>asset.instantiateModelsToScene(n=>id+'-'+n,false,{doNotInstantiate:true}));
  const nodes=copies.map(copy=>copy.rootNodes.flatMap(n=>[n,...n.getDescendants()]).filter(n=>n.rotationQuaternion));
  const assertPose=()=>{
   for(const [i,node] of nodes[0].entries()){
    for(const prop of ['position','rotationQuaternion','scaling'])assert.deepEqual(node[prop].asArray(),nodes[1][i][prop].asArray());
    assert.deepEqual(node.computeWorldMatrix(true).asArray(),nodes[1][i].computeWorldMatrix(true).asArray());
   }
  };
  for(const clip of ['Idle_Loop','Walk_Loop','Idle_Loop']){
   const groups=copies.map(copy=>copy.animationGroups.find(g=>g.name.endsWith(clip))),writes=[0,0];
   for(const [i,g] of groups.entries()){
    g.start(true,1,g.from,g.to,false);g.pause();
    for(const ch of g.animatables)for(const r of ch.getAnimations()){
     const set=r.setValue;r.setValue=function(...args){writes[i]++;return set.apply(this,args);};
    }
   }
   prepareResidentClip(groups[1]);
   for(const phase of [0,.147,.295,1,1,.283,.625,.625,0]){
    for(const rig of nodes){
     const hand=rig.find(n=>n.name.endsWith('hand_r')),hip=rig.find(n=>n.name.endsWith('thigh_l'));
     hand.rotationQuaternion.x+=.093;hip.position.y-=.013;
    }
    for(const g of groups)g.goToFrame(g.from+phase*(g.to-g.from));
    assertPose();
    for(const [i,ch] of groups[0].animatables.entries())assert.equal(ch.masterFrame,groups[1].animatables[i].masterFrame);
   }
   assert.ok(writes[1]<writes[0],'correct poses with fewer native interpolation writes');
   for(const g of groups)g.play(true);
   for(const dt of [16.7,30,82]){scene._animate(dt);assertPose();}
   for(const g of groups)g.pause();
   scene._animate(60);assertPose();
   for(const g of groups)g.play(true);
   scene._animate(16.7);assertPose();
   for(const g of groups)g.stop();
  }
 }finally{scene.dispose();engine.dispose();}
});
