import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGame} from '../engine.js';
import {surfaceElevation} from '../district3d/terrain.js';
import {createBootstrapActors} from '../game3d/bootstrap-actors.js';
import {pickedEntity,GameRenderer3D} from '../game3d/renderer.js';
import {createGameBuildings} from '../game3d/buildings.js';

const sandbox={exports:{},module:{exports:{}},console,setTimeout,clearTimeout,performance,window:{addEventListener(){},removeEventListener(){}},navigator:{userAgent:'node'}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.exports.NullEngine?sandbox.exports:sandbox.module.exports;
const fixture=()=>{const s=createGame({start:'established'}),base=s.citizens.find(c=>c.age>=16);s.citizens=[{...base,id:0,age:30,x:5,y:7,phase:'toStore',cargo:{clay:2}},{...base,id:4007,age:12,x:6,y:7,phase:'toHome',cargo:{}}];s.population=2;return s;};

test('bootstrap citizens have selectable actual geometry at saved coordinates with stable non-contiguous IDs',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),view=createBootstrapActors(B,scene),s=fixture(),before=JSON.stringify(s);
 try{
  const live=view.meshes;view.update(s);assert.equal(JSON.stringify(s),before);assert.equal(live.length,4);assert.equal(view.meshes,live);
  for(const c of s.citizens){const root=view.rootFor({citizenId:c.id});assert.ok(root);assert.equal(root.position.x,c.x*6);assert.equal(root.position.z,c.y*6);assert.equal(root.position.y,surfaceElevation(c.x,c.y,s));root.computeWorldMatrix(true);
   for(const m of root.getChildMeshes()){assert.ok(m.getTotalVertices()>0);assert.equal(m.isPickable,true);assert.equal(pickedEntity(m).citizenId,c.id);m.computeWorldMatrix(true);}
   const pick=scene.pickWithRay(new B.Ray(new B.Vector3(c.x*6,10,c.y*6),new B.Vector3(0,-1,0)),m=>m.metadata?.citizenId===c.id);assert.equal(pick.hit,true);assert.equal(pickedEntity(pick.pickedMesh).citizenId,c.id);
  }
 }finally{view.dispose();scene.dispose();engine.dispose();}
});
test('bootstrap updates move existing identities without simulation writes or per-frame mesh growth',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),view=createBootstrapActors(B,scene),s=fixture();
 try{view.update(s);const root=view.rootFor({citizenId:4007}),meshCount=scene.meshes.length;
  for(let i=0;i<20;i++){s.citizens[1].x+=.025;s.simTime+=.1;const before=JSON.stringify(s);view.update(s);assert.equal(JSON.stringify(s),before);assert.equal(view.rootFor({citizenId:4007}),root);assert.equal(root.position.x,s.citizens[1].x*6);assert.equal(scene.meshes.length,meshCount);}
 }finally{view.dispose();scene.dispose();engine.dispose();}
});
test('bootstrap removes a vanished ID without renumbering survivors and releases all owned resources once',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),view=createBootstrapActors(B,scene),s=fixture();
 try{view.update(s);const gone=view.rootFor({citizenId:0}),survivor=view.rootFor({citizenId:4007}),live=view.meshes,meshes=[...live],materials=[...new Set(live.map(m=>m.material))];s.citizens.shift();s.population=1;view.update(s);assert.equal(gone.isDisposed(),true);assert.equal(view.rootFor({citizenId:0}),undefined);assert.equal(view.rootFor({citizenId:4007}),survivor);assert.equal(live.length,2);
  view.dispose();view.dispose();assert.equal(live.length,0);assert.equal(view.rootFor({citizenId:4007}),undefined);for(const m of meshes)assert.equal(m.isDisposed(),true);for(const material of materials)assert.equal(scene.materials.includes(material),false);const count=scene.meshes.length;view.update(s);assert.equal(scene.meshes.length,count);
 }finally{view.dispose();scene.dispose();engine.dispose();}
});
test('a child who grows up while detailed models are pending gets the adult bootstrap scale',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),view=createBootstrapActors(B,scene),s=fixture();
 try{view.update(s);const root=view.rootFor({citizenId:4007});assert.ok(root.scaling.y<1);s.citizens[1].age=16;view.update(s);assert.equal(view.rootFor({citizenId:4007}),root);assert.equal(root.scaling.y,1);}
 finally{view.dispose();scene.dispose();engine.dispose();}
});
test('renderer initialization exposes real selectable bootstrap layers before any delayed GLB can resolve',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),originalLoad=B.SceneLoader.LoadAssetContainerAsync,originalDocument=globalThis.document,s=fixture();
 const node=()=>({dataset:{},setAttribute(){},remove(){},textContent:'',hidden:false});
 globalThis.document={createElement:node};let loads=0,stopCalls=0;
 B.SceneLoader.LoadAssetContainerAsync=()=>{loads++;return new Promise(()=>{});};
 const materials=Object.fromEntries(['soil','wood','plaster','brick','reed','linen','terracotta','stone','grass'].map(name=>[name,new B.PBRMaterial(name,scene)]));Object.defineProperty(materials,'loadPhotos',{async value(){}});
 const renderer=Object.create(GameRenderer3D.prototype);Object.assign(renderer,{B,scene,engine,materials,canvas:{parentNode:{append(){}}},resize(){},home(){},camera:{target:{x:3,z:4},alpha:.4,beta:1.1,radius:48}});
 const stop=engine.stopRenderLoop.bind(engine);engine.stopRenderLoop=()=>{stopCalls++;stop();};let timer;
 try{
  const before=JSON.stringify(s);await Promise.race([renderer.initialize(s),new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('initialization waited for GLB details')),2500))]);clearTimeout(timer);
  assert.equal(renderer.layersReady,true);assert.equal(stopCalls,1);assert.ok(renderer.buildings.meshes.some(m=>m.getTotalVertices()>0));assert.ok(renderer.landscape.meshes.some(m=>m.name==='alluvial-valley'));assert.ok(renderer.actors.rootFor({citizenId:4007}));assert.equal(JSON.stringify(s),before);assert.equal(renderer.camera.radius,48);
  await new Promise(resolve=>setTimeout(resolve,0));assert.ok(loads>0,'detail work starts in the background after bootstrap readiness');assert.equal(renderer.layersReady,true);assert.equal(JSON.stringify(s),before);assert.equal(renderer.camera.radius,48);
 }finally{clearTimeout(timer);renderer.dispose();B.SceneLoader.LoadAssetContainerAsync=originalLoad;if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;}
});
test('an invalid detailed rig cannot replace or destroy the working bootstrap layer',async t=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),originalLoad=B.SceneLoader.LoadAssetContainerAsync,originalDocument=globalThis.document,s=fixture();s.buildings=s.buildings.filter(b=>b.type!=='field');
 globalThis.document={createElement:()=>({dataset:{},setAttribute(){},remove(){}})};t.mock.method(console,'warn',()=>{});const releasedSources=[],requiredSources=['source-walk-male.glb','source-walk-female.glb','source-walk-child.glb','source-walk-adolescent.glb','sheep.glb'];
 B.SceneLoader.LoadAssetContainerAsync=(_path,file)=>{
  const name=file.split('?')[0];if(!requiredSources.includes(name))return new Promise(()=>{});
  return Promise.resolve({animationGroups:[{name:'Walk_Loop'},{name:'Idle_Loop'}],skeletons:[{bones:Array.from({length:41})}],instantiateModelsToScene(){throw Error('rig geometry unavailable');},dispose(){releasedSources.push(name);}});
 };
 const materials=Object.fromEntries(['soil','wood','plaster','brick','reed','linen','terracotta','stone','grass'].map(name=>[name,new B.PBRMaterial(name,scene)]));Object.defineProperty(materials,'loadPhotos',{async value(){}});
 const renderer=Object.create(GameRenderer3D.prototype);Object.assign(renderer,{B,scene,engine,materials,canvas:{parentNode:{append(){}}},resize(){},home(){},quality:'high'});
 try{await renderer.initialize(s);const bootstrap=renderer.actors,root=bootstrap.rootFor({citizenId:4007}),before=JSON.stringify(s);
  for(let i=0;i<100&&!renderer.detailQueue.errors.length;i++)await new Promise(resolve=>setTimeout(resolve,1));
  assert.ok(renderer.detailQueue.errors.some(error=>/rig geometry unavailable/.test(error.message)));assert.equal(renderer.actors,bootstrap);assert.equal(root.isDisposed(),false);assert.equal(bootstrap.rootFor({citizenId:4007}),root);assert.deepEqual(releasedSources.sort(),requiredSources.sort(),'all five owned sources are released exactly once');assert.equal(JSON.stringify(s),before);assert.doesNotThrow(()=>bootstrap.update(s));
 }finally{renderer.dispose();B.SceneLoader.LoadAssetContainerAsync=originalLoad;if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;}
});
test('a city without initial fields requests crop detail only when its first field is later built',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),originalLoad=B.SceneLoader.LoadAssetContainerAsync,s=fixture();s.buildings=s.buildings.filter(b=>b.type!=='field');const loads=[];
 B.SceneLoader.LoadAssetContainerAsync=(_path,file)=>{loads.push(file);return new Promise(()=>{});};
 const materials=Object.fromEntries(['soil','wood','plaster','brick','reed','linen','terracotta','stone','grass'].map(name=>[name,new B.PBRMaterial(name,scene)]));let view;
 try{view=await createGameBuildings(B,scene,materials,{deferAssets:true});view.sync(s);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(loads.length,0);
  s.buildings.push({type:'field',x:5,y:10,level:1,crop:{sown:1,growth:.6}});const before=JSON.stringify(s);view.sync(s);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(loads.length,1);assert.ok(loads[0].includes('valley-barley.glb'));assert.equal(JSON.stringify(s),before);
  view.sync(s);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(loads.length,1,'one shared crop request is reused on later updates');assert.ok(view.meshes.some(m=>m.metadata?.type==='field'&&m.getTotalVertices()>0));
 }finally{view?.dispose();B.SceneLoader.LoadAssetContainerAsync=originalLoad;scene.dispose();engine.dispose();}
});
