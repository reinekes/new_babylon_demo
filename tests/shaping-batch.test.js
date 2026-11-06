import assert from 'node:assert/strict';
import test from 'node:test';
import {createNewCity} from '../new-game.js';
import {decode,encode} from '../engine.js';
import {createShapingBatch,groundShapingBatch,shapingBatchQuote} from '../shaping-batch.js';

test('a single batch keeps its identity and material after losing its yard',()=>{
 const s=createNewCity({mode:'awakening',seed:1});
 const yard={type:'brickyard',x:7,y:9,level:1};
 s.buildings.push(yard);
 const connected=()=>true;
 assert.ok(shapingBatchQuote(s,yard,{connected}).ok);
 const clay=s.resources.clay,reed=s.resources.reed;
 const result=createShapingBatch(s,yard,{connected});
 assert.ok(result.ok);
 const batch=s.shapingBatches.rows[0];
 assert.deepEqual(batch.remaining,{clay:60,reed:40});
 assert.equal(s.resources.clay,clay);assert.equal(s.resources.reed,reed);
 assert.equal(shapingBatchQuote(s,yard,{connected}).ok,false);
 groundShapingBatch(s,yard);
 s.buildings=s.buildings.filter(b=>b!==yard);
 const raw=encode(s),saved=decode(raw);
 assert.ok(saved);assert.equal(encode(saved),raw);
 assert.deepEqual(saved.shapingBatches.rows[0],{...batch,grounded:true});
 const corrupt=JSON.parse(raw);corrupt.shapingBatches.rows[0].remaining.clay=61;
 assert.equal(decode(JSON.stringify(corrupt)),null);
});

test('partial warehouse acceptance and recovery conserve each material',async()=>{
 const {loadShapingBatch,deliverShapingLoad,returnShapingLoad,validateShapingBatches}=await import('../shaping-batch.js');
 const s=createNewCity({mode:'awakening',seed:1}),carrier=s.citizens[0],store=s.buildings[0];
 const yard={type:'brickyard',x:7,y:9,level:1};
 s.buildings.push(yard);
 assert.equal(shapingBatchQuote(s,yard,{connected:()=>false}).ok,false);
 const {batch}=createShapingBatch(s,yard,{connected:()=>true});
 assert.equal(loadShapingBatch(s,carrier,batch.id,'clay',40),12);
 const key=`${store.x},${store.y}`;
 s.resources.clay+=197-store.stock.clay;
 store.stock.clay=197;
 assert.equal(deliverShapingLoad(s,carrier,key),3);
 assert.equal(carrier.cargo.clay,9);
 groundShapingBatch(s,yard);
 assert.equal(returnShapingLoad(s,carrier),true);
 assert.equal(returnShapingLoad(s,carrier),false);
 assert.deepEqual(batch.remaining,{clay:57,reed:40});
 assert.deepEqual(batch.delivered,{clay:3,reed:0});
 assert.ok(validateShapingBatches(s));
});
