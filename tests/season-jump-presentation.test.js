import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {advanceTime,encode,decode} from '../engine.js';
import {orderFestival,festivalCitizenView} from '../festival.js';
import {advanceToNextSeason} from '../season-jump.js';
import {createGameActors,actorViewFrame,residentViewPositions} from '../game3d/actors.js';
import {GameRenderer3D} from '../game3d/renderer.js';
import {Renderer} from '../renderer.js';
import {setCitizenRole,assignWorkplace} from '../management.js';
import {testingCity,advanceUntil} from './helpers/testing-ceremonies.js';

const sandbox={console,setTimeout,clearTimeout,performance,self:{},TextDecoder,TextEncoder,URL,Blob};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.BABYLON;
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylonjs-loaders-9.31.0.min.js',import.meta.url),'utf8'),sandbox);
function feast(){const s=testingCity();assert.ok(orderFestival(s).ok);assert.ok(advanceUntil(s,state=>state.festival?.stage==='celebrating'));advanceTime(s,3);return s;}
async function realActors(check){
 const engine=new B.NullEngine(),scene=new B.Scene(engine),loader=B.SceneLoader.LoadAssetContainerAsync;let actors;
 B.SceneLoader.LoadAssetContainerAsync=(path,file)=>loader.call(B.SceneLoader,'',new Uint8Array(readFileSync(new URL('../'+path+file.split('?')[0],import.meta.url))),scene,undefined,'.glb');
 try{scene.activeCamera=new B.FreeCamera('camera',new B.Vector3(0,3,-8),scene);actors=await createGameActors(B,scene,{},{includeFauna:false,includeFuneralFauna:false});await check(actors,scene);}
 finally{actors?.dispose();B.SceneLoader.LoadAssetContainerAsync=loader;scene.dispose();engine.dispose();}
}
function rendererFor(state,actors){return Object.assign(Object.create(GameRenderer3D.prototype),{state,actors,effects:[],effectViews:[],lastSim:state.simTime,lastTime:1000});}

test('paused season skip immediately clears 3D patrol positions and props without recreating residents or changing cargo',async()=>realActors((actors,scene)=>{
 const s=feast();actors.update(s,1/60);scene.render();
 const ids=s.citizens.filter(c=>festivalCitizenView(s,c).festivalTorch).map(c=>c.id),roots=new Map(ids.map(id=>[id,actors.rootFor({citizenId:id})]));assert.ok(ids.length>=2);
 assert.ok(advanceToNextSeason(s).ok);const before=encode(s),frame=actorViewFrame(s),expected=residentViewPositions(s,frame.citizens),renderer=rendererFor(s,actors);
 assert.ok(ids.some(id=>{const p=s.citizens.find(c=>c.id===id),r=roots.get(id);return Math.hypot(p.x*6-r.position.x,p.y*6-r.position.z)>1;}),'the skip must move a previously rendered patrol');
 renderer.resetPresentation();actors.update(s,.1,{paused:true,speed:4});scene.render();
 for(const id of ids){const root=actors.rootFor({citizenId:id}),p=expected.get(id);assert.equal(root,roots.get(id),'keep the existing citizen rig');if(p)assert.ok(Math.hypot(root.position.x-p.x*6,root.position.z-p.y*6)<.001,'no old festival interpolation survives the paused teleport');else assert.equal(root.isEnabled(),false);}
 assert.equal(scene.transformNodes.filter(n=>n.metadata?.festivalCandle).length,0);assert.equal(encode(s),before);assert.equal(renderer.lastSim,null);assert.equal(renderer.lastTime,null);
 // All guests may be indoors at the new season's midnight. Reappearing the
 // next morning must not restore a frozen dance or an old patrol offset.
 const worker=ids[0],clay=s.buildings.find(b=>b.type==='clay');assert.ok(setCitizenRole(s,worker,'production').ok);assert.ok(assignWorkplace(s,worker,`${clay.x},${clay.y}`).ok);
 assert.ok(advanceUntil(s,state=>actorViewFrame(state).citizens.some(c=>c.id===worker)));const morning=actorViewFrame(s),positions=residentViewPositions(s,morning.citizens),saved=encode(s);actors.update(s,0,{paused:true});scene.render();
 const returning=ids.filter(id=>positions.has(id));assert.ok(returning.length>0);
 for(const id of returning){const root=actors.rootFor({citizenId:id}),p=positions.get(id);assert.equal(root,roots.get(id));assert.ok(Math.hypot(root.position.x-p.x*6,root.position.z-p.y*6)<.001,'a hidden former guest starts at the current ordinary route position');}
 assert.equal(encode(s),saved);
}));

test('loading an active festival while paused samples its current patrol pose instead of sending reused resident IDs home',async()=>realActors((actors,scene)=>{
 const s=feast();actors.update(s,1/60);scene.render();const loaded=decode(encode(s));assert.ok(loaded);advanceTime(loaded,20);
 const before=encode(loaded),people=actorViewFrame(loaded).citizens.filter(c=>c.festivalTorch),renderer=rendererFor(loaded,actors);assert.ok(people.length>=2);
 renderer.resetPresentation();actors.update(loaded,0,{paused:true});scene.render();
 for(const c of people){const root=actors.rootFor({citizenId:c.id});assert.ok(Math.hypot(root.position.x-c.eventContact.x*6,root.position.z-c.eventContact.y*6)<.001);assert.ok(Math.abs(root.rotation.y-c.eventContact.yaw)<1e-6,'loaded patrol has its saved facing even on pause');assert.ok(scene.getTransformNodeByName('festival-candle-'+c.id)?.isEnabled());}
 assert.equal(encode(loaded),before);
}));

test('2D presentation reset clears paused ceremony joins and transient effects but retains an active loaded festival',()=>{
 const s=feast(),renderer=Object.assign(Object.create(Renderer.prototype),{state:s,effects:[{id:'festival',start:0}],visualLast:1000});
 const original=renderer.ceremonyCitizens(s,1/60),ids=original.filter(c=>c.festivalTorch).map(c=>c.id);assert.ok(ids.length>=2);assert.ok(advanceToNextSeason(s).ok);const before=encode(s);
 renderer.resetPresentation();const current=renderer.ceremonyCitizens(s,0,{paused:true}),fresh=Object.create(Renderer.prototype).ceremonyCitizens(s,0,{paused:true});
 assert.deepEqual(current,fresh);assert.deepEqual(renderer.effects,[]);assert.equal(renderer.visualLast,null);assert.equal(encode(s),before);
 const loaded=feast();renderer.state=loaded;renderer.resetPresentation();const restored=renderer.ceremonyCitizens(loaded,0,{paused:true});
 for(const c of restored.filter(c=>c.festivalTorch)){assert.equal(c.x,c.eventContact.x);assert.equal(c.y,c.eventContact.y);}
 assert.ok(restored.some(c=>c.festivalTorch));
});
