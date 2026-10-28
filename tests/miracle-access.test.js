import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,miracle,encode,decode} from '../engine.js';
import {MIRACLES} from '../definitions.js';
import {miracleKnowledgeReason} from '../godhood.js';
import {miracleLockReason,sacredMiracleUnlocked,syncSacredUnlocks} from '../sacred-unlocks.js';
import * as catalogue from '../ui-catalog.js';
import {modeChooserHTML} from '../ui-godhood.js';
import {catReason} from '../pests.js';

test('mature knowledge never bypasses a sacred building or an undelivered relic',()=>{
 const s=createGame({mode:'mature'}),before=structuredClone(s.resources);
 for(const id of ['inannaProtection','relicAwakening','earthMemory']){
  assert.ok(miracleLockReason(s,id),id);
  assert.equal(sacredMiracleUnlocked(s,id),false,id);
  assert.equal(miracle(s,id).ok,false,id);
  assert.deepEqual(s.resources,before,'a locked gift must spend no faith');
 }
 for(const phase of ['idle','searching','found','carrying','delivering']){
  s.relicQuest.phase=phase;s.landRelicQuest.phase=phase;
  assert.ok(miracleLockReason(s,'relicAwakening'),phase);
  assert.ok(miracleLockReason(s,'earthMemory'),phase);
 }
 s.relicQuest.phase='completed';
 assert.equal(miracleLockReason(s,'relicAwakening'),'');
 assert.ok(miracleLockReason(s,'earthMemory'),'each relic earns only its own gift');
 s.landRelicQuest.phase='completed';assert.equal(miracleLockReason(s,'earthMemory'),'');
});

test('mature Ishtar protection requires a completed gate and keeps its earned unlock across saves',()=>{
 let s=createGame({mode:'mature'});s.buildings.push({type:'ishtarGate',x:2,y:2,level:1,construction:{kind:'new'}});
 assert.equal(syncSacredUnlocks(s),false);assert.ok(miracleLockReason(s,'inannaProtection'));
 delete s.buildings.at(-1).construction;
 assert.equal(syncSacredUnlocks(s),true);assert.equal(miracleLockReason(s,'inannaProtection'),'');
 const history=structuredClone(s.sacred),announcements=s.news.filter(n=>n.title==='Новое чудо: Покров Инанны').length;
 s.buildings.pop();s=decode(encode(s));assert.ok(s);assert.deepEqual(s.sacred,history);
 assert.equal(syncSacredUnlocks(s),false);assert.equal(miracleLockReason(s,'inannaProtection'),'');
 assert.equal(s.news.filter(n=>n.title==='Новое чудо: Покров Инанны').length,announcements);
 assert.equal(miracle(s,'inannaProtection').ok,true);
});

test('ordinary miracles stay visible before a first cat, after summoning and during cooldown',()=>{
 assert.equal(typeof catalogue.shouldShowMiracle,'function');
 const s=createGame({start:'established'});
 assert.equal(s.pests.nextCat,0);
 assert.equal(catalogue.shouldShowMiracle(s,'cat'),true);
 assert.equal(miracle(s,'cat').ok,true);assert.equal(s.pests.cats.length,1);
 assert.equal(catalogue.shouldShowMiracle(s,'cat'),true);
 assert.match(miracle(s,'cat').reason,/через .*сез/i);
 s.cooldowns.cat=0;assert.match(miracle(s,'cat').reason,/под защитой/);
 assert.equal(catalogue.shouldShowMiracle(s,'cat'),true);
 const unseen=createGame({mode:'awakening'});
 assert.equal(catalogue.shouldShowMiracle(unseen,'cat'),true);
 assert.match(miracleKnowledgeReason(unseen,'cat'),/никто не признал/);
 const faith=unseen.resources.faith;assert.equal(miracle(unseen,'cat').ok,false);assert.equal(unseen.resources.faith,faith);
 assert.equal(catalogue.shouldShowMiracle(unseen,'unknown'),false);
});

test('the catalogue reveals each blue gift only after its own earned unlock',()=>{
 assert.equal(typeof catalogue.shouldShowMiracle,'function');
 for(const mode of ['mature','awakening']){
  const s=createGame({mode});
  for(const [id,m]of Object.entries(MIRACLES))assert.equal(catalogue.shouldShowMiracle(s,id),!(m.unlockBuilding||m.unlockQuest),`${mode}:${id}`);
  s.relicQuest.phase='completed';
  assert.equal(catalogue.shouldShowMiracle(s,'relicAwakening'),true);
  assert.equal(catalogue.shouldShowMiracle(s,'earthMemory'),false);
  assert.equal(catalogue.shouldShowMiracle(s,'inannaProtection'),false);
 }
});

test('the mature mode description distinguishes ordinary abilities from earned blue gifts',()=>{
 const html=modeChooserHTML();assert.match(html,/Обычные способности/);assert.match(html,/Синие дары/);assert.match(html,/реликв/i);
 assert.doesNotMatch(html,/Все здания, профессии и способности доступны/);
});

test('cat availability explains missing stores and blocked yards instead of claiming they are protected',()=>{
 const s=createGame({mode:'mature'});assert.match(catReason(s),/Сначала построй.*святилище|Сначала построй.*хранилище/);
 s.buildings=[{type:'shrine',x:4,y:4,level:1}];
 for(let y=2;y<=6;y++)for(let x=2;x<=6;x++)if(x!==4||y!==4)s.buildings.push({type:'house',x,y,level:1});
 assert.match(catReason(s),/свободный сухой двор/);
 assert.equal(s.pests.cats.length,0);
});
