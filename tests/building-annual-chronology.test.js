import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,encode,decode} from '../engine.js';
import {recordBuildingProduction,annualProductionHistory,initializeProductionAccounting,validateProductionHistory} from '../building-production-history.js';
import {buildingProductionHistoryHTML} from '../ui-building-production.js';
import {buildingChronology,compareBuildingsNewest,stampBuildingCompletion} from '../building-chronology.js';
import {finishConstruction,createOrder,workRequired} from '../construction.js';

const date=(year,season=0,seasonElapsed=0)=>({year,season,seasonElapsed});

test('annual history shows the last three completed calendar years and excludes the current year',()=>{
 const b={type:'pottery'},s={...date(1),buildings:[]};s.buildings.push(b);initializeProductionAccounting(s);
 for(let year=1;year<=4;year++)for(let season=0;season<4;season++)recordBuildingProduction({...date(year,season)},b,'pottery',year);
 const before=JSON.stringify(b),rows=annualProductionHistory(date(4,3),b);
 assert.deepEqual(rows.map(r=>[r.year,r.known,r.complete,r.resources.pottery]),[[1,true,true,4],[2,true,true,8],[3,true,true,12]]);
 assert.equal(JSON.stringify(b),before);assert.ok(rows.every(r=>r.year!==4));
 const html=buildingProductionHistoryHTML(date(4,3),b);assert.match(html,/Последние 3 полных года/);assert.doesNotMatch(html,/Весна|Лето|Осень|Зима|текущий/);assert.match(html,/>12</);
});

test('legacy seasonal totals cannot masquerade as complete annual output and views remain readonly',()=>{
 const b={type:'pottery',productionHistory:[{year:8,season:3,resources:{pottery:999}}]};Object.freeze(b);
 const before=JSON.stringify(b),rows=annualProductionHistory(date(9),b);assert.ok(rows.every(r=>!r.known));assert.ok(rows.every(r=>!Object.keys(r.resources).length));assert.equal(JSON.stringify(b),before);
});

test('midyear accounting is explicitly partial; later tracked zero years are complete',()=>{
 const s={...date(7,2,10),buildings:[{type:'pottery'}]},b=s.buildings[0];initializeProductionAccounting(s);recordBuildingProduction(s,b,'pottery',5);
 const rows=annualProductionHistory(date(10),b);assert.deepEqual(rows.map(r=>[r.year,r.known,r.complete,r.resources.pottery||0]),[[7,true,false,5],[8,true,true,0],[9,true,true,0]]);
 const html=buildingProductionHistoryHTML(date(10),b);assert.match(html,/неполный учёт/);assert.match(html,/>5/);assert.match(html,/Учёт начат в течение года/);
});

test('annual buffers keep three completed years plus the current one and reject malformed metadata',()=>{
 const s={...date(1),buildings:[{type:'clay'}]},b=s.buildings[0];initializeProductionAccounting(s);
 for(let year=1;year<=10;year++)recordBuildingProduction({...date(year)},b,'clay',year);
 assert.deepEqual(b.productionAnnual.rows.map(r=>r.year),[7,8,9,10]);s.year=10;assert.equal(validateProductionHistory(s),true);
 const saved=structuredClone(b.productionAnnual);
 for(const mutate of [a=>a.rows.push({...a.rows[3]}),a=>a.rows[0].resources.fake=1,a=>a.rows[0].resources.clay=-1,a=>a.started.year=11,a=>a.rows[0].year=11,a=>a.started.elapsed=46]){b.productionAnnual=structuredClone(saved);mutate(b.productionAnnual);assert.equal(validateProductionHistory(s),false);}
 b.productionAnnual=saved;const rows=annualProductionHistory(date(10),b);rows[0].resources.clay=999;assert.equal(b.productionAnnual.rows[0].resources.clay,7);
});

test('newgame buildings have known year1; actual completion sets date and upgrade retains it',()=>{
 for(const start of ['beehives','established'])assert.ok(createGame({start}).buildings.every(b=>buildingChronology(b).year===1));
 const s=createGame(),b={type:'pottery',x:2,y:2,level:1,construction:createOrder({},1)};s.buildings.push(b);s.year=3;s.season=2;s.seasonElapsed=12;b.construction.work=workRequired(b);
 assert.equal(buildingChronology(b).known,false);finishConstruction(s);assert.equal(buildingChronology(b).year,3);assert.equal(b.built.season,2);assert.equal(b.built.elapsed,12);
 const built=structuredClone(b.built);b.construction=createOrder({},2,'upgrade');b.construction.work=workRequired(b);s.year=4;finishConstruction(s);assert.deepEqual(b.built,built);
 const newer={type:'pottery'};stampBuildingCompletion(s,newer);assert.ok(compareBuildingsNewest(newer,b)<0);assert.equal(buildingChronology({type:'pottery'}).label,'Год неизвестен');
});

test('v28 old metadata omission roundtrips without changing people, freight, resources or inventing build year',()=>{
 const s=createGame({start:'established'});for(const b of s.buildings){delete b.built;delete b.productionAnnual;}const original=JSON.parse(encode(s)),restored=decode(JSON.stringify(original));
 assert.ok(restored);assert.equal(restored.version,28);assert.deepEqual(restored,original);assert.ok(restored.buildings.every(b=>!b.built&&!b.productionAnnual));
 const people=structuredClone(restored.citizens),resources=structuredClone(restored.resources);initializeProductionAccounting(restored);assert.deepEqual(restored.citizens,people);assert.deepEqual(restored.resources,resources);assert.ok(restored.buildings.every(b=>!b.built));assert.ok(decode(encode(restored)));
 const bad=JSON.parse(encode(s));bad.buildings[0].built={year:0,season:0,elapsed:0,order:0};assert.equal(decode(JSON.stringify(bad)),null);
});


test('the founding year has no completed annual totals yet, and legacy sort order stays stable',()=>{
 const s=createGame({start:'established'}),b=s.buildings.find(b=>b.type==='clay');
 assert.deepEqual(annualProductionHistory(s,b),[]);const html=buildingProductionHistoryHTML(s,b);assert.match(html,/Первый полный год ещё не завершён/);assert.doesNotMatch(html,/Год 0/);
 const first={type:'clay'},second={type:'clay'};assert.equal(compareBuildingsNewest(first,second),0);assert.ok(compareBuildingsNewest(b,first)<0);
});

test('a newly finished building has a known annual total including zero before it existed',()=>{
 const s={...date(2,2,10),buildings:[]},b={type:'pottery'};s.buildings.push(b);stampBuildingCompletion(s,b);initializeProductionAccounting(s);recordBuildingProduction(s,b,'pottery',2);
 assert.deepEqual(annualProductionHistory(date(3),b).at(-1),{year:2,known:true,complete:true,resources:{pottery:2}});
});
