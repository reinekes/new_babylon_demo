import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGame} from '../engine.js';
import {createValleyVegetation,loadValleyPlantSources,valleyVegetationPlan,vegetationBankDistance,VEGETATION_BUDGETS} from '../game3d/valley-vegetation.js';
import {landscapePlan} from '../game3d/landscape.js';
import {sceneryClear} from '../game3d/nature.js';
import {lakeDistance,visualSurfaceElevation} from '../game3d/lake-shore.js';

const distance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);};
test('imported plants follow visible wet/dry bands and avoid full farm/workplace/road footprints read-only',()=>{
 const s=createGame();s.buildings.push({type:'farm',x:4,y:5,footprint:3},{type:'logging',x:20,y:8,footprint:2});const roads=landscapePlan(s).roads,before=JSON.stringify(s),a=valleyVegetationPlan(s,roads);
 assert.deepEqual(a,valleyVegetationPlan(s,roads));assert.ok(a.grass.length>100);assert.ok(a.reed.length>10);assert.ok(a.greenGrass.length>20);assert.ok(a.grass.every(p=>p.scale>=1.3));
 for(const [kind,points]of Object.entries(a))for(const p of points){const d=vegetationBankDistance(p.x,p.y,s);assert.ok(d>.1);assert.ok(lakeDistance(p.x,p.y,s)>.1);assert.ok(sceneryClear(s,p,.05));assert.ok(roads.every(r=>distance(p,r.a,r.b)>.33));if(kind==='grass')assert.ok(d>=.83&&d<6);if(kind==='greenGrass')assert.ok(d>=.83&&d<2.5);}
 assert.equal(JSON.stringify(s),before);
 const low=valleyVegetationPlan(s,roads,'low'),high=valleyVegetationPlan(s,roads,'high');assert.deepEqual(low.grass,high.grass.slice(0,low.grass.length));for(const tier of ['low','balanced','high']){const p=valleyVegetationPlan(s,roads,tier);assert.ok(p.grass.length<=VEGETATION_BUDGETS[tier].grass);assert.ok(p.reed.length<=VEGETATION_BUDGETS[tier].reed+90);}
 s.buildings.push({type:'house',x:a.grass[0].x,y:a.grass[0].y});const next=valleyVegetationPlan(s,roads);assert.ok(!next.grass.some(p=>p.x===a.grass[0].x&&p.y===a.grass[0].y));
});
const sandbox={console,setTimeout,clearTimeout,performance,window:{addEventListener(){},removeEventListener(){}},navigator:{userAgent:'node'}};vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);const B=sandbox.BABYLON;
test('material layers stay together per variant; cached instances are grounded, bounded and disposed',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),original=B.SceneLoader.LoadAssetContainerAsync;let loads=0,view;
 B.SceneLoader.LoadAssetContainerAsync=async(root,file)=>{loads++;const c=new B.AssetContainer(scene),reflection=new B.TransformNode('reflection',scene);reflection.scaling.z=-1;c.transformNodes.push(reflection);
  for(let i=0;i<2;i++){const m=B.MeshBuilder.CreatePlane(`${file}-layer-${i}`,{size:1},scene);m.position.y=.5;m.parent=reflection;m.material=new B.PBRMaterial(`${file}-mat-${i}`,scene);m.material.transparencyMode=B.Material.MATERIAL_ALPHATEST;c.materials.push(m.material);c.meshes.push(m);}c.removeAllFromScene();return c;};
 try{const s=createGame(),roads=landscapePlan(s).roads,before=JSON.stringify(s);view=await createValleyVegetation(B,scene,{tier:'low'});assert.equal(loads,9);view.update(s,roads,'initial');const live=view.meshes,instances=live.filter(m=>m.sourceMesh),first=instances[0];assert.equal(instances.length,(view.plan.grass.length+view.plan.greenGrass.length+view.plan.reed.length)*2,'both alpha material layers at every selected variant');
  for(const m of instances){const p=m.metadata.valleyVegetation;assert.ok(Math.abs(m.position.y-visualSurfaceElevation(p.x,p.y,s))<1e-8);assert.ok(m.material.needAlphaTesting());assert.equal(m.material.twoSidedLighting,true,'back-facing leaf cards must receive light on the visible side');assert.equal(m.overrideMaterialSideOrientation,B.Material.CounterClockWiseSideOrientation);assert.ok(m.getWorldMatrix().determinant()>0);assert.equal(m.isEnabled(),true);}
  const count=scene.meshes.length;view.update(s,roads,'initial');assert.ok(live.includes(first));assert.equal(scene.meshes.length,count);assert.equal(loads,9);assert.equal(JSON.stringify(s),before);
  view.setQuality('high');view.update(s,roads,'initial');assert.ok(first.isDisposed());assert.ok(scene.meshes.length>count);assert.equal(loads,9);view.dispose();view.dispose();assert.equal(live.length,0);assert.equal(scene.meshes.length,0);assert.equal(JSON.stringify(s),before);
 }finally{B.SceneLoader.LoadAssetContainerAsync=original;view?.dispose();scene.dispose();engine.dispose();}
});
test('unavailable plant files preserve a working empty optional layer and dispose cleanly',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),original=B.SceneLoader.LoadAssetContainerAsync;let view;B.SceneLoader.LoadAssetContainerAsync=async()=>{throw Error('offline');};
 try{view=await createValleyVegetation(B,scene);view.update(createGame(),[],'offline');assert.equal(view.sources.grass.length,0);assert.equal(view.sources.reed.length,0);assert.equal(view.meshes.length,0);view.dispose();assert.equal(scene.meshes.length,0);}finally{B.SceneLoader.LoadAssetContainerAsync=original;view?.dispose();scene.dispose();engine.dispose();}
});

