import test from 'node:test';
import assert from 'node:assert/strict';
import {allocateCanalWater} from '../canal-flow.js';
import {createGame,advanceTime,build,encode,decode} from '../engine.js';
import {strictScenario} from '../scenario-profiles.js';
import {irrigationFor,fieldWater,lowWaterForecast} from '../irrigation.js';
import {callRepairWorkers,queueCanalCleaning} from '../management.js';
import {stampBuildingCompletion} from '../building-chronology.js';

test('canal branches share their common intake and can draw from another intake',()=>{
 const adjacent=new Map([
  ['head',['upper','lower']],['upper',['head']],['lower',['head','second']],['second',['lower']]
 ]);
 const capacity=new Map([['head',1],['upper',2],['lower',2],['second',2]]);
 const fields=new Map([['A',['upper']],['B',['lower']]]);
 const first=allocateCanalWater({adjacent,heads:['head'],capacity,fields});
 assert.deepEqual([...first.routes],[['A',['head','upper']]]);
 assert.equal(first.residual.get('head'),0);
 assert.equal(capacity.get('head'),1);
 const second=allocateCanalWater({adjacent,heads:['head','second'],capacity,fields});
 assert.deepEqual([...second.routes],[['A',['head','upper']],['B',['second','lower']]]);
 const closed=allocateCanalWater({adjacent,heads:['head','second'],capacity:new Map([...capacity,['lower',0]]),fields});
 assert.deepEqual([...closed.routes],[['A',['head','upper']]]);
});

test('a repair crew walks to a blocked intake, restores the field and can resume after saving',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const intake={type:'canal',x:13,y:6,level:1,silt:1};
 const field={type:'field',x:11,y:6,level:1};
 for(const b of [intake,{type:'canal',x:12,y:6,level:1},field]){
  s.buildings.push(b);stampBuildingCompletion(s,b);
 }
 assert.equal(irrigationFor(s).wet.size,0);
 assert.equal(fieldWater(s,field).canal,false);
 for(const [x,y] of [[8,7],[8,9],[10,8]])assert.ok(build(s,'house',x,y).ok);
 assert.ok(queueCanalCleaning(s,'13,6').ok);
 assert.ok(callRepairWorkers(s).ok);
 assert.equal(s.citizens.filter(c=>c.work==='13,6').length,1);
 for(let i=0;i<120&&intake.silt===1;i++)advanceTime(s,.5);
 assert.ok(intake.silt<1);
 const raw=encode(s),saved=decode(raw);assert.ok(saved);assert.equal(encode(saved),raw);
 const section=saved.buildings.find(b=>b.type==='canal'&&b.x===13);
 for(let i=0;i<360&&section.canalCleaning;i++){if(saved.event)saved.event=null;advanceTime(saved,.5);}
 assert.equal(section.canalCleaning,undefined);
 assert.equal(fieldWater(saved,field).canal,true);
 assert.ok(decode(encode(saved)));
});

test('summer low water reduces real field supply and an independent lake intake restores it',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const fields=[{type:'field',x:12,y:6,level:1},{type:'field',x:13,y:5,level:1}];
 s.buildings.push({type:'canal',x:13,y:6,level:1},...fields);
 s.year=2;
 assert.equal(fields.filter(b=>fieldWater(s,b).canal).length,2);
 const forecast=lowWaterForecast(s);
 assert.equal(forecast.active,false);
 assert.equal(forecast.fields.length,1);
 s.season=1;
 assert.equal(fields.filter(b=>fieldWater(s,b).canal).length,1);
 assert.equal(irrigationFor(s).intakeLimits.get('13,6'),1);
 assert.deepEqual(lowWaterForecast(s),{active:true,fields:forecast.fields});
 s.world={...s.world,lakes:[{cells:[{x:12,y:4}]}]};
 s.buildings.push({type:'canal',x:12,y:5,level:1});
 assert.equal(fields.filter(b=>fieldWater(s,b).canal).length,2);
 assert.deepEqual(lowWaterForecast(s).fields,[]);
 s.season=2;
 assert.equal(lowWaterForecast(s),null);
 assert.equal(fields.filter(b=>fieldWater(s,b).canal).length,2);
});

test('Depths pressure lends a share to one connected intake during low water, then expires',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const fields=[{type:'field',x:12,y:6,level:1},{type:'field',x:13,y:5,level:1}];
 s.buildings.push({type:'canal',x:13,y:6,level:1},{type:'canal',x:13,y:12,level:1},...fields);
 s.year=2;
 s.season=1;
 const low=()=>irrigationFor(s,{lowRiver:true});
 assert.equal(low().flow.routes.size,1);
 assert.equal(low().intakeLimits.get('13,12'),1);
 s.tick=5;
 s.depthSupply={pressure:{x:13,y:6,tick:5}};
 assert.equal(low().flow.routes.size,2);
 assert.equal(low().intakeLimits.get('13,12'),1);
 s.season=2;
 s.tick++;
 assert.equal(low().flow.routes.size,1);
});
