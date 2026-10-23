import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,encode,decode} from '../engine.js';
import {startFuneral,advanceFuneral,funeralView,validateFuneral} from '../funerals.js';
test('desert crowd gathers at the ziggurat, adds no roads, carries torches and saves at every stage',()=>{
 const s=createGame({start:'established'});s.buildings.push({type:'ziggurat',x:6,y:8,level:1});const roads=JSON.stringify([s.roads,s.roadAnchors]);
 assert.ok(startFuneral(s,[{id:12,name:'Умерший',x:9,y:9}]));assert.equal(s.funeral.style,'desert');assert.deepEqual(s.funeral.gather,{x:6,y:8});assert.equal(JSON.stringify([s.roads,s.roadAnchors]),roads);
 const seen=new Set();let broad=false;for(let i=0;i<3000&&s.funeral;i++){const f=s.funeral;if(!seen.has(f.stage)){seen.add(f.stage);assert.ok(decode(encode(s)),f.stage);}
 if(f.stage==='procession'){const moving=f.actors.filter(a=>a.route.length);assert.ok(moving.every(a=>a.delay===0));assert.ok(funeralView(s).torches);broad ||= new Set(moving.map(a=>a.route.at(-1).y)).size>2;}
 advanceFuneral(s,.1);if(s.funeral)assert.equal(validateFuneral(s),true);}
 assert.ok(broad);assert.deepEqual([...seen],['gathering','procession','farewell','receding','jackals','returning']);assert.equal(s.funeral,null);
});
test('deaths give mournful and cruel names without erasing earned titles',()=>{
 const s=createGame({start:'established'});s.deaths=2;startFuneral(s,[{id:12,name:'Умерший',x:9,y:9}]);assert.match(s.name,/плач|пеп|скорб|смерт|пустын/i);const name=s.name;s.funeral=null;s.deaths=30;startFuneral(s,[{id:13,name:'Умерший',x:9,y:9}]);assert.match(s.name,/жесток|смерт|поглот/i);assert.ok(s.divinity.names.includes(name));
});
test('saved road procession migrates to the desert ceremony without dropping cargo',async()=>{
 const {readFile}=await import('node:fs/promises');const raw=await readFile(new URL('./fixtures/legacy-v6-funeral.json',import.meta.url),'utf8'),old=JSON.parse(raw),s=decode(raw);assert.ok(s);assert.equal(s.funeral.style,'desert');assert.deepEqual(s.citizens.map(c=>c.cargo),old.citizens.map(c=>c.cargo));assert.ok(decode(encode(s)));
});
test('crowd path preparation is spread over simulation steps',()=>{
 const s=createGame({start:'established'});startFuneral(s,[{id:12,name:'Умерший',x:8,y:8}]);advanceFuneral(s,.1);assert.ok(s.funeral.actors.filter(a=>a.departure!==null).length<=2);assert.ok(s.funeral.actors.some(a=>a.departure!==null));assert.ok(decode(encode(s)));
});
test('mourners spread into a crowd instead of overlapping repeated lanes',async()=>{
 const {syncCitizens}=await import('../workforce.js');const s=createGame({start:'established'});s.buildings.push(...[[6,10],[7,11],[8,10]].map(([x,y])=>({type:'house',x,y,level:1})));s.population=36;s.capacity=40;syncCitizens(s);startFuneral(s,[{id:36,name:'Умерший',x:8,y:8}]);for(let i=0;i<1500&&s.funeral.stage==='gathering';i++)advanceFuneral(s,.1);for(let i=0;i<40;i++)advanceFuneral(s,.1);const positions=new Set(s.citizens.map(c=>`${c.x.toFixed(2)},${c.y.toFixed(2)}`));assert.ok(positions.size>27,`${positions.size} distinct positions for 36 mourners`);
});
