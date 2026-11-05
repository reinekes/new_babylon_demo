import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,build,encode,decode,advanceTime} from '../engine.js';
import {callHarvestWorkers,callUnloadWorkers} from '../management.js';
import {activeLaborKind,harvestCallActive,harvestCandidates} from '../city-labor.js';
import {useThreeDayCalendar} from '../calendar.js';
import {strictScenario} from '../scenario-profiles.js';
import {trade} from '../trading.js';

test('a harvest call takes available adults from construction and survives a reload',()=>{
 const s=createGame({start:'established',mode:'mature',seed:137,scenario:strictScenario()});
 for(let i=0;i<250&&s.simTime<122-1e-7;i++){
  if(s.event)s.event=null;
  advanceTime(s,Math.min(1,122-s.simTime));
 }
 assert.equal(s.season,2);
 useThreeDayCalendar(s);
 const field=s.buildings.find(b=>b.type==='field'),key=`${field.x},${field.y}`;
 Object.assign(field.crop,{sown:1,growth:1,seedUsed:4,total:40,remaining:40,harvested:0,sheaves:0,threshed:0,spoiled:0});
 for(const [x,y] of [[8,7],[8,9],[10,8]])assert.equal(build(s,'house',x,y).ok,true);
 assert.equal(s.citizens.filter(c=>c.work===key).length,0);
 const ids=s.citizens.map(c=>c.id);
 assert.equal(callHarvestWorkers(s).ok,true);
 assert.equal(s.citizens.filter(c=>c.work===key).length,2);
 assert.equal(harvestCallActive(s),true);
 assert.equal(callHarvestWorkers(s).ok,false);
 assert.deepEqual(s.citizens.map(c=>c.id),ids);
 const saved=decode(encode(s));
 assert.ok(saved);
 assert.equal(harvestCallActive(saved),true);
 assert.equal(encode(saved),encode(s));
 for(let i=0;i<260&&saved.simTime<183&&!saved.event;i++)advanceTime(saved,.5);
 assert.ok(saved.buildings.find(b=>b.type==='field').crop.harvested>0);
 assert.equal(harvestCallActive(saved),false);
});

test('the last adult at each home, supply staff and active loads are excluded',()=>{
 const citizen=(id,home,rest={})=>({id,home,age:24,role:'auto',...rest});
 const people=[citizen(1,'east'),citizen(2,'east',{role:'watercarrier'}),citizen(3,'east',{cargo:{clay:2}}),
  citizen(4,'east',{work:'fish'}),citizen(5,'east'),citizen(6,'west'),
  citizen(7,'east',{buildCargo:{wood:2}})];
 const b=new Map([['fish',{type:'fishing'}]]);
 assert.deepEqual(harvestCandidates(people,b).map(c=>c.id),[5]);
});

test('unloading moves paid goods with extra porters and finishes a load after expiry',()=>{
 let s=createGame({start:'established',seed:137,mode:'mature'});
 assert.equal(build(s,'market',10,9).ok,true);
 for(let i=0;i<3000&&s.trade.caravan?.phase!=='trading';i++){
  if(s.event)s.event=null;
  advanceTime(s,.1);
 }
 assert.equal(s.trade.caravan?.phase,'trading');
 assert.equal(callUnloadWorkers(s).ok,false);
 advanceTime(s,2);
 s.trade.silver=500;
 assert.equal(trade(s,'stone','buy',24).ok,true);
 const silver=s.trade.silver;
 assert.equal(callUnloadWorkers(s).ok,true);
 assert.equal(s.citizens.filter(c=>c.tradeJob).length,4);
 assert.equal(callHarvestWorkers(s).ok,false);
 for(let i=0;i<100&&!s.citizens.some(c=>c.tradeJob&&c.cargo.stone>0);i++)advanceTime(s,.1);
 const carrier=s.citizens.find(c=>c.tradeJob&&c.cargo.stone>0);
 assert.ok(carrier);
 s.cityLabor.started=s.simTime-59.99;
 const raw=encode(s);
 s=decode(raw);
 assert.ok(s);
 assert.equal(encode(s),raw);
 advanceTime(s,.1);
 assert.equal(activeLaborKind(s),null);
 assert.ok(s.citizens.find(c=>c.id===carrier.id).cargo.stone>0);
 for(let i=0;i<450&&s.trade.deliveries[0].delivered<24;i++)advanceTime(s,.1);
 assert.equal(s.trade.deliveries[0].delivered,24);
 assert.equal(s.resources.stone,24);
 assert.equal(s.trade.silver,silver);
 assert.ok(decode(encode(s)));
});
