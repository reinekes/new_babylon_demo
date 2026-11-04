import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildIndex,readGlb,reconcile,renderMarkdown,scanReferences} from '../scripts/model-index.mjs';

test('generated model index matches real assets and current reachability',async()=>{
 const index=await buildIndex();
 assert.deepEqual(index.errors,[]);
 assert.deepEqual(JSON.parse(await readFile(new URL('../docs/model-index.json',import.meta.url),'utf8')),index);
 assert.equal(await readFile(new URL('../docs/MODEL_INDEX.md',import.meta.url),'utf8'),renderMarkdown(index));
 const models=new Map(index.models.map(m=>[m.file,m]));
 // These were misrepresented by old inventory snapshots; protect the distinction.
 assert.equal(models.get('source-walk-male.glb').status,'active');
 assert.equal(models.get('human-native-male.glb').status,'fallback');
 assert.equal(models.get('resident.glb').status,'fallback');
 assert.equal(models.get('adobe-courtyard.glb').status,'optional');
 assert.equal(models.get('sky-bird-single.glb').status,'optional');
 assert.equal(models.get('imported-goose.glb').status,'spare');
 assert.equal(models.get('imported-sky-birds.glb').status,'spare');
 assert.ok(models.get('festival-candle.glb').sources.some(s=>s.author.includes('al0sral0')));
 assert.ok(models.get('historical-man.glb').sources.some(s=>s.author.includes('Iko Nia')));
 assert.ok(models.get('goat-authored.glb').sources[0].license.includes('not recorded'));
 assert.ok(models.get('source-walk-child.glb').references.some(r=>r.kind==='reviewed-dynamic-expansion'));
});

function matching(){return {disk:['known.glb'],manifest:[{file:'known.glb'}],versions:{'known.glb':'abc'},refs:[{model:'known.glb'}],classified:['known.glb']};}

test('new literal loader paths are checked against all three inventories',()=>{
 const input=matching();
 input.refs=scanReferences({'game3d/new-detail.js':"loadModel(B, scene, '', 'assets/art-courtyard/models/new-detail.glb?v=1');"});
 const errors=reconcile(input);
 for(const problem of ['missing on disk','missing manifest row','missing model-versions row','missing reviewed classification'])assert.ok(errors.includes('new-detail.glb: '+problem));
 assert.equal(input.refs[0].line,1);
});

test('missing manifest or disk rows and duplicate classifications are errors',()=>{
 const absentManifest=matching();absentManifest.manifest=[];
 assert.deepEqual(reconcile(absentManifest),['known.glb: missing manifest row']);
 const absentDisk=matching();absentDisk.disk=[];
 assert.deepEqual(reconcile(absentDisk),['known.glb: missing on disk']);
 const duplicate=matching();duplicate.classified.push('known.glb');
 assert.ok(reconcile(duplicate).includes('Duplicate classification model'));
});

test('courtyard names expand independently of literal .glb strings',()=>{
 const refs=scanReferences({'courtyard/app.js':"model('resident');\nstress?model('resident-lod'):null"});
 assert.deepEqual(refs.map(r=>[r.model,r.line]),[['resident-lod.glb',2],['resident.glb',1]]);
});

test('actor expansion fails closed if the reviewed dynamic loader changes',()=>{
 assert.throws(()=>scanReferences({'game3d/actors.js':"human('unreviewed-'+variant)"}),/Actor model expansion changed/);
});

test('new dynamic resident variant cannot be omitted from reconciliation',async()=>{
 const actor=await readFile(new URL('../game3d/actors.js',import.meta.url),'utf8');
 const refs=scanReferences({'game3d/actors.js':actor+"\nsourceHuman('elder'); ageSource('infant');"});
 for(const name of ['source-walk-elder','human-native-elder','source-walk-infant','human-native-infant','sumer-infant']){
  assert.ok(refs.some(r=>r.model===name+'.glb'),name);
  assert.ok(reconcile({...matching(),refs}).includes(name+'.glb: missing manifest row'));
 }
});

test('GLB reader accepts valid JSON chunk and rejects malformed/truncated input',()=>{
 const json=Buffer.from('{"asset":{"version":"2.0"}}  ');
 const bytes=Buffer.alloc(20+json.length);
 bytes.write('glTF');bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(bytes.length,8);bytes.writeUInt32LE(json.length,12);bytes.writeUInt32LE(0x4e4f534a,16);json.copy(bytes,20);
 assert.deepEqual(readGlb(bytes),{asset:{version:'2.0'}});
 assert.throws(()=>readGlb(bytes.subarray(0,19)),/Invalid GLB header/);
 const badChunk=Buffer.from(bytes);badChunk.writeUInt32LE(0,16);
 assert.throws(()=>readGlb(badChunk),/Missing GLB JSON chunk/);
});
