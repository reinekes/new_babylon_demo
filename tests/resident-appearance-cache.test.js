import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGame} from '../engine.js';
import {createGameActors} from '../game3d/actors.js';

const sandbox={console,setTimeout,clearTimeout,performance,self:{},TextDecoder,TextEncoder,URL,Blob};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.BABYLON;
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylonjs-loaders-9.31.0.min.js',import.meta.url),'utf8'),sandbox);
async function studio(check){
 const engine=new B.NullEngine(),scene=new B.Scene(engine),loader=B.SceneLoader.LoadAssetContainerAsync;let actors;
 // Only replace transport: Babylon parses, clones, animates and renders the shipped GLBs.
 B.SceneLoader.LoadAssetContainerAsync=(path,file)=>loader.call(B.SceneLoader,'',new Uint8Array(readFileSync(new URL('../'+path+file.split('?')[0],import.meta.url))),scene,undefined,'.glb');
 try{
  scene.activeCamera=new B.FreeCamera('camera',new B.Vector3(0,3,-8),scene);actors=await createGameActors(B,scene,{},{includeFauna:false});
  const state=createGame({start:'established'}),base=state.citizens.find(c=>c.age>=16);
  state.buildings=[];state.citizens=[{...base,id:7800,age:30,sex:'m',role:'production',calling:'auto',futureRole:null,pendingRole:null,work:null,site:null,siteDuty:null,guardPost:null,phase:'waiting',x:7,y:10,mood:50,clothing:100,cargo:{},buildCargo:{}}];
  const frame=(s=state,options)=>{actors.update(s,1/60,options);scene.render();return actors.rootFor({citizenId:7800});};
  await check({scene,actors,state,c:state.citizens[0],frame});
 }finally{actors?.dispose();B.SceneLoader.LoadAssetContainerAsync=loader;scene.dispose();engine.dispose();}
}
const colorWrites=new WeakMap();
function surfaces(root){const result=[...new Set(root.getChildMeshes().map(m=>m.material).filter(m=>/^citizen-(skin|hair|cloth)-/.test(m?.name||'')))];assert.ok(result.length>=3,'real independently recolored GLB surfaces');return result;}
function colors(root){
 const materials=surfaces(root);for(const m of materials)if(!colorWrites.has(m)){
  let prototype=m,descriptor;while(prototype&&!descriptor){descriptor=Object.getOwnPropertyDescriptor(prototype,'albedoColor');prototype=Object.getPrototypeOf(prototype);}
  assert.ok(descriptor?.get&&descriptor?.set);colorWrites.set(m,0);
  // Observe writes while preserving Babylon's real setter, equality checks and dirty flags.
  Object.defineProperty(m,'albedoColor',{configurable:true,get(){return descriptor.get.call(this);},set(value){colorWrites.set(this,colorWrites.get(this)+1);descriptor.set.call(this,value);}});
 }
 const result=materials.map(m=>m.albedoColor);result.writes=materials.reduce((n,m)=>n+colorWrites.get(m),0);return result;
}
function unchanged(root,previous,message){const next=colors(root);assert.equal(next.length,previous.length);for(let i=0;i<next.length;i++)assert.equal(next[i],previous[i],message);assert.equal(next.writes,previous.writes,message||'unchanged appearance must skip real material setter writes');}
function cloth(root){const m=root.getChildMeshes().find(m=>/draped wool skirt/i.test(m.name))?.material;assert.ok(m);return m;}
function garment(root){return root.getChildMeshes().find(m=>m.metadata?.profession);}
function child(root,suffix){const n=root.getChildTransformNodes().find(n=>n.name.endsWith(suffix));assert.ok(n,suffix);return n;}
function mesh(root,name){return root.getChildMeshes().find(m=>m.name===name);}
function tint(actual,hex){const expected=B.Color3.FromHexString(hex).toLinearSpace();for(const key of ['r','g','b'])assert.ok(Math.abs(actual[key]-expected[key])<1e-8,`${key}: ${actual[key]} vs ${hex}`);}

// Babylon retains an equal Color3 internally, so also observe writes to catch wasted allocations.
test('unchanged real GLB appearance keeps material colors and garments while movement and wear decay continue',async()=>studio(({state,c,frame})=>{
 c.calling='potter';const root=frame(),before=JSON.stringify(state),initial=colors(root),wrap=garment(root);assert.ok(wrap);
 for(const clothing of [99.9,80,51]){c.clothing=clothing;c.x+=.01;c.phase='toWork';frame();unchanged(root,initial,'same wear tier must skip material writes');assert.equal(garment(root),wrap);}
 c.clothing=100;c.x=7;c.phase='waiting';frame();assert.equal(JSON.stringify(state),before,'render updates never edit the citizen or save');
}));

