import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {usesHistoricalMan} from '../game3d/historical-resident.js';
import {createGameActors,actorViewCitizens,residentViewPositions,residentMotion} from '../game3d/actors.js';
import {createGame} from '../engine.js';
import {generateStreets} from '../city-life.js';
import {workstationHands} from '../game3d/workstations.js';
import {surfaceElevation} from '../district3d/terrain.js';
const file=new URL('../assets/art-courtyard/models/historical-man.glb',import.meta.url),raw=readFileSync(file),n=raw.readUInt32LE(12),g=JSON.parse(raw.subarray(20,20+n)),bin=raw.subarray(28+n);
const report=JSON.parse(readFileSync(new URL('../assets/art-courtyard/historical-man-report.json',import.meta.url)));
function data(i){const a=g.accessors[i],v=g.bufferViews[a.bufferView],w={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],size=a.componentType===5123?2:4;return Array.from({length:a.count},(_,k)=>Array.from({length:w},(_,j)=>{const offset=(v.byteOffset||0)+(a.byteOffset||0)+(k*w+j)*size;return a.componentType===5126?bin.readFloatLE(offset):bin.readUInt16LE(offset);}));}
test('historical skin preserves both credits, actual robe UVs, aliases and separate truthful animation semantics',()=>{
 assert.equal(createHash('sha256').update(raw).digest('hex'),report.sha256);assert.ok(raw.length<.55*report.source_bytes);assert.equal(report.triangles,35999);
 const meta=g.asset.extras.native_resident;assert.match(g.asset.extras.author,/ASYKIN/);assert.match(meta.walk.source.author,/Iko Nia/);assert.match(g.asset.extras.license,/CC-BY-4.0/);assert.equal(meta.walk.sourceQuaternionsPreserved,false);
 assert.equal(g.skins[0].joints.length,34);for(const name of ['pelvis','spine_01','head','upperarm_l','lowerarm_l','hand_l','thigh_l','calf_l','foot_l','toe_l'])assert.ok(g.nodes.some(n=>n.name===name));
 assert.deepEqual(g.animations.map(a=>a.name),['Walk_Loop','Idle_Loop','Source_Talking']);assert.ok(meta.strideMetres>1&&meta.strideMetres<2);
 const primitive=g.meshes[0].primitives[0],weights=data(primitive.attributes.WEIGHTS_0),joints=data(primitive.attributes.JOINTS_0),uv=data(primitive.attributes.TEXCOORD_0),positions=data(primitive.attributes.POSITION);
 assert.ok(uv.some(p=>p[0]>.9)&&uv.some(p=>p[0]<.1),'inherited atlas still spans face/body/robe charts');assert.ok(positions.some(p=>p[1]<.15)&&positions.some(p=>p[1]>1.65));
 for(let i=0;i<weights.length;i++){assert.ok(Math.abs(weights[i].reduce((a,b)=>a+b)-1)<1e-5);assert.ok(joints[i].every(j=>j>=0&&j<34));}
 assert.ok(meta.simplification.max_vertex_displacement_metres<.014);assert.ok(g.materials[0].pbrMetallicRoughness.baseColorTexture);
});
test('only inspired actual adult male temple/music specialists opt into the heavier variant',()=>{
 const c={id:17,age:35,sex:'m',role:'production',calling:'priest'},before=structuredClone(c);assert.equal(usesHistoricalMan(c),true);assert.deepEqual(c,before);
 assert.equal(usesHistoricalMan({...c,calling:'musician'}),true);
 for(const patch of [{id:null},{age:13},{sex:'f'},{role:'carrier'},{calling:'auto'},{calling:'potter'},{pendingRole:'production'}])assert.equal(usesHistoricalMan({...c,...patch}),false,JSON.stringify(patch));
});

