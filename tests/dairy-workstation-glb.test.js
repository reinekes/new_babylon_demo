import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGame} from '../engine.js';
import {generateStreets} from '../city-life.js';
import {createGameActors,actorViewCitizens,residentViewPositions,residentMotion} from '../game3d/actors.js';
import {surfaceElevation} from '../district3d/terrain.js';
import {workstationHands} from '../game3d/workstations.js';

const sandbox={exports:{},module:{exports:{}},console,setTimeout,clearTimeout,performance,window:{addEventListener(){},removeEventListener(){}},navigator:{userAgent:'node'}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.exports.NullEngine?sandbox.exports:sandbox.module.exports;sandbox.BABYLON=B;sandbox.exports=undefined;sandbox.module=undefined;sandbox.TextDecoder=TextDecoder;sandbox.TextEncoder=TextEncoder;sandbox.URL=URL;sandbox.Blob=Blob;
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylonjs-loaders-9.31.0.min.js',import.meta.url),'utf8'),sandbox);

test('actual supplied resident palms can reach the low milking contact through every rotation',async t=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),loader=B.SceneLoader.LoadAssetContainerAsync;let actors;
 B.SceneLoader.LoadAssetContainerAsync=async(path,file)=>loader.call(B.SceneLoader,'',new Uint8Array(readFileSync(new URL('../'+path+file.split('?')[0],import.meta.url))),scene,undefined,'.glb');
 try{
  scene.activeCamera=new B.FreeCamera('camera',new B.Vector3(0,5,-10),scene);actors=await createGameActors(B,scene,{},{includeFauna:false});const state=createGame({start:'established'}),base=state.citizens.find(c=>c.age>=16);state.simTime=4;let ticks=0,maxError=0,worst;
  const step=()=>{actors.update(state,1/60);scene.render();ticks++;};
  const joints=(root,side)=>['thigh','calf','foot'].map(name=>root.getChildTransformNodes().find(n=>n.name.endsWith(`-${name}_${side}`)));
  const localPoint=(root,node)=>{node.computeWorldMatrix(true);return B.Vector3.TransformCoordinates(node.getAbsolutePosition(),root.computeWorldMatrix(true).clone().invert());};
  for(const sex of ['m','f'])for(const rotation of [0,1,2,3]){
   const b={type:'cowshed',x:6,y:10,level:1,rotation,dairy:{cows:3,calves:2,reed:3,water:12,elapsed:0}};state.buildings=[b];const port=generateStreets(state.buildings,state).ports[0];
   state.citizens=[1,2].map(id=>({...base,id:9900+id,sex,age:30,phase:'waiting',x:port.x,y:port.y,work:null,cargo:{},buildCargo:{},guardPost:null,site:null}));step();
   const standing=new Map(state.citizens.map(c=>{const root=actors.rootFor({citizenId:c.id}),pelvis=root.getChildTransformNodes().find(n=>n.name.endsWith('-pelvis'));return [c.id,{pelvis:localPoint(root,pelvis),legs:Object.fromEntries(['l','r'].map(side=>{const chain=joints(root,side);return [side,{foot:localPoint(root,chain[2]),translations:chain.map(n=>n.position.asArray()),scales:chain.map(n=>n.scaling.asArray())}];}))}];}));
   for(const c of state.citizens){c.phase='working';c.work='6,10';}for(let n=0;n<12;n++)step();
   const positions=residentViewPositions(state,actorViewCitizens(state));
   for(const c of state.citizens){const root=actors.rootFor({citizenId:c.id}),contact=positions.get(c.id).contact;assert.ok(contact,`contact ${sex}/${rotation}`);
    const pelvis=root.getChildTransformNodes().find(n=>n.name.endsWith('-pelvis'));assert.ok(localPoint(root,pelvis).y<standing.get(c.id).pelvis.y-.3,'pelvis sits lower on the stool');assert.ok(root.getChildTransformNodes().find(n=>n.name.endsWith('-milking-seat')).isEnabled());
    for(const side of ['l','r']){const hand=root.getChildTransformNodes().find(n=>n.name.endsWith(`-hand_${side}`));hand.computeWorldMatrix(true);const point=hand.getAbsolutePosition(),motion=residentMotion(c.id),time=ticks/60*motion.gait+motion.phase,expected=workstationHands(contact,time)[side==='l'?'left':'right'],target=new B.Vector3(expected.x*6,surfaceElevation(expected.x,expected.y,state)+expected.height,expected.y*6),error=B.Vector3.Distance(point,target);if(error>maxError){maxError=error;worst={sex,rotation,side,error,palm:point.asArray(),target:target.asArray()};}
     const chain=joints(root,side),baseline=standing.get(c.id).legs[side];assert.deepEqual(chain.map(n=>n.position.asArray()),baseline.translations,'native leg segment translations are not lengthened');assert.deepEqual(chain.map(n=>n.scaling.asArray()),baseline.scales,'native legs are not scaled');assert.ok(B.Vector3.Distance(localPoint(root,chain[2]),baseline.foot)<.035,`bent legs retain their planted foot points: ${JSON.stringify({sex,rotation,side,actual:localPoint(root,chain[2]).asArray(),expected:baseline.foot.asArray(),distance:B.Vector3.Distance(localPoint(root,chain[2]),baseline.foot)})}`);
    }
   }
   const saved=JSON.stringify(state),pose=()=>state.citizens.flatMap(c=>{const root=actors.rootFor({citizenId:c.id});return root.getChildTransformNodes().filter(n=>/pelvis|thigh_[lr]$|calf_[lr]$|foot_[lr]$|hand_[lr]$/.test(n.name)).map(n=>[n.name,n.position.asArray(),n.rotationQuaternion?.asArray()]);}),frozen=pose();for(let n=0;n<12;n++){actors.update(state,.1,{paused:true,speed:4});scene.render();}const after=pose(),drift=[];for(let i=0;i<after.length;i++)for(const j of [1,2])for(let k=0;k<(after[i][j]?.length||0);k++){const delta=Math.abs(after[i][j][k]-frozen[i][j][k]);if(delta)drift.push({name:after[i][0],component:j,index:k,delta});}assert.deepEqual(drift,[],`paused seated hips, bent knees and palms stay exact: ${JSON.stringify(drift)}`);assert.equal(JSON.stringify(state),saved,'seating never mutates the citizens or their route state');
   for(const c of state.citizens){c.phase='waiting';c.work=null;}step();step();for(const c of state.citizens){const root=actors.rootFor({citizenId:c.id}),pelvis=root.getChildTransformNodes().find(n=>n.name.endsWith('-pelvis'));assert.ok(B.Vector3.Distance(localPoint(root,pelvis),standing.get(c.id).pelvis)<.001,`leaving the dairy restores the source standing hips: ${JSON.stringify({sex,rotation,actual:localPoint(root,pelvis).asArray(),expected:standing.get(c.id).pelvis.asArray(),clip:root.metadata})}`);assert.equal(root.getChildTransformNodes().find(n=>n.name.endsWith('-milking-seat')).isEnabled(),false);}
  }
  assert.ok(maxError<.05,`Actual palm misses its milking contact: ${JSON.stringify(worst)}`);
  t.diagnostic(`Worst actual native milking palm error: ${maxError.toFixed(6)}m; both sexes, four rotations, two workers.`);
 }finally{actors?.dispose();B.SceneLoader.LoadAssetContainerAsync=loader;scene.dispose();engine.dispose();}
});
