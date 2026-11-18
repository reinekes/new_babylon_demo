import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MODEL_VERSIONS} from '../game3d/model-versions.js';
import {readGlb} from '../scripts/model-index.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const animalsDir=join(root,'assets/art-courtyard/models');

test('each courtyard herd keeps its former models alongside its new anatomical sculpt',async()=>{
 const atlas=JSON.parse(await readFile(join(root,'model-atlas/data/animals.json'),'utf8'));
 const models=new Set(atlas.rows.flatMap(row=>row.previews.map(p=>p.entry?.file)));
 const controller=await readFile(join(root,'game3d/test-livestock.js'),'utf8');
 for(const [kind,files] of Object.entries({
  pig:['alluvial-pig.glb','test-pig-trellis.glb','ambient-yard-pig.glb'],
  bull:['alluvial-bull.glb','test-bull-trellis.glb','ambient-bull.glb'],
  sheep:['alluvial-ram.glb','ambient-sheep-kenchoo.glb'],
 })){
  const configs=controller.split('\n').find(line=>line.trim().startsWith(kind+':'));
  for(const file of files){
   assert.ok(configs?.includes(file),file+' must participate in its live herd');
   assert.ok(models.has(file),file+' must open separately in the atlas');
   assert.ok(MODEL_VERSIONS[file],file+' must load through the versioned city loader');
  }
 }
});

test('sculpts carry aligned normalized skin data, colour and normal maps, and native motion',async()=>{
 for(const species of ['bull','pig','ram']){
  const glb=readGlb(await readFile(join(animalsDir,'alluvial-'+species+'.glb')));
  const mesh=glb.meshes[0].primitives[0],a=glb.accessors,mat=glb.materials[mesh.material];
  assert.equal(glb.meshes.length,1);
  assert.equal(glb.meshes[0].primitives.length,1);
  assert.ok(a[mesh.indices].count/3<45000);
  assert.equal(a[mesh.attributes.COLOR_0].type,'VEC4');
  assert.ok(a[mesh.attributes.WEIGHTS_0].normalized);
  assert.equal(a[mesh.attributes.JOINTS_0].count,a[mesh.attributes.POSITION].count);
  const surfaces=mat.pbrMetallicRoughness;
  assert.equal(new Set([mat.normalTexture.index,surfaces.baseColorTexture.index,surfaces.metallicRoughnessTexture.index]).size,3);
  assert.equal(mat.occlusionTexture.index,surfaces.metallicRoughnessTexture.index);
  assert.equal(glb.images.length,3);
  if(species!=='ram'){
   assert.equal(glb.asset.extras.coat_reference.file,'test-'+species+'-trellis.glb');
   for(const key of ['source','license','author'])assert.ok(glb.asset.extras.coat_reference[key]);
  }
  assert.ok(glb.images.every(i=>i.bufferView!==undefined));
  const joints=new Set(glb.skins[0].joints);
  for(const clip of glb.animations){
   assert.ok(clip.channels.every(c=>joints.has(c.target.node)));
   const names=new Set(clip.channels.map(c=>glb.nodes[c.target.node].name));
   for(const name of ['neck','poll','tail','ear--1','ear-1'])assert.ok(names.has(name));
   if(clip.name==='Walk'){
    for(const name of ['fore-l-lower','hind-l-lower','fore-r-lower','hind-r-lower'])assert.ok(names.has(name));
   }
  }
  assert.deepEqual(glb.animations.map(c=>c.name),['Walk','Idle']);
 }
});
