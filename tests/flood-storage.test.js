import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,encode,decode} from '../engine.js';
import {strictScenario} from '../scenario-profiles.js';
import {floodFootprint} from '../river-flood.js';
import {putStock,takeStock,validateInventory} from '../inventory.js';
import {requestTransfer,connectedStores} from '../district-logistics.js';
import {cityToolsHTML} from '../ui-city-tools.js';

function fixture({late=true}={}){
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 for(let i=0;i<1200&&s.tick<11;i++){
  s.event=null;
  advanceTime(s,.5);
 }
 assert.equal(s.tick,11);
 s.event=null;
 if(late){
  s.simTime+=44.99-s.seasonElapsed;
  s.seasonElapsed=44.99;
 }
 const flooded=floodFootprint(s,s.riverFlood);
 const key=[...flooded].find(key=>!s.buildings.some(b=>key===`${b.x},${b.y}`));
 const [x,y]=key.split(',').map(Number);
 const granary={type:'granary',x,y,level:1};
 s.buildings.push(granary);
 putStock(s,key,'food',40);
 putStock(s,key,'clay',10);
 return {s,key,granary};
}

test('winter forecast shows the at-risk store and reflects provisions already removed',()=>{
 const {s,key}=fixture();
 assert.match(cityToolsHTML(s,{tab:'workshops'}),/Под угрозой 10 ед\. еды/);
 assert.equal(takeStock(s,key,'food',20),20);
 assert.match(cityToolsHTML(s,{tab:'workshops'}),/Под угрозой 5 ед\. еды/);
});

test('spring flood spoils only local warehouse food once, across saves',()=>{
 const {s,key}=fixture();
 const raw=encode(s),restored=decode(raw);
 assert.ok(restored);
 assert.equal(encode(restored),raw);
 const granary=restored.buildings.find(b=>key===`${b.x},${b.y}`);
 advanceTime(restored,.02,{calendarRate:1});
 assert.equal(restored.season,0);
 assert.ok(Math.abs(granary.stock.food-30)<.01);
 assert.equal(granary.stock.clay,10);
 assert.ok(validateInventory(restored));
 assert.ok(restored.news.some(n=>n.title==='Разлив испортил запасы'));
 const active=decode(encode(restored));
 assert.ok(active);
 active.event=null;
 advanceTime(active,.02,{calendarRate:1});
 assert.ok(Math.abs(active.buildings.find(b=>key===`${b.x},${b.y}`).stock.food-30)<.01);
});


test('residents can deliver a food transfer from the forecast before the river rises',()=>{
 const {s,key,granary}=fixture({late:false});
 const shrine=s.buildings.find(b=>b.type==='shrine');
 const target=`${shrine.x},${shrine.y}`;
 assert.ok(connectedStores(s,key,target));
 assert.equal(requestTransfer(s,key,target,'food',12).ok,true);
 const job=s.district.jobs.at(-1);
 for(let i=0;i<300&&s.tick===11&&job.delivered<12;i++){
  s.event=null;
  advanceTime(s,.25);
 }
 assert.equal(s.tick,11);
 assert.equal(job.delivered,12);
 assert.ok(granary.stock.food<=28);
 assert.ok(validateInventory(s));
});
