import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MODEL_VERSIONS} from '../game3d/model-versions.js';
import {readGlb} from '../scripts/model-index.mjs';
import {createTestLivestock} from '../game3d/test-livestock.js';

const root=fileURLToPath(new URL('..',import.meta.url));
const animalsDir=join(root,'assets/art-courtyard/models');

test('each previous herd model and its new pasture sculpt remain individually available',async()=>{
 const atlas=JSON.parse(await readFile(join(root,'model-atlas/data/animals.json'),'utf8'));
 const models=new Set(atlas.rows.flatMap(row=>row.previews.map(p=>p.entry?.file)));
 for(const file of ['pasture-ram','pasture-bull','pasture-pig','alluvial-ram','alluvial-bull','alluvial-pig',
  'test-bull-trellis','test-pig-trellis','ambient-yard-pig','ambient-sheep-kenchoo','ambient-bull']){
  const name=file+'.glb';
  assert.ok(models.has(name),name+' must open separately in the atlas');
  assert.ok(MODEL_VERSIONS[name],name+' must have a versioned model URL');
 }
});

test('city requests a previous model only for the species whose primary GLB failed',async()=>{
 for(const missing of [null,'pasture-bull.glb']){
  const requests=[];
  const B={SceneLoader:{async LoadAssetContainerAsync(_url,filename){
   const file=filename.split('?')[0];requests.push(file);
   if(file===missing)return null;
   return {dispose(){}};
  }}};
  const view=createTestLivestock(B,{},[],()=>false,()=>false);
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(requests.filter(file=>file.startsWith('pasture-')).sort(),
   ['pasture-bull.glb','pasture-pig.glb','pasture-ram.glb']);
  assert.deepEqual(requests.filter(file=>file.startsWith('alluvial-')),missing?['alluvial-bull.glb']:[]);
  assert.deepEqual(requests.filter(file=>file.includes('goat')).sort(),['goat-downloaded.glb','test-goat-trellis.glb']);
  view.dispose();
 }
});

test('each active animal in the city has a skin, a walk, an idle and its source credit',async()=>{
 for(const kind of ['pig','bull','ram']){
  const g=readGlb(await readFile(join(animalsDir,'pasture-'+kind+'.glb')));
  assert.ok(g.skins[0].joints.length>=15);
  for(const key of ['source','license','author','adaptation'])assert.ok(g.asset.extras[key],kind+' '+key);
  for(const name of ['Walk','Idle'])assert.ok(g.animations.find(a=>a.name===name)?.channels.length>=8);
  for(const mesh of g.meshes)for(const prim of mesh.primitives){
   assert.equal(g.accessors[prim.attributes.POSITION].count,g.accessors[prim.attributes.JOINTS_0].count);
   assert.equal(g.accessors[prim.attributes.POSITION].count,g.accessors[prim.attributes.WEIGHTS_0].count);
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
