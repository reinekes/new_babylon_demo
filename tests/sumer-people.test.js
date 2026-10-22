import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
function glb(path){
 const bytes=fs.readFileSync(new URL(path,import.meta.url));assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(8),bytes.length);
 const len=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+len)),bin=bytes.subarray(28+len);
 const accessor=i=>{const a=g.accessors[i],v=g.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],size={5121:1,5123:2,5125:4,5126:4}[a.componentType],out=[];for(let r=0;r<a.count;r++)for(let c=0;c<n;c++){const p=(v.byteOffset??0)+(a.byteOffset??0)+r*(v.byteStride??n*size)+c*size;out.push(a.componentType===5126?bin.readFloatLE(p):size===4?bin.readUInt32LE(p):size===2?bin.readUInt16LE(p):bin[p]);}return out;};return {g,bytes,accessor};
}
const source=glb('../assets/art-courtyard/models/resident.glb'),model=glb('../assets/art-courtyard/models/sumer-people.glb'),{g,accessor}=model;
test('Sumerian civilian retains exact restricted source provenance and omits royal/military meshes',()=>{
 assert.equal(g.asset.extras.original.author,'Trident.AI (https://sketchfab.com/Trident.AI)');assert.equal(g.asset.extras.original.license,'SKETCHFAB Standard (https://sketchfab.com/licenses)');assert.match(g.asset.extras.original.source,/egyptian-people-b24eba1c3d56439a9dda74fc84065c37$/);assert.equal(g.asset.extras.source_sha256,'dc98fc77349e020099e9dfb263736f2cdcbc74b485db13e78b47d5aaccb726c3');assert.match(g.asset.extras.adaptation,/kilt replaced/);assert.equal(g.meshes.length,4);assert.ok(g.meshes.every(m=>!/Commander|Warrior|King/i.test(m.name)));assert.ok(model.bytes.length<3_000_000);
});
test('resident joint interface, inverse bind matrices and both authored clips are preserved exactly',()=>{
 assert.deepEqual(g.skins,source.g.skins);assert.equal(g.skins[0].joints.length,53);assert.deepEqual(accessor(g.skins[0].inverseBindMatrices),source.accessor(source.g.skins[0].inverseBindMatrices));
 for(const name of ['spine_01','head',...['upperarm','lowerarm','hand','thigh','calf','foot'].flatMap(n=>[`${n}_l`,`${n}_r`])])assert.ok(g.nodes.some(n=>n.name===name),name);
 assert.deepEqual(g.animations,source.g.animations);
 for(const clip of g.animations)for(const sampler of clip.samplers){assert.deepEqual(accessor(sampler.input),source.accessor(sampler.input));assert.deepEqual(accessor(sampler.output),source.accessor(sampler.output));}
});
test('all rendered geometry has bounded indices, finite normals and normalized nonnegative joint weights',()=>{
 let triangles=0;
 for(const mesh of g.meshes)for(const p of mesh.primitives){const a=p.attributes,pos=accessor(a.POSITION),norm=accessor(a.NORMAL),j=accessor(a.JOINTS_0),w=accessor(a.WEIGHTS_0),indices=accessor(p.indices);assert.ok(pos.every(Number.isFinite));assert.ok(norm.every(Number.isFinite));assert.equal(pos.length,norm.length);assert.ok(indices.every(i=>i>=0&&i<pos.length/3));assert.ok(j.every(i=>i>=0&&i<53));assert.ok(w.every(v=>Number.isFinite(v)&&v>=0&&v<=1));for(let i=0;i<w.length;i+=4)assert.ok(Math.abs(w[i]+w[i+1]+w[i+2]+w[i+3]-1)<1e-5);triangles+=indices.length/3;}
 assert.ok(triangles>10_000&&triangles<20_000);
});
const mul=(a,b)=>Array.from({length:16},(_,i)=>{const r=Math.floor(i/4),c=i%4;return [0,1,2,3].reduce((s,k)=>s+a[r*4+k]*b[k*4+c],0);});
const transpose=a=>Array.from({length:16},(_,i)=>a[(i%4)*4+Math.floor(i/4)]);
function posed(clip,phase){
 const pose=new Map();for(const ch of clip.channels){const s=clip.samplers[ch.sampler],times=accessor(s.input),v=accessor(s.output),width=g.accessors[s.output].type==='VEC4'?4:3,frame=Math.round((times.length-1)*phase);pose.set(`${ch.target.node}:${ch.target.path}`,v.slice(frame*width,frame*width+width));}
 const parent=new Map(g.nodes.flatMap((n,i)=>(n.children||[]).map(c=>[c,i]))),cache=new Map();
 function world(i){if(cache.has(i))return cache.get(i);const n=g.nodes[i],get=(k,d)=>pose.get(`${i}:${k}`)||n[k]||d,[x,y,z,w]=get('rotation',[0,0,0,1]),s=get('scale',[1,1,1]),t=get('translation',[0,0,0]);let m=[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w),t[0],2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),t[1],2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y),t[2],0,0,0,1];for(let r=0;r<3;r++)for(let c=0;c<3;c++)m[r*4+c]*=s[c];if(parent.has(i))m=mul(world(parent.get(i)),m);cache.set(i,m);return m;}
 const skin=g.skins[0],ib=accessor(skin.inverseBindMatrices),matrices=skin.joints.map((n,i)=>mul(world(n),transpose(ib.slice(i*16,i*16+16)))),out=[];
 for(const mesh of g.meshes)for(const prim of mesh.primitives){const a=prim.attributes,p=accessor(a.POSITION),j=accessor(a.JOINTS_0),w=accessor(a.WEIGHTS_0);for(let i=0;i<p.length/3;i++){const v=[...p.slice(i*3,i*3+3),1],q=[0,0,0];for(let c=0;c<4;c++){const m=matrices[j[i*4+c]];for(let r=0;r<3;r++)q[r]+=w[i*4+c]*v.reduce((sum,x,k)=>sum+m[r*4+k]*x,0);}out.push(q);}}
 return out;
}
test('CPU skinning of both clips deforms actual geometry without NaN, exploding vertices or detached source offsets',()=>{
 for(const clip of g.animations){const start=posed(clip,0);let moved=0;for(const phase of [.25,.5,.75,1]){const points=posed(clip,phase);for(let i=0;i<points.length;i++){const p=points[i];assert.ok(p.every(Number.isFinite));assert.ok(Math.abs(p[0])<1.3&&p[1]>-.3&&p[1]<2.1&&Math.abs(p[2])<1.3);if(Math.hypot(...p.map((x,k)=>x-start[i][k]))>(clip.name==='Idle_Loop'?.0005:.025))moved++;}}assert.ok(moved>50,`${clip.name} must deform skin`);}
});
