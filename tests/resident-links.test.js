import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,encode} from '../engine.js';
import {displayName} from '../citizen-epithets.js';
import {residentLinkHTML,residentTextHTML,residentTarget,bindResidentLinks} from '../ui-resident-links.js';
import {renderStaffing} from '../ui-professions.js';

test('staffing names use current epithets and stable resident links, while native options stay plain text',()=>{
 const s=createGame({start:'established'}),c=s.citizens[0],b={type:'garden',x:6,y:8,level:1};s.buildings.push(b);
 Object.assign(c,{work:`${b.x},${b.y}`,workplace:`${b.x},${b.y}`,epithet:{key:'job:farmer'}});
 const before=encode(s),html=renderStaffing(s,b);
 assert.ok(html.includes(`data-resident-id="${c.id}"`));assert.ok(html.includes(displayName(s,c)));
 assert.ok(!/<option[^>]*>[^<]*<button/.test(html));assert.equal(encode(s),before);
});

test('resident labels escape HTML and never invent a clickable record for unknown ancestors',()=>{
 const s={citizens:[{id:7,birthName:'<Нанна & "друг">'}],lifeAnalytics:{people:[{id:22,name:'Тари 2',diedTick:4}]}};
 assert.match(residentLinkHTML(s,7),/data-resident-id="7"/);assert.match(residentLinkHTML(s,7),/&lt;Нанна &amp; &quot;друг&quot;&gt;/);
 assert.match(residentLinkHTML(s,22),/data-resident-id="22"/);assert.ok(!residentLinkHTML(s,999).includes('data-resident-id'));
 assert.equal(residentTarget(s,7).living,true);assert.equal(residentTarget(s,22).living,false);assert.equal(residentTarget(s,'7'),null);
});

test('chronicle text links full original names without changing archived wording or matching name prefixes',()=>{
 const s={citizens:[{id:0},{id:12},{id:1}],lifeAnalytics:{people:[{id:2,name:'Илду',diedTick:9}]}},text='Амал 2 и Нин-Ая пришли к Илду. Амалит не житель. <img src=x>';
 const html=residentTextHTML(s,text);
 assert.match(html,/data-resident-id="12"[^>]*>Амал 2<\/button>/);assert.match(html,/data-resident-id="1"[^>]*>Нин-Ая<\/button>/);assert.match(html,/data-resident-id="2"[^>]*>Илду<\/button>/);
 assert.ok(!html.includes('data-resident-id="0"'));assert.ok(html.includes('Амалит не житель. &lt;img src=x&gt;'));
 assert.equal(residentTextHTML(s,'Амал 999 не сохранился в записях.'),'Амал 999 не сохранился в записях.','a missing numbered resident must not become resident 0');
 const duplicate={citizens:[{id:1,birthName:'Друг'},{id:2,birthName:'Друг'}]};assert.equal(residentTextHTML(duplicate,'Друг'), 'Друг');
});

test('delegated links navigate live and archived IDs after rerenders without mutating the save',()=>{
 const s={citizens:[{id:0,home:'3,3',cargo:{clay:3}}],lifeAnalytics:{people:[{id:14,name:'Илду 2',diedTick:2}]}},calls=[],handlers={},root={contains:()=>true,addEventListener:(name,fn)=>handlers[name]=fn};
 const before=JSON.stringify(s);bindResidentLinks(root,{getState:()=>s,onLiving:c=>calls.push(['live',c.id]),onArchived:id=>calls.push(['archive',id])});
 const click=id=>handlers.click({target:{closest:()=>({dataset:{residentId:String(id)}})},preventDefault:()=>calls.push(['prevented'])});
 click(0);click(14);click(999);click('0\" onclick=x');assert.deepEqual(calls,[['prevented'],['live',0],['prevented'],['archive',14]]);assert.equal(JSON.stringify(s),before);
});
