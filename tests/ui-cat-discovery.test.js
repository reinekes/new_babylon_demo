import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createGame} from '../engine.js';
import {strictScenario,CAT_DISCOVERY_RULES} from '../scenario-profiles.js';
import {awakeningHTML,createGodhoodControls} from '../ui-godhood.js';
import * as catalog from '../ui-catalog.js';
function fixture(){const s=createGame({mode:'awakening',scenario:{...strictScenario(),miracles:CAT_DISCOVERY_RULES}}),c=s.citizens.find(c=>c.age>=16);Object.assign(s.godhood,{stage:'recognized',witnessId:c.id,recognitionAt:0,believerIds:[c.id]});return {s,c};}
function domFor(s,callbacks={}){const dom=new JSDOM('<main></main>'),root=dom.window.document.querySelector('main'),controls=createGodhoodControls({root,getState:()=>s,document:dom.window.document,...callbacks});return {dom,root,controls};}
test('fisher guidance counts only the selected real learner and preserves the builder path without mutating the city',()=>{
 const {s,c}=fixture();s.catFishing.candidateId=c.id;s.catFishing.completed=2;s.catFishing.lessons[c.id]=2;const before=JSON.stringify(s),{dom,root,controls}=domFor(s);
 const guide=root.querySelector('.cat-discovery-guide');assert.ok(guide);assert.match(guide.textContent,/2 из 3/);assert.equal(guide.querySelector('[data-resident-id]').dataset.residentId,String(c.id));assert.ok(root.querySelector('[data-first-builder]'));assert.equal(JSON.stringify(s),before);controls.dispose();dom.window.close();
});
test('prepared fisher button uses the existing inspiration command once and disables it without faith',()=>{
 const {s,c}=fixture();s.catFishing.lessons[c.id]=3;s.catFishing.candidateId=c.id;s.catFishing.completed=3;s.resources.faith=1;const calls=[],{dom,root,controls}=domFor(s,{onFisher:id=>calls.push(id)});
 const b=root.querySelector('[data-cat-fisher]');assert.ok(b);assert.equal(b.disabled,false);assert.match(b.textContent,/1 вера/);b.click();assert.deepEqual(calls,[c.id]);s.resources.faith=0;controls.refresh();assert.equal(root.querySelector('[data-cat-fisher]').disabled,true);controls.dispose();dom.window.close();
});
test('offering, night and ready trial guide the player without requiring a surviving initiator',()=>{
 const {s}=fixture();Object.assign(s.catDiscovery,{phase:'offering',initiatorId:999,trace:{x:8,y:9,site:'9,8'},offering:{kind:'water',amount:1,sources:{'8,8':1}}});const calls=[],{dom,root,controls}=domFor(s,{onCatFocus:()=>calls.push('focus'),onCat:()=>calls.push('cast')});
 assert.match(root.querySelector('.cat-discovery-guide').textContent,/дождись ночи/i);root.querySelector('[data-cat-focus]').click();s.catDiscovery.phase='eyes';controls.refresh();assert.match(root.querySelector('.cat-discovery-guide').textContent,/рассвет/i);
 s.catDiscovery.phase='opened';s.catDiscovery.trial='ready';controls.refresh();const cast=root.querySelector('[data-cat-cast]');assert.ok(cast);assert.match(cast.textContent,/0 веры/);cast.click();assert.deepEqual(calls,['focus','cast']);
 s.catDiscovery.trial='spent';controls.refresh();assert.equal(root.querySelector('[data-cat-cast]'),null);assert.match(root.querySelector('.cat-discovery-guide').textContent,/12 веры/);controls.dispose();dom.window.close();
});
test('classic cities never display the C01 task',()=>{for(const s of [createGame({mode:'awakening'}),createGame({mode:'mature'})])assert.doesNotMatch(awakeningHTML(s),/cat-discovery-guide/);});
test('miracle card updates every price and accessibility label between trial, paid and classic saves',()=>{
 const {s}=fixture(),dom=new JSDOM('<details><small class="miracle-summary-status"></small><div class="miracle-facts"><span></span></div><p class="miracle-unavailable"></p><p data-miracle-history hidden></p><button class="miracle-cast"></button></details>'),details=dom.window.document.querySelector('details');
 Object.assign(s.catDiscovery,{phase:'opened',trial:'ready'});const before=JSON.stringify(s);catalog.updateMiracleCard(details,s,'cat','');assert.equal(details.querySelector('button').textContent,'Призвать · 0 веры');assert.match(details.querySelector('button').getAttribute('aria-label'),/0 веры/);assert.equal(details.querySelector('.miracle-facts span').textContent,'0 веры · первый дар');assert.equal(JSON.stringify(s),before);
 s.catDiscovery.trial='spent';catalog.updateMiracleCard(details,s,'cat','Нужно 12 веры');assert.equal(details.querySelector('button').disabled,true);assert.match(details.querySelector('button').textContent,/12 веры/);assert.match(details.querySelector('.miracle-unavailable').textContent,/12 веры/);
 s.miracleHistory={version:1,trials:{cat:{number:1,at:3,faithSpent:0}},paid:{cat:{number:4,at:100,faithSpent:12}}};
 const history=details.querySelector('[data-miracle-history]');
 catalog.updateMiracleCard(details,s,'cat','');
 assert.equal(history.hidden,false);
 assert.match(history.textContent,/Бесплатная проба использована/);
 assert.match(history.textContent,/Последнее платное применение · 12 веры/);
 s.miracleHistory.paid.healing={number:5,at:101,faithSpent:45,population:{happiness:5,newResidents:0,reserved:6}};
 catalog.updateMiracleCard(details,s,'healing','');
 assert.match(history.textContent,/Довольство \+5/);
 assert.match(history.textContent,/Места зарезервированы: 6/);
 assert.doesNotMatch(history.textContent,/Заселилось/);
 catalog.updateMiracleCard(details,createGame(),'cat','');assert.equal(details.querySelector('button').disabled,false);assert.equal(details.querySelector('.miracle-facts span').textContent,'12 веры');assert.equal(history.hidden,true);assert.equal(history.textContent,'');dom.window.close();
});
test('an existing fishery guides completion or delivery instead of asking for a duplicate hut',()=>{
 const {s,c}=fixture(),b={type:'fishing',x:16,y:7,level:1,construction:{kind:'new'}};s.buildings.push(b);const {dom,root,controls}=domFor(s);let guide=root.querySelector('.cat-discovery-guide');assert.match(guide.textContent,/Дострой/);assert.equal(guide.querySelector('[data-awakening-build="fishing"]'),null);
 delete b.construction;controls.refresh();guide=root.querySelector('.cat-discovery-guide');assert.match(guide.textContent,/хижина готова/i);assert.ok(guide.querySelector('[data-awakening-work]'));c.work='16,7';controls.refresh();guide=root.querySelector('.cat-discovery-guide');assert.match(guide.textContent,/дождись.*приёмки/i);assert.equal(guide.querySelector('[data-awakening-build="fishing"]'),null);controls.dispose();dom.window.close();
});

