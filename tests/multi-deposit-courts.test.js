import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTime,build,createGame,decode,encode} from '../engine.js';
import {extractionOwner,extractionWorkArea} from '../extraction-courts.js';
import {clayRemaining,takeClay} from '../mineral-stock.js';
import {actorWorkActivity} from '../labor-life.js';
import {strictScenario} from '../scenario-profiles.js';
import {DATE_HARVEST_CAPACITY,dateStock,takeDates} from '../orchard-layout.js';

test('a court uses its neighboring source after the first empties and loads without relocating either',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const first={kind:'clay',x:5,y:8},second={kind:'clay',x:6,y:8};
 s.world.deposits=s.world.deposits.filter(d=>![first,second].some(p=>p.x===d.x&&p.y===d.y)).concat(first,second);
 takeClay(s,first.x,first.y,clayRemaining(s,first.x,first.y)-.25);
 const result=build(s,'clay',first.x,first.y,0,{instant:true});assert.ok(result.ok,result.reason);
 const court=s.buildings.at(-1),key=`${court.x},${court.y}`;
 assert.equal(extractionOwner(s,first),court);assert.equal(extractionOwner(s,second),court);
 const walked=new Set();
 for(let i=0;i<1200&&(clayRemaining(s,first.x,first.y)>0||clayRemaining(s,second.x,second.y)===480);i++){
  s.event=null;advanceTime(s,.1);
  for(const c of s.citizens.filter(c=>c.work===key)){
   const a=actorWorkActivity(s,c,[]);
   if(a?.stage==='working'||a?.stage==='strike')walked.add(`${a.target.x},${a.target.y}`);
  }
 }
 assert.equal(clayRemaining(s,first.x,first.y),0);
 assert.ok(clayRemaining(s,second.x,second.y)<480);
 assert.ok(walked.has('5,8')&&walked.has('6,8'));
 assert.equal(extractionWorkArea(court,s).z,6,'the shade remains clear of both source plots');
 const raw=encode(s);assert.equal(encode(decode(raw)),raw);
});

test('date plots keep independent finite fruit stocks through reload and refill in autumn',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const plots=[{kind:'dates',x:5,y:8},{kind:'dates',x:6,y:8}];
 s.world.deposits=s.world.deposits.filter(d=>!plots.some(p=>p.x===d.x&&p.y===d.y)).concat(plots);
 assert.ok(build(s,'garden',5,8,0,{instant:true}).ok);
 const [first,second]=plots;
 assert.equal(takeDates(s,first,100),DATE_HARVEST_CAPACITY);assert.equal(takeDates(s,first,1),0);
 assert.equal(takeDates(s,second,4),4);
 const stored=encode(s),loaded=decode(stored);assert.equal(encode(loaded),stored);
 assert.equal(dateStock(loaded,first),0);assert.equal(dateStock(loaded,second),DATE_HARVEST_CAPACITY-4);
 loaded.season=1;assert.equal(dateStock(loaded,first),0);
 loaded.season=2;assert.equal(dateStock(loaded,first),DATE_HARVEST_CAPACITY);assert.equal(dateStock(loaded,second),DATE_HARVEST_CAPACITY);
});
