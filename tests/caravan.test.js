import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGame} from '../engine.js';
import {CARAVAN_MODELS,caravanFormation,createTradeCaravan,caravanCargoSignature} from '../game3d/caravan.js';
import {acquireDonkey} from '../game3d/donkey.js';
const box={exports:{},module:{exports:{}},console,setTimeout,clearTimeout,performance,window:{addEventListener(){},removeEventListener(){}},navigator:{userAgent:'node'}};vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),box);const B=box.exports.NullEngine?box.exports:box.module.exports;box.BABYLON=B;box.exports=undefined;box.module=undefined;box.TextDecoder=TextDecoder;box.TextEncoder=TextEncoder;box.URL=URL;box.Blob=Blob;vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylonjs-loaders-9.31.0.min.js',import.meta.url),'utf8'),box);
const caravan=()=>({id:'test-visit',x:6,y:5,phase:'arriving',route:[{x:3,y:5},{x:7,y:5}],routeIndex:1,stock:{wood:60,food:40}});
test('roaming and pack donkeys share one source until both release it, including after fallback',async()=>{
 for(const unavailable of [false,true]){
  const scene={},calls=[];let disposals=0;
  const load=async file=>{
   calls.push(file);
   if(unavailable&&file==='pasture-donkey.glb')throw Error('Primary unavailable');
   return {dispose(){disposals++;}};
  };
  const [roaming,caravan]=await Promise.all([acquireDonkey(scene,load),acquireDonkey(scene,load)]);
  assert.deepEqual(calls,unavailable?['pasture-donkey.glb','ambient-donkey.glb']:['pasture-donkey.glb']);
  assert.equal(roaming.model.file,calls.at(-1));assert.equal(roaming.asset,caravan.asset);
  roaming.release();roaming.release();assert.equal(disposals,0);
  caravan.release();assert.equal(disposals,1);
  const next=await acquireDonkey(scene,load);assert.notEqual(roaming.asset,next.asset);next.release();
 }
 const scene={};
 await assert.rejects(()=>acquireDonkey(scene,async()=>{throw Error('Both unavailable');}),/Both unavailable/);
 const retry=await acquireDonkey(scene,async()=>({dispose(){}}));assert.equal(retry.model.file,'pasture-donkey.glb');retry.release();
});
test('formation projects independent road positions without touching trade state',()=>{const c=caravan(),before=JSON.stringify(c),p=caravanFormation(c);assert.equal(p.length,3);assert.equal(p[0].kind,'merchant');assert.equal(p[1].kind,'camel');assert.ok(p[0].x>p[1].x&&p[1].x>p[2].x);assert.equal(p[1].y,5);assert.equal(JSON.stringify(c),before);assert.deepEqual(caravanFormation({...c,transport:'river'}),[]);assert.equal(caravanCargoSignature({food:0,wood:2}),caravanCargoSignature({wood:2}));});
test('derived GLBs retain attribution, source rig, clips and explicit limits',()=>{for(const [kind,file]of Object.entries(CARAVAN_MODELS)){const b=readFileSync(new URL(`../assets/art-courtyard/models/${file}`,import.meta.url));assert.equal(b.length,b.readUInt32LE(8));const g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12))),e=g.asset.extras.new_babylon_adaptation;assert.match(e.license,/CC-BY-4.0/);assert.match(e.source,/sketchfab.com/);assert.equal(e.forward_gltf,'+Z');assert.ok(g.skins[0].joints.length>50);assert.ok(g.animations.some(a=>a.name==='Walk'));assert.ok(g.animations.some(a=>a.name==='Idle'));assert.match(e.historical_limits,/anachronism/);if(kind==='merchant'){assert.equal(e.removed_meshes.length,1);assert.match(e.clips.Walk,/authored/);assert.ok(!g.nodes.some(n=>'mesh'in n&&g.meshes[n.mesh].name.includes('Headwear')));}else{assert.match(e.clips.Walk,/Supplied/);const hair=g.materials.find(m=>m.name==='CamelHair');assert.equal(g.images[g.textures[hair.pbrMetallicRoughness.baseColorTexture.index].source].mimeType,'image/png','hair cards retain source alpha');}}});
test('real skins parse, face route, distance gait pauses, trading idles, stock preserves actors and disposal',async()=>{const engine=new B.NullEngine(),scene=new B.Scene(engine),meshes=[],state=createGame({start:'established'});scene.activeCamera=new B.FreeCamera('camera',new B.Vector3(0,3,-6),scene);let view;try{view=await createTradeCaravan(B,scene,meshes,{},null,{warn:(...a)=>{throw Error(a.map(String).join(' '));},loadAsset:async file=>{B.SceneLoader.OnPluginActivatedObservable.addOnce(p=>{p.skipMaterials=true;});return B.SceneLoader.LoadAssetContainerAsync('',new Uint8Array(readFileSync(new URL(`../assets/art-courtyard/models/${file}`,import.meta.url))),scene,undefined,'.glb');}});assert.ok(view.loaded());const c=caravan(),before=JSON.stringify({state,c});view.update(state,c,0);scene.render();assert.equal(JSON.stringify({state,c}),before);assert.equal(view.actors.length,3);const camel=view.actors[1],head=camel.root.getDescendants().find(n=>n.name.endsWith('Head_018'));head.computeWorldMatrix(true);assert.ok(head.getAbsolutePosition().x>camel.root.position.x+.5,'actual skinned head points toward +X route');const roots=view.actors.map(a=>a.root);c.x+=.02;view.update(state,c,.02);scene.render();const phase=camel.phase;assert.ok(phase>0);const positions=camel.root.getDescendants().filter(n=>n.position).map(n=>n.position.asArray());view.update(state,c,.02);scene.render();assert.equal(camel.phase,phase);assert.deepEqual(camel.root.getDescendants().filter(n=>n.position).map(n=>n.position.asArray()),positions);c.stock.wood--;view.update(state,c,.04);assert.deepEqual(view.actors.map(a=>a.root),roots);c.phase='trading';view.update(state,c,.06);assert.equal(camel.clip,'Idle');assert.equal(view.actors[2].clip,'Idle2');assert.ok(meshes.every(m=>m.getWorldMatrix().m.every(Number.isFinite)));view.update(state,{...c,transport:'river'},.08);assert.equal(view.actors.length,0);view.dispose();assert.equal(meshes.length,0);assert.equal(scene.meshes.length,0);}finally{view?.dispose();scene.dispose();engine.dispose();}});
test('strict caravan uses donkeys, preserves formation/trade, and switches profiles without stale animals',async()=>{
 const {strictScenario}=await import('../scenario-profiles.js'),engine=new B.NullEngine(),scene=new B.Scene(engine),meshes=[],state=createGame({start:'established',scenario:strictScenario()}),loads=[];
 const goods={sources:new Map(['wood','food'].map(kind=>[kind,B.MeshBuilder.CreateBox(kind,{size:.36},scene)]))};
 let view;try{view=await createTradeCaravan(B,scene,meshes,{},goods,{initialState:state,warn:(...a)=>{throw Error(a.map(String).join(' '));},loadAsset:async file=>{loads.push(file);B.SceneLoader.OnPluginActivatedObservable.addOnce(p=>{p.skipMaterials=true;});return B.SceneLoader.LoadAssetContainerAsync('',new Uint8Array(readFileSync(new URL(`../assets/art-courtyard/models/${file}`,import.meta.url))),scene,undefined,'.glb');}});
  assert.ok(view.loaded());assert.ok(loads.includes('pasture-donkey.glb'));assert.ok(!loads.includes('ambient-donkey.glb'));assert.ok(!loads.includes('caravan-camel.glb'));assert.ok(!loads.includes('caravan-merchant.glb'));assert.ok(loads.includes('source-walk-male.glb'));
  const c=caravan(),before=JSON.stringify({state,c});view.update(state,c,0);assert.deepEqual(view.actors.map(a=>a.kind),['merchant','donkey','donkey']);assert.equal(JSON.stringify({state,c}),before);
  const roots=view.actors.map(a=>a.root),formation=caravanFormation(c);assert.deepEqual(view.actors.map(a=>[a.root.position.x,a.root.position.z]),formation.map(p=>[p.x*6,p.y*6]));
  const head=view.actors[1].root.getDescendants().find(n=>n.name.endsWith('Head_08'));head.computeWorldMatrix(true);assert.ok(head.getAbsolutePosition().x>view.actors[1].root.position.x+.25,'donkey actual head faces forward along the saved route');
  const saddles=meshes.filter(m=>m.name.includes('woven-saddle'));assert.equal(saddles.length,2);assert.ok(saddles.every(m=>m.position.y<1.2));
  function assertPanniers(){
   for(const animal of view.actors.slice(1)){
    const inverse=animal.root.computeWorldMatrix(true).clone().invert();
    const bags=animal.root.getChildMeshes().filter(m=>m.name.includes('cloth-pannier')).map(m=>{
     m.computeWorldMatrix(true);
     return B.Vector3.TransformCoordinates(m.getBoundingInfo().boundingBox.centerWorld,inverse);
    }).sort((a,b)=>a.x-b.x);
    assert.equal(bags.length,2);assert.ok(bags[0].x<-.18&&bags[1].x>.18,'one pannier on each flank');
    assert.ok(Math.abs(bags[0].z-bags[1].z)<.03);
    assert.ok(bags.every(v=>v.z>-.3&&v.z<0&&v.y>.64&&v.y<.87),'pannier lies alongside the ribcage');
   }
  }
  assertPanniers();
  for(let frame=1;frame<=18;frame++){c.x+=.012;view.update(state,c,frame*.02);assertPanniers();}
  c.route=[{x:6,y:1},{x:6,y:9}];c.x=6;c.y=5.5;view.update(state,c,.39);assertPanniers();
  const cargo=()=>meshes.filter(m=>m.metadata?.caravanCargo);
  assert.deepEqual(cargo().map(m=>m.metadata.goods.kind),['food','wood','wood']);
  assert.ok(cargo().every(m=>m.parent===view.actors[1].pack.root||m.parent===view.actors[2].pack.root));
  c.x+=.02;view.update(state,c,.41);const phase=view.actors[1].phase;view.update(state,c,.41);assert.equal(view.actors[1].phase,phase);
  c.stock.food=0;view.update(state,c,.43);assert.deepEqual(view.actors.map(a=>a.root),roots);
  assert.deepEqual(cargo().map(m=>m.metadata.goods.kind),['wood','wood']);
  view.update({...state,scenario:undefined},c,.45);await view.ready;view.update({...state,scenario:undefined},c,.47);assert.deepEqual(view.actors.map(a=>a.kind),['merchant','camel','camel']);assert.ok(roots.every(r=>r.isDisposed()));
  view.update(state,c,.49);assert.deepEqual(view.actors.map(a=>a.kind),['merchant','donkey','donkey']);assert.equal(loads.filter(f=>f==='pasture-donkey.glb').length,1);assert.equal(view.actors[1].root.metadata.modelFile,'pasture-donkey.glb');
 }finally{view?.dispose();assert.equal(meshes.length,0);scene.dispose();engine.dispose();}
});
