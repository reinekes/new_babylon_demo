import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGame} from '../engine.js';
import {createGameActors,actorViewCitizens} from '../game3d/actors.js';
import {residentViewPositions} from '../game3d/resident-motion.js';
import {generateStreets} from '../city-life.js';
const sandbox={exports:{},module:{exports:{}},console,setTimeout,clearTimeout,performance,window:{addEventListener(){},removeEventListener(){}},navigator:{userAgent:'node'},TextDecoder,TextEncoder,URL,Blob};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.exports.NullEngine?sandbox.exports:sandbox.module.exports;sandbox.BABYLON=B;sandbox.exports=undefined;sandbox.module=undefined;
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylonjs-loaders-9.31.0.min.js',import.meta.url),'utf8'),sandbox);
async function studio(check){const engine=new B.NullEngine(),scene=new B.Scene(engine),loader=B.SceneLoader.LoadAssetContainerAsync;let actors;B.SceneLoader.LoadAssetContainerAsync=async(path,file)=>loader.call(B.SceneLoader,'',new Uint8Array(readFileSync(new URL('../'+path+file.split('?')[0],import.meta.url))),scene,undefined,'.glb');try{scene.activeCamera=new B.FreeCamera('camera',new B.Vector3(0,3,-8),scene);actors=await createGameActors(B,scene,{},{includeFauna:false});await check({scene,actors});}finally{actors?.dispose();B.SceneLoader.LoadAssetContainerAsync=loader;scene.dispose();engine.dispose();}}
function joint(B,root,name){const node=root.getChildTransformNodes().find(n=>n.name.endsWith('-'+name));node.computeWorldMatrix(true);return B.Vector3.TransformCoordinates(node.getAbsolutePosition(),root.computeWorldMatrix(true).clone().invert());}
test('actual adult and child free arms stay beside the body with a short walking swing',async()=>studio(({scene,actors})=>{
 const state=createGame({start:'established'}),base=state.citizens.find(c=>c.age>=16);state.buildings=[];state.citizens=[{...base,id:9871,age:30,phase:'waiting',work:null,x:7,y:10,cargo:{},buildCargo:{}},{...base,id:9872,age:8,phase:'waiting',work:null,x:7.4,y:10,cargo:{},buildCargo:{}}];
 for(const mode of ['idle','walk'])for(let frame=0;frame<36;frame++){for(const c of state.citizens){c.walking=mode==='walk';c.phase=mode==='walk'?'toStore':'waiting';if(mode==='walk')c.y+=.007;}actors.update(state,.05);scene.render();for(const c of state.citizens){const root=actors.rootFor({citizenId:c.id});for(const side of ['l','r']){const p=joint(B,root,`hand_${side}`),shoulder=joint(B,root,`upperarm_${side}`);assert.ok(p.y<shoulder.y-.20,`${mode}/${c.age}/${side}: hand raised ${p.y}`);assert.ok(Math.abs(p.x)<.36,`${mode}/${c.age}/${side}: arm spread ${p.x}`);assert.ok(Math.abs(p.z)<.24,`${mode}/${c.age}/${side}: excessive swing ${p.z}`);}}}
}));
test('inspired specialists wear curved skinned upper cloth with open armholes',async()=>studio(({scene,actors})=>{
 const state=createGame({start:'established'}),base=state.citizens.find(c=>c.age>=16);state.citizens=[{...base,id:9881,age:30,phase:'waiting',role:'production',calling:'potter',work:null,x:7,y:10,cargo:{},buildCargo:{}}];state.buildings=[];actors.update(state,.05);scene.render();const root=actors.rootFor({citizenId:9881}),garment=root.getChildMeshes().find(m=>m.name.includes('profession-upper-wrap'));assert.ok(garment,'a real upper garment is visible');assert.equal(garment.skeleton.bones.length,41);assert.ok(garment.getTotalVertices()>100);const positions=garment.getVerticesData(B.VertexBuffer.PositionKind),depth=[];for(let i=0;i<positions.length;i+=3)depth.push(positions[i+2]);assert.ok(Math.max(...depth)-Math.min(...depth)>.16,'cloth curves around both sides of the torso');assert.ok(garment.getVerticesData(B.VertexBuffer.MatricesWeightsKind).some(w=>w>0),'cloth follows the actual torso bones');
 const prior=garment.getPositionData(true,true);actors.update(state,.05,{paused:true});scene.render();assert.deepEqual(Array.from(garment.getPositionData(true,true)),Array.from(prior));
}));
test('both production workers stand inside their production yard under every rotation',()=>{
 const state=createGame({start:'established'}),base=state.citizens.find(c=>c.age>=16);state.simTime=4;
 for(const type of ['pottery','brewery','weaver','tailor','brickyard','kiln'])for(let rotation=0;rotation<4;rotation++){const b={type,x:6,y:10,level:1,rotation,artisan:{stage:type==='brewery'?'brewing':'forming'},weaving:{wool:3},tailoring:{cloth:2},brickmaking:{clay:4,reed:2,water:2,wet:0,ready:0,time:0},firing:{brick:4,reed:3,hot:0,ready:0,time:0}};state.buildings=[b];const port=generateStreets(state.buildings,state).ports[0];state.citizens=[1,2].map(id=>({...base,id:9890+id,age:30,phase:'working',x:port.x,y:port.y,work:'6,10',cargo:{},buildCargo:{},site:null,guardPost:null}));const positions=residentViewPositions(state,actorViewCitizens(state));for(const p of positions.values()){assert.ok(p.contact,`${type}/${rotation} contact`);assert.ok(Math.abs(p.x-b.x)*6<2.62&&Math.abs(p.y-b.y)*6<2.62,`${type}/${rotation}: worker outside yard`);}}
});
