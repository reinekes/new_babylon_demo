import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGame} from '../engine.js';
import {createGameActors} from '../game3d/actors.js';

const variants=['male','female','child','adolescent'];
const assetFile=variant=>new URL(`../assets/art-courtyard/models/source-walk-${variant}.glb`,import.meta.url);
const sourceSha='b98f7d15b68c0d3948989973451ca1f528fbb7a21f164c4ed0faadb9028d8e71';
// Independently sampled keys 0,14,29 from the supplied man_woman_walk.glb.
// A quaternion sign flip is equivalent; replacing the authored gait is not.
const sourceKeys={
 male:{upperarm_l:[[.529080868,.098325402,-.082773879,.838781297],[.477439791,.139631689,-.153234288,.853857994],[.529080927,.098325230,-.082773961,.838781297]],lowerarm_l:[[.045540303,.000433658,.294349074,.954612255],[.035820827,.001371689,.212072983,.976596117],[.045540288,.000433735,.294349074,.954612255]],upperarm_r:[[.478424728,-.228594884,.189445347,.826416731],[.511410892,-.192458436,-.011861360,.837423384],[.478424639,-.228594884,.189445242,.826416790]],lowerarm_r:[[.050184727,-.001474432,-.263225049,.963427186],[.064983919,.000810982,-.383484721,.921257794],[.050184544,-.001474524,-.263225168,.963427126]],thigh_l:[[.005421897,-.165922433,-.985758424,.026845885],[.036926474,.075646050,.992910147,.083926037],[.005422455,-.165922999,-.985758305,.026845342]],thigh_r:[[.103049599,-.048769765,-.989886761,.084418476],[-.045787569,.136127040,.987603784,.063337006],[.103049673,-.048769135,-.989886701,.084418990]]},
 female:{upperarm_l:[[.707519531,.043337114,-.075391494,.701323152],[.666317403,.100835733,-.138357341,.725748301],[.707519531,.043336976,-.075391613,.701323152]],lowerarm_l:[[.013084564,-.070858903,.311273307,.947584689],[.009618502,-.072588339,.228822127,.970710516],[.013084554,-.070858851,.311273307,.947584689]],upperarm_r:[[.667218029,-.203824341,.150684267,.700407028],[.690798044,-.122222394,-.038257372,.711615145],[.667217910,-.203824311,.150684148,.700407207]],lowerarm_r:[[.015501029,.063984364,-.279540002,.957874298],[.022179483,.061068241,-.399980456,.914217889],[.015500854,.063984275,-.279540122,.957874238]],thigh_l:[[.003817008,-.189037278,-.981718540,.021887280],[.035582267,.099896334,.990277231,.090031467],[.003817695,-.189037830,-.981718421,.021887295]],thigh_r:[[.101955220,-.067227557,-.988271952,.091673456],[-.048060466,.155045435,.985077381,.057214994],[.101955272,-.067226909,-.988272071,.091673709]]}
};
function model(variant){
 const file=assetFile(variant);assert.ok(existsSync(file),`prepared source walking ${variant} asset must exist`);
 const bytes=readFileSync(file),length=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+length)),bin=bytes.subarray(28+length);
 return {g,read(index){const a=g.accessors[index],v=g.bufferViews[a.bufferView],width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],size={5121:1,5123:2,5125:4,5126:4}[a.componentType];return Array.from({length:a.count},(_,row)=>Array.from({length:width},(_,col)=>{const p=(v.byteOffset||0)+(a.byteOffset||0)+row*(v.byteStride||width*size)+col*size;return a.componentType===5126?bin.readFloatLE(p):size===1?bin[p]:size===2?bin.readUInt16LE(p):bin.readUInt32LE(p);}));}};
}
function quaternionDistance(a,b){const dot=a.reduce((sum,x,i)=>sum+x*b[i],0),norm=Math.hypot(...a)*Math.hypot(...b);return 2*Math.acos(Math.min(1,Math.abs(dot)/norm));}
function maxDelta(a,b){assert.equal(a.length,b.length);let difference=0;for(let i=0;i<a.length;i++)difference=Math.max(difference,Math.abs(a[i]-b[i]));return difference;}

