import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.js';
import {cityToolsHTML,renderCityTools} from '../ui-city-tools.js';
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
 assert.match(header,/Гончарный двор/);assert.match(header,/Ур\. 2/);assert.match(header,/0\/2/);assert.match(header,/Год неизвестен/);
 assert.doesNotMatch(header,/Быстро назначить|Сырьё|Последние|Нет работника/);
 assert.ok(card.indexOf('Быстро назначить')>card.indexOf('</summary>'));
});

test('work cards group identical building types without changing state',()=>{
 const s=createGame({start:'established'});s.buildings.push({type:'pottery',x:6,y:8,level:1},{type:'weaver',x:7,y:8,level:1},{type:'pottery',x:8,y:8,level:1});
 const before=JSON.stringify(s),html=cityToolsHTML(s,{tab:'workshops'});
 const start=html.indexOf('data-city-building-group="pottery"'),end=html.indexOf('<section class="city-tools-workshop-group"',start+1),group=html.slice(start,end<0?undefined:end);
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
 const s=createGame({start:'established'}),focused={matches:()=>true,parentElement:{dataset:{cityDisclosure:'12,8'}}},calls=[];
 const root={innerHTML:'',firstChild:null,contains:()=>true,addEventListener(){},ownerDocument:{activeElement:focused},querySelectorAll:()=>[{dataset:{cityDisclosure:'12,8'},querySelector:()=>({focus:options=>calls.push(options)})}]};
 renderCityTools(root,s,{tab:'workshops'});s.simTime+=1;renderCityTools(root,s);
 assert.ok(calls.length>=1);assert.deepEqual(calls.at(-1),{preventScroll:true});
});
