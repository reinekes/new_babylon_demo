import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGame} from '../engine.js';
import {shoreDistance} from '../district3d/terrain.js';
import {sceneryClear} from '../game3d/nature.js';
import {natureDetailPlan,createNatureDetails} from '../game3d/nature-details.js';
const box={console,setTimeout,clearTimeout,performance,window:{addEventListener(){},removeEventListener(){}},navigator:{userAgent:'node'}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),box);const B=box.BABYLON;
test('tumbleweed has a visible dry corridor near each founding settlement on both river axes',()=>{
 for(const seed of [1,4,9,96]){const s=createGame({seed}),before=JSON.stringify(s),p=natureDetailPlan(s,[],'low');assert.equal(p.tumbleweeds.length,2);assert.ok(p.tumbleweeds.some(p=>s.buildings.some(b=>Math.hypot(b.x-p.x,b.y-p.y)<8)),'at least one visible near the village');for(const w of p.tumbleweeds){assert.ok(w.reach>=.8,'rolls across at least 1.6 tiles');for(let k=0;k<=30;k++){const t=k/15-1,x=w.x+w.dx*w.reach*t,y=w.y+w.dy*w.reach*t;assert.ok(shoreDistance(x,y,s)>.8);assert.ok(sceneryClear(s,{x,y},.16));}}assert.equal(JSON.stringify(s),before);}
});
test('rolling is continuous on weather changes, stops with simulation time, and never allocates meshes per frame',()=>{
 const e=new B.NullEngine(),scene=new B.Scene(e),s=createGame({seed:96}),view=createNatureDetails(B,scene,{}, {tier:'low'});try{view.update(s,0,{type:'sunny'},[],'same');const weeds=()=>view.meshes.filter(m=>m.metadata?.natureDetail?.kind==='tumbleweeds'),start=weeds().map(m=>m.position.clone()),count=scene.meshes.length;for(let i=1;i<=100;i++)view.update(s,i*.1,{type:'wind'},[],'same');assert.ok(weeds().some((m,i)=>B.Vector3.Distance(start[i],m.position)>3),'a dry bush visibly travels several metres');const pose=()=>weeds().map(m=>[...m.position.asArray(),...m.rotation.asArray()]),frozen=pose();view.update(s,10,{type:'rain'},[],'same');assert.deepEqual(pose(),frozen,'weather transition without elapsed time cannot jump');for(let i=0;i<10;i++)view.update(s,10,{type:'wind'},[],'same');assert.deepEqual(pose(),frozen);assert.equal(scene.meshes.length,count);}finally{view.dispose();assert.equal(scene.meshes.length,0);scene.dispose();e.dispose();}
});

test('procedural flocks appear without assets near the village, preserve formation and face their flight',async()=>{
 const {birdFlockPlan,birdFlockPose,BIRD_FLOCK_BUDGETS}=await import('../game3d/bird-flocks.js');for(const seed of [1,96]){const s=createGame({seed}),before=JSON.stringify(s);for(const tier of Object.keys(BIRD_FLOCK_BUDGETS)){const plan=birdFlockPlan(s,tier);assert.equal(plan.reduce((n,f)=>n+f.count,0),BIRD_FLOCK_BUDGETS[tier]);assert.ok(s.buildings.some(b=>Math.hypot(plan[0].x/6-b.x,plan[0].z/6-b.y)<5));for(const f of plan)for(const time of [0,10,30,60,120]){const leader=birdFlockPose(f,time),next=birdFlockPose(f,time+.001),dx=next.x-leader.x,dz=next.z-leader.z;assert.ok((Math.sin(leader.yaw)*dx+Math.cos(leader.yaw)*dz)/Math.hypot(dx,dz)>.9999);for(let i=1;i<f.count;i++){const p=birdFlockPose(f,time,i);assert.ok(Math.hypot(p.x-leader.x,p.z-leader.z)<6);assert.ok(Math.hypot(p.x-leader.x,p.z-leader.z)>1);assert.ok(Object.values(p).every(Number.isFinite));}}}assert.equal(JSON.stringify(s),before);}
});
test('early sky flock owns two geometries, obeys quality and pause, never rebuilds per frame, and fully disposes',async()=>{
 const {createBirdFlocks}=await import('../game3d/bird-flocks.js'),e=new B.NullEngine(),scene=new B.Scene(e),s=createGame({seed:1}),saved=JSON.stringify(s),beforeMaterials=scene.materials.length,view=createBirdFlocks(B,scene,{state:s,tier:'high'});
 try{assert.equal(view.roots().length,10);assert.equal(scene.geometries.length,2);assert.equal(scene.meshes.length,32);const count=scene.meshes.length,roots=view.roots(),snap=()=>JSON.stringify(view.roots().flatMap(r=>[r,...r.getChildMeshes()]).map(n=>[n.position.asArray(),n.rotation.asArray()])),initial=snap();view.update(s,0);assert.equal(snap(),initial);for(let i=1;i<=120;i++)view.update(s,i*.2);assert.notEqual(snap(),initial);assert.deepEqual(view.roots(),roots);assert.equal(scene.meshes.length,count);assert.equal(scene.geometries.length,2);view.setQuality('low');view.update(s,24);assert.equal(view.roots().length,4);assert.equal(scene.meshes.length,14);const frozen=snap();view.update(s,24);assert.equal(snap(),frozen);assert.equal(JSON.stringify(s),saved);assert.ok(view.meshes.every(m=>!m.isPickable));}finally{view.dispose();view.dispose();assert.equal(scene.meshes.length,0);assert.equal(scene.geometries.length,0);assert.equal(scene.transformNodes.length,0);assert.equal(scene.materials.length,beforeMaterials);scene.dispose();e.dispose();}
});
test('early procedural sky replaces deferred sky assets while keeping licensed ground birds',async()=>{
 const {createAmbientFauna}=await import('../game3d/ambient-fauna.js'),e=new B.NullEngine(),scene=new B.Scene(e),loads=[];
 const view=await createAmbientFauna(B,scene,[],{includeSkyBirds:false,loadAsset:async file=>{loads.push(file);const c=new B.AssetContainer(scene),r=new B.TransformNode(file,scene),m=B.MeshBuilder.CreateBox('test-animal',{size:.2},scene);m.parent=r;c.rootNodes=[r];c.transformNodes=[r];c.meshes=[m];c.removeAllFromScene();return c;}});
 try{view.update(createGame(),.1);assert.equal(loads.length,9);assert.ok(loads.includes('imported-orange-bird.glb'));assert.ok(!loads.some(n=>n.includes('sky-bird')));assert.ok(view.roots().every(r=>!r.metadata.ambientSpecies.includes('sky')));assert.equal(view.roots().filter(r=>r.metadata.ambientSpecies==='orange-bird').length,2);}finally{view.dispose();scene.dispose();e.dispose();}
});