test('wear cache invalidates at 50 and 25 only and retains the shipped wool tints and roughness',async()=>studio(({c,frame})=>{
 const root=frame();let previous=colors(root);
 for(const {value,hex,roughness,changed}of [{value:51,roughness:.88,changed:false},{value:50,hex:'#b6a88d',roughness:.96,changed:true},{value:26,hex:'#b6a88d',roughness:.96,changed:false},{value:25,hex:'#9b927b',roughness:1,changed:true},{value:0,hex:'#9b927b',roughness:1,changed:false},{value:100,roughness:.88,changed:true}]){
  c.clothing=value;frame();if(changed)assert.ok(colors(root).writes>previous.writes);else unchanged(root,previous,`wear ${value} has not crossed a threshold`);
  assert.equal(cloth(root).roughness,roughness);if(hex)tint(cloth(root).albedoColor,hex);previous=colors(root);
 }
}));

test('profession adoption, pending roles, mourning, future calling and inspiration update without stale garments',async()=>studio(({state,c,frame})=>{
 const root=frame(),sign=mesh(root,'citizen-7800-inspired');assert.equal(sign.isEnabled(),false);
 c.futureRole='potter';frame();assert.equal(sign.isEnabled(),true);c.futureRole=null;frame();assert.equal(sign.isEnabled(),false);
 c.calling='potter';c.pendingRole='production';frame();assert.equal(garment(root),undefined);assert.equal(sign.isEnabled(),true);
 c.pendingRole=null;frame();const potter=garment(root);assert.equal(potter?.metadata.profession,'potter');
 c.calling='weaver';frame();assert.equal(potter.isDisposed(),true);assert.equal(garment(root)?.metadata.profession,'weaver');
 c.phase='mourning';frame();assert.equal(garment(root),undefined);tint(cloth(root).albedoColor,'#c7c9ae');
 c.phase='waiting';frame();assert.equal(garment(root)?.metadata.profession,'weaver');
 c.role='builder';frame();assert.equal(garment(root),undefined);c.calling='auto';c.work='work';state.buildings=[{id:'work',type:'clay',x:0,y:0}];
 state.buffs.inspiration=0;frame();assert.equal(sign.isEnabled(),false);state.buffs.inspiration=2;frame();assert.equal(sign.isEnabled(),true);state.buffs.inspiration=0;frame();assert.equal(sign.isEnabled(),false);
}));

test('fresh workplace types retain first-match and coordinate-fallback semantics for clothing and cargo',async()=>studio(({state,c,frame})=>{
 c.work='shared';c.cargo={food:2};state.buildings=[{id:'shared',type:'weaver',x:0,y:0},{id:'shared',type:'fishing',x:1,y:0}];const root=frame();assert.ok(mesh(root,'craft-thread'));assert.ok(mesh(root,'cargo-sack'));let previous=colors(root);
 state.buildings[0].type='fishing';frame();assert.ok(colors(root).writes>previous.writes);assert.equal(mesh(root,'craft-thread'),undefined);assert.ok(mesh(root,'cargo-fish'));previous=colors(root);
 state.buildings[0].type='hunting';frame();assert.ok(mesh(root,'cargo-game-bundle'));assert.equal(mesh(root,'cargo-fish'),undefined);assert.ok(colors(root).writes>previous.writes);
 state.buildings[0].type=undefined;frame();assert.ok(mesh(root,'cargo-sack'),'undefined first match must not fall through to duplicate fishing building');assert.equal(mesh(root,'cargo-fish'),undefined);
 c.work='2,3';state.buildings=[{id:0,x:2,y:3,type:'weaver'}];frame();assert.ok(mesh(root,'craft-thread'),'falsy building ID retains coordinate fallback');
 state.buildings[0].type='fishing';frame();assert.ok(mesh(root,'cargo-fish'));assert.equal(mesh(root,'craft-thread'),undefined);
}));

