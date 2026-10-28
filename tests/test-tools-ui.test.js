import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.js';
import {buildingKey} from '../definitions.js';
import {renderTestTools} from '../ui-test-tools.js';

test('test tab is read-only HTML with explicit event, stock, improvement and funeral actions',()=>{
 const s=createGame({start:'established'}),before=JSON.stringify(s),html=renderTestTools(s);assert.equal(JSON.stringify(s),before);
 for(const name of ['event','resources','upgrade','map-upgrade','kill','kill-many'])assert.match(html,new RegExp(`data-test-action="${name}"`));
 for(const name of ['event','resource','building','citizen','count'])assert.match(html,new RegExp(`data-test-${name}`));assert.match(html,/>\+1000/);assert.match(html,/Тестирование/);assert.match(html,/Похороны/);assert.match(html,/min="1"/);assert.match(html,/max="11"/);
});
test('test tab preserves selected fields, uses stable resident IDs and disables unavailable actions',()=>{
 const s=createGame({start:'established'}),id=s.citizens[3].id,key=buildingKey(s.buildings[1]),html=renderTestTools(s,{event:'refugees',resource:'beer',building:key,citizen:id,count:3,mapUpgrade:true});
 assert.match(html,/<option value="refugees" selected/);assert.match(html,/<option value="beer" selected/);assert.match(html,new RegExp(`<option value="${key}" selected`));assert.match(html,new RegExp(`<option value="${id}" selected`));assert.match(html,/value="3"/);assert.match(html,/aria-pressed="true"/);
 s.relicQuest.phase='controlled';const before=JSON.stringify(s),locked=renderTestTools(s);assert.equal(JSON.stringify(s),before);assert.match(locked,/сначала заверши поиск артефакта/);assert.match(locked,/<fieldset disabled/);
});
test('test tab shows the actual media status and an independently audible lithophone without changing audio',()=>{
 const s=createGame(),audioStatus={enabled:true,theme:'funeral2',lithophone:true,playing:['funeral2','main','lithophone']},before=JSON.stringify({s,audioStatus}),html=renderTestTools(s,{audioStatus});
 assert.match(html,/data-test-audio-current>Похоронная песня · 2 · Главная тема · Литофон/);assert.match(html,/data-test-audio-theme>Фоновая тема: Похоронная песня · 2/);assert.match(html,/data-test-audio-lithophone>Литофон: слышен рядом/);assert.equal(JSON.stringify({s,audioStatus}),before);
 assert.match(renderTestTools(s,{audioStatus:{enabled:false,theme:null,playing:[]}}),/data-test-audio-current>Звук выключен/);
});
