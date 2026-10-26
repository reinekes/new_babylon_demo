import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGame,advanceTime} from '../engine.js';
import {syncCitizens} from '../workforce.js';
import {startRelicQuest,orderRelicMove,searchRelic,relicQuestView} from '../relic-quest.js';
import {createGameActors,actorViewFrame,actorAnimation} from '../game3d/actors.js';
const sandbox={exports:{},module:{exports:{}},console,setTimeout,clearTimeout,performance,window:{addEventListener(){},removeEventListener(){}},navigator:{userAgent:'node'}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.exports.NullEngine?sandbox.exports:sandbox.module.exports;sandbox.BABYLON=B;sandbox.exports=undefined;sandbox.module=undefined;sandbox.TextDecoder=TextDecoder;sandbox.TextEncoder=TextEncoder;sandbox.URL=URL;sandbox.Blob=Blob;
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylonjs-loaders-9.31.0.min.js',import.meta.url),'utf8'),sandbox);
function searching(){const s=createGame({start:'established'});s.resources.faith=250;for(const c of s.citizens){c.age=25;c.role='builder';c.work=null;c.site=null;c.phase='home';c.cargo={};c.buildCargo={};delete c.pantryTrip;delete c.waterTrip;}syncCitizens(s);assert.equal(startRelicQuest(s,s.citizens[0].id).ok,true);orderRelicMove(s,relicQuestView(s).searchPoint);const c=s.citizens[0];for(let i=0;i<1200&&c.routeIndex<c.route.length;i++)advanceTime(s,.1);assert.equal(searchRelic(s).ok,true);return s;}
test('controlled search activity survives actor view selection and produces the real searching pose',()=>{const s=searching(),before=JSON.stringify(s),c=actorViewFrame(s).citizens.find(c=>c.id===s.relicQuest.actorId);assert.equal(c.controlled,true);assert.deepEqual(c.activity,{kind:'relicSearch',stage:'searching'});assert.equal(actorAnimation(c).pose,'relicSearch');assert.equal(actorAnimation(c).clip,'Idle_Loop');assert.equal(JSON.stringify(s),before);});
test('native male and female hands hold one visible gold-lapis artifact with no ordinary cargo; pause is stable',async t=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),loader=B.SceneLoader.LoadAssetContainerAsync;let actors;
 B.SceneLoader.LoadAssetContainerAsync=async(path,file)=>loader.call(B.SceneLoader,'',new Uint8Array(readFileSync(new URL('../'+path+file.split('?')[0],import.meta.url))),scene,undefined,'.glb');
 try{scene.activeCamera=new B.FreeCamera('camera',new B.Vector3(0,5,-10),scene);actors=await createGameActors(B,scene,{},{includeFauna:false});const s=searching(),id=s.relicQuest.actorId;let worst=0;
  actors.update(s,1/60);scene.render();assert.equal(actorAnimation(actorViewFrame(s).citizens.find(c=>c.id===id)).pose,'relicSearch');advanceTime(s,2.1);assert.equal(s.relicQuest.artifact.location,'carried');
  for(const sex of ['m','f']){s.citizens.find(c=>c.id===id).sex=sex;for(let i=0;i<3;i++){actors.update(s,1/60);scene.render();}const root=actors.rootFor({citizenId:id}),view=actorViewFrame(s).citizens.find(c=>c.id===id);assert.equal(view.relic,true);assert.equal(actorAnimation(view).pose,'carry');assert.deepEqual(view.cargo,{});assert.deepEqual(s.citizens.find(c=>c.id===id).cargo,{});
   const parts=root.getChildMeshes().filter(m=>/^carried-relic-(?:lapis|gold|linen)$/.test(m.name));assert.equal(parts.length,3);assert.ok(parts.every(m=>m.isEnabled()&&m.isVisible&&m.getTotalVertices()>0));const load=root.getChildTransformNodes().find(n=>n.name.endsWith('-carried'));assert.ok(load);load.computeWorldMatrix(true);
   for(const side of ['l','r']){const hand=root.getChildTransformNodes().find(n=>n.name.endsWith('-hand_'+side));assert.ok(hand);hand.computeWorldMatrix(true);const d=B.Vector3.Distance(hand.getAbsolutePosition(),load.getAbsolutePosition());worst=Math.max(worst,d);assert.ok(d<.30,`${sex} palm ${side} must touch relic edge, distance ${d}`);}
   const pose=()=>root.getChildTransformNodes().filter(n=>/hand_[lr]$|upperarm_[lr]$|lowerarm_[lr]$/.test(n.name)).map(n=>[n.position.asArray(),n.rotationQuaternion?.asArray()]),frozen=pose(),before=JSON.stringify(s);for(let i=0;i<8;i++){actors.update(s,1/60,{paused:true});scene.render();}assert.deepEqual(pose(),frozen);assert.equal(JSON.stringify(s),before);
  }t.diagnostic(`Native male/female maximum palm-to-artifact centre distance ${worst.toFixed(5)} m (hands meet the ±0.21 m edges).`);
 }finally{actors?.dispose();B.SceneLoader.LoadAssetContainerAsync=loader;scene.dispose();engine.dispose();}
});
