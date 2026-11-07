import test from 'node:test';
import assert from 'node:assert/strict';
import {build,createGame,advanceTime,decode,encode} from '../engine.js';
import {finishConstruction,workRequired} from '../construction.js';
import {assignWorkplace} from '../management.js';
import {syncCitizens} from '../workforce.js';
import {putStock} from '../inventory.js';
import {strictScenario} from '../scenario-profiles.js';

test('a joinery yard works delivered imported timber into parts for the warehouse',()=>{
 const s=createGame({start:'established',scenario:strictScenario()});
 putStock(s,'9,8','timber',2);
 const result=build(s,'joineryYard',10,9);assert.ok(result.ok,result.reason);
 const b=s.buildings.at(-1);
 b.construction.delivered={...b.construction.required};
 for(const k of Object.keys(b.construction.remaining))b.construction.remaining[k]=0;
 b.construction.work=workRequired(b);assert.ok(finishConstruction(s));
 syncCitizens(s);assert.ok(assignWorkplace(s,0,'10,9').ok);assert.ok(assignWorkplace(s,1,'10,9').ok);
 let worked=false;
 for(let i=0;i<2400&&s.resources.joinery<1;i++){
  s.event=null;advanceTime(s,.1);worked||=b.artisan.stage==='cuttingJoinery';
  if(i%30===0)assert.ok(decode(encode(s)));
 }
 assert.ok(worked);
 assert.equal(s.resources.joinery,1);
 assert.equal(s.resources.timber,0);
 assert.ok(s.district.jobs.some(q=>q.source==='10,9'&&q.resource==='joinery'&&q.delivered===1));
});

test('ready boat parts replace raw wood and a cancelled order returns them exactly once',async()=>{
 const {buildHarborTender}=await import('../engine.js');
 const {cancelConstruction}=await import('../management.js');
 const s=createGame({start:'established',scenario:strictScenario()});
 const b={type:'harbor',x:11,y:9,level:1};s.buildings.push(b);syncCitizens(s);
 putStock(s,'9,8','joinery',2);
 const wood=s.resources.wood;
 assert.ok(buildHarborTender(s,b,{joinery:true}).ok);
 assert.equal(s.resources.wood,wood);
 assert.equal(s.resources.joinery,0);
 assert.equal(b.construction.required.joinery,2);
 assert.equal(workRequired(b),8);
 const raw=encode(s);assert.equal(encode(decode(raw)),raw);
 assert.ok(cancelConstruction(s,11,9).ok);
 assert.equal(s.resources.joinery,2);
 assert.equal(cancelConstruction(s,11,9).ok,false);
 assert.equal(s.resources.joinery,2);
});

test('a joinery upgrade reserves parts and protects a granary after real work finishes',async()=>{
 const {upgrade}=await import('../engine.js');
 const {floodStorageRisk}=await import('../river-flood.js');
 const s=createGame({start:'established',scenario:strictScenario()});
 const b={type:'granary',x:10,y:9,level:1};s.buildings.push(b);syncCitizens(s);
 putStock(s,'9,8','brick',80);putStock(s,'9,8','joinery',2);
 putStock(s,'10,9','food',30);
 assert.ok(upgrade(s,10,9,{joinery:true}).ok);
 assert.equal(b.construction.required.joinery,2);
 assert.equal(workRequired(b),18);
 assert.equal(floodStorageRisk(s,new Set(['10,9']))[0].loss,7.5);
 for(let i=0;i<2800&&b.construction;i++){s.event=null;advanceTime(s,.1);}
 assert.equal(b.level,2);
 assert.ok(b.joineryLevels.includes(2));
 const risk=floodStorageRisk(s,new Set(['10,9']))[0];
 assert.equal(risk.loss,(b.stock.food-risk.covered)/8);
 const raw=encode(s);assert.equal(encode(decode(raw)),raw);
});
