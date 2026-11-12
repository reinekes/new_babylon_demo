import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {renderCityTools} from '../ui-city-tools.js';
import {createGame, encode, decode, advanceTime} from '../engine.js';
import {buildingKey, capacityOf} from '../definitions.js';
import * as tools from '../test-tools.js';
import {renderTestTools} from '../ui-test-tools.js';

test('testing adds 200 residents with finite camp beds and round-trips the city',()=>{
 const s=createGame({start:'established'});
 const old=s.citizens.map(c=>[c.id,c.home]), capacity=s.capacity;
 assert.match(renderTestTools(s),/data-test-action="add-citizens"/);
 assert.equal(tools.addTestCitizens(s,200-s.population).ok,true);
 assert.equal(s.population,200);
 assert.equal(s.capacity,capacity);
 assert.deepEqual(s.citizens.slice(0,old.length).map(c=>[c.id,c.home]),old);
 const camps=s.buildings.filter(b=>b.reedCamp);
 assert.ok(camps.length);
 assert.equal(s.citizens.filter(c=>camps.some(b=>buildingKey(b)===c.home)).length,200-capacity);
 for(const b of camps)assert.ok(s.citizens.filter(c=>c.home===buildingKey(b)).length<=capacityOf(b));
 assert.equal(encode(decode(encode(s))),encode(s));
});

test('camp residents eat real supplies, lose health, then move into new housing',()=>{
 const s=createGame({start:'established'});
 assert.equal(tools.addTestCitizens(s,s.capacity-s.population+1).ok,true);
 const person=s.citizens.at(-1),camp=s.buildings.find(b=>b.reedCamp);
 camp.pantry=camp.pantryDelivered=20;
 for(let i=0;i<120;i++)advanceTime(s,.5);
 assert.equal(person.missedMeals,0);
 assert.ok(person.health<100);
 assert.ok(camp.pantry<20);
 const vacant=s.buildings.find(b=>b.type==='house'&&b!==camp);
 assert.equal(tools.instantTestUpgrade(s,buildingKey(vacant)).ok,true);
 for(let i=0;i<120&&person.home===buildingKey(camp);i++)advanceTime(s,.5);
 assert.equal(s.citizens.find(c=>c.id===person.id).home,buildingKey(vacant));
 assert.ok(decode(encode(s)));
});

test('testing tab sends the entered population count to the city action',()=>{
 const s=createGame({start:'established'});
 const {window}=new JSDOM('<div id="city"></div>');
 const root=window.document.querySelector('#city');
 renderCityTools(root,s,{tab:'testing',onTestAction:(action,data)=>{
  assert.equal(action,'add-citizens');
  assert.equal(tools.addTestCitizens(s,data['add-count']).ok,true);
 }});
 root.querySelector('[data-test-add-count]').value='188';
 root.querySelector('[data-test-action="add-citizens"]').click();
 assert.equal(s.population,200);
});
