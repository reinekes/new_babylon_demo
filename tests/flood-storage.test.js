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

test('only local delivered jars protect food, and damaged jars are debited once across reload',()=>{
 const {s,key}=fixture({late:false});
 const shrine=s.buildings.find(b=>b.type==='shrine');
 const remote=`${shrine.x},${shrine.y}`;
 putStock(s,remote,'pottery',10);
 assert.equal(requestTransfer(s,remote,key,'pottery',2).ok,true);
 const job=s.district.jobs.at(-1);
 assert.match(cityToolsHTML(s,{tab:'workshops'}),/Под угрозой 10 ед\. еды/);
 for(let i=0;i<300&&s.tick===11&&job.delivered<2;i++){
  s.event=null;
  advanceTime(s,.25);
 }
 assert.equal(s.tick,11);
 assert.equal(job.delivered,2);
 assert.match(cityToolsHTML(s,{tab:'workshops'}),/Под угрозой 6 ед\. еды · В таре 16 ед\./);
 const granary=s.buildings.find(b=>key===`${b.x},${b.y}`);
 const before=granary.stock.food,beforePottery=s.resources.pottery;
 s.simTime+=44.99-s.seasonElapsed;
 s.seasonElapsed=44.99;
 const raw=encode(s),restored=decode(raw);
 assert.ok(restored);
 assert.equal(encode(restored),raw);
 advanceTime(restored,.02,{calendarRate:1});
 const flooded=restored.buildings.find(b=>key===`${b.x},${b.y}`);
 assert.ok(Math.abs(flooded.stock.food-(before-(before-16)/4))<.01);
 assert.equal(flooded.stock.pottery,0);
 assert.equal(restored.resources.pottery,beforePottery-2);
 assert.ok(validateInventory(restored));
 const after=decode(encode(restored));
 assert.ok(after);
 after.event=null;
 advanceTime(after,.02,{calendarRate:1});
 assert.equal(after.resources.pottery,beforePottery-2);
});

test('complete cover preserves all food and only jars used for it crack',()=>{
 const {s,key,granary}=fixture();
 takeStock(s,key,'food',35);
 putStock(s,key,'pottery',3);
 advanceTime(s,.02,{calendarRate:1});
 assert.ok(Math.abs(granary.stock.food-5)<.01);
 assert.equal(granary.stock.pottery,2);
 assert.ok(s.news.some(n=>n.title==='Разлив повредил тару'));
 assert.ok(!s.news.some(n=>n.title==='Разлив испортил запасы'));
});
