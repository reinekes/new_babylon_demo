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
 const replacement={...source};
 s.buildings[s.buildings.indexOf(source)]=replacement;
 const replaced=encode(s);
 assert.equal(approveHouseholdInitiative(s,replacement,offer).ok,false);
 assert.equal(encode(s),replaced);
 const fresh=householdInitiative(s,replacement);
 assert.equal(approveHouseholdInitiative(s,replacement,{...fresh,members:null}).ok,false);
 assert.equal(encode(s),replaced);
 assert.ok(approveHouseholdInitiative(s,replacement,fresh).ok);
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

test('the first accepted neighbor delivery is remembered by a settled small courtyard',async()=>{
 const {recordNeighborFoodFact}=await import('../causal-facts.js');
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const source=s.buildings.find(h=>buildingKey(h)===s.citizens[0].home);
 const offer=householdInitiative(s,source);
 const result=approveHouseholdInitiative(s,source,offer);
 assert.ok(result.ok,result.reason);
 const home=s.buildings.find(h=>buildingKey(h)===result.key),project=home.householdInitiative;
 for(let i=0;i<900&&!project.settled;i++){s.event=null;advanceTime(s,.25);}
 assert.ok(project.settled);
 const courier=s.citizens.find(c=>c.home&&c.home!==result.key&&!project.members.includes(c.id));
 assert.ok(courier);
 const origin=s.buildings.find(b=>buildingKey(b)===courier.home);
 courier.pantryTarget=result.key;
 recordNeighborFoodFact(s,courier,home,0);
 assert.equal(project.firstNeighborAid,undefined);
 recordNeighborFoodFact(s,courier,home,2);
 const fact={resource:'food',homeId:home.waterEntityId,originId:origin.waterEntityId,origin:courier.home,courierId:courier.id,amount:2,time:s.simTime};
 assert.deepEqual(project.firstNeighborAid,fact);
 recordNeighborFoodFact(s,courier,home,1);
 assert.deepEqual(project.firstNeighborAid,fact);
 delete courier.pantryTarget;
 const raw=encode(s);
 assert.equal(encode(decode(raw)),raw);
 const invalid=JSON.parse(raw);
 invalid.buildings.find(b=>b.householdInitiative).householdInitiative.firstNeighborAid.originId=home.waterEntityId;
 assert.equal(decode(JSON.stringify(invalid)),null);
});

test('a different family can occupy the finished courtyard without settling the original project',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const [first,second]=s.citizens;
 const source=s.buildings.find(h=>buildingKey(h)===first.home);
 const offer=householdInitiative(s,source),result=approveHouseholdInitiative(s,source,offer);
 assert.ok(result.ok,result.reason);
 const home=s.buildings.find(b=>buildingKey(b)===result.key);
 for(const resident of [first,second])Object.assign(resident,{partner:null,age:46});
 for(let step=0;step<1400&&!s.citizens.some(c=>c.home===result.key);step++){
  s.event=null;
  advanceTime(s,.25);
 }
 assert.equal(home.construction,undefined);
 assert.ok(s.citizens.some(c=>c.home===result.key&&!offer.members.includes(c.id)));
 assert.equal(home.householdInitiative.settled,undefined);
 const raw=encode(s);
 assert.equal(encode(decode(raw)),raw);
});

test('a house with reserved places does not prevent another family from proposing a courtyard',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const source=s.buildings.find(b=>buildingKey(b)===s.citizens[0].home);
 const first=householdInitiative(s,source);
 assert.ok(first.ok,first.reason);
 const house={type:'house',x:first.x,y:first.y,level:1,starterHut:true};
 s.buildings.push(house);
 assert.match(householdInitiative(s,source).reason,/свободный дом/);
 const key=buildingKey(house);
 s.arrivalGroup={home:key,count:2};
 assert.match(householdInitiative(s,source).reason,/свободный дом/);
 s.arrivalGroup.count=3;
 assert.ok(householdInitiative(s,source).ok);
 delete s.arrivalGroup;
 house.householdInitiative={members:[2,3]};
 assert.ok(householdInitiative(s,source).ok);
});

