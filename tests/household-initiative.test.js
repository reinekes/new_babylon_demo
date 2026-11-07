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

test('autonomous housing is off by default and opt-in starts one reserved project per day',async()=>{
 const {setAutonomousHousing}=await import('../household-initiative.js');
 let s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 advanceTime(s,1);
 assert.ok(!s.buildings.some(b=>b.householdInitiative));
 assert.ok(setAutonomousHousing(s,true).ok);
 const raw=encode(s);s=decode(raw);assert.equal(encode(s),raw);
 const clay=s.resources.clay,faith=s.resources.faith;
 advanceTime(s,.1);advanceTime(s,.1);
 const sites=s.buildings.filter(b=>b.householdInitiative);
 assert.equal(sites.length,1);
 assert.equal(sites[0].householdInitiative.autonomous,true);
 assert.equal(s.resources.clay,clay-12);
 assert.equal(s.resources.faith,faith);
 assert.ok(setAutonomousHousing(s,false).ok);
 assert.equal(s.householdBuildingPolicy.enabled,false);
 assert.ok(decode(encode(s)));
});

test('new family projects retain their original courtyard through rebuilding and loading',async()=>{
 const {householdInitiativeFrom}=await import('../household-initiative.js');
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const source=s.buildings.find(h=>buildingKey(h)===s.citizens[0].home);
 assert.ok(approveHouseholdInitiative(s,source,householdInitiative(s,source)).ok);
 const site=s.buildings.find(b=>b.householdInitiative),project=site.householdInitiative;
 assert.ok(Number.isSafeInteger(project.sourceId));
 assert.equal(project.sourceId,source.waterEntityId);
 assert.ok(householdInitiativeFrom(project,source));
 const replacement={...source};
 delete replacement.waterEntityId;
 s.buildings[s.buildings.indexOf(source)]=replacement;
 assert.ok(!householdInitiativeFrom(project,replacement));
 const raw=encode(s);
 assert.equal(encode(decode(raw)),raw);
 const legacy=JSON.parse(raw);
 delete legacy.causalFacts;
 const oldProject=legacy.buildings.find(b=>b.householdInitiative).householdInitiative;
 delete oldProject.sourceId;
 assert.ok(householdInitiativeFrom(oldProject,replacement));
 const oldSave=JSON.stringify(legacy);
 assert.equal(encode(decode(oldSave)),oldSave);
});

test('a family building a small courtyard takes part through the normal site queue',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const [builder,carrier]=s.citizens.filter(c=>c.home==='9,9'&&c.age>=16);
 const source=s.buildings.find(b=>buildingKey(b)===builder.home);
 s.buildings.find(b=>buildingKey(b)==='8,8').level=2;
 carrier.home='8,8';
 builder.role='builder';
 const offer=householdInitiative(s,source);
 assert.ok(offer.ok,offer.reason);
 assert.ok(offer.members.includes(builder.id)&&offer.members.includes(carrier.id));
 const result=approveHouseholdInitiative(s,source,offer);
 assert.ok(result.ok,result.reason);
 advanceTime(s,.1);
 assert.equal(builder.site,result.key);
 assert.equal(builder.siteDuty,'builder');
 assert.equal(carrier.site,result.key);
 assert.equal(carrier.siteDuty,'carrier');
 const raw=encode(s);
 assert.equal(encode(decode(raw)),raw);
});
