import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createGame,advanceTime,encode} from '../engine.js';
import {beginFirstSign} from '../godhood.js';
import {inspireCitizen} from '../management.js';
import {cityToolsHTML} from '../ui-city-tools.js';
import {relicHUDHTML} from '../ui-relic-control.js';
import {startRelicQuest,relicControlActive} from '../relic-quest.js';
import {bindResidentLinks} from '../ui-resident-links.js';
function recognized(){
 const s=createGame({mode:'awakening'});assert.equal(beginFirstSign(s).ok,true);
 for(let i=0;i<500&&s.godhood.stage!=='recognized';i++)advanceTime(s,.1);
 assert.equal(s.godhood.stage,'recognized');return s;
}
function chanceText(s,id,profession){
 const dom=new JSDOM(cityToolsHTML(s,{tab:'citizens',desiredInspirations:new Map([[id,profession]]),expandedCitizens:new Set([id])}));
 const text=dom.window.document.querySelector(`[data-city-person-disclosure="${id}"] .city-tools-inspiration small`)?.textContent;dom.window.close();return text;
}
test('compact resident list shows the first witness builder guarantee and returns to ordinary chance after use',()=>{
 const s=recognized(),id=s.godhood.witnessId;
 assert.match(chanceText(s,id,'builder'),/Шанс 100%/);
 const rng=s.rngState,faith=s.resources.faith,result=inspireCitizen(s,id,'builder');
 assert.equal(result.success,true);assert.equal(s.rngState,(rng*1664525+1013904223)>>>0);assert.equal(s.resources.faith,faith-1);
 assert.match(chanceText(s,id,'builder'),/Шанс 40%/);
});
test('shared inspiration chance retains adult/child and healer probabilities',async()=>{
 const {inspirationSuccessChance}=await import('../management.js'),s=createGame({mode:'mature'}),c=s.citizens[0];
 assert.equal(typeof inspirationSuccessChance,'function');c.age=24;assert.equal(inspirationSuccessChance(s,c,'builder'),.4);assert.equal(inspirationSuccessChance(s,c,'healer'),.2);
 c.age=12;assert.equal(inspirationSuccessChance(s,c,'builder'),.7);assert.equal(inspirationSuccessChance(s,c,'healer'),.4);
});
test('chosen resident name opens the existing ID delegate without a quest command or another payment',()=>{
 const s=createGame({start:'established'});s.resources.faith=1000;const c=s.citizens[0];
 assert.equal(startRelicQuest(s,c.id).ok,true);const before=encode(s),opened=[];
 const dom=new JSDOM(`<main>${relicHUDHTML(s)}</main>`),root=dom.window.document.querySelector('main');
 bindResidentLinks(root,{getState:()=>s,onLiving:person=>opened.push(person.id)});
 const name=root.querySelector('.relic-hud-heading [data-resident-id]');assert.ok(name);assert.equal(name.dataset.residentId,String(c.id));name.click();
 assert.deepEqual(opened,[c.id]);assert.equal(relicControlActive(s),true);assert.equal(encode(s),before);dom.window.close();
});
