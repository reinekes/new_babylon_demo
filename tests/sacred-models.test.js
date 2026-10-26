import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {createSacredModels,sacredModelKey,SACRED_MODELS} from '../game3d/sacred-models.js';
import {createGameBuildings} from '../game3d/buildings.js';

const sandbox={module:{exports:{}},console,setTimeout,clearTimeout,performance,self:{}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.BABYLON;
const bytes=file=>readFileSync(new URL('../assets/art-courtyard/models/'+file,import.meta.url));
const gltf=file=>{const b=bytes(file),n=b.readUInt32LE(12);return {g:JSON.parse(b.subarray(20,20+n)),bin:b.subarray(28+n)};};
function geometry(scene,file){
 const {g,bin}=gltf(file),container=new B.AssetContainer(scene),root=new B.TransformNode('gltf-reflection',scene);root.scaling.z=-1;container.transformNodes.push(root);
 const mats=g.materials.map(m=>new B.PBRMaterial(m.name,scene));container.materials.push(...mats);
 function data(i){const a=g.accessors[i],v=g.bufferViews[a.bufferView],w={SCALAR:1,VEC2:2,VEC3:3}[a.type],size=a.componentType===5123?2:4,out=[];for(let k=0;k<a.count*w;k++){const p=(v.byteOffset||0)+(a.byteOffset||0)+k*size;out.push(a.componentType===5126?bin.readFloatLE(p):a.componentType===5123?bin.readUInt16LE(p):bin.readUInt32LE(p));}return out;}
 for(const node of g.nodes){if(node.mesh===undefined)continue;for(const p of g.meshes[node.mesh].primitives){const mesh=new B.Mesh(node.name,scene),v=new B.VertexData();v.positions=data(p.attributes.POSITION);v.normals=data(p.attributes.NORMAL);v.uvs=data(p.attributes.TEXCOORD_0);v.indices=data(p.indices);v.applyToMesh(mesh);mesh.parent=root;mesh.material=mats[p.material];container.meshes.push(mesh);}}
 container.removeAllFromScene();return container;
}
test('only requested completed sacred tiers use downloads; saved one-cell ziggurats and upgrade base tiers are preserved',()=>{
 assert.equal(sacredModelKey({type:'shrine',level:3}),'shrine3');
 assert.equal(sacredModelKey({type:'shrine',level:2,construction:{kind:'upgrade',target:3}}),null);
 assert.equal(sacredModelKey({type:'shrine',level:3,construction:{kind:'new'}}),null);
 assert.equal(sacredModelKey({type:'ishtarGate',level:1}),'ishtarGate');
 assert.equal(sacredModelKey({type:'ziggurat',level:1,footprint:2}),'ziggurat1');
 assert.equal(sacredModelKey({type:'ziggurat',level:3,footprint:2}),'ziggurat3');
 assert.equal(sacredModelKey({type:'ziggurat',level:2,footprint:2}),null);
 assert.equal(sacredModelKey({type:'ziggurat',level:3}),null);
});
test('four actual compact assets preserve provenance, limits, native UVs and baked metre bounds',()=>{
 const report=JSON.parse(readFileSync(new URL('../assets/art-courtyard/sacred-models-report.json',import.meta.url)));
 for(const {file,width} of Object.values(SACRED_MODELS)){
  const row=report.find(r=>r.output===file),{g,bin}=gltf(file),raw=bytes(file),meta=g.asset.extras;
  assert.equal(createHash('sha256').update(raw).digest('hex'),row.sha256);assert.ok(raw.length<row.source_bytes);
  assert.match(meta.license,/CC-BY-4.0/);assert.match(meta.source,/sketchfab.com\/3d-models\//);assert.ok(meta.author);
  assert.equal(g.meshes.length,row.meshes);assert.ok(g.meshes.length<=4);assert.equal(g.skins,undefined);assert.equal(g.animations,undefined);
  let triangles=0,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const mesh of g.meshes)for(const p of mesh.primitives){triangles+=g.accessors[p.indices].count/3;const a=g.accessors[p.attributes.POSITION];for(let j=0;j<3;j++){min[j]=Math.min(min[j],a.min[j]);max[j]=Math.max(max[j],a.max[j]);}assert.ok(p.attributes.NORMAL!==undefined&&p.attributes.TEXCOORD_0!==undefined);}
  assert.equal(triangles,row.triangles);assert.ok(triangles<=52000);assert.ok(max[0]-min[0]<=width+.025);assert.ok(max[2]-min[2]<=width+.025);assert.ok(min[1]>=-.025);assert.ok(max[1]>3);
  for(const im of g.images){const v=g.bufferViews[im.bufferView];assert.ok(v.byteOffset+v.byteLength<=bin.length);assert.ok(['image/jpeg','image/png'].includes(im.mimeType));}
 }
 const etem=report.find(r=>r.output==='sacred-ziggurat-3.glb');assert.equal(etem.omitted_nodes.length,12);assert.ok(etem.max_vertex_displacement_metres<.021);assert.ok(etem.triangles<.4*134248);
});
test('loader is on demand, shares each asset, reports offline once and releases late assets after disposal',async()=>{
 const scene={},loads=[],errors=[];let finish,disposed=0;
 const fake={SceneLoader:{LoadAssetContainerAsync(_root,file){loads.push(file);return new Promise(r=>finish=r);}}};
 const s=createSacredModels(fake,scene,{onError:e=>errors.push(e.message)});assert.equal(loads.length,0);assert.equal(s.request({type:'shrine',level:1}),null);const b={type:'ishtarGate'};
 const p=s.request(b);assert.equal(s.request(b),p);await Promise.resolve();assert.equal(loads.length,1);s.dispose();finish({dispose(){disposed++;}});await p;assert.equal(disposed,1);assert.equal(s.ready(b),false);
 const fail=createSacredModels({SceneLoader:{LoadAssetContainerAsync(){throw Error('offline');}}},{},{onError:e=>errors.push(e.message)});await fail.request(b);await fail.request(b);assert.deepEqual(errors,['offline']);fail.dispose();
});
test('real building adapter starts with procedural construction, swaps only after GLB readiness, stays read only and retains stable instances',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),previous=B.SceneLoader.LoadAssetContainerAsync,loads=[];
 B.SceneLoader.LoadAssetContainerAsync=async(_root,file)=>{loads.push(file);return geometry(scene,file.split('?')[0]);};
 const m=Object.fromEntries(['plaster','brick','wood','linen','reed','terracotta','soil','grass','stone'].map(k=>[k,new B.PBRMaterial(k,scene)]));
 const layer=await createGameBuildings(B,scene,m,{deferAssets:true});
 try{
  assert.equal(loads.length,0);const b={id:'temple',type:'shrine',level:3,x:3,y:4},state={buildings:[b],citizens:[]},before=structuredClone(state);
  layer.preview({...b,type:'ziggurat',footprint:2},state);assert.equal(loads.length,0,'hover never requests a sacred asset');layer.clearPreview();
  layer.sync(state);const procedural=layer.meshes[0];assert.ok(!layer.meshes.some(m=>m.name.includes('sacred-shrine-3')));await layer.sacredReady();layer.sync(state);
  assert.equal(loads.length,1);assert.ok(procedural.isDisposed());const imported=layer.meshes.filter(m=>m.name.includes('sacred-shrine-3'));assert.equal(imported.length,4);assert.ok(layer.meshes.every(m=>m.isPickable&&m.metadata.buildingKey==='temple'));assert.deepEqual(state,before);
  const first=imported[0],source=first.sourceMesh,count=scene.meshes.length;for(let i=0;i<12;i++)layer.sync(state);assert.equal(scene.meshes.length,count);assert.equal(layer.meshes.find(m=>m.name.includes('sacred-shrine-3')),first);
  b.rotation=1;layer.sync(state);assert.equal(first.sourceMesh,source);first.computeWorldMatrix(true);assert.ok(first.getBoundingInfo().boundingBox.minimumWorld.y>=.03);
  layer.sync({buildings:[],citizens:[]});assert.ok(first.isDisposed());assert.equal(layer.meshes.length,0);
 }finally{layer.dispose();B.SceneLoader.LoadAssetContainerAsync=previous;scene.dispose();engine.dispose();}
});
