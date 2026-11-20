import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {PROFESSION_IDS} from '../professions.js';

const workspace=new URL('../',import.meta.url);
const evidence=JSON.parse(readFileSync(new URL('docs/benchmarks/2026-11-20-profession-actions.json',workspace),'utf8'));
const duties=['baker','cheesemaker','basketmaker','matmaker','joiner','coppersmith','guard','medicalStudent','canalworker','marketPorter','merchant'];

test('every registered calling and staffed duty has its own evidence',()=>{
 const covered=type=>evidence.roles.filter(r=>r.category===type).map(r=>r.id).sort();
 assert.deepEqual(covered('calling'),[...PROFESSION_IDS].sort());
 assert.deepEqual(covered('duty'),[...duties].sort());
 assert.equal(new Set(evidence.scenes.map(s=>s.id)).size,evidence.scenes.length);
});

for(const role of evidence.roles)test(role.name+' has visible motion and a simulation result',()=>{
 assert.ok(role.scenes.length>0);
 assert.ok(existsSync(new URL(role.test,workspace)));
 for(const id of role.scenes){
  const scene=evidence.scenes.find(s=>s.id===id);
  assert.equal(scene?.role,role.id);
  assert.ok(scene.actorId!==undefined&&scene.activity?.stage);
  const {entry,version,jsErrors,httpErrors,glError,visibleMeshes,samples,feetDisplacementM,palmDisplacementM}=scene.webgl;
  assert.deepEqual([entry,version,jsErrors,httpErrors,glError],['/index.html',2,[],[],0]);
  assert.ok(visibleMeshes>0&&samples>=10&&Math.max(feetDisplacementM,palmDisplacementM)>.001);
  assert.ok(Object.keys(scene.productionOrOutcome).length>0);
  assert.ok(existsSync(new URL(scene.sheet,workspace)));
 }
});

test('the livestock workers still arrive from the street before using their stations',()=>{
 for(const key of ['cowshed','sheepfold']){
  const proof=evidence.yardWalks[key];
  assert.equal(proof.simSpeed,4);
  assert.ok(proof.framesAtStation>20&&proof.framesAtStation<proof.framesVisible);
  assert.ok(proof.minDistanceToStationMetres<.1&&proof.rightPalmPathAtStationMetres>.05);
 }
});

test('both milking hands reach different teats on the rendered adult cow',()=>{
 const cow=evidence.milkingContact;
 assert.equal(cow.cowFile,'pasture-cow.glb');
 assert.ok(cow.udderInActiveMeshes&&cow.activeCowMeshes>=2&&cow.activeWorkerMeshes>0);
 assert.deepEqual([cow.glError,cow.errors,cow.http],[0,[],[]]);
 assert.ok(cow.frames.length>=12);
 for(const frame of cow.frames){
  assert.equal(frame.teats.length,4);
  assert.equal(new Set(frame.tipIndex).size,2);
  assert.ok(Math.max(...frame.distanceToNearestTip)<=.072);
  assert.ok(Math.max(...frame.distanceToUdderSurface)<=.056);
 }
 const walk=evidence.yardWalks.cowshed;
 assert.equal(walk.cowFrames,walk.framesAtStation);
 assert.ok(walk.cowFrames>20);
 const shot=evidence.scenes.find(scene=>scene.id==='cowshed').closeup;
 assert.ok(existsSync(new URL(shot,workspace)));
});
