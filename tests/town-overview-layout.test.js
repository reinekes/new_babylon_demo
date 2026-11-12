import test from 'node:test';
import {JSDOM} from 'jsdom';
import assert from 'node:assert/strict';
import {createGame} from '../engine.js';
import {cityToolsHTML,renderCityTools,residentVitalsHTML} from '../ui-city-tools.js';
import {buildingInventoryHTML} from '../ui-building-inventory.js';
import {RESOURCE_GROUPS} from '../season-balance.js';

test('inventory uses header order, icon quantities and accessible full resource labels',()=>{
 const storage={milk:2,clothing:1,wood:4,food:3,clay:84,beer:0,reed:9,brick:7};
 const before=JSON.stringify(storage),html=buildingInventoryHTML({storage});
 const keys=[...html.matchAll(/data-stock-resource="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(keys,RESOURCE_GROUPS.flatMap(g=>g.keys).filter(k=>k in storage));
 assert.match(html,/title="глина"/);assert.match(html,/aria-label="глина: 84"/);
 assert.match(html,/tabindex="0"/);assert.doesNotMatch(html,/<span>глина<\/span>/);
 assert.equal(JSON.stringify(storage),before);
});

test('work cards are closed disclosures with compact headers and all details inside',()=>{
 const s=createGame({start:'established'});s.buildings.push({type:'pottery',x:6,y:8,level:2});
 const html=cityToolsHTML(s,{tab:'workshops'}),card=html.match(/<article[^>]*data-city-building="6,8"[\s\S]*?<\/article>/)?.[0];
 assert.ok(card);assert.match(card,/<details[^>]*data-city-disclosure="6,8"[^>]*>/);
 assert.doesNotMatch(card,/<details[^>]* open/);
 const header=card.match(/<summary[\s\S]*?<\/summary>/)?.[0];
 assert.match(header,/Гончарный двор/);assert.match(header,/Ур\. 2/);assert.match(header,/0 \/ 2/);assert.match(header,/Год неизвестен/);
 assert.doesNotMatch(header,/Быстро назначить|Сырьё|Последние/);
 assert.doesNotMatch(card,/Быстро назначить/);
 const expanded=cityToolsHTML(s,{tab:'workshops',expandedBuildings:new Set(['6,8'])});
 assert.match(expanded,/<\/summary><div class="city-tools-building-body">[\s\S]*Быстро назначить/);
});

test('work cards group identical building types without changing state',()=>{
 const s=createGame({start:'established'});s.buildings.push({type:'pottery',x:6,y:8,level:1},{type:'weaver',x:7,y:8,level:1},{type:'pottery',x:8,y:8,level:1});
 const before=JSON.stringify(s),html=cityToolsHTML(s,{tab:'workshops'});
 const start=html.indexOf('data-city-building-group="pottery"'),end=html.indexOf('</section>',start),group=html.slice(start,end<0?undefined:end);
 assert.ok(group);assert.match(group,/data-city-building="6,8"/);assert.match(group,/data-city-building="8,8"/);
 assert.doesNotMatch(group,/data-city-building="7,8"/);assert.equal(JSON.stringify(s),before);
});

test('same-type buildings sort by completion date and order; unknown dates stay honest',()=>{
 const s=createGame({start:'established'});s.year=8;
 const built=(year,order)=>({year,season:0,elapsed:0,order});
 s.buildings.push({type:'pottery',x:6,y:8,level:1,built:built(2,30)},{type:'pottery',x:7,y:8,level:3},{type:'pottery',x:8,y:8,level:1,built:built(5,31)},{type:'pottery',x:9,y:8,level:2,built:built(5,32)});
 const before=JSON.stringify(s),html=cityToolsHTML(s,{tab:'workshops'});
 const positions=['9,8','8,8','6,8','7,8'].map(key=>html.indexOf(`data-city-building="${key}"`));
 assert.deepEqual([...positions].sort((a,b)=>a-b),positions);
 assert.match(html,/Год 5/);assert.match(html,/Год неизвестен/);assert.equal(JSON.stringify(s),before);
});

test('disclosure state survives UI refresh and tab changes without touching the save',()=>{
 const s=createGame({start:'established'});s.buildings.push({type:'pottery',x:6,y:8,level:1});
 const before=JSON.stringify(s),root={innerHTML:'',firstChild:null,handlers:{},contains:()=>true,addEventListener(type,fn){this.handlers[type]=fn;}};
 renderCityTools(root,s,{tab:'workshops'});
 assert.ok(root.handlers.toggle,'capture native disclosure changes');
 root.handlers.toggle({target:{dataset:{cityDisclosure:'6,8'},open:true}});
 renderCityTools(root,s);assert.match(root.innerHTML,/<details[^>]*data-city-disclosure="6,8"[^>]* open/);
 renderCityTools(root,s,{tab:'citizens'});renderCityTools(root,s,{tab:'workshops'});
 assert.match(root.innerHTML,/<details[^>]*data-city-disclosure="6,8"[^>]* open/);
 root.handlers.toggle({target:{dataset:{cityDisclosure:'6,8'},open:false}});renderCityTools(root,s);
 assert.doesNotMatch(root.innerHTML,/<details[^>]*data-city-disclosure="6,8"[^>]* open/);
 assert.equal(JSON.stringify(s),before);
});

test('a live refresh keeps keyboard focus on the same building summary',()=>{
 const s=createGame({start:'established'}),dom=new JSDOM('<main></main>'),root=dom.window.document.querySelector('main');
 renderCityTools(root,s,{tab:'workshops'});
 const first=root.querySelector('[data-city-disclosure]'),key=first.dataset.cityDisclosure;
 first.querySelector('summary').focus();
 s.buildings.push({type:'pottery',x:6,y:8,level:1});renderCityTools(root,s);
 const active=dom.window.document.activeElement;
 assert.equal(active.tagName,'SUMMARY');assert.equal(active.parentElement.dataset.cityDisclosure,key);
 dom.window.close();
});

test('the shared resident readout uses live thirst, hunger and clothing without changing the resident',()=>{
 const c={health:83,hunger:42,thirst:64,mood:49,faith:70,clothing:18};
 const dom=new JSDOM(residentVitalsHTML(c));
 const meters=[...dom.window.document.querySelectorAll('meter')];
 assert.deepEqual(meters.map(m=>m.value),[83,58,36,49,70,18]);
 assert.deepEqual(meters.filter(m=>m.closest('.is-warning')).map(m=>m.getAttribute('aria-label')),['Сытость','Утоление жажды','Состояние одежды']);
 assert.equal(c.thirst,64);
 dom.window.close();
});

test('resident help distinguishes the previous meal from food available at home now',()=>{
 const c={id:17,home:'2,3',lastMealQuality:.4,hunger:52,thirst:48,clothing:10};
 const s={buildings:[{type:'house',x:2,y:3,pantry:2,householdStock:{milk:2},water:4}]};
 const dom=new JSDOM(residentVitalsHTML(c,s,'map')),doc=dom.window.document;
 assert.match(doc.getElementById('vital-map-17-food').textContent,/40% порции.*3 ед\. еды.*путь до склада/);
 assert.match(doc.getElementById('vital-map-17-health').textContent,/сильный голод, жажда, ветхая одежда/);
 assert.match(doc.getElementById('vital-map-17-water').textContent,/4 ед\. воды/);
 dom.window.close();
});

test('food and water advice link to the supplied home and do not link when there is no home',()=>{
 const c={id:17,home:'courtyard-a'},s={buildings:[{id:'courtyard-a',type:'house',x:2,y:3}]};
 const dom=new JSDOM(residentVitalsHTML(c,s,'map')),doc=dom.window.document;
 assert.deepEqual([...doc.querySelectorAll('#vital-map-17-food [data-vital-home],#vital-map-17-water [data-vital-home]')].map(b=>[b.dataset.vitalHome,b.dataset.vitalTab]),[['courtyard-a','food'],['courtyard-a','water']]);
 assert.doesNotMatch(residentVitalsHTML({...c,home:null},s),/data-vital-home/);
 dom.window.close();
});
