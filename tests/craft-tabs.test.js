import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {bindCraftTabs,BUILDING_GROUPS,CRAFT_GROUPS} from '../ui-catalog.js';

test('craft sub-tabs partition the existing craft catalog exactly',()=>{
 const types=BUILDING_GROUPS.find(group=>group.id==='craft').types;
 assert.deepEqual(CRAFT_GROUPS.flatMap(group=>group.types).sort(),[...types].sort());
});

test('craft sub-tabs keep one reachable panel, ignore empty groups and retain card handlers',()=>{
 const dom=new JSDOM('<section><div data-craft-tabs></div><div data-craft-group="clay"><button id="pottery">Гончарный двор</button></div><div data-craft-group="textiles"><button id="weaver">Ткацкая</button></div><div data-craft-group="food"></div></section>');
 const {document}=dom.window,section=document.querySelector('section');
 let selected=0;
 document.querySelector('#weaver').onclick=()=>selected++;
 const tabs=bindCraftTabs(section);
 assert.equal(section.querySelectorAll('[role=tab]').length,2);
 assert.equal(section.querySelector('[data-craft-group=clay]').hidden,false);
 assert.equal(section.querySelector('[data-craft-group=textiles]').hidden,true);
 const first=section.querySelector('[role=tab]');
 first.focus();
 first.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
 assert.equal(document.activeElement.getAttribute('aria-selected'),'true');
 assert.equal(section.querySelector('[data-craft-group=textiles]').hidden,false);
 document.querySelector('#weaver').click();
 assert.equal(selected,1);
 tabs.show('pottery');
 assert.equal(first.getAttribute('aria-selected'),'true');
 assert.equal(section.querySelector('[data-craft-group=food]').hidden,true);
 dom.window.close();
});