const sandbox={console,setTimeout,clearTimeout,performance,self:{},TextDecoder,TextEncoder,URL,Blob};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);const B=sandbox.BABYLON;
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylonjs-loaders-9.31.0.min.js',import.meta.url),'utf8'),sandbox);
// NullEngine cannot decode JPEGs. Only material image references are omitted;
// exact saved accessors, weights, skeleton and animation bytes load unchanged.
function headlessBytes(){const copy=structuredClone(g);delete copy.materials[0].pbrMetallicRoughness.baseColorTexture;let js=Buffer.from(JSON.stringify(copy));js=Buffer.concat([js,Buffer.alloc((4-js.length%4)%4,32)]);const out=Buffer.alloc(28+js.length+bin.length);out.write('glTF');out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(js.length,12);out.write('JSON',16);js.copy(out,20);out.writeUInt32LE(bin.length,20+js.length);out.write('BIN\0',24+js.length);bin.copy(out,28+js.length);return new Uint8Array(out);}
test('actual Babylon skin walks with low ankles, grounded soles, stable limb lengths and a closed loop',async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine);let source;
 try{
  source=await B.SceneLoader.LoadAssetContainerAsync('',headlessBytes(),scene,undefined,'.glb');const copy=source.instantiateModelsToScene(n=>'new-'+n,false,{doNotInstantiate:true}),nodes=copy.rootNodes.flatMap(n=>n.getChildTransformNodes()),mesh=copy.rootNodes.flatMap(n=>n.getChildMeshes()).find(m=>m.skeleton),walk=copy.animationGroups.find(a=>a.name.endsWith('Walk_Loop'));
  assert.ok(mesh);assert.equal(mesh.skeleton.bones.length,34);walk.start(true,0,walk.from,walk.to);let first,last,motion=0,baseLengths;
  for(const phase of [0,.1,.2,.3,.4,.5,.6,.7,.8,.9,1]){
   walk.goToFrame(walk.from+(walk.to-walk.from)*phase);scene.incrementRenderId();mesh.skeleton.prepare(true);const p=Array.from(mesh.getPositionData(true,true));assert.ok(p.every(Number.isFinite));
   let minY=Infinity,maxY=-Infinity;for(let i=0;i<p.length;i+=3){minY=Math.min(minY,p[i+1]);maxY=Math.max(maxY,p[i+1]);assert.ok(Math.abs(p[i])<1&&Math.abs(p[i+2])<1.1);}
   assert.ok(minY>-.004&&minY<.004,`actual sole grounded at ${phase}: ${minY}`);assert.ok(maxY>1.5&&maxY<1.9);
   const lengths=[];for(const side of ['l','r']){const joints=['thigh','calf','foot'].map(k=>nodes.find(n=>n.name==='new-'+k+'_'+side));for(const node of joints)node.computeWorldMatrix(true);const positions=joints.map(n=>n.getAbsolutePosition());lengths.push(B.Vector3.Distance(positions[0],positions[1]),B.Vector3.Distance(positions[1],positions[2]));assert.ok(positions[2].y<.26,'ankles preserve the real low source trajectory');}
   if(!baseLengths)baseLengths=lengths;else for(let i=0;i<4;i++)assert.ok(Math.abs(lengths[i]-baseLengths[i])<1e-5,'retargeting never stretches a native leg');
   if(!first)first=p;else motion=Math.max(motion,...p.map((v,i)=>Math.abs(v-first[i])));last=p;
  }
  assert.ok(motion>.2,'actual robe, feet and arms deform through a walk');assert.ok(Math.max(...first.map((v,i)=>Math.abs(v-last[i])))<1e-5,'loop closes without a seam');source.dispose();source=null;
 }finally{source?.dispose();scene.dispose();engine.dispose();}
});
test('real specialist loads lazily, retains saved identity/cargo and reaches music stones through every building rotation',async t=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),loader=B.SceneLoader.LoadAssetContainerAsync,loaded=[];let actors;
 B.SceneLoader.LoadAssetContainerAsync=(path,file)=>{loaded.push(file);return loader.call(B.SceneLoader,'',file.startsWith('historical-man')?headlessBytes():new Uint8Array(readFileSync(new URL('../'+path+file.split('?')[0],import.meta.url))),scene,undefined,'.glb');};
 try{
  scene.activeCamera=new B.FreeCamera('camera',new B.Vector3(0,5,-10),scene);actors=await createGameActors(B,scene,{},{includeFauna:false});
  const state=createGame({start:'established'}),base=state.citizens.find(c=>c.age>=16);state.simTime=4;state.buildings=[];state.citizens=[{...base,id:17017,age:35,sex:'m',role:'production',calling:'auto',pendingRole:null,work:null,workplace:null,phase:'waiting',x:6,y:10,cargo:{},buildCargo:{},guardPost:null,site:null}];
  let ticks=0;const step=(paused=false)=>{actors.update(state,1/60,{paused});scene.render();if(!paused)ticks++;};step();assert.ok(!loaded.some(f=>f.startsWith('historical-man')));
  state.citizens[0].calling='priest';const saved=JSON.stringify(state);step();const plain=actors.rootFor({citizenId:17017});await actors.residentDetailsReady();step();const root=actors.rootFor({citizenId:17017});assert.equal(JSON.stringify(state),saved);assert.ok(plain.isDisposed());assert.equal(root.metadata.citizenId,17017);assert.equal(root.metadata.residentVariant,'historical-man');assert.equal(root.metadata.nativeResident,true);assert.equal(loaded.filter(f=>f.startsWith('historical-man')).length,1);
  assert.ok(root.getChildMeshes().some(m=>m.metadata?.profession==='priest'),'real fitted profession shell follows the new skin too');
  state.citizens[0].cargo={wood:3};state.citizens[0].phase='toStore';state.citizens[0].walking=true;state.citizens[0].y+=.01;const cargoState=JSON.stringify(state);step();assert.equal(JSON.stringify(state),cargoState);assert.ok(root.getChildMeshes().some(m=>m.name==='cargo-bundle'));assert.ok(scene.animationGroups.some(g=>g.name.includes('citizen-17017')&&g.name.endsWith('Walk_Loop')&&g.isStarted));
  let maxError=0;
  for(const rotation of [0,1,2,3]){
   const b={type:'musicHouse',x:6,y:10,level:1,rotation},port=generateStreets([b],state).ports[0],c=state.citizens[0];state.buildings=[b];Object.assign(c,{calling:'musician',workplace:'6,10',work:'6,10',phase:'working',walking:false,x:port.x,y:port.y,cargo:{}});
   for(let k=0;k<18;k++)step();const contact=residentViewPositions(state,actorViewCitizens(state)).get(c.id).contact;assert.ok(contact);
   for(const side of ['l','r']){const hand=root.getChildTransformNodes().find(n=>n.name.endsWith('-hand_'+side));hand.computeWorldMatrix(true);const motion=residentMotion(c.id),target=workstationHands(contact,ticks/60*motion.gait+motion.phase)[side==='l'?'left':'right'],expected=new B.Vector3(target.x*6,surfaceElevation(target.x,target.y,state)+target.height,target.y*6);maxError=Math.max(maxError,B.Vector3.Distance(hand.getAbsolutePosition(),expected));assert.ok(root.getChildTransformNodes().find(n=>n.name.endsWith('-music-mallet-'+side)).isEnabled());}
   const pose=()=>root.getChildTransformNodes().filter(n=>/pelvis|hand_[lr]$|thigh_[lr]$|calf_[lr]$/.test(n.name)).map(n=>[n.position.asArray(),n.rotationQuaternion?.asArray()]),frozen=pose();for(let k=0;k<4;k++)step(true);assert.deepEqual(pose(),frozen);
  }
  assert.ok(maxError<.07,`new supplied man's palms reach the mallets: ${maxError}`);t.diagnostic(`Historical man music palm error ${maxError.toFixed(5)}m; original citizen ID preserved.`);
 }finally{actors?.dispose();B.SceneLoader.LoadAssetContainerAsync=loader;scene.dispose();engine.dispose();}
});
