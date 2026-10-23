import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
function glb(path) {
 const bytes=fs.readFileSync(new URL(path,import.meta.url));
 assert.equal(bytes.readUInt32LE(0),0x46546c67);
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 const len=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+len)),bin=bytes.subarray(28+len);
 const view=i=>{const v=g.bufferViews[i];return bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength);};
 const accessor=i=>{const a=g.accessors[i],v=g.bufferViews[a.bufferView];const n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],size={5121:1,5123:2,5125:4,5126:4}[a.componentType],out=[];for(let r=0;r<a.count;r++)for(let c=0;c<n;c++){const p=(v.byteOffset??0)+(a.byteOffset??0)+r*(v.byteStride??n*size)+c*size;out.push(a.componentType===5126?bin.readFloatLE(p):size===4?bin.readUInt32LE(p):size===2?bin.readUInt16LE(p):bin[p]);}return out;};
 return {g,bytes,view,accessor};
}
const original=glb('../assets/art-courtyard/models/goat.glb');
const adapted=glb('../assets/art-courtyard/models/goat-downloaded.glb');
test('downloaded goat retains original geometry, UVs, skin weights and bind matrices',()=>{
 assert.deepEqual(adapted.g.meshes,original.g.meshes);
 assert.deepEqual(adapted.g.skins,original.g.skins);
 for(const m of original.g.meshes)for(const p of m.primitives)for(const i of [p.indices,...Object.values(p.attributes)])assert.deepEqual(adapted.accessor(i),original.accessor(i));
 for(const s of original.g.skins)assert.deepEqual(adapted.accessor(s.inverseBindMatrices),original.accessor(s.inverseBindMatrices));
 assert.equal(adapted.g.asset.extras.author,original.g.asset.extras.author);
});
test('source animation survives exactly and new motions state their provenance',()=>{
 for(const name of ['Idle','SourceRigAction']){const a=adapted.g.animations.find(a=>a.name===name),source=original.g.animations[0];assert.deepEqual(a.channels,source.channels);assert.deepEqual(a.samplers,source.samplers);for(const s of source.samplers){assert.deepEqual(adapted.accessor(s.input),original.accessor(s.input));assert.deepEqual(adapted.accessor(s.output),original.accessor(s.output));}}
 for(const name of ['Walk','Graze','Rest']){const a=adapted.g.animations.find(a=>a.name===name);assert.match(a.extras.provenance,/New Babylon/);assert.equal(a.channels.length,93);for(const s of a.samplers){const times=adapted.accessor(s.input),values=adapted.accessor(s.output),width=adapted.g.accessors[s.output].type==='VEC4'?4:3;assert.equal(values.length,times.length*width);assert.ok(values.every(Number.isFinite));assert.ok(times.every((t,i)=>i===0||t>times[i-1]));for(let c=0;c<width;c++)assert.ok(Math.abs(values[c]-values[values.length-width+c])<1e-6,'cyclic endpoints must match');if(width===4)for(let i=0;i<values.length;i+=4)assert.ok(Math.abs(Math.hypot(...values.slice(i,i+4))-1)<1e-5);}}
});
function imageDimensions(bytes,mime){
 if(mime==='image/png'){assert.equal(bytes.subarray(1,4).toString(),'PNG');return [bytes.readUInt32BE(16),bytes.readUInt32BE(20)];}
 assert.equal(mime,'image/jpeg');assert.equal(bytes.readUInt16BE(0),0xffd8);
 for(let offset=2;offset<bytes.length;){assert.equal(bytes[offset++],0xff);while(bytes[offset]===0xff)offset++;const marker=bytes[offset++];assert.notEqual(marker,0xda,'JPEG frame dimensions must precede image data');const size=bytes.readUInt16BE(offset);if(marker>=0xc0&&marker<=0xcf&&![0xc4,0xc8,0xcc].includes(marker))return [bytes.readUInt16BE(offset+5),bytes.readUInt16BE(offset+3)];assert.ok(size>=2);offset+=size;}
 assert.fail('JPEG frame dimensions missing');
}
test('adaptation embeds <=1k PNG/JPEG textures while alpha and normal maps remain PNG',()=>{
 assert.ok(adapted.bytes.length<original.bytes.length*.5);
 for(const im of adapted.g.images){const dimensions=imageDimensions(adapted.view(im.bufferView),im.mimeType);assert.ok(dimensions.every(value=>value>0&&value<=1024));}
 for(const material of adapted.g.materials){
  const normal=material.normalTexture,alpha=material.alphaMode&&material.alphaMode!=='OPAQUE'&&material.pbrMetallicRoughness?.baseColorTexture;
  for(const texture of [normal,alpha].filter(Boolean)){const image=adapted.g.images[adapted.g.textures[texture.index].source];assert.equal(image.mimeType,'image/png');}
  if(alpha){const image=adapted.g.images[adapted.g.textures[alpha.index].source],bytes=adapted.view(image.bufferView);assert.ok([4,6].includes(bytes[25]),'transparent hair keeps an alpha channel');}
 }
 const root=adapted.g.nodes.at(-1);assert.equal(root.extras.forward_gltf,'+Z');assert.deepEqual(adapted.g.scenes[0].nodes,[adapted.g.nodes.length-1]);assert.ok(root.scale.every(s=>s>0&&s<1));
});
