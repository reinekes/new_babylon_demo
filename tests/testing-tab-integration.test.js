import test from 'node:test';import assert from 'node:assert/strict';
import {createGame} from '../engine.js';import {cityToolsHTML} from '../ui-city-tools.js';
test('city overview has a testing tab with explicit tools and actual audio status',()=>{
 const s=createGame({start:'established'}),before=JSON.stringify(s),html=cityToolsHTML(s,{tab:'testing',testOptions:{audioStatus:{enabled:true,theme:'nightLights',playing:['nightLights'],lithophone:false}}});
 assert.match(html,/data-city-tab="testing"/);assert.match(html,/data-test-action="event"/);assert.match(html,/data-test-action="kill-many"/);assert.match(html,/data-test-audio-current>Ночь огней/);assert.equal(JSON.stringify(s),before);
});