test('source walking assets retain authored limb keys, native skin provenance and a real enclosing wool skirt',()=>{
 for(const variant of variants){
  const {g,read}=model(variant),meta=g.asset.extras.native_resident,skin=g.skins[0];
  assert.equal(meta.rig,'ikonia-mixamo');assert.equal(meta.sourceWalk,true);assert.equal(meta.provenance.sha256,sourceSha);assert.match(meta.provenance.author,/Iko Nia/);assert.match(meta.provenance.license,/CC-BY-4.0/);
  assert.equal(g.skins.length,1);assert.equal(meta.bones,skin.joints.length);assert.ok(g.nodes.some(n=>n.extras?.native_resident?.sourceWalk));assert.ok(meta.strideMetres>.25&&meta.strideMetres<4);
  assert.ok(g.animations.some(a=>a.name==='Idle_Loop'));const walk=g.animations.find(a=>a.name==='Walk_Loop');assert.ok(walk);
  for(const [name,expected]of Object.entries(sourceKeys[variant==='female'?'female':'male'])){
   const joint=skin.joints[meta.semanticMap[name]];assert.equal(g.nodes[joint].name,name);const channel=walk.channels.find(c=>c.target.node===joint&&c.target.path==='rotation');assert.ok(channel,`${variant} ${name} has authored rotation`);
   const keys=read(walk.samplers[channel.sampler].output);assert.ok(keys.length>=30);for(const [i,key]of [0,14,29].entries())assert.ok(quaternionDistance(keys[key],expected[i])<2e-6,`${variant} ${name} preserves supplied walk key ${key}`);
  }
  assert.ok(g.materials.every(m=>!/tie|pants|trouser|shoe|jacket/i.test(m.name)),'modern clothing components are excluded');
  const skirt=g.meshes.find(m=>/draped wool skirt/i.test(m.name));assert.ok(skirt,'the garment is a separate skinned draped surface');
  const primitive=skirt.primitives[0],positions=read(primitive.attributes.POSITION),weights=read(primitive.attributes.WEIGHTS_0),joints=read(primitive.attributes.JOINTS_0),xs=positions.map(p=>p[0]),ys=positions.map(p=>p[1]),zs=positions.map(p=>p[2]);
  assert.ok(read(primitive.indices).length/3>100,'folds retain substantial real geometry');assert.ok(Math.min(...xs)<-.10&&Math.max(...xs)>.10&&Math.min(...zs)<-.06&&Math.max(...zs)>.06,'wool encloses both sides, front and back');assert.ok(Math.max(...ys)-Math.min(...ys)>.15,'drapery covers the lower torso');
  for(let i=0;i<positions.length;i++){assert.ok(positions[i].every(Number.isFinite));assert.ok(joints[i].every(j=>j>=0&&j<skin.joints.length));assert.ok(Math.abs(weights[i].reduce((sum,w)=>sum+w,0)-1)<1e-5,'garment stays bound to this source rig');}
 }
});

const sandbox={console,setTimeout,clearTimeout,performance,self:{},TextDecoder,TextEncoder,URL,Blob};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);const B=sandbox.BABYLON;
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylonjs-loaders-9.31.0.min.js',import.meta.url),'utf8'),sandbox);
async function studio(check){
 const engine=new B.NullEngine(),scene=new B.Scene(engine),loader=B.SceneLoader.LoadAssetContainerAsync;let actors;
 B.SceneLoader.LoadAssetContainerAsync=(path,file)=>loader.call(B.SceneLoader,'',new Uint8Array(readFileSync(new URL('../'+path+file.split('?')[0],import.meta.url))),scene,undefined,'.glb');
 try{scene.activeCamera=new B.FreeCamera('camera',new B.Vector3(0,3,-8),scene);actors=await createGameActors(B,scene,{},{includeFauna:false});
  const state=createGame({start:'established'}),base=state.citizens.find(c=>c.age>=16);state.buildings=[];state.citizens=[{age:30,sex:'m'},{age:30,sex:'f'},{age:7,sex:'m'},{age:13,sex:'f'}].map((p,i)=>({...base,...p,id:7980+i,work:null,site:null,phase:'waiting',x:7+i*.45,y:10,cargo:{},buildCargo:{},calling:'auto',role:'production'}));
  await check({scene,actors,state});
 }finally{actors?.dispose();B.SceneLoader.LoadAssetContainerAsync=loader;scene.dispose();engine.dispose();}
}
function joint(root,name){const node=root.getChildTransformNodes().find(n=>n.name.endsWith('-'+name));assert.ok(node,`real ${name} joint`);return node;}
function armSurface(root){
 const points=[];
 for(const mesh of root.getChildMeshes().filter(m=>m.skeleton)){
  mesh.skeleton.prepare(true);const positions=mesh.getPositionData(true,true),weights=mesh.getVerticesData(B.VertexBuffer.MatricesWeightsKind),joints=mesh.getVerticesData(B.VertexBuffer.MatricesIndicesKind);if(!weights||!joints)continue;
  for(let i=0;i<positions.length/3;i++){let armWeight=0;for(let k=0;k<4;k++)if(/(?:^|-)(?:upperarm|lowerarm|hand)_[lr]$/.test(mesh.skeleton.bones[Math.round(joints[i*4+k])]?.name||''))armWeight+=weights[i*4+k];if(armWeight>.65)points.push(...positions.slice(i*3,i*3+3));}
 }
 assert.ok(points.length>60,'measure actual vertices weighted to the native arms');return points;
}
function geometry(root){return root.getChildMeshes().filter(m=>m.skeleton).map(m=>{m.skeleton.prepare(true);const p=Array.from(m.getPositionData(true,true));assert.ok(p.every(Number.isFinite));for(let i=0;i<p.length;i+=3)assert.ok(Math.abs(p[i])<1.5&&p[i+1]>-.15&&p[i+1]<2.3&&Math.abs(p[i+2])<1.5,'actual deformed skin remains in figure bounds');return p;});}

