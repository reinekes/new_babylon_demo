import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewCity} from '../new-game.js';
import {miracle,createGame,encode,decode,advanceTime,advanceSeason} from '../engine.js';
import {strictScenario,CAT_DISCOVERY_RULES} from '../scenario-profiles.js';
import {fisheryOptions} from '../labor-life.js';
import {fisheryStock,takeFish,restFishery} from '../fishery-stock.js';
import {syncCitizens,invalidateAssignments,networkFor} from '../workforce.js';
import {cityToolsHTML} from '../ui-city-tools.js';
import {foodYieldMultiplier,richCatchCharges,useRichCatch,richCatchMapReason} from '../rich-catch.js';

test('Rich Catch needs the milestone and a completed fishery, costs faith and lasts for six catches',()=>{
 const s=createNewCity({mode:'awakening'}),target={x:10,y:8},yard={type:'fishing',...target},other={type:'fishing',x:12,y:8};
 s.resources.faith=40;
 assert.equal(miracle(s,'richCatch',target).ok,false);
 s.richCatchEvidence={version:1,homes:['1,2','2,2'],fisher:s.citizens[0].id};
 assert.equal(miracle(s,'richCatch',target).ok,false);
 s.buildings.push(yard,other);
 assert.equal(miracle(s,'richCatch',target).ok,true);
 assert.equal(s.resources.faith,22);
 assert.equal(s.cooldowns.richCatch,2);
 assert.equal(foodYieldMultiplier(s,yard),1.5);
 assert.equal(foodYieldMultiplier(s,other),1);
 useRichCatch(s,yard,0);
 assert.equal(richCatchCharges(s,yard),6);
 for(let i=0;i<6;i++)useRichCatch(s,yard,1);
 assert.equal(richCatchCharges(s,yard),0);
 assert.equal(foodYieldMultiplier(s,yard),1);
});

test('fertility only boosts fields and gardens in enrolled cities and old saves retain their former bonus',()=>{
 const s=createNewCity({mode:'awakening'}),old=createGame();
 for(const state of [s,old])state.buffs.fertility=2;
 for(const type of ['field','garden','fishing','hunting']){
  assert.equal(foodYieldMultiplier(old,{type}),1.6);
  assert.equal(foodYieldMultiplier(s,{type}),['field','garden'].includes(type)?1.6:1);
 }
 delete old.cooldowns.richCatch;
 const raw=encode(old);
 assert.equal(encode(decode(raw)),raw);
});

test('a real fishing trip consumes one charge and lands the bonus from the finite shoal',()=>{
 let s=createGame({start:'established',mode:'awakening',scenario:{...strictScenario(),miracles:CAT_DISCOVERY_RULES}});
 const yard={type:'fishing',x:11,y:9,level:1};
 s.buildings.push(yard);
 const fisher=s.citizens.find(c=>c.age>=16);
 Object.assign(fisher,{role:'production',workplace:'11,9',calling:'fisher'});
 s.richCatchEvidence={version:1,homes:['8,8','9,9'],fisher:fisher.id};
 s.resources.faith=40;
 invalidateAssignments(s);syncCitizens(s);
 assert.equal(miracle(s,'richCatch',yard).ok,true);
 for(let i=0;i<400&&!Object.keys(s.fisheries||{}).length;i++)advanceTime(s,.2);
 assert.equal(richCatchCharges(s,yard),5);
 assert.equal(Object.values(s.fisheries).reduce((n,q)=>n+48-q.stock,0),7.5);
 assert.ok(s.citizens.some(c=>c.fishCargo?.[0]===7.5)||yard.workshopStock.output.food===7.5);
 const raw=encode(s);
 s=decode(raw);
 assert.ok(s);
 assert.equal(encode(s),raw);
 advanceSeason(s);
 assert.equal(s.buildings.find(b=>b.type==='fishing').richCatch,undefined);
 assert.equal(s.cooldowns.richCatch,1);
});

test('a map without a fishing shore reports an unavailable chapter without spending faith',()=>{
 const s=createNewCity({mode:'awakening'});
 s.richCatchEvidence={version:1,homes:['1,2','2,2'],fisher:s.citizens[0].id};
 s.world={...s.world,river:{axis:'y',offset:-20,slope:0,frequency:0,amplitude:0,phase:0},lakes:[]};
 s.resources.faith=50;
 assert.match(miracle(s,'richCatch',{x:2,y:2}).reason,/нет берега/);
 assert.equal(s.resources.faith,50);
 assert.match(cityToolsHTML(s),/Богатый улов»<\/h3><p>На этой карте нет берега/);
 s.world.lakes=[{id:'lake-test',cells:[{x:12,y:12}]}];
 assert.equal(richCatchMapReason(s),'');
});

test('a closed fishing ground preserves all charges until a real catch after reopening',()=>{
 const s=createGame({start:'established',mode:'awakening',scenario:{...strictScenario(),miracles:CAT_DISCOVERY_RULES}});
 const yard={type:'fishing',x:11,y:9,level:1};
 s.buildings.push(yard);
 const fisher=s.citizens.find(c=>c.age>=16);
 Object.assign(fisher,{role:'production',workplace:'11,9',calling:'fisher'});
 s.richCatchEvidence={version:1,homes:['8,8','9,9'],fisher:fisher.id};
 invalidateAssignments(s);syncCitizens(s);
 const grounds=fisheryOptions(s,networkFor(s).ports.find(p=>p.building===yard));
 assert.ok(grounds.length>0);
 for(const {key} of grounds){assert.equal(takeFish(s,key,48),48);assert.ok(restFishery(s,key));}
 const runUntil=stop=>{
  for(let i=0;i<1600&&!stop();i++){s.event=null;advanceTime(s,.4);}
  assert.ok(stop());
 };
 runUntil(()=>s.simTime>=52);
 s.resources.faith=50;
 assert.equal(miracle(s,'richCatch',yard).ok,true);
 runUntil(()=>s.simTime>=59);
 assert.equal(richCatchCharges(s,yard),6);
 assert.ok(grounds.every(({key})=>fisheryStock(s,key).resting));
 runUntil(()=>richCatchCharges(s,yard)<6);
 assert.equal(richCatchCharges(s,yard),5);
 assert.ok(s.simTime>=60&&s.tick===1);
});
