import test from 'node:test';
import assert from 'node:assert/strict';
import {compareSavedState} from '../tools/history-check/save-check.js';
const saved=()=>({buildings:[{type:'house',stock:{food:6.000000000000028,clay:12}},{type:'field',crop:{sown:1,growth:1,sheaves:0,threshed:7}}],citizens:[{id:1,name:'Энкиду',personality:{care:.6},cargo:{food:7}}],resources:{food:34.40000000000001}});
test('real observed inventory reconciliation roundoff is reported, not called byte-exact',()=>{
 const a=saved(),b=structuredClone(a);b.buildings[0].stock.food=6.0000000000000355;const r=compareSavedState(a,b);
 assert.equal(r.equal,false);assert.equal(r.equivalent,true);assert.equal(r.changes.length,1);assert.equal(r.changes[0].path,'/buildings/0/stock/food');assert.ok(r.changes[0].delta>0&&r.changes[0].delta<1e-13);
});
test('cargo, personalities, harvest and aggregate resources require exact numbers even below inventory tolerance',()=>{
 for(const mutate of [b=>b.citizens[0].cargo.food+=1e-12,b=>b.citizens[0].personality.care+=1e-12,b=>b.buildings[1].crop.threshed+=1e-12,b=>b.resources.food+=1e-12]){const a=saved(),b=structuredClone(a);mutate(b);assert.equal(compareSavedState(a,b).equivalent,false);}
});
test('real inventory loss, missing fields and person replacement cannot pass the roundtrip checker',()=>{
 for(const mutate of [b=>b.buildings[0].stock.food-=1e-5,b=>delete b.citizens[0].cargo.food,b=>b.citizens.pop(),b=>b.citizens[0].name='Другой',b=>b.buildings[0].stock.food=null]){const a=saved(),b=structuredClone(a);mutate(b);assert.equal(compareSavedState(a,b).equivalent,false);}
});
test('key order does not alter saved meaning while exact unchanged state stays exact',()=>{
 const a=saved(),b=Object.fromEntries(Object.entries(a).reverse());assert.deepEqual(compareSavedState(a,b),{equal:true,equivalent:true,changes:[]});
});
