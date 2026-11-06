import test from 'node:test';
import assert from 'node:assert/strict';
import {appendFish,takeFish,recordHomeFish,newRichCatchEvidence} from '../fish-provenance.js';

test('untagged food ahead of and between catches remains untagged after a split',()=>{
 const store={};
 appendFish(store,'fishStock',[3],4);
 appendFish(store,'fishStock',[2],10);
 assert.deepEqual(takeFish(store,'fishStock',4,12),[]);
 assert.deepEqual(takeFish(store,'fishStock',4,8),[3]);
 assert.deepEqual(takeFish(store,'fishStock',4,4),[-2,2]);
 assert.equal(store.fishStock,undefined);
});

test('only distinct inhabited courtyards receiving tagged food count',()=>{
 const a={type:'house',x:1,y:2},b={type:'house',x:2,y:2};
 const s={simTime:5,richCatchEvidence:newRichCatchEvidence(),citizens:[{home:'1,2'}]};
 recordHomeFish(s,a,[]);
 recordHomeFish(s,b,[3]);
 assert.deepEqual(s.richCatchEvidence.homes,[]);
 recordHomeFish(s,a,[1]);
 recordHomeFish(s,{...a},[1]);
 s.citizens.push({home:'2,2'});
 recordHomeFish(s,b,[-3,1]);
 assert.deepEqual(s.richCatchEvidence.homes,['1,2','2,2']);
});

import {createGame,advanceTime,decode,encode} from '../engine.js';
import {strictScenario,CAT_DISCOVERY_RULES} from '../scenario-profiles.js';
import {syncCitizens,invalidateAssignments} from '../workforce.js';
import {isShore,terrain} from '../world.js';

test('actual catches reach two occupied houses after a warehouse haul and a save in transit',()=>{
 let s=createGame({start:'established',mode:'awakening',scenario:{...strictScenario(),miracles:CAT_DISCOVERY_RULES}});
 s.richCatchEvidence=newRichCatchEvidence();
 s.resources.food=2;
 const shore=[];
 for(let y=1;y<31;y++)for(let x=1;x<39;x++){
  if(isShore(s,x,y)&&terrain(x,y,s)!=='water'&&!s.buildings.some(b=>b.x===x&&b.y===y))shore.push({x,y});
 }
 shore.sort((a,b)=>Math.hypot(a.x-9,a.y-8)-Math.hypot(b.x-9,b.y-8));
 const b={type:'fishing',...shore[0],level:1};
 s.buildings.push(b);
 Object.assign(s.citizens.find(c=>c.age>=16),{role:'production',workplace:`${b.x},${b.y}`});
 invalidateAssignments(s);syncCitizens(s);
 let warehouse=false,reloaded=false;
 for(let i=0;i<12000&&s.richCatchEvidence.homes.length<2;i++){
  advanceTime(s,.1);
  warehouse ||= s.buildings.some(b=>b.fishStock);
  if(!reloaded&&warehouse&&s.citizens.some(c=>c.fishPantry||c.fishCargo)){
   const saved=encode(s);
   s=decode(saved);
   assert.ok(s);
   assert.equal(encode(s),saved);
   const corrupt=JSON.parse(saved);
   const carrier=corrupt.citizens.find(c=>c.fishPantry||c.fishCargo);
   carrier[carrier.fishPantry?'fishPantry':'fishCargo']=[1e6];
   assert.equal(decode(JSON.stringify(corrupt)),null);
   reloaded=true;
  }
 }
 assert.ok(warehouse);
 assert.ok(reloaded);
 assert.equal(s.richCatchEvidence.homes.length,2,JSON.stringify({time:s.simTime,pop:s.population,stores:s.buildings.filter(b=>b.fishStock).map(b=>[b.type,b.stock.food,b.fishStock]),houses:s.buildings.filter(b=>b.type==='house').map(b=>[b.x,b.y,b.pantry]),jobs:s.district.jobs.slice(-4)}));
 assert.equal(encode(decode(encode(s))),encode(s));
 const old=createGame({start:'established',mode:'awakening',scenario:{...strictScenario(),miracles:CAT_DISCOVERY_RULES}});
 delete old.richCatchEvidence;
 assert.equal(encode(decode(encode(old))),encode(old));
});
