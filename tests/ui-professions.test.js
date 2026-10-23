import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.js';
import {filterCitizens} from '../city-diagnostics.js';
import {cityToolsHTML} from '../ui-city-tools.js';
test('staffing card lists matching specialists first without hiding other eligible adults',async()=>{
 const {renderStaffing}=await import('../ui-professions.js');
 const s={citizens:[{id:9,age:30,role:'production',calling:'brewer'},{id:7,age:30,role:'production',calling:'potter'},{id:2,age:30,role:'auto'},{id:3,age:30,role:'production',calling:'potter'},{id:1,age:12,role:'auto'},{id:4,age:30,role:'carrier'}]},b={type:'pottery',x:10,y:9};
 const html=renderStaffing(s,b),ids=[...html.matchAll(/<option value="(\d+)"/g)].map(m=>Number(m[1]));assert.deepEqual(ids,[3,7,2,9]);assert.match(html,/Гончар/);assert.match(html,/Пивовар/);assert.match(html,/Авто/);
 s.citizens.reverse();assert.deepEqual([...renderStaffing(s,b).matchAll(/<option value="(\d+)"/g)].map(m=>Number(m[1])),ids);
});
test('healer staffing excludes children and untrained apprentices while preserving qualified healers',async()=>{
 const {renderStaffing}=await import('../ui-professions.js');const s={citizens:[{id:4,age:30,role:'healer',medicine:{level:0}},{id:5,age:30,role:'healer',medicine:{level:1}},{id:6,age:12,role:'healer',medicine:{level:1}}]};
 const ids=[...renderStaffing(s,{type:'healer',x:10,y:9}).matchAll(/<option value="(\d+)"/g)].map(m=>Number(m[1]));assert.deepEqual(ids,[5]);
});
test('city overview displays specialized professions and filters them while keeping the general production filter',()=>{
 const s=createGame({start:'established'}),c=s.citizens.find(c=>c.age>=16);Object.assign(c,{role:'production',calling:'potter'});
 assert.deepEqual(filterCitizens(s,{role:'potter'}).map(p=>p.id),[c.id]);assert.ok(filterCitizens(s,{role:'production'}).includes(c));
 const html=cityToolsHTML(s,{tab:'citizens',filter:{role:'potter'}});assert.match(html,/Гончар/);assert.match(html,/Найдено: 1/);assert.match(html,new RegExp(`data-city-citizen="${c.id}"`));
});
