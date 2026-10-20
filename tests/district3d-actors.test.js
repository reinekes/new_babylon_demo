import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGame} from '../engine.js';
import {visibleCitizens} from '../workforce.js';
import {animalsFor} from '../fauna.js';
import {surfaceElevation} from '../district3d/terrain.js';
import {bridgeSpan,onBridge,river} from '../world.js';
import {createDistrictActors} from '../district3d/actors.js';
const sandbox={exports:{},module:{exports:{}},console,setTimeout,clearTimeout,performance,window:{addEventListener(){},removeEventListener(){}},navigator:{userAgent:'node'}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.exports.NullEngine?sandbox.exports:sandbox.module.exports;

test('3D actors instance shared geometry, preserve simulation and track real positions and cargo',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),view=createDistrictActors(B,scene,{}),s=createGame();
 const c=s.citizens.find(c=>c.age>=16);c.phase='toStore';c.cargo={clay:2};
 const before=JSON.stringify(s);view.update(s,s.simTime);
 assert.equal(JSON.stringify(s),before,'rendering must not change saved identity, positions or stock');
 const root=scene.transformNodes.find(n=>n.metadata?.citizenId===c.id);
 assert.ok(root);assert.equal(root.position.x,c.x*6);assert.equal(root.position.z,c.y*6);
 assert.equal(root.position.y,surfaceElevation(c.x,c.y,s));
 for(const animal of animalsFor(s)){
  const rig=scene.transformNodes.find(n=>n.metadata?.animalId===animal.id);
  assert.equal(rig.position.y,onBridge(s.buildings,animal.x,animal.y)?.22:surfaceElevation(animal.x,animal.y,s));
 }
 assert.equal(scene.transformNodes.filter(n=>n.metadata?.citizenId!==undefined&&n.isEnabled()).length,visibleCitizens(s).length);
 assert.equal(scene.transformNodes.filter(n=>n.metadata?.animalId!==undefined&&n.isEnabled()).length,animalsFor(s).length);
 assert.ok(view.meshes.every(m=>m instanceof B.InstancedMesh));
 const count=scene.meshes.length,ids=view.meshes.map(m=>m.uniqueId);
 for(let i=0;i<10;i++)view.update(s,s.simTime);
 assert.equal(scene.meshes.length,count,'steady frames allocate no meshes');assert.deepEqual(view.meshes.map(m=>m.uniqueId),ids);
 const load=root.getChildTransformNodes().find(n=>n.name==='carried-goods');assert.ok(load.getChildMeshes().length>0);
 c.x+=.1;c.y+=.2;view.update(s,s.simTime);assert.equal(root.position.x,c.x*6);assert.equal(root.position.z,c.y*6);assert.ok(root.rotation.y>0);
 c.x=.2;c.y=.2;view.update(s,s.simTime);assert.ok(root.position.y>0,'feet follow raised edge terrain');assert.equal(root.position.y,surfaceElevation(c.x,c.y,s));
 const bridge={type:'bridge',x:Math.round(river(10)),y:10};s.buildings.push(bridge);
 const span=bridgeSpan(bridge.y);c.x=(span.left+span.right)/2;c.y=span.y;view.update(s,s.simTime);
 assert.equal(root.position.y,.22,'bridge walkers stand on the deck instead of the river bed');
 c.cargo={};view.update(s,s.simTime);assert.equal(load.getChildMeshes().length,0,'empty hands cannot retain fictitious cargo');
 c.phase='home';view.update(s,s.simTime);assert.equal(root.isEnabled(),false);
 s.citizens=s.citizens.filter(p=>p.id!==c.id);view.update(s,s.simTime);assert.ok(root.isDisposed(),'departed citizen pool must be released');
 view.dispose();assert.equal(view.meshes.length,0);assert.equal(scene.meshes.length,0);scene.dispose();engine.dispose();
});

test('camera frustum skips actor rigs and restores current simulated position on return',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),view=createDistrictActors(B,scene,{}),s=createGame();
 const c=s.citizens.find(c=>c.age>=16);s.citizens=[c];c.phase='toStore';c.cargo={};
 const camera=new B.FreeCamera('test-camera',new B.Vector3(c.x*6,8,c.y*6-10),scene);
 camera.setTarget(new B.Vector3(c.x*6,0,c.y*6));camera.minZ=.1;camera.maxZ=100;scene.activeCamera=camera;
 view.update(s);const root=scene.transformNodes.find(n=>n.metadata?.citizenId===c.id);assert.ok(root?.isEnabled());
 camera.position.x+=10000;camera.setTarget(new B.Vector3(c.x*6+10000,0,c.y*6));view.update(s);assert.equal(root.isEnabled(),false);
 const count=scene.meshes.length;c.x+=.2;const state=JSON.stringify(s);view.update(s);assert.equal(root.isEnabled(),false);assert.equal(scene.meshes.length,count);assert.equal(JSON.stringify(s),state);
 camera.position.x=c.x*6;camera.setTarget(new B.Vector3(c.x*6,0,c.y*6));view.update(s);assert.equal(root.isEnabled(),true);assert.equal(root.position.x,c.x*6);assert.equal(root.position.z,c.y*6);
 view.dispose();scene.dispose();engine.dispose();
});