test('leaf lighting flips double-sided normals without changing source atlas, alpha cutoff or opaque bark',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),original=B.SceneLoader.LoadAssetContainerAsync,meshes=[],containers=[],mats=[];
 B.SceneLoader.LoadAssetContainerAsync=async()=>{const c=new B.AssetContainer(scene),root=new B.TransformNode('gltf-reflection',scene);root.scaling.z=-1;c.transformNodes.push(root);
  for(const [i,name]of ['leaf-card','double-sided-leaf-geometry','opaque-bark'].entries()){const m=B.MeshBuilder.CreatePlane(name,{size:1},scene),mat=new B.PBRMaterial(name,scene);mat.backFaceCulling=i===2;mat.twoSidedLighting=false;mat.alphaCutOff=.215;mat.albedoColor.set(.2,.5,.15);if(i===0)mat.transparencyMode=B.Material.MATERIAL_ALPHATEST;mat.albedoTexture=B.RawTexture.CreateRGBATexture(new Uint8Array([60,130,35,200]),1,1,scene);mat.albedoTexture.hasAlpha=i===0;c.textures.push(mat.albedoTexture);m.material=mat;m.parent=root;c.materials.push(mat);c.meshes.push(m);mats.push({mat,texture:mat.albedoTexture});}c.removeAllFromScene();return c;};
 try{const sources=await loadValleyPlantSources(B,scene,['test.glb'],meshes,containers,'palm');assert.equal(sources.length,3);
  for(const [i,{mat,texture}]of mats.entries()){assert.equal(mat.twoSidedLighting,i!==2);assert.equal(mat.backFaceCulling,i===2);assert.equal(mat.alphaCutOff,.215,'retain source alpha coverage');assert.equal(mat.albedoTexture,texture);assert.equal(mat.albedoColor.g,.5);assert.equal(mat.emissiveColor.r,0,'correct normals instead of painting emissive leaves');assert.equal(mat.emissiveColor.g,0);assert.equal(mat.unlit,false);assert.equal(mat.subSurface.isTranslucencyEnabled,i===0,'only alpha leaf cards transmit sunlight');if(i===0){assert.equal(mat.subSurface.translucencyIntensity,.2);assert.equal(mat.subSurface.translucencyColor.r,.08);assert.equal(mat.subSurface.translucencyColor.g,.13);assert.equal(mat.subSurface.translucencyColor.b,.025);assert.equal(mat.subSurface.useAlbedoToTintTranslucency,true);assert.equal(mat.subSurface.minimumThickness,0);assert.equal(mat.subSurface.maximumThickness,.03);}}
  for(const m of sources){m.computeWorldMatrix(true);assert.ok(m.getWorldMatrix().determinant()>0);assert.equal(m.overrideMaterialSideOrientation,B.Material.CounterClockWiseSideOrientation);}
 }finally{B.SceneLoader.LoadAssetContainerAsync=original;for(const m of meshes)m.dispose();for(const c of containers)c.dispose();scene.dispose();engine.dispose();}
});

