import test from 'node:test';
import assert from 'node:assert/strict';
import {recordBuildingProduction,productionHistory,validateProductionHistory} from '../building-production-history.js';
import {buildingProductionHistoryHTML} from '../ui-building-production.js';

test('legacy buildings show unknown past seasons and a readonly history view never creates data',()=>{
 const s={year:3,season:1},b={type:'pottery'},before=JSON.stringify(b);Object.freeze(b);
 const rows=productionHistory(s,b);assert.equal(rows.length,3);assert.deepEqual(rows.map(r=>[r.year,r.season,r.known]),[[2,3,false],[3,0,false],[3,1,false]]);assert.equal(JSON.stringify(b),before);
 const html=buildingProductionHistoryHTML(s,b);assert.match(html,/Нет данных/);assert.match(html,/завершённые годы/);assert.ok(!html.includes('NaN'));
});
test('only positive real output records accumulate and readonly summaries do not credit another unit',()=>{
 const s={year:1,season:0},b={type:'pottery'};
 assert.equal(recordBuildingProduction(s,b,'pottery',2),true);recordBuildingProduction(s,b,'pottery',1.5);
 const before=JSON.stringify(b);assert.equal(productionHistory(s,b).at(-1).resources.pottery,3.5);productionHistory(s,b);assert.equal(JSON.stringify(b),before);
 for(const [key,amount]of [['pottery',0],['pottery',-1],['pottery',NaN],['invented',3],['__proto__',1]])assert.equal(recordBuildingProduction(s,b,key,amount),false);
 assert.equal(JSON.stringify(b),before);assert.equal(s.resources,undefined);
});
test('season gaps are zero after tracking starts, but the pre-tracking past remains unknown',()=>{
 const s={year:1,season:1},b={type:'logging'};recordBuildingProduction(s,b,'wood',6);
 let rows=productionHistory({year:1,season:2},b);assert.deepEqual(rows.map(r=>r.known),[false,true,true]);assert.deepEqual(rows.at(-1).resources,{});
 rows=productionHistory({year:3,season:0},b);assert.ok(rows.every(r=>r.known));assert.ok(rows.every(r=>Object.keys(r.resources).length===0));
});
test('actual buckets retain only the last three season records across the year boundary',()=>{
 const s={year:1,season:2},b={type:'clay'};recordBuildingProduction(s,b,'clay',6);
 s.year=2;s.season=1;recordBuildingProduction(s,b,'clay',3);
 assert.deepEqual(b.productionHistory.map(r=>[r.year,r.season]),[[1,3],[2,0],[2,1]]);assert.deepEqual(b.productionHistory.map(r=>r.resources.clay||0),[0,0,3]);
 for(let season=2;season<4;season++){s.season=season;recordBuildingProduction(s,b,'clay',2);}assert.equal(b.productionHistory.length,3);
});
test('production table has completed years and actual resource quantities with icons',()=>{
 const s={year:2,season:0},b={type:'hunting'};recordBuildingProduction(s,b,'food',4);recordBuildingProduction(s,b,'hides',1);
 const html=buildingProductionHistoryHTML({year:3,season:0},b);assert.match(html,/Последние 3 полных года/);assert.match(html,/resource-food/);assert.match(html,/resource-hides/);assert.match(html,/Год 2/);assert.match(html,/>4</);assert.match(html,/>1</);
});

test('optional save validation rejects oversized, duplicate, future and invented history records',()=>{
 const s={year:2,season:0,buildings:[{type:'pottery'}]},b=s.buildings[0];assert.equal(validateProductionHistory(s),true);
 b.productionHistory=[{year:1,season:3,resources:{pottery:2}},{year:2,season:0,resources:{pottery:1}}];assert.equal(validateProductionHistory(s),true);
 const original=structuredClone(b.productionHistory);
 for(const invalid of [[...original,original[1]],[{year:2,season:1,resources:{pottery:1}}],[{year:1,season:0,resources:{invented:2}}],[{year:1,season:0,resources:{pottery:-1}}],Array.from({length:4},(_,season)=>({year:1,season,resources:{}}))]){b.productionHistory=invalid;assert.equal(validateProductionHistory(s),false);}
 b.productionHistory=original;const rows=productionHistory(s,b);rows[1].resources.pottery=999;assert.equal(b.productionHistory[0].resources.pottery,2);
});
