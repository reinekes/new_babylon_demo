import {isStrictSumer} from '../scenario-profiles.js';
import {houseVisualKind} from './house-architecture.js';
import {loadModel} from './asset-loading.js';
import {batteredAdobe} from './reference-civic.js';
import {footprintSize} from '../footprints.js';

const FORTIFICATION_MODELS=Object.freeze({cityGate:'uruk-city-gate.glb',cityWall:'uruk-city-wall.glb'});
const MARKET_MODEL='market-2x2.glb';
const WATCH_HOUSE_MODEL='watch-house-v2.glb';
const REED_CAMP_MODEL='reed-camp-sf3d.glb';
const HOUSE_CATALOGUE={
 communalHouse:['communalHouse','78a44f4137f1'],
 'courtyard-1':['house','84ef78b6072b'],
 'courtyard-2':['house-2','feb3dfd79f0c'],
 'courtyard-3':['house-3','f5b16b4399d7'],
 hut:['starterHut','57ed6b25e246'],
 reedCamp:['reedCamp','7b60cd0774b3'],
};

export const SACRED_MODELS=Object.freeze({
 ishtarGate:{file:'sacred-ishtar-gate.glb',width:5.2},
 shrine3:{file:'sacred-shrine-3.glb',width:5.2},
 ziggurat1:{file:'sacred-ziggurat-1.glb',width:10.8},
 ziggurat3:{file:'sacred-ziggurat-3.glb',width:10.8}
});

/** Assets stay at their compact authored metre size. Rendering can enlarge a
 * gate without rewriting the GLB or moving cells in an existing saved town. */
export function sacredModelTransform(b){
 return {scale:b?.type==='ishtarGate'?(b.footprint===3?3:1.5):1,center:(footprintSize(b)-1)*3};
}

// Existing one-cell monuments retain their reserved area. A new
// construction remains scaffolding; an upgrade displays the current tier.
export function sacredModelKey(b,state){
 if(isStrictSumer(state))return null;
 if(!b||b.construction?.kind==='new')return null;
 const level=Math.max(1,Math.min(3,b.level||1));
 if(b.type==='ishtarGate')return 'ishtarGate';
 if(b.type==='shrine'&&level===3)return 'shrine3';
 if(b.type==='ziggurat'&&b.footprint===2&&[1,3].includes(level))return `ziggurat${level}`;
 return null;
}

export function flattenSacredContainer(B,container,{tileCoordinates=false}={}){
 container.addAllToScene();
 const sources=[];
 for(const mesh of container.meshes){
  if(!mesh.getTotalVertices())continue;
  mesh.computeWorldMatrix(true);
  let world=mesh.getWorldMatrix().clone();
  if(tileCoordinates){
   // The catalogue authors positions directly in the city tile frame. Remove
   // only the glTF loader's handedness root, retaining any authored node transforms.
   let root=mesh.parent;
   if(root){while(root.parent)root=root.parent;world=world.multiply(root.getWorldMatrix().clone().invert());}
  }
  const reflected=world.determinant()<0;
  mesh.bakeTransformIntoVertices(world);
  mesh.parent=null;mesh.position.setAll(0);mesh.rotation.setAll(0);mesh.rotationQuaternion=null;mesh.scaling.setAll(1);
  // A tile authored in glTF keeps its original CCW triangles and normals
  // after the loader reflection is removed. Babylon's LH front-face setting
  // must then preserve the lit outward side of its double-sided PBR material.
  mesh.overrideMaterialSideOrientation=tileCoordinates&&!container.scene?.useRightHandedSystem
   ?B.Material.ClockWiseSideOrientation
   :reflected?B.Material.ClockWiseSideOrientation:B.Material.CounterClockWiseSideOrientation;
  mesh.isVisible=false;mesh.isPickable=false;mesh.checkCollisions=false;mesh.receiveShadows=true;
  mesh.computeWorldMatrix(true);sources.push(mesh);
 }
 if(!sources.length)throw Error('Модель здания не содержит геометрии');
 return sources;
}

const fallbackBlueMaterials=new WeakMap();
export function createIshtarGateFallback(B,scene,m,blue,b={type:'ishtarGate'}){
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
 const {scale,center}=sacredModelTransform(b);
 return [...groups].map(([mat,parts])=>{const mesh=B.Mesh.MergeMeshes(parts,true,true,undefined,false,false);mesh.name='game-ishtar-procedural-'+mat.name;mesh.material=mat;mesh.scaling.setAll(scale);mesh.position.set(center,0,center);return mesh;});
}

