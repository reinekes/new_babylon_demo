import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {BUILDINGS,isResidence} from '../definitions.js';
import {createGame} from '../engine.js';
import {strictScenario} from '../scenario-profiles.js';
import {applyWorkshopArchitecture} from '../game3d/workshop-architecture.js';

const context={console,setTimeout,clearTimeout,performance,self:{}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),context);
const B=context.BABYLON;

test('each fixed nonresidential template has identifiable equipment, finite geometry and scene-shared finishes',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),root=new B.TransformNode('template',scene);
 const state=createGame({seed:137,start:'established',scenario:strictScenario()});
 const finishes=new Map(),signatures=new Set();
 // These three infrastructure models are rebuilt by the field/bridge/canal generators.
 const types=Object.keys(BUILDINGS).filter(type=>!isResidence({type})&&!['field','bridge','canal'].includes(type));
 const before=JSON.stringify(state);
 try{
  for(const type of types){
   const b={type,level:1,x:8,y:9},saved=structuredClone(b),parts=[];
   applyWorkshopArchitecture(B,scene,b,state,{},parts,root);
   assert.deepEqual(b,saved);
   assert.ok(parts.length>0&&parts.length<=5,type+' equipment draws');
   const fingerprint=createHash('sha256');
   for(const mesh of parts){
    assert.equal(mesh.metadata.workshopDetail,type);
    const recorded=finishes.get(mesh.material.name);
    if(recorded)assert.equal(mesh.material,recorded);
    else finishes.set(mesh.material.name,mesh.material);
    mesh.computeWorldMatrix(true);
    const p=mesh.getVerticesData(B.VertexBuffer.PositionKind);
    assert.ok(p.length&&p.every(Number.isFinite));
    assert.ok(mesh.getVerticesData(B.VertexBuffer.NormalKind).every(Number.isFinite));
    fingerprint.update(Buffer.from(new Float32Array(p).buffer));
    fingerprint.update(JSON.stringify(mesh.getWorldMatrix().asArray()));
   }
   const hash=fingerprint.digest('hex');assert.ok(!signatures.has(hash),type+' duplicates an installation');signatures.add(hash);
   for(const part of parts)part.dispose();
  }
  assert.ok(finishes.size<=12);
  for(const type of ['house','bakery']){
   const parts=[];applyWorkshopArchitecture(B,scene,{type,construction:{kind:'new'}},state,{},parts,root);assert.equal(parts.length,0);
  }
  assert.equal(JSON.stringify(state),before);
 }finally{scene.dispose();engine.dispose();}
});
