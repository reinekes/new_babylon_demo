import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGame} from '../engine.js';
import {river} from '../world.js';
import {createGameWater,WATER_HEIGHT} from '../game3d/water.js';
import {createWildlife} from '../game3d/wildlife.js';
const sandbox={module:{exports:{}},console,setTimeout,clearTimeout,performance,self:{}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.BABYLON;

test('water adds only transparent surface ribbons over the existing terrain, with no intersecting duplicate bed',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),s=createGame({start:'established'}),view=createGameWater(B,scene,{});
 try{
  const before=JSON.stringify(s);view.update(s,1);const ribbons=view.meshes.filter(m=>!m.sourceMesh&&m.getTotalVertices()>500);
  assert.equal(ribbons.length,2,'one river and one lake surface, with no duplicate opaque riverbed');
  for(const m of ribbons){assert.ok(m.material.needAlphaBlending());assert.equal(m.material.disableDepthWrite,true);const p=m.getVerticesData(B.VertexBuffer.PositionKind);for(let i=1;i<p.length;i+=3)assert.ok(Math.abs(p[i]-WATER_HEIGHT)<1e-6);}
  const count=scene.meshes.length;for(let i=0;i<20;i++)view.update(s,i/10);assert.equal(scene.meshes.length,count);assert.equal(JSON.stringify(s),before);
  view.dispose();assert.equal(scene.meshes.length,0);
 }finally{view.dispose();scene.dispose();engine.dispose();}
});

test('the whole swimming fish, including animated dorsal fins, stays below the water surface',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),s=createGame({start:'established'}),view=createWildlife(B,scene),fish=[{id:'submerged-fish',kind:'fish',x:river(8,s),y:8,waterLevel:WATER_HEIGHT,swimDepth:.22,behavior:'swimming'},{id:'legacy-fish',kind:'fish',x:river(9,s),y:9,waterLevel:.12,swimDepth:.2,behavior:'swimming'}];
 try{
  const before=JSON.stringify([s,fish]);for(let i=0;i<100;i++){view.update(s,fish,.05);for(const c of fish){const root=view.rootFor({animalId:c.id});root.computeWorldMatrix(true);for(const m of root.getChildMeshes()){m.computeWorldMatrix(true);assert.ok(m.getBoundingInfo().boundingBox.maximumWorld.y<WATER_HEIGHT-.01,`${m.name}: ${m.getBoundingInfo().boundingBox.maximumWorld.y}`);}}}
  assert.equal(JSON.stringify([s,fish]),before);
 }finally{view.dispose();scene.dispose();engine.dispose();}
});


test('switching saved river courses replaces water geometry even when lake cells are identical',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),s=createGame({start:'established'}),view=createGameWater(B,scene,{});
 try{
  view.update(s);const first=view.meshes.find(m=>m.name==='clear-living-river'),positions=first.getVerticesData(B.VertexBuffer.PositionKind).slice();
  s.world.river={offset:20,slope:-.1,frequency:.2,phase:0,amplitude:.6};view.update(s);
  const second=view.meshes.find(m=>m.name==='clear-living-river');assert.notEqual(first,second);assert.ok(first.isDisposed());assert.notDeepEqual(second.getVerticesData(B.VertexBuffer.PositionKind),positions);
  const current=second.getVerticesData(B.VertexBuffer.PositionKind);for(let i=12*3;i<current.length;i+=25*3){const x=current[i]/6,y=current[i+2]/6;assert.ok(Math.abs(x-river(y,s))<1e-5);}
 }finally{view.dispose();scene.dispose();engine.dispose();}
});