test('cargo changes rebuild carried meshes each update without invalidating appearance',async()=>studio(({c,frame})=>{
 const root=frame(),initial=colors(root);assert.equal(child(root,'-carried').getChildMeshes().length,0);
 c.cargo={wood:2};frame();const bundle=mesh(root,'cargo-bundle');assert.ok(bundle);unchanged(root,initial,'cargo is independent of appearance');
 c.cargo.wood=3;frame();assert.equal(bundle.isDisposed(),true);assert.ok(mesh(root,'cargo-bundle'));unchanged(root,initial,'cargo amounts do not recolor the resident');
 c.cargo={water:1};frame();assert.ok(mesh(root,'cargo-vessel'));assert.equal(mesh(root,'cargo-bundle'),undefined);unchanged(root,initial);
 c.cargo={};frame();assert.equal(child(root,'-carried').getChildMeshes().length,0);unchanged(root,initial);
}));

test('age, sex, mood, site duties and guards refresh while head identity survives post-animation resets',async()=>studio(({c,frame,scene})=>{
 let root=frame(),initial=colors(root),head=child(root,'-head'),scale=head.scaling.asArray(),model=child(root,'-model');
 c.mood=10;frame();assert.ok(Math.abs(model.rotation.x-.045)<1e-8);unchanged(root,initial,'live mood must not recolor the rig');c.mood=50;frame();assert.equal(model.rotation.x,0);
 head.scaling.setAll(2);scene.render();assert.deepEqual(head.scaling.asArray(),scale,'observer reapplies identity after animations even on cache hits');
 c.siteDuty='carrier';frame();assert.ok(mesh(root,'carrier-sling'));c.siteDuty=null;frame();assert.equal(mesh(root,'carrier-sling'),undefined);
 c.work='guard';c.guardPost='guard';c.phase='working';frame();assert.ok(mesh(root,'guard-staff'));c.phase='waiting';frame();assert.equal(mesh(root,'guard-staff'),undefined);
 c.age=55;frame();const grey=surfaces(root).find(m=>m.name.startsWith('citizen-hair-')).albedoColor;assert.ok(['#8c8372','#b0a693','#756b5d'].some(hex=>{const q=B.Color3.FromHexString(hex).toLinearSpace();return Math.abs(q.r-grey.r)+Math.abs(q.g-grey.g)+Math.abs(q.b-grey.b)<1e-8;}));
 c.sex='f';root=frame();assert.equal(root.metadata.residentVariant,'female');c.age=7;root=frame();assert.equal(root.metadata.residentVariant,'child');const height=root.scaling.y;c.age=8;frame();assert.ok(root.scaling.y>height);c.age=13;root=frame();assert.equal(root.metadata.residentVariant,'adolescent');c.age=30;root=frame();assert.equal(root.metadata.residentVariant,'female');
}));

test('replacement city with reused citizen IDs refreshes appearance on the same paused rig without mutating saves',async()=>studio(({state,c,frame})=>{
 c.calling='potter';const root=frame(),initial=colors(root),loaded=structuredClone(state),before=JSON.stringify(loaded);
 frame(loaded,{paused:true});assert.equal(frame(loaded,{paused:true}),root);assert.ok(colors(root).writes>initial.writes,'state replacement resets cached appearance even for the same IDs');
 const refreshed=colors(root);frame(loaded,{paused:true});unchanged(root,refreshed);assert.equal(JSON.stringify(loaded),before);
 loaded.citizens[0].clothing=25;loaded.citizens[0].calling='auto';const changed=JSON.stringify(loaded);frame(loaded,{paused:true});tint(cloth(root).albedoColor,'#9b927b');assert.equal(garment(root),undefined);assert.equal(JSON.stringify(loaded),changed);
}));

test('far geometry shares the real resident rig and restores the original mesh when inspected',async()=>studio(({state,c,frame})=>{
 const root=frame(),skin=root.getChildMeshes().find(m=>/native civilian skin/i.test(m.name));
 const {geometry,skeleton,material}=skin,full=skin.getTotalIndices(),before=JSON.stringify(state);
 const camera={fov:Math.PI/4,position:{x:0,y:3,z:500}},options={camera,viewportHeight:720};
 assert.equal(frame(state,options),root);
 assert.ok(skin.getTotalIndices()<full*.5);
 assert.equal(skin.skeleton,skeleton);assert.equal(skin.material,material);
 assert.equal(frame(state,{...options,focusId:c.id}),root);
 assert.equal(skin.geometry,geometry);assert.equal(skin.getTotalIndices(),full);
 assert.equal(skin.subMeshes[0].indexCount,full,'the full range is rendered after returning from LOD');
 assert.equal(JSON.stringify(state),before);
}));
