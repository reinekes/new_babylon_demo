import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const model=new URL('../assets/art-courtyard/models/goat-authored-lod.glb',import.meta.url);
function read(url=model){
  const b=readFileSync(url);assert.equal(b.toString('ascii',0,4),'glTF');
  assert.equal(b.readUInt32LE(8),b.length);
  const j=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));
  return {b,j,offset:28+b.readUInt32LE(12)};
}
function data(g,id){
  const a=g.j.accessors[id],v=g.j.bufferViews[a.bufferView];
  const types={5126:Float32Array,5123:Uint16Array,5125:Uint32Array};
  const size={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type];
  return new types[a.componentType](g.b.buffer,g.b.byteOffset+g.offset+(v.byteOffset||0)+(a.byteOffset||0),a.count*size);
}
test('city authored goat reduces geometry while preserving its rig, details and embedded coat',()=>{
  const g=read(),full=read(new URL('../assets/art-courtyard/models/goat-authored.glb',import.meta.url));
  const tris=g.j.meshes[0].primitives.reduce((n,p)=>n+data(g,p.indices).length/3,0);
  assert.ok(tris>=20000&&tris<=35000,`${tris} triangles`);
  assert.ok(g.b.length<full.b.length*.6);
  assert.deepEqual(g.j.nodes,full.j.nodes);
  assert.deepEqual(g.j.skins,full.j.skins);
  assert.deepEqual(g.j.materials,full.j.materials);
  const detail=g.j.meshes[0].primitives[1],original=full.j.meshes[0].primitives[1];
  assert.equal(data(g,detail.indices).length,data(full,original.indices).length,'retain full-resolution horn rings and facial details');
  for(const img of g.j.images){
    assert.equal(img.mimeType,'image/png');assert.equal(img.uri,undefined);
    const view=g.j.bufferViews[img.bufferView],originalView=full.j.bufferViews[full.j.images[0].bufferView];
    assert.deepEqual(g.b.subarray(g.offset+view.byteOffset,g.offset+view.byteOffset+view.byteLength),full.b.subarray(full.offset+originalView.byteOffset,full.offset+originalView.byteOffset+originalView.byteLength));
  }
});
test('city authored goat skin is one closed connected surface with finite normalized influences',()=>{
  const g=read(),p=g.j.meshes[0].primitives[0],pos=data(g,p.attributes.POSITION),w=data(g,p.attributes.WEIGHTS_0),j=data(g,p.attributes.JOINTS_0),idx=data(g,p.indices);
  assert.ok([...pos].every(Number.isFinite));
  assert.ok([...w].every(v=>Number.isFinite(v)&&v>=0&&v<=1));
  for(let i=0;i<w.length;i+=4){assert.ok(Math.abs(w[i]+w[i+1]+w[i+2]+w[i+3]-1)<1e-5);assert.ok(j.slice(i,i+4).every(k=>k<g.j.skins[0].joints.length));}
  const edges=new Map(),parent=new Map();
  function root(i){if(!parent.has(i))parent.set(i,i);let r=i;while(parent.get(r)!==r)r=parent.get(r);while(parent.get(i)!==i){const n=parent.get(i);parent.set(i,r);i=n;}return r;}
  for(let i=0;i<idx.length;i+=3){
    const a=root(idx[i]);for(let k=1;k<3;k++)parent.set(root(idx[i+k]),a);
    for(let e=0;e<3;e++){const a=idx[i+e],b=idx[i+(e+1)%3];assert.ok(a<pos.length/3&&b<pos.length/3);const key=a<b?`${a},${b}`:`${b},${a}`;edges.set(key,(edges.get(key)||0)+1);}
  }
  assert.ok([...edges.values()].every(n=>n===2),'every skin edge has exactly two neighbouring faces');
  assert.equal(new Set([...parent.keys()].map(root)).size,1,'single connected skin');
});
test('city authored goat retains all original finite animation samples and time bounds',()=>{
  const g=read(),full=read(new URL('../assets/art-courtyard/models/goat-authored.glb',import.meta.url));
  assert.deepEqual(g.j.animations.map(a=>a.name),['Idle','Walk','Graze','Rest']);
  for(const [i,clip] of g.j.animations.entries()){
    assert.deepEqual(clip.channels,full.j.animations[i].channels);
    for(const [k,s] of clip.samplers.entries()){
      const t=data(g,s.input),v=data(g,s.output),original=full.j.animations[i].samplers[k];
      assert.ok(t.at(-1)>0);assert.ok([...v].every(Number.isFinite));
      assert.deepEqual(t,data(full,original.input));assert.deepEqual(v,data(full,original.output));
      assert.deepEqual(g.j.accessors[s.input].min,[t[0]]);assert.ok(Math.abs(g.j.accessors[s.input].max[0]-t.at(-1))<1e-6);
    }
  }
});
