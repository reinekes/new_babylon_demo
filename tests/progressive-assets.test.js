import test from 'node:test';import assert from 'node:assert/strict';
import {createBackgroundQueue,createLazyFeature,loadModel} from '../game3d/asset-loading.js';
const turn=()=>new Promise(r=>setTimeout(r,0));
test('background queue does not block startup, caps concurrent loads, and retains light layer on failure',async()=>{const q=createBackgroundQueue(2),pending=[],started=[],completed=[];for(let i=0;i<4;i++)q.add(()=>new Promise((resolve,reject)=>{started.push(i);pending.push(i===2?()=>reject(Error('offline')):()=>resolve(i));}),v=>completed.push(v));assert.equal(started.length,0);await turn();assert.equal(started.length,2);pending.shift()();await turn();assert.equal(started.length,3);pending.shift()();await turn();assert.equal(started.length,4);for(const finish of pending)finish();await q.idle();assert.deepEqual(completed,[0,1,3]);assert.equal(q.errors.length,1);q.dispose();});
test('disposed background replacement releases late assets instead of swapping them into a dead city',async()=>{const q=createBackgroundQueue(1);let finish,swaps=0,disposed=0;q.add(()=>new Promise(r=>finish=r),()=>swaps++);await turn();q.dispose();finish({dispose(){disposed++;}});await q.idle();assert.equal(swaps,0);assert.equal(disposed,1);});
test('caravan-like optional feature loads only on demand and replays latest state without mutating it',async()=>{let loads=0,resolve,cleared=0,shown=[];const f=createLazyFeature(()=>{loads++;return new Promise(r=>resolve=r);},{required:(_s,c)=>!!c});const s={simTime:1};f.update(s,null,1);assert.equal(loads,0);f.update(s,{id:1},2);await turn();assert.equal(loads,1);f.update(s,{id:2},3);resolve({update(...args){shown.push(args);},dispose(){cleared++;}});await turn();assert.equal(shown[0][1].id,2);assert.deepEqual(s,{simTime:1});f.dispose();assert.equal(cleared,1);});
test('queued miracle is cleared if a new game starts before its assets finish',async()=>{let resolve,shows=0;const f=createLazyFeature(()=>new Promise(r=>resolve=r));f.show({x:1,y:2},2);f.clear();await turn();resolve({show(){shows++;},update(){},dispose(){}});await turn();assert.equal(shows,0);f.dispose();});
test('a synchronous optional loader failure reaches fallback error handling without escaping the game update',async()=>{
 const errors=[],f=createLazyFeature(()=>{throw Error('decode failed');},{onError:error=>errors.push(error.message)});
 assert.doesNotThrow(()=>f.show({x:1,y:2},2));await f.ready;assert.deepEqual(errors,['decode failed']);assert.equal(f.meshes.length,0);f.dispose();
});
test('GLB semaphore caps active loads across independent layer requests and rejects queued work after scene disposal',async()=>{
 const scene={isDisposed:false},started=[],pending=[],B={SceneLoader:{LoadAssetContainerAsync(...args){started.push(args[1]);return new Promise(resolve=>pending.push(resolve));}}};
 const jobs=Array.from({length:8},(_,i)=>loadModel(B,scene,'models/',`test-${i}.glb`,scene));const settled=Promise.allSettled(jobs);
 await turn();assert.deepEqual(started,['test-0.glb','test-1.glb','test-2.glb']);pending.shift()({id:0});await turn();assert.equal(started.length,4);
 scene.isDisposed=true;for(const resolve of pending)resolve({id:1});const result=await settled;assert.equal(started.length,4);assert.equal(result.filter(r=>r.status==='fulfilled').length,4);assert.equal(result.filter(r=>r.status==='rejected').length,4);
 for(const r of result.filter(r=>r.status==='rejected'))assert.match(r.reason.message,/disposed/i);
});
