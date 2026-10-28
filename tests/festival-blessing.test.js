import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {festivalBlessingFrame,festivalBlessingParticle,FESTIVAL_BLESSING_COUNT} from '../festival-blessing.js';
import {createFestivalBlessing} from '../game3d/festival-blessing.js';
import {createFestivalCourt} from '../game3d/festival-court.js';
import {drawFestivalBlessing} from '../festival-art.js';

const view=elapsed=>({occasion:'nightLights',stage:'celebrating',elapsed,court:{x:8,y:7}});
test('the divine light falls only in the middle of Night of Lights and fades at both ends',()=>{
 for(const elapsed of [0,29.9,30,65,90])assert.equal(festivalBlessingFrame(view(elapsed)),null);
 for(const value of [null,{...view(45),stage:'waiting'},{...view(45),occasion:'firstBeer'},{...view(45),court:null},{...view(45),elapsed:NaN}])assert.equal(festivalBlessingFrame(value),null);
 assert.equal(festivalBlessingFrame(view(45)).alpha,1);
 assert.ok(festivalBlessingFrame(view(31)).alpha<.2);
 assert.ok(festivalBlessingFrame(view(64)).alpha<.2);
});

test('flakes descend, stay bounded and restore exactly from ceremony time without touching the save',()=>{
 const saved=view(45),before=JSON.stringify(saved),frame=festivalBlessingFrame(saved);
 const flakes=Array.from({length:FESTIVAL_BLESSING_COUNT},(_,i)=>festivalBlessingParticle(frame,i));
 assert.ok(flakes.length>=48&&flakes.length<=100);
 for(const p of flakes){assert.ok(Math.hypot(p.x-8,p.y-7)<2.9);assert.ok(p.height>=.4&&p.height<=11);assert.ok(p.alpha>=0&&p.alpha<=1);assert.ok(p.size>0&&p.size<.2);}
 const restored=festivalBlessingFrame(JSON.parse(before));
 assert.deepEqual(flakes,Array.from({length:FESTIVAL_BLESSING_COUNT},(_,i)=>festivalBlessingParticle(restored,i)));
 const later=festivalBlessingFrame(view(45.1));
 assert.ok(flakes.filter((p,i)=>festivalBlessingParticle(later,i).height<p.height).length>flakes.length*.9,'almost every flake descends, apart from a wrap at its invisible end');
 assert.equal(JSON.stringify(saved),before);
});

const sandbox={console,setTimeout,clearTimeout,performance,self:{}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.BABYLON;
test('real Babylon uses one reusable mesh, freezes on pause and leaks no meshes, textures or lights across cycles',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),layer=createFestivalBlessing(B,scene),state={buildings:[]};
 try{
  layer.update(view(12),state);assert.equal(scene.meshes.length,0);
  layer.update(view(45),state);const mesh=layer.mesh,material=mesh.material;
  assert.equal(scene.meshes.length,1);assert.equal(scene.materials.length,1);assert.equal(scene.lights.length,0);assert.equal(scene.textures.length,0);assert.ok(mesh.isEnabled());
  scene.activeCamera=new B.FreeCamera('blessing-camera',new B.Vector3(48,5,34),scene);scene.render();
  const positions=Array.from(mesh.getVerticesData(B.VertexBuffer.PositionKind)),colors=Array.from(mesh.getVerticesData(B.VertexBuffer.ColorKind));
  for(let i=0;i<60;i++)layer.update(view(45),state);
  assert.deepEqual(Array.from(mesh.getVerticesData(B.VertexBuffer.PositionKind)),positions);assert.deepEqual(Array.from(mesh.getVerticesData(B.VertexBuffer.ColorKind)),colors);
  layer.update(view(49),state);assert.notDeepEqual(Array.from(mesh.getVerticesData(B.VertexBuffer.PositionKind)),positions);
  layer.update(JSON.parse(JSON.stringify(view(45))),state);assert.deepEqual(Array.from(mesh.getVerticesData(B.VertexBuffer.PositionKind)),positions);
  for(let i=0;i<25;i++){layer.update(null,state);assert.equal(mesh.isEnabled(),false);layer.update(view(45),state);assert.equal(layer.mesh,mesh);assert.equal(mesh.material,material);assert.equal(scene.meshes.length,1);assert.equal(scene.materials.length,1);}
  layer.update(view(65),state);assert.equal(mesh.isEnabled(),false);
  layer.dispose();layer.dispose();assert.equal(scene.meshes.length,0);assert.equal(scene.materials.length,0);assert.equal(scene.lights.length,0);assert.equal(scene.textures.length,0);
 }finally{layer.dispose();scene.dispose();engine.dispose();}
});

test('2D light flakes use the same saved time, never add lighting objects and vanish outside the blessing',()=>{
 const drawn=[],ctx={save(){},restore(){},beginPath(){this.path=[];},moveTo(x,y){this.path.push([x,y]);},lineTo(x,y){this.path.push([x,y]);},closePath(){},fill(){drawn.push([this.fillStyle,this.globalAlpha,this.path]);}},r={ctx,s:1,point:(x,y,z=0)=>({x:x*30-y*30,y:x*15+y*15-z}),lights:[]};
 drawFestivalBlessing(r,view(45));assert.ok(drawn.length>=48&&drawn.length<=FESTIVAL_BLESSING_COUNT);const first=structuredClone(drawn);drawn.length=0;drawFestivalBlessing(r,view(45));assert.deepEqual(drawn,first);assert.equal(r.lights.length,0);
 drawn.length=0;drawFestivalBlessing(r,view(46));assert.notDeepEqual(drawn,first);
 drawn.length=0;drawFestivalBlessing(r,view(65));assert.equal(drawn.length,0);
});

test('the real festival court activates the blessing and clears it immediately when the feast ends',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),meshes=[],court=createFestivalCourt(B,scene,meshes),state={buildings:[]};
 try{
  court.update(view(45),state);const snow=scene.getMeshByName('festival-blessing-light-snow');assert.ok(snow?.isEnabled());assert.equal(meshes.includes(snow),false,'self-luminous flakes must not enter the shadow caster list');
  court.update(null,state);assert.equal(snow.isEnabled(),false);assert.equal(meshes.length,0);
  court.update({...view(45),occasion:'firstBeer'},state);assert.equal(snow.isEnabled(),false);
  court.update(view(45),state);assert.equal(scene.getMeshByName('festival-blessing-light-snow'),snow);assert.ok(snow.isEnabled());
  court.dispose();assert.equal(scene.meshes.length,0);assert.equal(scene.lights.length,0);
 }finally{court.dispose();scene.dispose();engine.dispose();}
});
