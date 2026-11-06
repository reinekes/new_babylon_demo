import assert from 'node:assert/strict';
import test from 'node:test';
import {createNewCity} from '../new-game.js';
import {encode,decode,miracle} from '../engine.js';
import {advanceShapingModel} from '../shaping-model.js';

test('a qualified master spends clay once and opens the gift after completing the model',()=>{
 const s=createNewCity({mode:'awakening',seed:1}),master=s.citizens[0];
 Object.assign(s.creatorMaterials,{clay:30,reed:20,projects:['1,1','2,2'],inspired:['clayworker','reedcutter']});
 s.shapingProjects.used=['brickyard','waterpoint','house','clay','reed'].map((type,i)=>({id:i+1,builders:[master.id],type,x:20+i,y:20,time:0}));
 s.shapingProjects.nextId=6;
 Object.assign(master,{role:'builder',calling:'builder'});
 const clay=s.resources.clay,reed=s.resources.reed;
 assert.match(miracle(s,'shaping').reason,/макет/i);
 assert.deepEqual(advanceShapingModel(s,2),[master.id]);
 assert.equal(s.resources.clay,clay-2);
 assert.equal(s.shapingModel.work,2);
 assert.equal(miracle(s,'shaping').ok,false);
 const raw=encode(s),loaded=decode(raw);
 assert.ok(loaded);assert.equal(encode(loaded),raw);
 advanceShapingModel(loaded,20);
 assert.ok(loaded.shapingModel.completedAt!==undefined);
 assert.equal(loaded.resources.clay,clay-2);
 assert.equal(loaded.resources.reed,reed);
});

test('two residents can finish the work of a dead master without spending the clay twice',()=>{
 const s=createNewCity({mode:'awakening',seed:1}),[master,first,second]=s.citizens;
 Object.assign(s.creatorMaterials,{clay:30,reed:20,projects:['1,1','2,2'],inspired:['clayworker','reedcutter']});
 s.shapingProjects.used=['brickyard','waterpoint','house','clay','reed'].map((type,i)=>({id:i+1,builders:[master.id],type,x:20+i,y:20,time:0}));
 s.shapingProjects.nextId=6;
 const clay=s.resources.clay,reed=s.resources.reed;
 advanceShapingModel(s,2);
 s.citizens=s.citizens.filter(c=>c!==master);
 first.home=second.home=master.home;
 assert.deepEqual(advanceShapingModel(s,2),[first.id,second.id]);
 advanceShapingModel(s,2);
 assert.deepEqual(s.shapingModel.workers,[first.id,second.id]);
 assert.equal(s.resources.clay,clay-2);
 assert.equal(s.resources.reed,reed-1);
});
