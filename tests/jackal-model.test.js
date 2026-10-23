import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGame} from '../engine.js';
import {createJackals,jackalHeading} from '../game3d/jackals.js';
const raw=readFileSync(new URL('../assets/art-courtyard/models/jackal.glb',import.meta.url)),g=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)));
const box={exports:{},module:{exports:{}},console,setTimeout,clearTimeout,performance,window:{addEventListener(){},removeEventListener(){}},navigator:{userAgent:'node'}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),box);const B=box.exports.NullEngine?box.exports:box.module.exports;
box.BABYLON=B;box.exports=undefined;box.module=undefined;Object.assign(box,{TextDecoder,TextEncoder,URL,Blob});vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylonjs-loaders-9.31.0.min.js',import.meta.url),'utf8'),box);
test('jackal retains exact source attribution, skin and honest adapted gait',()=>{
 assert.equal(raw.readUInt32LE(8),raw.length);assert.match(g.asset.extras.author,/OLEKSO/);assert.match(g.asset.extras.license,/CC-BY-NC-4.0/);assert.equal(g.skins[0].joints.length,46);assert.equal(g.asset.extras.new_babylon_adaptation.triangles,7285);
 assert.deepEqual(g.animations.map(a=>a.name),['Idle','Walk','Pull','SourceTake001']);assert.equal(g.animations.at(-1).channels.length,134);assert.ok(g.nodes.some(n=>n.name==='JackalMouthContact'));assert.equal(g.asset.extras.new_babylon_adaptation.forward_gltf,'+Z');
 const walk=g.animations[1];for(const ni of [8,49]){const ch=walk.channels.find(c=>c.target.node===ni&&c.target.path==='translation'),a=g.accessors[walk.samplers[ch.sampler].output];assert.equal(a.min[0],a.max[0]);assert.equal(a.min[2],a.max[2]);}
 assert.equal(jackalHeading({x:4,y:4,faceX:4,faceY:5},-.2,0),0);
});
test('real jackal GLB has independent skins, actual muzzle contact, backwards pull and clean disposal',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),meshes=[],state=createGame({start:'established'});scene.activeCamera=new B.FreeCamera('camera',new B.Vector3(0,3,-6),scene);let view;
 try{
  view=await createJackals(B,scene,null,meshes,{loadAsset:async()=>{B.SceneLoader.OnPluginActivatedObservable.addOnce(p=>{p.skipMaterials=true;});return B.SceneLoader.LoadAssetContainerAsync('',new Uint8Array(raw),scene,undefined,'.glb');}});
  const a={id:'jackal-a',kind:'jackal',x:5,y:5},b={id:'jackal-b',kind:'jackal',x:6,y:5};const before=JSON.stringify({state,a,b});view.update(state,[a,b],.04);scene.render();assert.equal(JSON.stringify({state,a,b}),before);
  const ar=view.rootFor(a.id),br=view.rootFor(b.id),skin=r=>r.getChildMeshes().find(m=>m.skeleton);assert.notEqual(skin(ar).skeleton,skin(br).skeleton);assert.equal(skin(ar).geometry,skin(br).geometry);const sharedMaterial=new B.StandardMaterial('shared coat',scene);skin(ar).material=sharedMaterial;skin(br).material=sharedMaterial;
  const normal=view.mouthFor(a.id);assert.ok(normal.z>ar.position.z+.4);assert.ok(normal.y>ar.position.y+.3);a.pulling=true;a.faceX=a.x;a.faceY=a.y+1;a.y-=.01;view.update(state,[a,b],.04);scene.render();const mouth=view.mouthFor(a.id);assert.equal(ar.metadata.clip,'Pull');assert.ok(ar.metadata.gaitPhase>.8,'backwards gait wraps from zero');assert.ok(Math.abs(ar.rotation.y)<1e-6);assert.ok(mouth.y<normal.y-.1,'grip lowers muzzle to shroud');assert.ok(mouth.z>ar.position.z+.3,'mouth remains ahead while actor backs away');
  const frozen=()=>JSON.stringify(ar.getDescendants().map(n=>[n.position?.asArray(),n.rotationQuaternion?.asArray(),n.rotation?.asArray()])),snap=frozen();for(let i=0;i<8;i++)view.update(state,[a,b],.05,{paused:true,speed:4});assert.equal(frozen(),snap);
  view.update(state,[b],.04);assert.ok(ar.isDisposed());assert.ok(!skin(br).isDisposed());assert.ok(scene.materials.includes(sharedMaterial),'removing one jackal preserves the shared coat');assert.ok(skin(br).geometry);view.dispose();assert.equal(meshes.length,0);assert.equal(scene.meshes.length,0);assert.equal(scene.skeletons.length,0);
 }finally{view?.dispose();scene.dispose();engine.dispose();}
});
