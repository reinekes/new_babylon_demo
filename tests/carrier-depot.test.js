import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,encode,decode} from '../engine.js';
import {assignWorkplace} from '../management.js';
import {syncCitizens,invalidateAssignments} from '../workforce.js';
import {canStaffBuilding,professionForBuilding,professionMatchesTask,staffingCandidates} from '../professions.js';
import {cityDiagnostics} from '../city-diagnostics.js';
import {cityToolsHTML} from '../ui-city-tools.js';
import {workRate} from '../wellbeing.js';

function town(){
 const s=createGame({start:'established'});s.buildings.push({type:'depot',x:10,y:9,level:1},{type:'pottery',x:6,y:8,level:1});syncCitizens(s);return s;
}
const carrier=c=>Object.assign(c,{age:30,role:'carrier',calling:'carrier'});

test('trained carriers match distribution courtyards and retain their delivery calling bonus',()=>{
 const c=carrier({id:7}),b={type:'depot',x:10,y:9};
 assert.equal(professionForBuilding('depot'),'carrier');
 assert.equal(canStaffBuilding(c,b),true);assert.equal(professionMatchesTask(c,'depot'),true);assert.equal(professionMatchesTask(c,'carrier'),true);
 assert.equal(workRate(c,'depot'),1.2);assert.equal(workRate(c,'carrier'),1.2);assert.equal(workRate(c,'pottery'),1);
 assert.equal(canStaffBuilding({...c,age:15},b),false);assert.equal(professionMatchesTask({...c,role:'production'},'depot'),false);
 const candidates=staffingCandidates([{id:2,age:30,role:'auto'},c,{id:4,age:30,role:'production'}],b);assert.deepEqual(candidates.map(c=>c.id),[7,2,4]);
});

test('a pinned carrier keeps their distribution place when assignments are synchronized',()=>{
 const s=town(),c=carrier(s.citizens[0]);
 assert.equal(assignWorkplace(s,c.id,'10,9').ok,true);assert.equal(c.workplace,'10,9');
 invalidateAssignments(s);syncCitizens(s);assert.equal(c.workplace,'10,9');assert.equal(c.work,'10,9');
 assert.ok(decode(encode(s)));
});

test('pinning a loaded carrier preserves their stable identity, old destination and exact cargo through reload',()=>{
 const s=town(),c=carrier(s.citizens[0]),ids=s.citizens.map(c=>c.id);Object.assign(c,{cargo:{clay:3},phase:'toStore'});const destination=c.store;
 assert.equal(assignWorkplace(s,c.id,'10,9').ok,true);assert.equal(c.workplace,'10,9');assert.equal(c.store,destination);assert.deepEqual(c.cargo,{clay:3});assert.deepEqual(s.citizens.map(c=>c.id),ids);
 const restored=decode(encode(s));assert.ok(restored);const loaded=restored.citizens.find(p=>p.id===c.id);assert.equal(loaded.workplace,'10,9');assert.equal(loaded.store,destination);assert.deepEqual(loaded.cargo,{clay:3});assert.deepEqual(restored.citizens.map(c=>c.id),ids);
});

test('save validation accepts an existing carrier depot pin and rejects a production pin',()=>{
 const s=town(),c=carrier(s.citizens[0]);c.workplace='10,9';const before={id:c.id,cargo:structuredClone(c.cargo)};
 const restored=decode(encode(s));assert.ok(restored);const loaded=restored.citizens.find(p=>p.id===before.id);assert.deepEqual(loaded.cargo,before.cargo);assert.equal(loaded.workplace,'10,9');
 c.workplace='6,8';assert.equal(decode(encode(s)),null);
});

test('carrier matching fills two depot places brightly without opening production or trade staffing',()=>{
 const s=town(),a=carrier(s.citizens[0]),b=carrier(s.citizens[1]),third=carrier(s.citizens[2]);
 assert.equal(assignWorkplace(s,a.id,'10,9').ok,true);assert.equal(assignWorkplace(s,b.id,'10,9').ok,true);assert.equal(assignWorkplace(s,third.id,'10,9').ok,false);
 const card=cityDiagnostics(s).workshops.find(w=>w.key==='10,9');assert.deepEqual(card.staffing,{count:2,capacity:2,matching:2,state:'matched',label:'Все места заняты по призванию'});
 const html=cityToolsHTML(s,{tab:'workshops'});assert.match(html,/<article[^>]*data-city-building="10,9"[^>]*data-staffing="matched"/);
 const pin=a.workplace;for(const type of ['pottery','field','market','harbor']){assert.equal(canStaffBuilding(a,{type}),false);assert.equal(professionMatchesTask(a,type),false);assert.ok(!staffingCandidates([a],{type,x:1,y:1}).length);}
 assert.equal(assignWorkplace(s,a.id,'6,8').ok,false);assert.equal(a.workplace,pin);
});
