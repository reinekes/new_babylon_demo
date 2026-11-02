import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {createSaveLibrary,MAX_SAVE_BYTES,parseSaveFile} from '../save-library.js';
import {createGame,encode,decode} from '../engine.js';

const library=()=>createSaveLibrary({indexedDB:new IDBFactory()});
test('named snapshots keep complete cities, people and cargo independent from later changes',async()=>{
 const lib=library(),s=createGame(),raw=encode(s),a=await lib.create(raw,'Первый город'),b=await lib.create(raw,'Перед новой игрой',{kind:'archive'});
 s.citizens[0].name='Изменился';s.resources.faith=500;
 const entries=await lib.list();assert.equal(entries.length,2);assert.ok(entries.every(e=>!Object.hasOwn(e,'raw')));assert.equal(a.kind,'manual');assert.equal(b.kind,'archive');
 assert.equal((await lib.read(a.id)).raw,raw);assert.deepEqual(decode((await lib.read(a.id)).raw).citizens,decode(raw).citizens);
 await lib.rename(a.id,'После дождя');assert.equal((await lib.read(a.id)).name,'После дождя');assert.equal((await lib.read(a.id)).raw,raw);
 await lib.remove(b.id);assert.equal((await lib.list()).length,1);assert.equal(await lib.read(b.id),null);lib.close();
});
test('corrupt imports and unsupported saves never write records',async()=>{
 const lib=library();for(const raw of ['{','{}',JSON.stringify({version:999}),'{"__proto__":{}}'])await assert.rejects(lib.create(raw,'Плохой файл'));
 assert.equal((await lib.list()).length,0);assert.throws(()=>parseSaveFile(' '.repeat(MAX_SAVE_BYTES+1)));lib.close();
});
test('unavailable or aborted storage reports a failure, preserving earlier records',async()=>{
 const unavailable=createSaveLibrary({indexedDB:null});await assert.rejects(unavailable.list(),/хранилищ/i);
 const factory=new IDBFactory(),lib=createSaveLibrary({indexedDB:factory}),raw=encode(createGame());await lib.create(raw,'До ошибки');
 const db=await new Promise((resolve,reject)=>{const r=factory.open('new-babylon-save-library',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const original=db.constructor.prototype.transaction;db.constructor.prototype.transaction=function(...args){const tx=original.apply(this,args);if(args[1]==='readwrite')queueMicrotask(()=>tx.abort());return tx;};
 try{await assert.rejects(lib.create(raw,'Не сохранено'));assert.equal((await lib.list()).length,1);}finally{db.constructor.prototype.transaction=original;db.close();lib.close();}
});
test('file transfer accepts plain game JSON and upgrades it through the same decoder',()=>{
 const raw=encode(createGame()),result=parseSaveFile(raw);assert.equal(result.raw,raw);assert.equal(result.state.world.seed,73129);assert.ok(decode(result.raw));
});
