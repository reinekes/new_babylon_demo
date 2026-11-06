import test from 'node:test';
import assert from 'node:assert/strict';
import {planNewRoad} from '../roads.js';
import {networkFor,routeBetween} from '../workforce.js';

function enclosure(){
 const s={world:{lakes:[]},roads:[],buildings:[]};
 for(let y=4;y<=10;y++)for(let x=3;x<=8;x++){
  if(x===3||y===4||x===8||y===10)s.buildings.push({type:'cityWall',x,y,level:1});
 }
 return s;
}
const crossing=s=>routeBetween(s,'6,8','11,8');

test('joined walls seal their corners and a one-section breach reconnects walking',()=>{
 const s=enclosure();
 assert.equal(crossing(s),null);
 s.buildings=s.buildings.filter(b=>b.x!==8||b.y!==8);
 assert.ok(crossing(s));
});

test('the gate opens only after completion and only along its orientation',()=>{
 const s=enclosure();
 s.buildings=s.buildings.filter(b=>b.x!==8||![6,7].includes(b.y));
 const gate={type:'cityGate',x:8,y:6,footprint:2,rotation:0,construction:{kind:'new'}};
 s.buildings.push(gate);
 assert.equal(crossing(s),null);
 delete gate.construction;
 const route=crossing(s);
 assert.ok(route?.some(p=>p.x===8.5&&p.y===6.5));
 const before=networkFor(s);
 gate.rotation=1;
 assert.equal(crossing(s),null);
 assert.notEqual(networkFor(s),before);
});

test('street edges respect wall barriers and an unfinished gate keeps a reachable building approach',()=>{
 const s=enclosure();
 s.buildings=s.buildings.filter(b=>b.x!==8||![6,7].includes(b.y));
 const gate={type:'cityGate',x:8,y:6,footprint:2,rotation:0,construction:{kind:'new'}};
 s.buildings.push(gate);
 s.roadAnchors=[{type:'road',x:5,y:7},{type:'road',x:10,y:7}];
 assert.match(planNewRoad(s,{x:5,y:7},{x:10,y:7}).reason,/Нет сухого пути/);
 const closed=networkFor(s);
 const approach=closed.ports.find(p=>p.building===gate);
 assert.ok(approach&&closed.nodes.has(approach.key));
 const gateSides=closed.ports.filter(p=>p.building.siteKey==='8,6');
 assert.equal(gateSides.length,2);
 assert.notEqual(closed.components.get(gateSides[0].key),closed.components.get(gateSides[1].key));
 assert.equal(closed.edges.some(([a,b])=>a.y===6.5&&b.y===6.5&&Math.min(a.x,b.x)<8&&Math.max(a.x,b.x)>8),false);
 delete gate.construction;
 const open=networkFor(s);
 assert.ok(open.edges.some(([a,b])=>a.y===6.5&&b.y===6.5&&Math.min(a.x,b.x)<8&&Math.max(a.x,b.x)>8));
});
