import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
function glb(name){
 const bytes=readFileSync(new URL(`../assets/art-courtyard/models/${name}.glb`,import.meta.url));
 assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
 const n=bytes.readUInt32LE(12);return JSON.parse(bytes.subarray(20,20+n).toString());
}
function triangles(g){return g.meshes.reduce((sum,m)=>sum+m.primitives.reduce((n,p)=>n+(g.accessors[p.indices]?.count||0)/3,0),0);}
test('courtyard uses self-contained actual skinned models and named clips with bounded geometry',()=>{
 const hero=glb('resident'),lod=glb('resident-lod'),sheep=glb('sheep');
 for(const g of [hero,lod,sheep]){
  assert.ok(g.skins?.some(s=>s.joints.length>=20),'actual shared skin required');
  assert.ok(g.meshes.some(m=>m.primitives.some(p=>p.attributes.JOINTS_0!==undefined&&p.attributes.WEIGHTS_0!==undefined)));
  assert.ok(g.animations.length>=2);assert.equal((g.extensionsRequired||[]).length,0);
 }
 assert.ok(hero.animations.some(a=>a.name==='Walk_Loop'));assert.ok(hero.animations.some(a=>a.name==='Idle_Loop'));
 assert.ok(sheep.animations.some(a=>a.name==='Walk'));assert.ok(sheep.animations.some(a=>a.name==='Graze'));
 assert.ok(triangles(hero)>5000&&triangles(hero)<30000);assert.ok(triangles(lod)<8000);assert.ok(triangles(sheep)<8000);
 for(const name of ['resident','resident-lod','sheep','date-palm','adobe-courtyard']){
  const g=glb(name);for(const b of g.buffers||[])assert.equal(b.uri,undefined,'no remote geometry');
  for(const image of g.images||[])assert.ok(image.bufferView!==undefined,'images embedded, no remote or missing texture');
  for(const a of g.accessors||[])for(const v of [...(a.min||[]),...(a.max||[])])assert.ok(Number.isFinite(v));
 }
});
test('art courtyard never reads or writes a game save and keeps a clear trial label',()=>{
 const html=readFileSync(new URL('../courtyard.html',import.meta.url),'utf8'),js=readFileSync(new URL('../courtyard/app.js',import.meta.url),'utf8');
 assert.match(html,/Художественная проба/);assert.doesNotMatch(js,/localStorage|sessionStorage|indexedDB/);
 assert.match(html,/babylonjs-loaders-9\.31\.0/);assert.match(js,/instantiateModelsToScene/);
});

test('published asset manifest matches every licensed file and crowd remains one skinned draw',()=>{
 const root=new URL('../assets/art-courtyard/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('manifest.json',root)));
 for(const row of manifest.files){const bytes=readFileSync(new URL(row.file,root));assert.equal(bytes.length,row.bytes,row.file);assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256,row.file);}
 const lod=glb('resident-lod');assert.equal(lod.meshes.length,1);assert.equal(lod.meshes[0].primitives.length,1);assert.ok(lod.meshes[0].primitives[0].attributes.COLOR_0!==undefined);
});
