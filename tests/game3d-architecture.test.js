import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createArchitecture,ARCHITECTURE_TYPES} from '../game3d/architecture.js';
import {BUILDINGS} from '../definitions.js';
const sandbox={console,setTimeout,clearTimeout,performance,self:{}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.BABYLON;
function setup(){const engine=new B.NullEngine(),scene=new B.Scene(engine),m=Object.fromEntries(['warm','raw','fired','shade','trim','plaster','brick','wood','linen','reed','terracotta','soil','grass','stone'].map(k=>[k,new B.PBRMaterial(k,scene)]));return{scene,m,dispose(){scene.dispose();engine.dispose();}};}
function extent(meshes){const out={x0:Infinity,x1:-Infinity,z0:Infinity,z1:-Infinity,h:0};for(const mesh of meshes){mesh.computeWorldMatrix(true);const b=mesh.getBoundingInfo().boundingBox;out.x0=Math.min(out.x0,b.minimumWorld.x);out.x1=Math.max(out.x1,b.maximumWorld.x);out.z0=Math.min(out.z0,b.minimumWorld.z);out.z1=Math.max(out.z1,b.maximumWorld.z);out.h=Math.max(out.h,b.maximumWorld.y);}return out;}
test('every nonlandscape special building has its own bounded geometry, shared materials and no fallback workshop',()=>{
 const t=setup();try{const signatures=new Set();assert.deepEqual([...ARCHITECTURE_TYPES].sort(),Object.keys(BUILDINGS).filter(k=>!['house','field','bridge','canal'].includes(k)).sort());
 for(const type of ARCHITECTURE_TYPES){const b={type,x:2,y:4,level:1},before=structuredClone(b),meshes=createArchitecture(B,t.scene,b,t.m);assert.deepEqual(b,before);assert.ok(meshes.length<=10,`${type}: ${meshes.length} material draws`);const bb=extent(meshes);assert.ok(bb.x0>=-2.9&&bb.x1<=2.9&&bb.z0>=-2.9&&bb.z1<=2.9,`${type}: ${JSON.stringify(bb)}`);const hash=createHash('sha256');for(const mesh of meshes){hash.update(JSON.stringify(Array.from(mesh.getVerticesData(B.VertexBuffer.PositionKind))));assert.ok(mesh.getVerticesData(B.VertexBuffer.NormalKind).every(Number.isFinite));}const signature=hash.digest('hex');assert.ok(!signatures.has(signature),`${type} duplicates another silhouette`);signatures.add(signature);for(const mesh of meshes)mesh.dispose();}
 }finally{t.dispose();}
});
test('new ziggurat occupies exactly its four reserved tiles and rises above the old monument without rewriting it',()=>{
 const t=setup();try{const legacy=createArchitecture(B,t.scene,{type:'ziggurat',level:1},t.m),newSite={type:'ziggurat',level:1,footprint:2},before=structuredClone(newSite),large=createArchitecture(B,t.scene,newSite,t.m),a=extent(legacy),b=extent(large);assert.deepEqual(newSite,before);assert.ok(a.x0>=-2.9&&a.x1<=2.9);assert.ok(b.x0>=-2.7&&b.x1<=8.7&&b.z0>=-2.7&&b.z1<=8.7,JSON.stringify(b));assert.ok(b.h>=10&&b.h>a.h*2);assert.ok(b.x1-b.x0>10);assert.ok(Math.abs((b.x0+b.x1)/2-3)<.1);}finally{t.dispose();}
});
test('handmade bevelled walls have outward side normals and upward roof normals',()=>{
 const t=setup();try{const meshes=createArchitecture(B,t.scene,{type:'depot',level:1},t.m);const mesh=meshes.find(m=>m.material===t.m.plaster),p=mesh.getVerticesData(B.VertexBuffer.PositionKind),n=mesh.getVerticesData(B.VertexBuffer.NormalKind);
 // First block is the back wall of the first room. Its centre is(-1.55,1.225,-2.4).
 let top=0,side=0;for(let i=0;i<192;i+=3){if(Math.abs(p[i+1]-2.45)<.002&&n[i+1]>.4)top++;if(p[i+2]<-2.4&&n[i+2]<-.1)side++;}assert.ok(top>0,'roof normal faces daylight');assert.ok(side>0,'back wall faces outwards');}finally{t.dispose();}
});

test('masonry face UVs preserve nonzero area on sides, bevels and caps',()=>{
 const t=setup();try{
  for(const type of ['ziggurat','shrine','granary','depot','kiln']){
   const meshes=createArchitecture(B,t.scene,{type,level:3,footprint:type==='ziggurat'?2:1},t.m);
   for(const mesh of meshes.filter(m=>[t.m.raw,t.m.fired,t.m.plaster].includes(m.material))){
    const p=mesh.getVerticesData(B.VertexBuffer.PositionKind),uv=mesh.getVerticesData(B.VertexBuffer.UVKind),ix=mesh.getIndices();
    for(let i=0;i<ix.length;i+=3){const [a,b,c]=Array.from(ix.slice(i,i+3)),ab=[0,1,2].map(k=>p[b*3+k]-p[a*3+k]),ac=[0,1,2].map(k=>p[c*3+k]-p[a*3+k]),area3=Math.hypot(ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]);if(area3<1e-8)continue;
     const areaUV=Math.abs((uv[b*2]-uv[a*2])*(uv[c*2+1]-uv[a*2+1])-(uv[b*2+1]-uv[a*2+1])*(uv[c*2]-uv[a*2]));assert.ok(areaUV>1e-10,`${type} masonry triangle ${i/3} has collapsed UVs`);
    }
   }
  }
 }finally{t.dispose();}
});

test('grand ziggurat has supported ascending front and lateral flights joining successive terraces',()=>{
 const t=setup();try{
  const meshes=createArchitecture(B,t.scene,{type:'ziggurat',level:1,footprint:2},t.m);
  const height=(x,z)=>{const ray=new B.Ray(new B.Vector3(x,20,z),new B.Vector3(0,-1,0),30),hits=meshes.map(m=>m.intersects(ray,false)).filter(h=>h.hit);assert.ok(hits.length,`solid stair missing at ${x},${z}`);return Math.max(...hits.map(h=>h.pickedPoint.y));};
  const heights=[height(3,8.2),height(3,7.4),height(3,6.65),height(3,5.94),height(3,4.8),height(3,3.2)];for(let i=1;i<heights.length;i++)assert.ok(heights[i]>heights[i-1],JSON.stringify(heights));assert.ok(Math.abs(heights[3]-3.25)<.05);assert.ok(heights.at(-1)>6);
  assert.ok(height(-1.8,6.02)<height(.5,6.02));assert.ok(height(7.8,6.02)<height(5.5,6.02));
 }finally{t.dispose();}
});
