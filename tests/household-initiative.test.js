import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTime,canBuild,createGame,decode,encode} from '../engine.js';
import {strictScenario} from '../scenario-profiles.js';
import {buildingKey,capacityOf} from '../definitions.js';
import {approveHouseholdInitiative,householdInitiative} from '../household-initiative.js';

test('a crowded couple proposes nearby housing without spending faith or creating residents',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const [a,b]=s.citizens;
 const source=s.buildings.find(h=>buildingKey(h)===a.home);
 const raw=encode(s),offer=householdInitiative(s,source);
 assert.ok(offer.ok,offer.reason);
 assert.equal(encode(s),raw);
 const ids=s.citizens.map(c=>c.id),{faith,clay,reed}=s.resources;
 const result=approveHouseholdInitiative(s,source,offer);
 assert.ok(result.ok,result.reason);
 const home=s.buildings.find(h=>buildingKey(h)===result.key);
 assert.deepEqual(home.householdInitiative.members,[a.id,b.id]);
 assert.equal(s.resources.faith,faith);
 assert.equal(s.resources.clay,clay-12);
 assert.equal(s.resources.reed,reed-8);
 assert.equal(capacityOf(home),0);
 assert.equal(approveHouseholdInitiative(s,source,offer).ok,false);
 const saved=encode(s);assert.equal(encode(decode(saved)),saved);
 for(let step=0;step<900&&!home.householdInitiative.settled;step++){
  s.event=null;
  advanceTime(s,.25);
 }
 assert.equal(home.construction,undefined);
 assert.equal(capacityOf(home),4);
 assert.equal(a.home,result.key);
 assert.equal(b.home,result.key);
 assert.ok(ids.every(id=>s.citizens.some(c=>c.id===id)));
 const settled=encode(s);
 assert.equal(encode(decode(settled)),settled);
});

test('an Awakening household can approve a secular project and a stale offer spends nothing',()=>{
 const s=createGame({start:'established',mode:'awakening',scenario:strictScenario()});
 const source=s.buildings.find(b=>buildingKey(b)===s.citizens[0].home);
 const offer=householdInitiative(s,source);
 assert.ok(offer.ok,offer.reason);
 assert.match(canBuild(s,'house',offer.x,offer.y),/присутствии/);
 const before=encode(s);
 assert.equal(approveHouseholdInitiative(s,source,{...offer,x:offer.x+1}).ok,false);
 assert.equal(encode(s),before);
 assert.ok(approveHouseholdInitiative(s,source,offer).ok);
 const project=s.buildings.find(b=>b.householdInitiative);
 for(let step=0;step<480&&project.construction;step++){
  s.event=null;
  advanceTime(s,.25);
 }
 assert.equal(project.construction,undefined);
 assert.deepEqual(s.godhood.believerIds,[]);
 assert.deepEqual(s.godhood.completedProjects,[]);
 assert.equal(s.resources.faith,0);
 assert.ok(decode(encode(s)));
});