test('demolition cannot relocate neighbors into a courtyard reserved for another family',async()=>{
 const {canDemolish,demolish}=await import('../management.js');
 const {networkFor}=await import('../workforce.js');
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const source=s.buildings.find(b=>buildingKey(b)==='8,8');
 const oldHome=s.buildings.find(b=>buildingKey(b)==='9,9');
 const offer=householdInitiative(s,source);
 assert.ok(offer.ok,offer.reason);
 const {x,y,members}=offer;
 const reserved={type:'house',x,y,level:1,starterHut:true,householdInitiative:{source:offer.source,members,startedAt:s.simTime}};
 s.buildings.push(reserved);
 s.capacity+=capacityOf(reserved);
 networkFor(s);
 const raw=encode(s);
 assert.match(canDemolish(s,oldHome),/доступного жилья/);
 assert.equal(demolish(s,oldHome.x,oldHome.y).ok,false);
 assert.equal(encode(s),raw);
 delete reserved.householdInitiative;
 assert.ok(demolish(s,oldHome.x,oldHome.y).ok);
});

test('a finished courtyard waiting for its family does not take new arrivals',async()=>{
 const {arrivalHousing}=await import('../arrival-hospitality.js');
 const {syncCitizens}=await import('../workforce.js');
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 s.population=s.capacity;
 syncCitizens(s);
 const source=s.buildings.find(b=>buildingKey(b)==='8,8');
 const {x,y,members}=householdInitiative(s,source);
 const house={type:'house',x,y,level:1,starterHut:true,householdInitiative:{source:'8,8',members,startedAt:0}};
 s.buildings.push(house);
 const key=buildingKey(house);
 assert.equal(arrivalHousing(s).some(row=>row.home===key),false);
 const count=s.population;
 s.population+=1;
 syncCitizens(s);
 assert.equal(s.population,count);
 s.arrivalGroup={home:key,count:2};
 assert.equal(arrivalHousing(s,{includeReserved:true}).find(row=>row.home===key)?.beds,4);
 delete s.arrivalGroup;
 delete house.householdInitiative;
 s.population+=1;
 syncCitizens(s);
 assert.equal(s.citizens.at(-1).home,key);
});

test('a spare house for one couple does not block a larger family in the same courtyard',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const source=s.buildings.find(b=>buildingKey(b)===s.citizens[0].home);
 const first=householdInitiative(s,source);
 assert.ok(first.ok,first.reason);
 const child=s.citizens.find(c=>c.age<16);
 child.parents=[2,3];
 const spare={type:'house',x:first.x,y:first.y,level:1,starterHut:true};
 s.buildings.push(spare);
 s.arrivalGroup={home:buildingKey(spare),count:2};
 const before=encode(s),offer=householdInitiative(s,source);
 assert.ok(offer.ok,offer.reason);
 assert.deepEqual(offer.members,[2,3,child.id]);
 assert.equal(encode(s),before);
});

test('a small courtyard proposal explains evacuation, an existing project and family size',async()=>{
 const {cancelConstruction}=await import('../management.js');
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const [first,partner]=s.citizens,source=s.buildings.find(b=>buildingKey(b)===first.home);
 const otherHome=s.buildings.find(b=>b.type==='house'&&b!==source);
 partner.home=buildingKey(otherHome);
 for(const c of s.citizens.slice(2))c.partner=null;
 partner.fireShelter={host:first.home};
 assert.match(householdInitiative(s,source).reason,/укрытия/);
 delete partner.fireShelter;
 const offer=householdInitiative(s,source);
 assert.ok(offer.ok,offer.reason);
 assert.ok(approveHouseholdInitiative(s,source,offer).ok);
 assert.match(householdInitiative(s,source).reason,/уже есть/);
 assert.ok(cancelConstruction(s,offer.x,offer.y).ok);
 for(const c of s.citizens.slice(-3))Object.assign(c,{age:10,parents:[first.id,partner.id]});
 assert.match(householdInitiative(s,source).reason,/четыре места/);
});
