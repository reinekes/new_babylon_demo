import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {inflateSync} from 'node:zlib';
const configs=[['date-palm',7.34,9941,4,'evolveduk'],['dry-grass-1',.65,20,1,'Pixel-bit'],['dry-grass-2',.55,8,1,'Pixel-bit'],['dry-grass-3',.72,20,1,'Pixel-bit'],['reed-1',1.8,331,2,'Nicholas-3D'],['reed-2',1.8,327,2,'Nicholas-3D'],['reed-3',1.8,296,2,'Nicholas-3D'],['barley',.95,8,1,'ljungman']];
function glb(name){const raw=readFileSync(new URL(`../assets/art-courtyard/models/valley-${name}.glb`,import.meta.url));assert.equal(raw.readUInt32LE(8),raw.length);const length=raw.readUInt32LE(12);return {raw,g:JSON.parse(raw.subarray(20,20+length)),bin:raw.subarray(28+length)};}
function values(g,bin,index){const a=g.accessors[index],v=g.bufferViews[a.bufferView],width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],size={5121:1,5123:2,5125:4,5126:4}[a.componentType],method={5121:'readUInt8',5123:'readUInt16LE',5125:'readUInt32LE',5126:'readFloatLE'}[a.componentType],start=(v.byteOffset||0)+(a.byteOffset||0);return Array.from({length:a.count},(_,i)=>Array.from({length:width},(_,j)=>bin[method](start+i*(v.byteStride||size*width)+j*size)));}
test('plant geometry has actual metre bounds, ground and finite unit normals, without source scene offsets',()=>{
 for(const [name,height,tris,meshCount] of configs){const {raw,g,bin}=glb(name),meta=g.asset.extras.new_babylon_adaptation;assert.ok(raw.length<3300000);assert.equal(g.meshes.length,meshCount);assert.ok(!g.skins&&!g.animations);assert.deepEqual(g.scenes[0].nodes,[0]);assert.equal(g.nodes.length,meshCount+1);let count=0;const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const node of g.nodes)for(const key of ['matrix','translation','rotation','scale'])assert.equal(node[key],undefined,'all source transforms must be baked');
  for(const mesh of g.meshes)for(const p of mesh.primitives){const points=values(g,bin,p.attributes.POSITION),indices=values(g,bin,p.indices).flat();count+=indices.length/3;for(const index of indices)assert.ok(index>=0&&index<points.length);for(const point of points)point.forEach((n,j)=>{assert.ok(Number.isFinite(n));min[j]=Math.min(min[j],n);max[j]=Math.max(max[j],n);});for(const normal of values(g,bin,p.attributes.NORMAL))assert.ok(Math.abs(Math.hypot(...normal)-1)<.0001);}
  assert.equal(count,tris);assert.equal(meta.triangles,tris);assert.ok(Math.abs(min[1])<1e-6);assert.ok(Math.abs(max[1]-height)<1e-5);assert.ok(Math.abs(min[0]+max[0])<1e-6);assert.ok(Math.abs(min[2]+max[2])<1e-6);assert.equal(meta.units,'metres');assert.equal(meta.up,'+Y');assert.equal(meta.runtime_approved,true);
 }
});
test('complete reed and palm layers retain exact attribution, alpha cards, embedded textures and normal maps',()=>{
 for(const [name,,,,author]of configs){const {g,bin}=glb(name),extras=g.asset.extras,meta=extras.new_babylon_adaptation;assert.match(extras.author,new RegExp(author));assert.match(extras.license,/CC-BY-4.0/);assert.match(extras.source,/^https:\/\/sketchfab.com\/3d-models\//);assert.deepEqual(meta.source_asset_extras,{author:extras.author,license:extras.license,source:extras.source,title:extras.title});assert.match(meta.source_sha256,/^[0-9a-f]{64}$/);
  for(const image of g.images){assert.equal(image.uri,undefined);assert.equal(image.mimeType,'image/png');const v=g.bufferViews[image.bufferView],data=bin.subarray(v.byteOffset,v.byteOffset+v.byteLength);assert.equal(data.readUInt32BE(0),0x89504e47);assert.ok(data.readUInt32BE(16)<=512);assert.ok(data.readUInt32BE(20)<=512);}
  assert.ok(g.materials.some(m=>m.normalTexture));assert.ok(g.materials.some(m=>m.alphaMode==='MASK'));for(const material of g.materials){assert.equal(material.pbrMetallicRoughness.metallicFactor,0);if(material.alphaMode==='MASK'){assert.equal(material.doubleSided,true);const texture=g.textures[material.pbrMetallicRoughness.baseColorTexture.index],image=g.images[texture.source],v=g.bufferViews[image.bufferView];assert.equal(bin[v.byteOffset+25],6,'masked base image retains RGBA alpha channel');}}
 }
 assert.deepEqual(glb('date-palm').g.asset.extras.new_babylon_adaptation.source_node_indices,[4,6,8,10]);
 for(const name of ['reed-1','reed-2','reed-3'])assert.equal(glb(name).g.asset.extras.new_babylon_adaptation.source_node_indices.length,2);
 const barley=glb('barley').g.asset.extras.new_babylon_adaptation;assert.match(barley.barley_derivative.base_color,/awns longer than ear/);assert.match(barley.barley_derivative.botanical_status,/not a botanical reconstruction/);
});
test('every shipped plant GLB parses in actual Babylon with finite geometry and shared instance geometry',async()=>{
 const box={exports:{},module:{exports:{}},console,setTimeout,clearTimeout,performance,window:{addEventListener(){},removeEventListener(){}},navigator:{userAgent:'node'},TextDecoder,TextEncoder,URL,Blob};vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),box);const B=box.exports.NullEngine?box.exports:box.module.exports;box.BABYLON=B;box.exports=undefined;box.module=undefined;vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylonjs-loaders-9.31.0.min.js',import.meta.url),'utf8'),box);const engine=new B.NullEngine(),scene=new B.Scene(engine);
 try{for(const [name] of configs){B.SceneLoader.OnPluginActivatedObservable.addOnce(p=>{p.skipMaterials=true;});const container=await B.SceneLoader.LoadAssetContainerAsync('',new Uint8Array(glb(name).raw),scene,undefined,'.glb');const models=container.meshes.filter(m=>m.getTotalVertices()>0);assert.ok(models.length);for(const mesh of models){assert.ok(mesh.getWorldMatrix().m.every(Number.isFinite));const instance=mesh.createInstance(`test-${name}`);assert.equal(instance.sourceMesh.geometry,mesh.geometry);instance.dispose();}container.dispose();}}finally{scene.dispose();engine.dispose();}
});

