import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeCatFishing,reconcileCatFishing,recordFishingCatch,pickupFishingOutput,acceptFishingCargo,discardFishingCargo,discardFishingOutput,validateCatFishing,moveFishingCargoToOutput} from '../cat-fishing-ledger.js';
const fixture=()=>{const b={type:'fishing',x:1,y:1,workshopStock:{output:{food:0}}},c={id:0,age:25,work:'1,1',cargo:{}},porter={id:1,age:20,cargo:{}},s={scenario:{miracles:'awakening-c01-v1'},godhood:{mode:'awakening'},demography:{nextId:3},buildings:[b],citizens:[c,porter]};initializeCatFishing(s);return {s,b,c,porter};};
function catchFish(f,amount=5){const before=f.b.workshopStock.output.food;f.b.workshopStock.output.food+=amount;recordFishingCatch(f.s,f.b,f.c,amount,{inBuffer:true,before});}
function pickup(f,amount){const before=f.b.workshopStock.output.food;f.b.workshopStock.output.food-=amount;f.porter.cargo.food=amount;pickupFishingOutput(f.s,f.b,f.porter,amount,before);}
function accept(f,amount,qualifies=true){const before=f.porter.cargo.food;f.porter.cargo.food-=amount;acceptFishingCargo(f.s,f.porter,amount,before,{qualifies});}

test('old output is consumed before a tracked catch and partial acceptance survives JSON reload',()=>{
 const f=fixture();f.b.workshopStock.output.food=3;catchFish(f);pickup(f,6);accept(f,3);assert.equal(f.s.catFishing.pending[0].accepted,0);accept(f,2);assert.equal(f.s.catFishing.pending[0].accepted,2);assert.equal(validateCatFishing(f.s),true);
 const copy=JSON.parse(JSON.stringify(f.s));assert.equal(validateCatFishing(copy),true);f.s=copy;f.b=copy.buildings[0];f.c=copy.citizens[0];f.porter=copy.citizens[1];accept(f,1);pickup(f,2);accept(f,2);assert.equal(f.s.catFishing.completed,1);assert.equal(f.s.catFishing.pending.length,0);assert.deepEqual(f.s.catFishing.flows,{});assert.equal(validateCatFishing(f.s),true);
});
test('later untracked food does not jump ahead of genuine earlier fish, transfers never become a second operation',()=>{
 const f=fixture();catchFish(f);f.b.workshopStock.output.food+=4;pickup(f,6);accept(f,6);assert.equal(f.s.catFishing.completed,1);f.porter.cargo.food=20;accept(f,20);assert.equal(f.s.catFishing.completed,1);assert.equal(validateCatFishing(f.s),true);
});
test('three complete own operations finish the bounded lesson, any later production remains untracked',()=>{
 const f=fixture();for(let i=0;i<3;i++){catchFish(f);pickup(f,5);accept(f,5);}const saved=JSON.stringify(f.s.catFishing);for(let i=0;i<20;i++)catchFish(f);assert.equal(JSON.stringify(f.s.catFishing),saved);assert.equal(f.s.catFishing.completed,3);assert.equal(validateCatFishing(f.s),true);
});
test('at most three operations can be in flight, independently of the number of fishers',()=>{
 const f=fixture();for(let i=0;i<8;i++)catchFish(f);assert.equal(f.s.catFishing.pending.length,3);const n=f.s.catFishing.nextCatchId;recordFishingCatch(f.s,f.b,{...f.c,id:1},5,{inBuffer:true,before:40});assert.equal(f.s.catFishing.nextCatchId,n);assert.equal(validateCatFishing(f.s),true);
});
test('raw catch enters the fisher hands then the output buffer without counting twice',()=>{
 const f=fixture();f.c.cargo.food=5;recordFishingCatch(f.s,f.b,f.c,5);f.b.workshopStock.output.food=5;moveFishingCargoToOutput(f.s,f.b,f.c,5,0,5);f.c.cargo={};assert.equal(f.s.catFishing.pending.length,1);assert.equal(validateCatFishing(f.s),true);pickup(f,5);accept(f,5);assert.equal(f.s.catFishing.completed,1);
});
test('nonwarehouse consumption and cargo recovery discard only evidence, not physical stock, and allow fresh operations',()=>{
 const f=fixture();catchFish(f);pickup(f,5);accept(f,2,false);assert.equal(f.s.catFishing.completed,0);assert.equal(f.s.catFishing.pending.length,0);assert.equal(f.porter.cargo.food,3);assert.equal(validateCatFishing(f.s),true);
 f.porter.cargo={};catchFish(f);pickup(f,5);discardFishingCargo(f.s,f.porter);assert.equal(f.porter.cargo.food,5);assert.equal(f.s.catFishing.pending.length,0);assert.equal(validateCatFishing(f.s),true);
});
test('demolition and rebuilding the same cell cannot adopt old fish provenance',()=>{
 const f=fixture();catchFish(f);const id=f.b.catFishingSiteId,stock=f.b.workshopStock.output.food;discardFishingOutput(f.s,f.b);assert.equal(f.b.workshopStock.output.food,stock);f.s.buildings=[];f.b={type:'fishing',x:1,y:1,workshopStock:{output:{food:0}}};f.s.buildings.push(f.b);catchFish(f);assert.ok(f.b.catFishingSiteId>id);assert.equal(f.s.catFishing.pending.length,1);assert.equal(validateCatFishing(f.s),true);
});
test('death of the learner allows a new fisher without reusing operation IDs',()=>{
 const f=fixture();catchFish(f);const id=f.s.catFishing.pending[0].id;f.s.citizens=f.s.citizens.filter(c=>c!==f.c);f.c=f.porter;f.c.work='1,1';catchFish(f);assert.equal(f.s.catFishing.candidateId,1);assert.ok(f.s.catFishing.pending[0].id>id);assert.equal(f.s.catFishing.pending.length,1);assert.equal(validateCatFishing(f.s),true);
});
test('invalid proof totals, absent holders, duplicate site IDs and orphan profiles are rejected',()=>{
 const f=fixture();catchFish(f);assert.equal(validateCatFishing(f.s),true);
 for(const mutate of [s=>s.catFishing.pending[0].accepted=4,s=>s.buildings[0].workshopStock.output.food=0,s=>s.catFishing.completed=4,s=>s.catFishing.flows['cargo:999']=[{id:1,amount:5}],s=>s.buildings.push({...s.buildings[0]}),s=>s.scenario.miracles='classic-v1']){const copy=JSON.parse(JSON.stringify(f.s));mutate(copy);assert.equal(validateCatFishing(copy),false);}
});
test('classic games do not receive ledger state or site markers',()=>{const f=fixture();delete f.s.catFishing;f.s.scenario.miracles='classic-v1';initializeCatFishing(f.s);catchFish(f);assert.equal(f.s.catFishing,undefined);assert.equal(f.b.catFishingSiteId,undefined);assert.equal(validateCatFishing(f.s),true);});

