import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
import {residentAnatomy} from '../game3d/resident-anatomy.js';
const sandbox={exports:{},module:{exports:{}},console,setTimeout,clearTimeout,performance,window:{addEventListener(){},removeEventListener(){}},navigator:{userAgent:'node'},TextDecoder,TextEncoder,URL,Blob};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);const B=sandbox.exports.NullEngine?sandbox.exports:sandbox.module.exports;sandbox.BABYLON=B;sandbox.exports=undefined;sandbox.module=undefined;vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylonjs-loaders-9.31.0.min.js',import.meta.url),'utf8'),sandbox);
const bytes=name=>new Uint8Array(readFileSync(new URL(`../assets/art-courtyard/models/sumer-${name}.glb`,import.meta.url)));
const json=data=>JSON.parse(Buffer.from(data).subarray(20,20+Buffer.from(data).readUInt32LE(12)));
test('child and adolescent have distinct actual rest limbs and clean child surfaces',()=>{
 const adult=json(bytes('people')),child=json(bytes('child')),teen=json(bytes('adolescent'));
 for(const name of ['calf_l','hand_l','spine_01']){const translation=g=>g.nodes.find(n=>n.name===name).translation;assert.notDeepEqual(translation(child),translation(adult),name);assert.notDeepEqual(translation(teen),translation(adult),name);}
 for(const g of [child,teen]){assert.ok(g.asset.extras.child_anatomy);assert.ok(!g.nodes.some(n=>n.mesh!==undefined&&/beard/i.test(n.name)));assert.ok(g.meshes.some(m=>m.name==='Simple child wool wrap'));}
});
test('stature is continuous at puberty and the adult boundary, identity-independent',()=>{
 assert.equal(residentAnatomy(4).source,'child');assert.equal(residentAnatomy(13).source,'adolescent');assert.equal(residentAnatomy(30).source,'adult');
 for(const age of [10,16])assert.ok(Math.abs(residentAnatomy(age-.001).scale-residentAnatomy(age+.001).scale)<.001);
});
test('real Babylon glTF loader skins independent child/adolescent meshes in both clips',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine);scene.activeCamera=new B.FreeCamera('c',new B.Vector3(0,1,-4),scene);
 try{for(const name of ['child','adolescent']){const source=await B.SceneLoader.LoadAssetContainerAsync('',bytes(name),scene,undefined,'.glb'),copy=source.instantiateModelsToScene(n=>`test-${n}`,false,{doNotInstantiate:true}),root=new B.TransformNode('person',scene);for(const n of copy.rootNodes)n.parent=root;
 assert.equal(copy.skeletons[0].bones.length,53);let moved=0;
 for(const clip of copy.animationGroups){clip.start(true,1,clip.from,clip.to,false);let previous;
 for(const phase of [0,.25,.5,.75,1]){clip.goToFrame(clip.from+phase*(clip.to-clip.from));scene.render();for(const mesh of root.getChildMeshes()){if(!mesh.skeleton)continue;const p=mesh.getPositionData(true,true);assert.ok(p.every(Number.isFinite));for(let i=0;i<p.length;i+=3)assert.ok(Math.abs(p[i])<1.5&&p[i+1]>-.3&&p[i+1]<2.2&&Math.abs(p[i+2])<1.5,`${name} bounded actual skin`);if(/civilian skin/.test(mesh.name)){if(previous)for(let i=0;i<p.length;i++)moved+=Math.abs(p[i]-previous[i])>.0001?1:0;previous=Array.from(p);}}}clip.stop();}assert.ok(moved>200);root.dispose();for(const s of copy.skeletons)s.dispose();source.dispose();}}
 finally{scene.dispose();engine.dispose();}
});
function parseGlb(data){const bytes=Buffer.from(data),n=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+n)),bin=bytes.subarray(28+n);return {g,read(i){const a=g.accessors[i],v=g.bufferViews[a.bufferView],w={SCALAR:1,VEC3:3,VEC4:4}[a.type],size=a.componentType===5123?2:4,result=[];for(let r=0;r<a.count;r++){const row=[];for(let c=0;c<w;c++){const p=(v.byteOffset||0)+(a.byteOffset||0)+r*(v.byteStride||w*size)+c*size;row.push(a.componentType===5126?bin.readFloatLE(p):a.componentType===5123?bin.readUInt16LE(p):bin.readUInt32LE(p));}result.push(row);}return result;}};}
const sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
function rayHit(origin,dir,a,b,c){const e1=sub(b,a),e2=sub(c,a),p=cross(dir,e2),det=dot(e1,p);if(Math.abs(det)<1e-12)return Infinity;const t=sub(origin,a),u=dot(t,p)/det;if(u<0||u>1)return Infinity;const q=cross(t,e1),v=dot(dir,q)/det;if(v<0||u+v>1)return Infinity;const d=dot(e2,q)/det;return d>0?d:Infinity;}
test('real scalp triangles fully cover the crown with clearance in all three age meshes',()=>{
 for(const name of ['people','child','adolescent']){const {g,read}=parseGlb(bytes(name)),skin=g.meshes.find(m=>/skin/i.test(m.name)).primitives[0],cap=g.meshes.find(m=>/scalp hair/i.test(m.name)).primitives[0],points=read(skin.attributes.POSITION).filter(p=>p[1]>1.63),hair=read(cap.attributes.POSITION),indices=read(cap.indices).flat(),origin=[0,0,0];for(const p of points)for(let k=0;k<3;k++)origin[k]+=p[k]/points.length;
 for(const p of points){const dir=sub(p,origin);let hit=Infinity;for(let i=0;i<indices.length;i+=3)hit=Math.min(hit,rayHit(origin,dir,hair[indices[i]],hair[indices[i+1]],hair[indices[i+2]]));assert.ok(hit>1.015&&hit<5,`${name} crown skin must lie beneath a closed cap (${p}; ray=${hit})`);}
 const joints=read(cap.attributes.JOINTS_0),weights=read(cap.attributes.WEIGHTS_0);assert.ok(joints.every(j=>j[0]===44));assert.ok(weights.every(w=>w[0]===1&&w.slice(1).every(x=>x===0)));
 }
});