test('arrival card previews the courtyard and exact provisions, then clears the unavailable offer',()=>{
 const {s}=fixture();
 const dom=new JSDOM('<details><small class="miracle-summary-status"></small><div class="miracle-facts"><span></span></div><p class="miracle-unavailable"></p><p data-arrival-preview hidden></p><button class="miracle-cast"></button></details>');
 const details=dom.window.document.querySelector('details'),preview=details.querySelector('[data-arrival-preview]');
 const offer={home:'8,9',beds:3,food:3,water:4,homeRef:{x:8,y:9}};
 const before=JSON.stringify(s);
 catalog.updateMiracleCard(details,s,'healing','',null,offer);
 assert.equal(preview.hidden,false);
 assert.match(preview.textContent,/8, 9.*еда 3.*вода 4.*1 на возлияние/);
 assert.equal(JSON.stringify(s),before);
 catalog.updateMiracleCard(details,s,'healing','Нужен сухой путь');
 assert.equal(preview.hidden,true);
 assert.equal(preview.textContent,'');
 dom.window.close();
});
test('the optional fishing story stays closed until chosen and keeps its state when faith changes',()=>{
 const {s}=fixture();s.resources.faith=1;
 const dom=new JSDOM('<main></main>'),root=dom.window.document.querySelector('main'),builds=[];
 const controls=createGodhoodControls({root,getState:()=>s,document:dom.window.document,onBuild:type=>builds.push(type)});
 let side=root.querySelector('[data-awakening-side-story]');
 assert.ok(side);assert.equal(side.open,false);
 assert.ok(root.querySelector('[data-first-builder]'));
 side.open=true;s.resources.faith=0;controls.refresh();
 side=root.querySelector('[data-awakening-side-story]');assert.equal(side.open,true);
 side.querySelector('[data-awakening-build="fishing"]').click();assert.deepEqual(builds,['fishing']);
 s.catDiscovery.phase='offering';controls.refresh();
 side=root.querySelector('[data-awakening-side-story]');assert.equal(side.open,true);assert.ok(side.querySelector('[data-cat-focus]'));
 controls.dispose();dom.window.close();
});
