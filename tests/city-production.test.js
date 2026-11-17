import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,decode,encode,advanceTime} from '../engine.js';
import {recordBuildingProduction, recordManualProduction, cityProduction} from '../building-production-history.js';
import {cityToolsHTML} from '../ui-city-tools.js';
import {grantTestResources} from '../test-tools.js';
import {assignWorkplace,demolish,setCitizenRole} from '../management.js';
import {syncCitizens} from '../workforce.js';
import {putStock} from '../inventory.js';
import {initializeTextiles} from '../textiles.js';
import {JSDOM} from 'jsdom';
import {renderCityTools} from '../ui-city-tools.js';
import {BUILDINGS} from '../definitions.js';

test('annual production attributes output to current and removed buildings and manual sites',()=>{
 const s=createGame({start:'established'}),tailor={type:'tailor',x:7,y:8,level:1},second={type:'tailor',x:6,y:8,level:1};
 s.buildings.push(tailor,second);syncCitizens(s);
 recordBuildingProduction(s,tailor,'clothing',12);
 recordBuildingProduction(s,second,'clothing',8);
 recordManualProduction(s,{x:5,y:7,resource:'clay'},6);
 grantTestResources(s,'clothing');
 assert.equal(demolish(s,second.x,second.y).ok,true);
 const before=JSON.stringify(s),view=cityProduction(s,1);
 const clothing=view.resources.find(row=>row.key==='clothing');
 assert.equal(clothing.total,20);
 assert.deepEqual(clothing.sources.map(row=>[row.kind,row.amount]),[['building',12],['demolished',8]]);
 assert.equal(view.resources.find(row=>row.key==='clay').sources[0].kind,'manual');
 assert.equal(JSON.stringify(s),before);
 assert.match(cityToolsHTML(s,{tab:'production'}),/Год 1|За текущий год/);
});

test('annual report preserves older production and handles incomplete pre-update accounting',()=>{
 const s=createGame({start:'established'});
 recordBuildingProduction(s,s.buildings.find(b=>b.type==='clay'),'clay',9);
 recordManualProduction(s,{x:6,y:7,resource:'clay'},3);
 const raw=encode(s);assert.equal(encode(decode(raw)),raw);
 delete s.cityProductionSince;
 assert.equal(cityProduction(s,1).coverage,'partial');
 s.year=2;s.season=0;s.tick=4;
 assert.equal(cityProduction(s,1).resources.find(row=>row.key==='clay').total,12);
 assert.equal(cityProduction(s,2).resources.length,0);
});

test('a real garment batch appears once through delivery and can be opened from the report',()=>{
 const s=createGame({start:'established'}),tailor={type:'tailor',x:10,y:9,level:1};
 s.buildings.push(tailor);initializeTextiles(s);syncCitizens(s);
 assert.ok(setCitizenRole(s,0,'tailor').ok);
 assert.ok(assignWorkplace(s,0,'10,9').ok);
 putStock(s,'9,8','cloth',2);
 for(let i=0;i<700&&s.resources.clothing<1;i++)advanceTime(s,.1);
 assert.equal(s.resources.clothing,1);
 assert.equal(cityProduction(s).resources.find(row=>row.key==='clothing').total,1);
 const {window}=new JSDOM('<main></main>'),root=window.document.querySelector('main');let opened;
 renderCityTools(root,s,{tab:'production',onFocus:key=>{opened=key;}});
 const picker=root.querySelector('[data-production-resource]');
 picker.value='clothing';picker.dispatchEvent(new window.Event('change',{bubbles:true}));
 const output=root.querySelector('[data-production-output="1:clothing"]');
 assert.ok(output.open);
 output.querySelector('[data-city-focus]').click();assert.equal(opened,'10,9');
});

test('visual chains show the existing recipes without treating stone as a processed resource',()=>{
 const s=createGame({start:'established'}),before=encode(s);
 const {window}=new JSDOM('<main></main>'),root=window.document.querySelector('main');
 renderCityTools(root,s,{tab:'production'});
 root.querySelector('[data-city-tab="chains"]').click();
 assert.match(root.querySelector('h2').textContent,/Цепочки производства/);
 const node=id=>root.querySelector(`[data-production-node="${id}"]`);
 const level=id=>Number(node(id).closest('[data-production-level]').dataset.productionLevel);
 assert.deepEqual(['field','clay','cowshed','pottery','brickyard','brewery','dairyStore','kiln'].map(level),[1,1,1,2,2,3,3,3]);
 const routes=target=>[...root.querySelectorAll(`path[data-to="${target}"]`)].map(edge=>[edge.dataset.from,edge.dataset.resource]);
 assert.deepEqual(routes('brewery'),[['field','grain'],['pottery','pottery']]);
 assert.deepEqual(routes('dairyStore'),[['cowshed','milk'],['pottery','pottery']]);
 assert.deepEqual(routes('tailor'),[['weaver','cloth'],['linenYard','cloth']]);
 for(const edge of root.querySelectorAll('path[data-from]'))assert.ok(level(edge.dataset.from)<level(edge.dataset.to));
 const inputs=id=>[...node(id).querySelectorAll('[data-chain-input]')].map(el=>[el.dataset.chainInput,Number(el.dataset.units)]);
 assert.deepEqual(inputs('brickyard'),[['clay',4],['reed',1],['water',2]]);
 assert.deepEqual(inputs('kiln'),[['brick',4],['reed',3]]);
 assert.deepEqual(inputs('tailor'),[['cloth',2]]);
 assert.deepEqual(inputs('brewery'),[['food',4],['water',3],['pottery',1]]);
 assert.match(node('brewery').textContent,/На 4 партии/);
 assert.deepEqual(inputs('dairyStore'),[['milk',6],['pottery',1]]);
 assert.deepEqual(inputs('bakery'),[['food',4],['water',2],['reed',2]]);
 assert.equal(node('bakery').querySelector('[data-chain-construction="stone"]').dataset.units,'4');
 assert.equal(root.querySelector('path[data-from="quarry"]'),null);
 root.querySelector('[data-city-tab="production"]').click();
 assert.match(root.querySelector('h2').textContent,/Производство за год/);
 assert.equal(encode(s),before);
});

test('the guide covers every building and exposes help above every preview',()=>{
 const s=createGame({start:'established'}),before=encode(s);
 const {window}=new JSDOM('<main></main>'),root=window.document.querySelector('main');
 renderCityTools(root,s,{tab:'chains'});
 const cards=[...root.querySelectorAll('[data-chain-building]')];
 const types=new Set(cards.map(card=>card.dataset.chainBuilding));
 assert.deepEqual(types,new Set([...Object.keys(BUILDINGS),'road','starterHut','reedCamp']));
 assert.match(root.querySelector('[data-chain-building="starterHut"] .chain-effect').textContent,/4 места/);
 for(const card of cards){
  const help=card.querySelector('details.chain-help');
  assert.ok(help?.querySelector('summary[aria-label]'),card.dataset.chainBuilding);
  assert.ok(help.querySelector('p').textContent.trim(),card.dataset.chainBuilding);
  assert.equal(help.open,false);
 }
 const bridge=root.querySelector('[data-chain-building="bridge"] details');
 bridge.querySelector('summary').click();
 assert.ok(bridge.open);
 assert.match(bridge.textContent,/соединит берега/i);
 renderCityTools(root,s);
 assert.ok(bridge.open);
 assert.equal(encode(s),before);
});
