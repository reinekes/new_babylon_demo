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
 const engine=new B.NullEngine(),scene=new B.Scene(engine),view=createDistrictActors(B,scene,{}),s=createGame({start:'established'});
 const c=s.citizens.find(c=>c.age>=16);c.phase='toStore';c.cargo={clay:2};
 const before=JSON.stringify(s);view.update(s,s.simTime);
 assert.equal(JSON.stringify(s),before,'rendering must not change saved identity, positions or stock');
 const root=scene.transformNodes.find(n=>n.metadata?.citizenId===c.id);
 assert.ok(root);assert.equal(root.position.x,c.x*6);assert.equal(root.position.z,c.y*6);
 assert.equal(root.position.y,surfaceElevation(c.x,c.y,s));
 for(const animal of animalsFor(s).filter(a=>a.kind!=='fish')){
  const rig=scene.transformNodes.find(n=>n.metadata?.animalId===animal.id);
  assert.equal(rig.position.y,onBridge(s.buildings,animal.x,animal.y)?.22:surfaceElevation(animal.x,animal.y,s));
 }
 assert.equal(scene.transformNodes.filter(n=>n.metadata?.citizenId!==undefined&&n.isEnabled()).length,visibleCitizens(s).length);
 assert.equal(scene.transformNodes.filter(n=>n.metadata?.animalId!==undefined&&n.isEnabled()).length,animalsFor(s).filter(a=>a.kind!=='fish').length);
 assert.ok(!scene.transformNodes.some(n=>String(n.metadata?.animalId).startsWith('fish:')),'legacy renderer must not render fish as land mammals');
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
 const engine=new B.NullEngine(),scene=new B.Scene(engine),view=createDistrictActors(B,scene,{}),s=createGame({start:'established'});
 const c=s.citizens.find(c=>c.age>=16);s.citizens=[c];c.phase='toStore';c.cargo={};
 const camera=new B.FreeCamera('test-camera',new B.Vector3(c.x*6,8,c.y*6-10),scene);
 camera.setTarget(new B.Vector3(c.x*6,0,c.y*6));camera.minZ=.1;camera.maxZ=100;scene.activeCamera=camera;
 view.update(s);const root=scene.transformNodes.find(n=>n.metadata?.citizenId===c.id);assert.ok(root?.isEnabled());
 camera.position.x+=10000;camera.setTarget(new B.Vector3(c.x*6+10000,0,c.y*6));view.update(s);assert.equal(root.isEnabled(),false);
 view.update(s,s.simTime,1/60,{citizenId:c.id});assert.equal(root.isEnabled(),true,'tracked resident stays available while the camera catches up');view.update(s);assert.equal(root.isEnabled(),false);
 const count=scene.meshes.length;c.x+=.2;const state=JSON.stringify(s);view.update(s);assert.equal(root.isEnabled(),false);assert.equal(scene.meshes.length,count);assert.equal(JSON.stringify(s),state);
 camera.position.x=c.x*6;camera.setTarget(new B.Vector3(c.x*6,0,c.y*6));view.update(s);assert.equal(root.isEnabled(),true);assert.equal(root.position.x,c.x*6);assert.equal(root.position.z,c.y*6);
 view.dispose();scene.dispose();engine.dispose();
});

test('residents ease into turns, settle their feet when stopped and keep real cargo and position',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),view=createDistrictActors(B,scene,{}),s=createGame({start:'established'});
 const c=s.citizens.find(c=>c.age>=16);s.citizens=[c];c.phase='toStore';c.cargo={clay:2};
 view.update(s,0,1/60);
 const root=scene.transformNodes.find(n=>n.metadata?.citizenId===c.id),before=JSON.stringify(s);
 const body=root.getChildTransformNodes().find(n=>n.name==='body'),hip=root.getChildTransformNodes().find(n=>n.name==='hip');
 c.x+=.04;view.update(s,1/60,1/60);
 assert.ok(root.rotation.y>0&&root.rotation.y<.45,'a right angle turn must not snap in one frame');
 assert.equal(root.position.x,c.x*6,'smoothing must not move the resident away from their real route');
 for(let i=2;i<=90;i++)view.update(s,i/60,1/60);
 assert.ok(Math.abs(root.rotation.y-Math.PI/2)<.02,'turn should settle onto the actual direction');
 assert.ok(Math.abs(hip.rotation.x)<.03,'a resident waiting on their route must stop marching');
 const yaw=root.rotation.y,pose=body.rotation.z;
 view.update(s,90/60,0);assert.equal(root.rotation.y,yaw);assert.equal(body.rotation.z,pose,'paused poses must remain still');
 assert.equal(JSON.stringify(s),JSON.stringify({...JSON.parse(before),citizens:[{...JSON.parse(before).citizens[0],x:c.x}]}));
 view.dispose();scene.dispose();engine.dispose();
});

test('cloth faces outward and all shared model vertices stay finite',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),view=createDistrictActors(B,scene,{}),s=createGame({start:'established'});
 view.update(s,0,1/60);
 const cloth=scene.meshes.find(m=>m.name.startsWith('actor-source-wrap:'));assert.ok(cloth);
 const positions=cloth.getVerticesData(B.VertexBuffer.PositionKind),normals=cloth.getVerticesData(B.VertexBuffer.NormalKind);
 for(let i=0;i<positions.length;i+=3)assert.ok(positions[i]*normals[i]+positions[i+2]*normals[i+2]>.1,'cloth must face outward rather than expose the back of the wrap');
 for(const mesh of scene.meshes.filter(m=>m.name.startsWith('actor-source-'))){
  assert.ok(mesh.getVerticesData(B.VertexBuffer.PositionKind).every(Number.isFinite));
 }
 view.dispose();scene.dispose();engine.dispose();
});

test('birds alternate their two legs instead of hopping with both together',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),view=createDistrictActors(B,scene,{}),s=createGame({start:'established'});
 let alternating=false;
 for(let i=0;i<80&&!alternating;i++){
  s.simTime=i*.05;view.update(s,s.simTime,.05);
  for(const bird of animalsFor(s).filter(a=>a.kind==='bird'&&a.walking)){
   const root=scene.transformNodes.find(n=>n.metadata?.animalId===bird.id);
   const legs=root.getChildTransformNodes().filter(n=>n.name==='animal-hip');
   if(legs.length===2&&legs[0].rotation.x*legs[1].rotation.x<-.0001)alternating=true;
  }
 }
 assert.ok(alternating,'a walking bird must advance one leg while the other is behind');
 view.dispose();scene.dispose();engine.dispose();
});
