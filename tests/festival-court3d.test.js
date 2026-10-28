import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const sandbox={console,setTimeout,clearTimeout,performance,self:{}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.BABYLON;

test('a live feast reuses its food, vessels and flickering hearths, then leaves no resources behind',async()=>{
 const module=await import('../game3d/festival-court.js');
 const engine=new B.NullEngine(),scene=new B.Scene(engine),meshes=[];
 const state={buildings:[{type:'shrine',x:8,y:8}],resources:{food:45,beer:3},citizens:[{id:1,x:8,y:9}]},before=JSON.stringify(state);
 let court;
 try{
  court=module.createFestivalCourt(B,scene,meshes);
  court.update(null,state,0);assert.equal(meshes.length,0,'a festival court is not visible before there is a feast');
  const view={stage:'celebrating',consumed:true,court:{x:7,y:9},participants:[1],dancing:[1],elapsed:0};
  court.update(view,state,0);
  const root=court.root,parts=[...meshes],lights=[...scene.lights],materials=[...scene.materials];
  assert.ok(parts.length>0,'actual food and drink geometry is visible');
  assert.ok(parts.some(m=>m.metadata?.festivalProp==='food'),'guests have real serving dishes');
  assert.ok(parts.some(m=>m.metadata?.festivalProp==='vessels'),'the feast has clay beer vessels');
  assert.equal(lights.length,2,'two small hearths light the gathering');
  assert.equal(root.position.x,42);assert.equal(root.position.z,54);
  const fire=parts.find(m=>m.metadata?.festivalProp==='flame'),firstHeight=fire.scaling.y;
  for(let i=1;i<=300;i++)court.update(view,state,i/30);
  assert.equal(court.root,root);assert.deepEqual(meshes,parts,'render frames do not allocate replacement geometry');
  assert.equal(scene.lights.length,lights.length);assert.ok(lights.every((light,i)=>scene.lights[i]===light));
  assert.equal(scene.materials.length,materials.length);assert.ok(materials.every((material,i)=>scene.materials[i]===material),'render frames do not allocate materials');
  assert.notEqual(fire.scaling.y,firstHeight,'the hearth flame actually moves');
  assert.equal(JSON.stringify(state),before,'presentation does not spend food or change residents');
  court.update(null,state,11);
  assert.equal(court.root,null);assert.equal(meshes.length,0);assert.equal(scene.meshes.length,0);assert.equal(scene.lights.length,0);assert.equal(scene.materials.length,0);
  court.update(view,state,12);assert.ok(court.root,'a later real festival can have its own feast');
  court.dispose();assert.equal(meshes.length,0);assert.equal(scene.meshes.length,0);assert.equal(scene.lights.length,0);assert.equal(scene.materials.length,0);
 }finally{court?.dispose();scene.dispose();engine.dispose();}
});