test('free source walk arms and their deformed surface remain authored after the runtime pose observer',async()=>studio(({scene,actors,state})=>{
 // The first view update establishes route positions; only subsequent movement
 // starts Walk_Loop, since spawning a resident is not a travelled distance.
 actors.update(state,.05);scene.render();
 const firstSurface=new Map();let largestMotion=0;
 for(let frame=0;frame<8;frame++){
  for(const c of state.citizens){c.phase='toStore';c.walking=true;c.y+=.012;}const before=JSON.stringify(state);actors.update(state,.05);scene.render();assert.equal(JSON.stringify(state),before);
  for(const [i,c]of state.citizens.entries()){
   const root=actors.rootFor({citizenId:c.id});assert.equal(root.metadata.sourceWalk,true,'default residents use the supplied walking source');assert.equal(root.metadata.residentVariant,variants[i]);assert.equal(root.metadata.citizenId,c.id);
   const group=scene.animationGroups.find(g=>g.name.includes(`citizen-${c.id}-`)&&g.name.endsWith('Walk_Loop'));assert.ok(group);group.goToFrame(group.animatables[0].masterFrame);
   const names=['upperarm_l','lowerarm_l','upperarm_r','lowerarm_r'],authored=names.map(name=>joint(root,name).rotationQuaternion.asArray()),skinBefore=armSurface(root);
   scene.render();for(const [index,name]of names.entries())assert.ok(quaternionDistance(joint(root,name).rotationQuaternion.asArray(),authored[index])<2e-6,`${variants[i]} ${name}: calm IK must not replace the supplied walk`);
   const skinAfter=armSurface(root);assert.ok(maxDelta(skinBefore,skinAfter)<1e-5,'pose observer preserves the authored arm surface');if(!firstSurface.has(c.id))firstSurface.set(c.id,skinAfter);else largestMotion=Math.max(largestMotion,maxDelta(firstSurface.get(c.id),skinAfter));
  }
 }
 assert.ok(largestMotion>.02,'the actual supplied arm skin visibly moves through the walk');
}));

test('source rigs carry loads, cycle work, preserve saved IDs and cargo, and freeze their actual skin on pause',async()=>studio(({scene,actors,state})=>{
 for(const c of state.citizens){c.phase='toStore';c.cargo={wood:3};}const before=JSON.stringify(state);actors.update(state,.05);scene.render();assert.equal(JSON.stringify(state),before);
 for(const [i,c]of state.citizens.entries()){
  const root=actors.rootFor({citizenId:c.id}),spec=model(variants[i]).g;assert.equal(root.metadata.sourceWalk,true);assert.equal(root.metadata.citizenId,c.id);assert.ok(root.getChildMeshes().some(m=>m.skeleton?.bones.length===spec.skins[0].joints.length),'actual source bones are retained');assert.ok(root.getChildMeshes().some(m=>m.name.includes('cargo')));geometry(root);
  if(c.age>=16){const inverse=root.computeWorldMatrix(true).clone().invert();for(const [side,x]of [['l',-.21],['r',.21]]){const hand=joint(root,'hand_'+side);hand.computeWorldMatrix(true);const point=B.Vector3.TransformCoordinates(hand.getAbsolutePosition(),inverse);assert.ok(B.Vector3.Distance(point,new B.Vector3(x,1.01,.34))<.12,`${c.sex}/${side}: palm reaches the actual load`);}}
 }
 const roots=state.citizens.map(c=>actors.rootFor({citizenId:c.id}));for(const c of state.citizens){c.cargo={};c.phase=c.age>=16?'working':'waiting';c.walking=false;}actors.update(state,.1);scene.render();const workBefore=armSurface(roots[0]);
 for(let frame=0;frame<4;frame++){const snapshot=JSON.stringify(state);actors.update(state,.1,{speed:4});scene.render();assert.equal(JSON.stringify(state),snapshot);for(const root of roots)geometry(root);}
 assert.ok(maxDelta(workBefore,armSurface(roots[0]))>.01,'work bends the real supplied arm skin');
 const frozen=roots.map(geometry),saved=JSON.stringify(state);actors.update(state,.1,{paused:true,speed:4});for(let frame=0;frame<6;frame++)scene.render();assert.equal(JSON.stringify(state),saved);assert.deepEqual(roots.map(geometry),frozen,'pause freezes the actual skinned body and clothing');
 for(const [i,c]of state.citizens.entries())assert.equal(actors.rootFor({citizenId:c.id}),roots[i],'work and cargo never replace a saved identity');
}));
