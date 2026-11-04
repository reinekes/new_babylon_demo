import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.js';
import {advanceGenerations} from '../demography.js';
import {networkFor} from '../workforce.js';

function family(){
 const s=createGame({start:'established'});s.citizens=s.citizens.slice(0,2);s.population=2;s.happiness=60;
 for(const [i,c]of s.citizens.entries())Object.assign(c,{age:24,sex:i?'m':'f',home:i?'9,9':'8,8',partner:s.citizens[1-i].id,parents:[],phase:'home',cargo:{},buildCargo:{}});
 return s;
}
test('seasonal housing finds the first free reachable home without searching individual walking routes',()=>{
 const s=family();s.buildings.push({type:'house',x:10,y:9,level:1},{type:'house',x:11,y:9,level:1});
 const net=networkFor(s),get=net.graph.get;let adjacencyReads=0;
 net.graph.get=function(...args){adjacencyReads++;return get.apply(this,args);};
 advanceGenerations(s);
 assert.deepEqual(s.citizens.map(c=>c.home),['10,9','10,9']);assert.equal(adjacencyReads,0,'connected components already prove reachability; seasonal housing must not run A*');
});
test('a free house across an unbridged river is skipped without changing destination order',()=>{
 const s=family();s.buildings.push({type:'house',x:30,y:9,level:1},{type:'house',x:10,y:9,level:1});advanceGenerations(s);
 assert.deepEqual(s.citizens.map(c=>c.home),['10,9','10,9']);
});
test('relocation keeps loaded families in place and requires both parents to reach the house',()=>{
 const s=family();s.buildings.push({type:'house',x:10,y:9,level:1});s.citizens[1].cargo={wood:1};advanceGenerations(s);
 assert.deepEqual(s.citizens.map(c=>c.home),['8,8','9,9']);assert.equal(s.citizens[1].cargo.wood,1);
 const split=family();split.buildings.push({type:'house',x:30,y:9,level:1},{type:'house',x:10,y:9,level:1});split.citizens[1].home='30,9';advanceGenerations(split);
 assert.deepEqual(split.citizens.map(c=>c.home),['8,8','30,9']);
});
