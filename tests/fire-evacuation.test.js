import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,decode,encode} from '../engine.js';
import {strictScenario} from '../scenario-profiles.js';
import {initializeProductionAccounting} from '../building-production-history.js';
import {evacuateFireHome,syncCitizens} from '../workforce.js';
import {initializeKilns,IGNITION_CHECK,setKilnBanked} from '../kilns.js';
import {supplyHome} from '../households.js';

test('a neighboring family walks to temporary shelter, then returns without changing its home',()=>{
 let s=createGame({start:'established',scenario:strictScenario()});
 const kiln={type:'kiln',x:10,y:9,level:1},source='9,9',host='8,8';
 s.buildings.push(kiln);
 s.buildings.find(b=>b.type==='house'&&b.x===8).level=3;
 s.capacity+=8;
 initializeKilns(s);
 initializeProductionAccounting(s);syncCitizens(s);
 Object.assign(kiln.firing,{hot:4,time:IGNITION_CHECK});
 kiln.kilnFire=true;
 const family=s.citizens.filter(c=>c.home===source),ids=family.map(c=>c.id);
 family[0].cargo={food:1};
 const before=encode(s);
 assert.equal(evacuateFireHome(s,kiln,source).ok,false);
 assert.equal(encode(s),before);
 family[0].cargo={};
 assert.ok(evacuateFireHome(s,kiln,source).ok);
 assert.ok(family.every(c=>supplyHome(c,{arrived:true})===null));
 const raw=encode(s);s=decode(raw);assert.equal(encode(s),raw);
 const people=()=>s.citizens.filter(c=>ids.includes(c.id));
 for(let i=0;i<100&&!people().every(c=>supplyHome(c,{arrived:true})===host);i++){s.event=null;advanceTime(s,.1);}
 assert.ok(people().every(c=>supplyHome(c,{arrived:true})===host));
 assert.ok(setKilnBanked(s,s.buildings.find(b=>b.type==='kiln'),true).ok);
 for(let i=0;i<100&&people().some(c=>c.fireShelter);i++){s.event=null;advanceTime(s,.1);}
 assert.ok(people().every(c=>!c.fireShelter&&c.home===source));
});

test('a closed gate keeps the family sheltered with access to household supplies until return is possible',()=>{
 const s=createGame({start:'established',scenario:strictScenario()});
 const kiln={type:'kiln',x:10,y:9,level:1},source='9,9',host='6,8';
 const house=s.buildings.find(b=>b.type==='house'&&b.x===8);
 house.x=6;house.level=3;s.capacity+=8;
 for(const c of s.citizens.filter(c=>c.home==='8,8')){c.home=host;c.x=6.5;}
 for(let y=4;y<=10;y++)for(let x=3;x<=8;x++){
  if((x===3||y===4||x===8||y===10)&&!(x===8&&[6,7].includes(y)))s.buildings.push({type:'cityWall',x,y,level:1});
 }
 const gate={type:'cityGate',x:8,y:6,level:1,footprint:2,rotation:0};
 s.buildings.push(gate,kiln);
 initializeKilns(s);initializeProductionAccounting(s);syncCitizens(s);
 Object.assign(kiln.firing,{hot:4,time:IGNITION_CHECK});kiln.kilnFire=true;
 const family=s.citizens.filter(c=>c.home===source);
 const advance=()=>{s.event=null;advanceTime(s,.1);};
 const result=evacuateFireHome(s,kiln,source);assert.ok(result.ok,result.reason);
 for(let i=0;i<220&&!family.every(c=>supplyHome(c,{arrived:true})===host);i++)advance();
 assert.ok(family.every(c=>supplyHome(c,{arrived:true})===host));
 gate.rotation=1;
 assert.ok(setKilnBanked(s,kiln,true).ok);
 for(let i=0;i<20;i++)advance();
 assert.ok(family.every(c=>supplyHome(c,{arrived:true})===host));
 gate.rotation=0;
 for(let i=0;i<220&&family.some(c=>c.fireShelter);i++)advance();
 assert.ok(family.every(c=>!c.fireShelter&&c.home===source));
});
