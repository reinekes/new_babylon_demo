import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createCraftVessel,createYardBrick,createGrindingStone} from '../game3d/yard-craft-meshes.js';

const context={console,setTimeout,clearTimeout,performance,self:{}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),context);
const B=context.BABYLON;
const scene=new B.Scene(new B.NullEngine());

function depthAt(mesh,point,direction){
 mesh.computeWorldMatrix(true);
 const hit=new B.Ray(new B.Vector3(...point),new B.Vector3(...direction).normalize(),4).intersectsMesh(mesh);
 assert.ok(hit.hit,'ray reached the model');
 return hit.distance;
}

test('turned vessels have a recessed floor and the pouring tube opens into the body',()=>{
 for(const kind of ['bowl','spouted','jar','fermenter']){
  const vessel=createCraftVessel(B,scene,kind);
  const depth=depthAt(vessel,[0,1.2,0],[0,-1,0]);
  assert.ok(depth>1.13 && depth<1.16,kind+' has a hollow centre');
  if(kind==='spouted'){
   // Through the tube along its axis: the first solid surface is the far wall.
   assert.ok(depthAt(vessel,[.829, .829,0],[-.75,-.66,0])>.6);
   const outward=vessel.getVerticesData('normal');
   const xyz=vessel.getVerticesData('position');
   const shoulder=[];
   for(let i=0;i<xyz.length;i+=3){
    if(xyz[i]>.68 && xyz[i]<.75 && xyz[i+2]>.08)shoulder.push(outward[i+2]);
   }
   assert.ok(shoulder.some(n=>n>.85),'sunlight reaches the outside of the tube');
  }
  vessel.dispose();
 }
});

test('fresh brick, fired brick and saddle quern retain their distinct working faces in one atlas',()=>{
 const raw=createYardBrick(B,scene,{seed:4});
 const fired=createYardBrick(B,scene,{fired:true,seed:4});
 const quern=createGrindingStone(B,scene);
 const mano=createGrindingStone(B,scene,true);
 assert.equal(raw.material,fired.material);
 assert.equal(raw.material,quern.material);
 assert.equal(quern.material,mano.material);
 const rise=m=>depthAt(m,[.125,.2,0],[0,-1,0])-depthAt(m,[0,.2,0],[0,-1,0]);
 assert.ok(rise(raw)>rise(fired),'drying face is more convex');
 assert.ok(depthAt(quern,[0,.4,0],[0,-1,0])-depthAt(quern,[.42,.4,0],[0,-1,0])>.055,'wear hollow in grinding bed');
 for(const mesh of [raw,fired,quern,mano])mesh.dispose();
});
