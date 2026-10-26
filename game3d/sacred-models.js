import {loadModel} from './asset-loading.js';

export const SACRED_MODELS=Object.freeze({
 ishtarGate:{file:'sacred-ishtar-gate.glb',width:5.2},
 shrine3:{file:'sacred-shrine-3.glb',width:5.2},
 ziggurat1:{file:'sacred-ziggurat-1.glb',width:10.8},
 ziggurat3:{file:'sacred-ziggurat-3.glb',width:10.8}
});

// Existing one-cell monuments retain their geometry and reserved area. A new
// construction remains scaffolding; an upgrade displays the current tier.
export function sacredModelKey(b){
 if(!b||b.construction?.kind==='new')return null;
 const level=Math.max(1,Math.min(3,b.level||1));
 if(b.type==='ishtarGate')return 'ishtarGate';
 if(b.type==='shrine'&&level===3)return 'shrine3';
 if(b.type==='ziggurat'&&b.footprint===2&&[1,3].includes(level))return `ziggurat${level}`;
 return null;
}

export function flattenSacredContainer(B,container){
 container.addAllToScene();
 const sources=[];
 for(const mesh of container.meshes){
  if(!mesh.getTotalVertices())continue;
  mesh.computeWorldMatrix(true);
  const world=mesh.getWorldMatrix().clone(),reflected=world.determinant()<0;
  mesh.bakeTransformIntoVertices(world);
  mesh.parent=null;mesh.position.setAll(0);mesh.rotation.setAll(0);mesh.rotationQuaternion=null;mesh.scaling.setAll(1);
  mesh.overrideMaterialSideOrientation=reflected?B.Material.ClockWiseSideOrientation:B.Material.CounterClockWiseSideOrientation;
  mesh.isVisible=false;mesh.isPickable=false;mesh.checkCollisions=false;mesh.receiveShadows=true;
  mesh.computeWorldMatrix(true);sources.push(mesh);
 }
 if(!sources.length)throw Error('Священное здание не содержит геометрии');
 return sources;
}

const fallbackBlueMaterials=new WeakMap();
export function createIshtarGateFallback(B,scene,m,blue){
 if(!blue){blue=fallbackBlueMaterials.get(scene);if(!blue||blue.isDisposed?.()){blue=new B.PBRMaterial('sacred-glazed-blue',scene);blue.albedoColor=B.Color3.FromHexString('#1e6087').toLinearSpace();blue.metallic=0;blue.roughness=.56;fallbackBlueMaterials.set(scene,blue);scene.onDisposeObservable.add(()=>fallbackBlueMaterials.delete(scene));}}
 const groups=new Map(),add=(mesh,mat)=>{mesh.material=mat;if(!groups.has(mat))groups.set(mat,[]);groups.get(mat).push(mesh);return mesh;};
 const box=(name,x,y,z,w,h,d,mat=blue)=>{const mesh=B.MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);mesh.position.set(x,y,z);return add(mesh,mat);};
 box('gate-stone-threshold',0,.06,0,5.2,.12,1.8,m.fired||m.stone);
 for(const side of [-1,1]){
  box('blue-gate-tower',side*1.84,1.61,0,1.36,3.1,1.4);
  for(let i=0;i<3;i++)box('gate-tower-merlon',side*1.84+(i-1)*.43,3.32,0,.28,.33,1.4);
  for(const y of [.34,2.64])box('gate-glazed-band',side*1.84,y,.715,1.38,.07,.035,m.trim);
  for(const y of [.77,1.25,1.73,2.21])box('gate-glazed-rosette',side*1.84,y,.73,.12,.15,.04,m.trim);
 }
 box('gate-crown',0,2.98,0,2.36,.39,1.35);
 for(let i=0;i<5;i++)box('gate-crown-merlon',(i-2)*.43,3.29,0,.26,.28,1.35);
 // A real empty arch, rather than a dark rectangle over an intact wall.
 const p=[],indices=[],normals=[];
 for(let i=0;i<12;i++){
  const a=i/12*Math.PI,c=(i+1)/12*Math.PI,start=p.length/3;
  for(const z of [-.67,.67])for(const r of [.78,1.13])for(const t of [a,c])p.push(Math.cos(t)*r,1.67+Math.sin(t)*r,z);
  for(const f of [[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]])indices.push(start+f[0],start+f[1],start+f[2],start+f[0],start+f[2],start+f[3]);
 }
 const uvs=[];for(let i=0;i<p.length;i+=3)uvs.push(p[i]/2,p[i+1]/2);
 B.VertexData.ComputeNormals(p,indices,normals);const data=new B.VertexData();Object.assign(data,{positions:p,indices,normals,uvs});const arch=new B.Mesh('gate-open-arch',scene);data.applyToMesh(arch);add(arch,blue);
 for(const side of [-1,1])box('gate-opening-pier',side*.985,.87,0,.41,1.74,1.34);
 return [...groups].map(([mat,parts])=>{const mesh=B.Mesh.MergeMeshes(parts,true,true,undefined,false,false);mesh.name='game-ishtar-procedural-'+mat.name;mesh.material=mat;return mesh;});
}

// No sacred GLB is requested on startup or placement previews. Built monuments
// opt in independently; their procedural silhouette remains while decoding or
// offline. Loading changes view templates only, never simulation/save objects.
export function createSacredModels(B,scene,{onError=error=>console.warn('Sacred model unavailable; retaining architecture.',error)}={}){
 const loaded=new Map(),pending=new Map(),failed=new Set();let disposed=false,blue=null;
 function request(b){
  const key=sacredModelKey(b);
  if(!key||disposed||loaded.has(key)||failed.has(key))return pending.get(key)||null;
  if(pending.has(key))return pending.get(key);
  const promise=loadModel(B,scene,'assets/art-courtyard/models/',SACRED_MODELS[key].file,scene,undefined,'.glb').then(container=>{
   if(disposed){container.dispose();return null;}
   try{const sources=flattenSacredContainer(B,container);loaded.set(key,{container,sources});return sources;}
   catch(error){container.dispose();throw error;}
  }).catch(error=>{failed.add(key);if(!disposed)onError(error);return null;}).finally(()=>pending.delete(key));
  pending.set(key,promise);return promise;
 }
 return {request,key:sacredModelKey,ready(b){return loaded.has(sacredModelKey(b));},sources(b){return loaded.get(sacredModelKey(b))?.sources||null;},
  fallback(b,m){if(b.type!=='ishtarGate')return null;if(!blue){blue=new B.PBRMaterial('sacred-glazed-blue',scene);blue.albedoColor=B.Color3.FromHexString('#1e6087').toLinearSpace();blue.metallic=0;blue.roughness=.56;}return createIshtarGateFallback(B,scene,m,blue);},
  idle(){return Promise.all([...pending.values()]);},
  dispose(){if(disposed)return;disposed=true;for(const {container} of loaded.values())container.dispose();loaded.clear();failed.clear();blue?.dispose();}
 };
}