test('actual dry-grass upward canopy normals stay up on both faces, while real reed normals keep two-sided lighting',async()=>{
 Object.assign(sandbox,{TextDecoder,TextEncoder,URL,Blob});vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylonjs-loaders-9.31.0.min.js',import.meta.url),'utf8'),sandbox);
 const engine=new B.NullEngine(),scene=new B.Scene(engine),original=B.SceneLoader.LoadAssetContainerAsync,meshes=[],containers=[];
 B.SceneLoader.LoadAssetContainerAsync=async(root,file)=>{B.SceneLoader.OnPluginActivatedObservable.addOnce(p=>p.skipMaterials=true);const raw=readFileSync(new URL(`../assets/art-courtyard/models/${file}`,import.meta.url)),c=await original.call(B.SceneLoader,'',new Uint8Array(raw),scene,undefined,'.glb');for(const m of c.meshes)if(m.getTotalVertices()>0){const mat=new B.PBRMaterial(m.name+'-test',scene);mat.backFaceCulling=false;mat.transparencyMode=B.Material.MATERIAL_ALPHATEST;m.material=mat;c.materials.push(mat);}return c;};
 try{const grass=await loadValleyPlantSources(B,scene,['valley-dry-grass-1.glb','valley-dry-grass-2.glb','valley-dry-grass-3.glb'],meshes,containers,'grass'),reed=await loadValleyPlantSources(B,scene,['valley-reed-1.glb'],meshes,containers,'reed');assert.equal(grass.length,3);assert.equal(reed.length,2);
  for(const m of grass){assert.equal(m.metadata.upwardCanopy,true);assert.equal(m.material.twoSidedLighting,false);const normals=m.getVerticesData(B.VertexBuffer.NormalKind);for(let i=1;i<normals.length;i+=3)assert.ok(normals[i]>.999);assert.equal(m.material.unlit,false);assert.equal(m.material.emissiveColor.r,0);}
  for(const m of reed){assert.equal(m.metadata.upwardCanopy,false);assert.equal(m.material.twoSidedLighting,true);}
  // Reflected glTF positions and normals are already baked into left-handed
  // geometry by MergeMeshes. Compare actual winding to a native Babylon box;
  // carrying the source root's CW override across that bake is incorrect.
  const windingDot=m=>{const ps=m.getVerticesData(B.VertexBuffer.PositionKind),ns=m.getVerticesData(B.VertexBuffer.NormalKind),ii=m.getIndices();let dot=0;for(let j=0;j<ii.length;j+=3){const a=B.Vector3.FromArray(ps,ii[j]*3),b=B.Vector3.FromArray(ps,ii[j+1]*3),c=B.Vector3.FromArray(ps,ii[j+2]*3);dot+=B.Vector3.Dot(B.Vector3.Cross(b.subtract(a),c.subtract(a)),B.Vector3.FromArray(ns,ii[j]*3));}return Math.sign(dot);};
  const palm=await loadValleyPlantSources(B,scene,['valley-date-palm.glb'],meshes,containers,'palm'),birch=await loadValleyPlantSources(B,scene,['miracle-birch-1.glb'],meshes,containers,'birch');assert.equal(palm.length,4);assert.equal(birch.length,2);
  const box=B.MeshBuilder.CreateBox('native-reference',{},scene);for(const m of [...reed,...palm,...birch]){assert.equal(windingDot(m),windingDot(box),'actual merged reed/palm/birch normals/winding agree with native LH geometry');assert.equal(m.overrideMaterialSideOrientation,box.overrideMaterialSideOrientation,'baked geometry uses native orientation after removal of reflected root');}assert.equal(box.overrideMaterialSideOrientation,B.Material.CounterClockWiseSideOrientation);box.dispose();
 }finally{B.SceneLoader.LoadAssetContainerAsync=original;for(const m of meshes)m.dispose();for(const c of containers)c.dispose();scene.dispose();engine.dispose();}
});