// Decode our own RGBA PNG to check the actual atlas, not metadata alone.
function rgbaPng(data){
 const width=data.readUInt32BE(16),height=data.readUInt32BE(20),parts=[];let at=8;
 while(at<data.length){const length=data.readUInt32BE(at),type=data.toString('ascii',at+4,at+8);if(type==='IDAT')parts.push(data.subarray(at+8,at+8+length));at+=length+12;}
 const raw=inflateSync(Buffer.concat(parts)),stride=width*4,pixels=Buffer.alloc(height*stride);let offset=0;
 for(let y=0;y<height;y++){const filter=raw[offset++];for(let x=0;x<stride;x++){const a=x>=4?pixels[y*stride+x-4]:0,b=y?pixels[(y-1)*stride+x]:0,c=y&&x>=4?pixels[(y-1)*stride+x-4]:0;let predictor=0;if(filter===1)predictor=a;if(filter===2)predictor=b;if(filter===3)predictor=Math.floor((a+b)/2);if(filter===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);predictor=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}pixels[y*stride+x]=(raw[offset++]+predictor)&255;}}
 return {width,height,pixels};
}
test('barley browser atlas has cream-gold long-awn heads above the stalks, with original ground/crown UVs',()=>{
 const {g,bin}=glb('barley'),p=g.meshes[0].primitives[0],positions=values(g,bin,p.attributes.POSITION),uv=values(g,bin,p.attributes.TEXCOORD_0);
 for(let i=0;i<positions.length;i++){if(positions[i][1]<.001)assert.ok(uv[i][1]<.01);if(positions[i][1]>.94)assert.ok(uv[i][1]>.99);}
 const texture=g.textures[g.materials[0].pbrMetallicRoughness.baseColorTexture.index],image=g.images[texture.source],view=g.bufferViews[image.bufferView],{width,height,pixels}=rgbaPng(bin.subarray(view.byteOffset,view.byteOffset+view.byteLength));let top=0,bottom=0,sum=[0,0,0],count=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const at=(y*width+x)*4;if(pixels[at+3]<150)continue;if(y<height*.5)top++;else bottom++;for(let c=0;c<3;c++)sum[c]+=pixels[at+c];count++;}
 assert.ok(top>bottom*1.3,'broad ears and awns must occupy upper PNG rows; upside-down heads caused ground stubble in browser');assert.ok(sum[0]/count>215&&sum[1]/count>185&&sum[2]/count>115,'golden cream atlas must contrast with brown soil');assert.match(g.asset.extras.new_babylon_adaptation.barley_derivative.atlas_orientation,/heads at top/);
});
