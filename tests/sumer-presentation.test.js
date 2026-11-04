import test from 'node:test';
import assert from 'node:assert/strict';
import {BUILDINGS,capacityOf} from '../definitions.js';
import {buildingDefinition,buildingPresentation} from '../building-presentation.js';
import {strictScenario,legacyScenario} from '../scenario-profiles.js';
import {createGame,yieldSummary} from '../engine.js';
import {miracleLockReason} from '../sacred-unlocks.js';
import {drawBuilding} from '../architecture.js';
const strict={scenario:strictScenario()},legacy={scenario:legacyScenario()};
test('strict gate presentation changes only name/description and leaves legacy global definitions intact',()=>{
 const before=structuredClone(BUILDINGS),gate=buildingDefinition(strict,'ishtarGate');assert.equal(gate.name,'Врата Инанны');assert.doesNotMatch(gate.desc,/из будущего|VI века|синие врата/);
 const {name,desc,...actual}=gate,{name:oldName,desc:oldDesc,...expected}=BUILDINGS.ishtarGate;assert.deepEqual(actual,expected);
 assert.equal(buildingDefinition(legacy,'ishtarGate'),BUILDINGS.ishtarGate);assert.deepEqual(BUILDINGS,before);
});
test('strict founding house description and summary match unchanged four-person economy',()=>{
 const b={type:'house',level:1,starterHut:true},s=createGame({scenario:strictScenario()});
 assert.equal(capacityOf(b),4);assert.equal(buildingPresentation(legacy,b).name,'Дом-улей');assert.equal(buildingPresentation(strict,b).name,'Первый дом');
 assert.match(buildingPresentation(strict,b).desc,/четырёх/);assert.doesNotMatch(buildingPresentation(strict,b).desc,/улей/);assert.doesNotMatch(yieldSummary(s,b),/улей/);
 assert.match(miracleLockReason(s,'inannaProtection'),/Врата Инанны/);assert.match(miracleLockReason(createGame(),'inannaProtection'),/Врата Иштар/);
});
function paint(b,state){const calls=[],ctx=new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});const r={ctx,s:1,point:()=>({x:0,y:0}),lighting:{night:0},lights:[],box:(...a)=>calls.push(['box',...a]),polygon:(...a)=>calls.push(['polygon',...a]),line:(...a)=>calls.push(['line',...a])};drawBuilding(r,b,{citizens:[],...state},0);return calls;}
test('strict 2D gate avoids glazed pigments and three ziggurat levels grow consistently',()=>{
 const gate={type:'ishtarGate',level:1,x:0,y:0};assert.notDeepEqual(paint(gate,strict),paint(gate,legacy));assert.doesNotMatch(JSON.stringify(paint(gate,strict)),/#234c6f|#366c88|#315c7c/);
 const heights=[1,2,3].map(level=>{const boxes=paint({type:'ziggurat',level,x:0,y:0},strict).filter(c=>c[0]==='box');return Math.max(...boxes.map(c=>c[5]-c[2]));});assert.ok(heights[0]<heights[1]&&heights[1]<heights[2]);
});

test('catalogue labels switch both ways without replacing buttons or losing focus',async()=>{
 const {JSDOM}=await import('jsdom'),{updateBuildingCardName}=await import('../ui-catalog.js');
 const dom=new JSDOM('<div><button class="building-card" data-type="ishtarGate"><span class="build-copy"><strong>Врата Иштар</strong></span></button><button class="building-info">?</button></div>'),card=dom.window.document.querySelector('.building-card'),info=dom.window.document.querySelector('.building-info');
 card.focus();updateBuildingCardName(card,strict);assert.equal(card.querySelector('strong').textContent,'Врата Инанны');assert.match(info.getAttribute('aria-label'),/Инанны/);assert.equal(dom.window.document.activeElement,card);
 updateBuildingCardName(card,legacy);assert.equal(card.querySelector('strong').textContent,'Врата Иштар');assert.match(info.title,/Иштар/);
});