test('a fisher changing work cannot strand the lesson on that identity; other fishers keep their own evidence',()=>{
 const f=fixture();for(let i=0;i<2;i++){catchFish(f);pickup(f,5);accept(f,5);}assert.equal(f.s.catFishing.lessons[0],2);f.c.work='other';f.c=f.porter;f.c.work='1,1';for(let i=0;i<3;i++){catchFish(f);pickup(f,5);accept(f,5);}assert.equal(f.s.catFishing.lessons[0],2);assert.equal(f.s.catFishing.lessons[1],3);assert.equal(f.s.catFishing.candidateId,1);assert.equal(f.s.catFishing.completed,3);assert.equal(validateCatFishing(f.s),true);
});

test('death of the first candidate preserves another fishers unfinished catch and a reloadable candidate',()=>{
 const f=fixture();catchFish(f);f.porter.work='1,1';const before=f.b.workshopStock.output.food;f.b.workshopStock.output.food+=5;const id=recordFishingCatch(f.s,f.b,f.porter,5,{inBuffer:true,before});f.s.citizens=f.s.citizens.filter(c=>c.id!==0);reconcileCatFishing(f.s);assert.equal(f.s.catFishing.candidateId,1);assert.equal(f.s.catFishing.pending.length,1);assert.equal(f.s.catFishing.pending[0].id,id);assert.equal(validateCatFishing(f.s),true);assert.equal(validateCatFishing(JSON.parse(JSON.stringify(f.s))),true);
});
