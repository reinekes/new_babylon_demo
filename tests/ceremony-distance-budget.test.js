import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.js';
import {networkFor} from '../workforce.js';
import {startMiracleCelebration} from '../miracle-celebration.js';

test('a resident beyond the ceremony walking limit stays put without an A-star search',()=>{
 const s=createGame({start:'established'});s.citizens=s.citizens.slice(0,1);s.population=1;
 const c=s.citizens[0];Object.assign(c,{x:.5,y:31.5});
 const net=networkFor(s),get=net.graph.get;let searches=0;
 net.graph.get=function(...args){searches++;return get.apply(this,args);};
 assert.equal(startMiracleCelebration(s,'fertility',{center:{x:9.5,y:8.5}}),true);
 assert.equal(s.miracleCelebration.participants[0].joined,false);assert.deepEqual(s.miracleCelebration.participants[0].path,[{x:.5,y:31.5}]);assert.equal(searches,0);
});
