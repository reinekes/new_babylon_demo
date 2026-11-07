import test from 'node:test';
import assert from 'node:assert/strict';
import {appendFish,takeFish,recordHomeFish,newRichCatchEvidence,recordInspiredCatch,richCatchView} from '../fish-provenance.js';

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
 const courier={id:0,home:'3,2'},recipient={id:1,home:'1,2'};
 const s={simTime:5,richCatchEvidence:newRichCatchEvidence(),citizens:[courier,recipient]};
 recordHomeFish(s,a,[],courier);
 recordHomeFish(s,b,[3],courier);
 assert.deepEqual(s.richCatchEvidence.homes,[]);
 recordHomeFish(s,a,[1],courier);
 recordHomeFish(s,{...a},[1],courier);
 recipient.home='2,2';
 recordHomeFish(s,b,[2],courier);
 assert.deepEqual(s.richCatchEvidence.homes,['1,2']);
 s.citizens.push({id:2,home:'2,2'});
 recordHomeFish(s,b,[-3,1],courier);
 assert.deepEqual(s.richCatchEvidence.homes,['1,2','2,2']);
 assert.deepEqual(s.causalFacts.fishHomes,[
  {home:'1,2',homeId:a.waterEntityId,recipientId:1,courierId:0,time:5,amount:1},
  {home:'2,2',homeId:b.waterEntityId,recipientId:2,courierId:0,time:5,amount:1}
 ]);
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
 Object.assign(s.citizens.find(c=>c.age>=16),{role:'production',calling:'fisher',workplace:`${b.x},${b.y}`});
 invalidateAssignments(s);syncCitizens(s);
 let warehouse=false,reloaded=false;
 for(let i=0;i<18000&&!richCatchView(s).qualified;i++){
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
 assert.ok(richCatchView(s).qualified);
 assert.equal(s.richCatchEvidence.homes.length,2,JSON.stringify({time:s.simTime,pop:s.population,stores:s.buildings.filter(b=>b.fishStock).map(b=>[b.type,b.stock.food,b.fishStock]),houses:s.buildings.filter(b=>b.type==='house').map(b=>[b.x,b.y,b.pantry]),jobs:s.district.jobs.slice(-4)}));
 assert.equal(s.causalFacts.fishHomes.length,2);
 assert.ok(s.causalFacts.fishHomes.every(r=>r.amount>0&&s.richCatchEvidence.homes.includes(r.home)));
 assert.equal(encode(decode(encode(s))),encode(s));
 const invalid=JSON.parse(encode(s));
 invalid.causalFacts.fishHomes[1].recipientId=invalid.causalFacts.fishHomes[0].recipientId;
 assert.equal(decode(JSON.stringify(invalid)),null);
 const former=JSON.parse(encode(s));
 delete former.causalFacts.fishHomes;
 const oldWithReceipts=decode(JSON.stringify(former));
 assert.ok(oldWithReceipts);
 assert.equal(richCatchView(oldWithReceipts).qualified,true);
 assert.equal(oldWithReceipts.causalFacts.fishHomes,undefined);
 const old=createGame({start:'established',mode:'awakening',scenario:{...strictScenario(),miracles:CAT_DISCOVERY_RULES}});
 delete old.richCatchEvidence;
 assert.equal(encode(decode(encode(old))),encode(old));
});

test('ten catches must come from one inspired fisher and two homes must receive fish',()=>{
 const s={simTime:0,richCatchEvidence:newRichCatchEvidence(),citizens:[{id:1,home:'1,2'},{id:2,home:'2,2'}]};
 const [a,b]=s.citizens;
 const fishery={type:'fishing',x:3,y:2};
 a.work=b.work='3,2';
 for(let i=0;i<10;i++)recordInspiredCatch(s,fishery,a,1);
 assert.equal(richCatchView(s).catches,0);
 a.calling=b.calling='fisher';
 for(let i=0;i<5;i++)for(const c of [a,b])recordInspiredCatch(s,fishery,c,1);
 assert.equal(richCatchView(s).catches,5);
 for(let i=0;i<5;i++)recordInspiredCatch(s,fishery,a,1);
 assert.equal(richCatchView(s).qualified,false);
 assert.equal(richCatchView(s).catches,10);
 recordHomeFish(s,{type:'house',x:a.id,y:2},[1],a);
 s.citizens.shift();
 recordHomeFish(s,{type:'house',x:b.id,y:2},[1],b);
 assert.equal(richCatchView(s).qualified,true);
});
