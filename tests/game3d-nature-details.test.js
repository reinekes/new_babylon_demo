import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGame} from '../engine.js';
import {terrain} from '../world.js';
import {NATURE_BUDGETS,natureDetailPlan,natureGroundGeometry,resourceDisplayLayout,advanceWetness,createNatureDetails} from '../game3d/nature-details.js';
const sandbox={console,setTimeout,clearTimeout,performance,window:{addEventListener(){},removeEventListener(){}},navigator:{userAgent:'node'}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);const B=sandbox.BABYLON;
test('natural details are deterministic, bounded, clear of foundations and keep saved state intact',()=>{
 const s=createGame(),before=JSON.stringify(s),road={a:{x:1,y:2},b:{x:20,y:2}};
 for(const tier of Object.keys(NATURE_BUDGETS)){const plan=natureDetailPlan(s,[road],tier);assert.deepEqual(plan,natureDetailPlan(s,[road],tier));for(const [kind,list]of Object.entries(plan)){assert.ok(list.length<=NATURE_BUDGETS[tier][kind]);assert.ok(list.length>0,kind);for(const p of list){assert.notEqual(terrain(Math.round(p.x),Math.round(p.y),s),'water');assert.ok(!s.buildings.some(b=>Math.abs(b.x-p.x)<.6&&Math.abs(b.y-p.y)<.6));}}
 const geometry=natureGroundGeometry(s,plan);for(const g of Object.values(geometry)){assert.ok(g.positions.every(Number.isFinite));assert.equal(g.colors.length/4,g.positions.length/3);assert.ok(g.indices.every(i=>i>=0&&i<g.positions.length/3));const normals=[];B.VertexData.ComputeNormals(g.positions,g.indices,normals);assert.ok(normals.filter((_,i)=>i%3===1).every(n=>n>.8),'wet ground must receive sky light on its upward face');}}
 assert.equal(JSON.stringify(s),before);
});
test('curated resource clusters stay in their original deposit cell without moving ledger coordinates',()=>{
 for(const kind of ['stone','clay','reed','forest','dates']){const d={kind,x:8,y:7},before=JSON.stringify(d),p=resourceDisplayLayout(d);assert.ok(p.length);assert.deepEqual(p,resourceDisplayLayout(d));assert.ok(p.every(p=>Math.abs(p.x-d.x)<.4&&Math.abs(p.y-d.y)<.4));assert.equal(JSON.stringify(d),before);}
});
test('rain accumulates and puddles evaporate smoothly; pause or backward time cannot create water',()=>{
 let w=0;for(let i=0;i<10;i++)w=advanceWetness(w,true,.5);assert.ok(w>.5);const old=w;assert.equal(advanceWetness(w,true,0),old);assert.equal(advanceWetness(w,true,-10),old);for(let i=0;i<100;i++)w=advanceWetness(w,false,1);assert.equal(w,0);
});
test('nature rendering shares sources/materials, never rebuilds on animation, handles quality changes and disposes',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),s=createGame(),before=JSON.stringify(s),view=createNatureDetails(B,scene,{});view.update(s,0,{type:'rain'},[],'stable');assert.equal(view.materialCount,4);const count=scene.meshes.length,matCount=scene.materials.length,first=view.meshes.find(m=>m.name==='nature-ground-reeds-shards-dust');
 assert.ok(view.meshes.filter(m=>m.metadata?.natureDetail).every(m=>m.sourceMesh));
 for(let i=1;i<100;i++)view.update(s,i/10,{type:'rain'},[],'stable');assert.equal(scene.meshes.length,count);assert.equal(scene.materials.length,matCount);assert.equal(first.isDisposed(),false);assert.ok(view.wetness>.9);assert.ok(view.meshes.find(m=>m.name==='nature-rain-puddles').material.alpha>.5);
 for(let i=10;i<60;i++)view.update(s,i,{type:'sunny'},[],'stable');assert.equal(view.wetness,0);assert.equal(view.meshes.find(m=>m.name==='nature-rain-puddles').isEnabled(),false);
 view.setQuality('low');view.update(s,60,{type:'wind'},[],'stable');assert.equal(first.isDisposed(),true);assert.equal(view.plan.snakes.length,1);assert.equal(scene.materials.length,matCount);assert.equal(JSON.stringify(s),before);
 view.dispose();assert.equal(scene.meshes.length,0);assert.equal(scene.materials.length,matCount-4);assert.equal(view.meshes.length,0);view.dispose();scene.dispose();engine.dispose();
});