// Southern Sumer game interpretation: raw-brick sacred courtyard entry,
// rectangular timber lintel, no Neo-Babylonian glazed reliefs or crenellations.
export function createSumerGate(B,scene,m,b={type:'ishtarGate'}){
 const groups=new Map();
 const box=(name,x,y,z,w,h,d,mat)=>{const mesh=B.MeshBuilder.CreateBox('sumer-gate-'+name,{width:w,height:h,depth:d},scene);mesh.position.set(x,y,z);mesh.material=mat;if(!groups.has(mat))groups.set(mat,[]);groups.get(mat).push(mesh);};
 const pier=(name,x,y,z,w,h,d,insetX,insetZ,mat)=>{
  const mesh=batteredAdobe(B,scene,'sumer-gate-'+name,{x,y,z,w,h,d,insetX,insetZ},mat);
  if(!groups.has(mat))groups.set(mat,[]);groups.get(mat).push(mesh);
 };
 box('threshold',0,.035,0,5.2,.07,3.93,m.soil);
 for(const side of [-1,1]){
  const x=side*1.62;
  pier('tapered-pylon',x,0,-.47,1.40,3.19,1.92,.16,.17,m.raw);
  // Raised jambs create the stepped recess seen on both pylon fronts.
  for(const dx of [-.48,.48]){
   const rib=batteredAdobe(B,scene,'sumer-gate-recess-jamb',{x:x+dx,y:.06,z:.48,w:.16,h:2.82,d:.22,insetX:.022,insetZ:.055},m.fired);
   rib.rotation.x=-.046;
   if(!groups.has(m.fired))groups.set(m.fired,[]);groups.get(m.fired).push(rib);
  }
  for(const y of [2.27,2.81])box('niche-header',x,y,.50-y*.045,1.06,.09,.19,m.fired);
  box('pylon-cap',x,3.22,-.47,1.14,.14,1.62,m.raw);
  pier('court-return',side*2.43,0,.06,.34,.99,3.87,.044,.052,m.raw);
  box('approach',side*1.84,.27,1.26,1.20,.54,1.39,m.fired);
  box('approach-cap',side*1.84,.56,1.26,1.24,.07,1.42,m.trim);
 }
 box('timber-lintel',0,2.43,-.45,2.36,.27,1.52,m.wood);
 box('brick-header',0,2.71,-.45,2.28,.31,1.60,m.raw);
 const {scale,center}=sacredModelTransform(b);
 return [...groups].map(([mat,parts])=>{const mesh=B.Mesh.MergeMeshes(parts,true,true,undefined,false,false);mesh.name='game-sumer-gate-'+mat.name;mesh.material=mat;mesh.scaling.setAll(scale);mesh.position.set(center,0,center);return mesh;});
}

function modelKey(b,state){
 if(b?.type==='communalHouse'&&b.construction?.kind!=='new')return 'communalHouse';
 if(b?.type==='house'&&!b.reedCamp&&!b.campSalvage&&b.construction?.kind!=='new')return houseVisualKind(b,state);
 // These Southern Sumer buildings are authored around their actual city joints and ports.
 if(isStrictSumer(state)&&['market','watchHouse','cityWall','cityGate'].includes(b?.type))return null;
 if(b?.type==='market'&&footprintSize(b)===2&&b.construction?.kind!=='new')return 'market';
 if(b?.type==='watchHouse'&&b.construction?.kind!=='new')return 'watchHouse';
 if(b?.construction?.kind!=='new'&&(b?.type==='cityWall'||b?.type==='cityGate'))return b.type;
 if(b?.type==='house'&&b.reedCamp&&!b.campSalvage&&!b.construction)return 'reedCamp';
 return sacredModelKey(b,state);
}

// Built monuments and reed camps load on demand. The procedural silhouette stays
// while decoding or offline; only the view changes.
export function createSacredModels(B,scene,{onError=error=>console.warn('Building model unavailable; retaining architecture.',error)}={}){
 const loaded=new Map(),pending=new Map(),failed=new Set();let disposed=false,blue=null;
 function request(b,state){
  const key=modelKey(b,state);
  if(!key||disposed||loaded.has(key)||failed.has(key))return pending.get(key)||null;
  if(pending.has(key))return pending.get(key);
  async function open(directory,file,catalogue=false){
   const container=await loadModel(B,scene,directory,file,scene,undefined,'.glb');
   if(disposed){container.dispose();return null;}
   try{
    const sources=flattenSacredContainer(B,container,{tileCoordinates:catalogue});
    loaded.set(key,{container,sources,catalogue});return sources;
   }catch(error){container.dispose();throw error;}
  }
  const house=HOUSE_CATALOGUE[key];
  let task;
  if(house){
   const [stem,version]=house;
   task=open('assets/3d/sumer-buildings/',stem+'.glb?v='+version,true);
   if(key==='reedCamp')task=task.catch(error=>{
    if(disposed)throw error;
    return open('assets/art-courtyard/models/',REED_CAMP_MODEL);
   });
  }else{
   const file=key==='market'?MARKET_MODEL:key==='watchHouse'?WATCH_HOUSE_MODEL:FORTIFICATION_MODELS[key]??SACRED_MODELS[key].file;
   task=open('assets/art-courtyard/models/',file);
  }
  const promise=task.catch(error=>{failed.add(key);if(!disposed)onError(error);return null;}).finally(()=>pending.delete(key));
  pending.set(key,promise);return promise;
 }
 return {request,key:sacredModelKey,catalogue(b,state){return !!loaded.get(modelKey(b,state))?.catalogue;},ready(b,state){return loaded.has(modelKey(b,state));},sources(b,state){return loaded.get(modelKey(b,state))?.sources||null;},
  fallback(b,m,state){if(b.type!=='ishtarGate')return null;if(isStrictSumer(state))return createSumerGate(B,scene,m,b);if(!blue){blue=new B.PBRMaterial('sacred-glazed-blue',scene);blue.albedoColor=B.Color3.FromHexString('#1e6087').toLinearSpace();blue.metallic=0;blue.roughness=.56;}return createIshtarGateFallback(B,scene,m,blue,b);},
  idle(){return Promise.all([...pending.values()]);},
  dispose(){if(disposed)return;disposed=true;for(const {container} of loaded.values())container.dispose();loaded.clear();failed.clear();blue?.dispose();}
 };
}
