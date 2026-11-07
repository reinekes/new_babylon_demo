import {advanceTrade} from '../trading.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,encode,decode} from '../engine.js';
import {strictScenario} from '../scenario-profiles.js';
import {buildingKey,housingOf} from '../definitions.js';
import {bindWaterProject,recordNeighborFoodFact,recordNeighborWaterFact,householdNameEvidence,waterNameEvidence} from '../causal-facts.js';
import {confirmProjectWater} from '../human-projects.js';

test('delivery evidence survives demolition and distinguishes a replacement on the same tile',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const home=s.buildings.find(b=>b.type==='house'),key=buildingKey(home);
 const requester=s.citizens.find(c=>c.home===key),courier=s.citizens.find(c=>c.home!==key);
 const station={type:'waterpoint',x:12,y:7,level:1,humanWaterProject:{organizerId:courier.id,requesterId:requester.id,home:key,startedAt:0}};
 s.buildings.push(station);
 bindWaterProject(s,station,home);
 confirmProjectWater(s,courier,buildingKey(station),home,3);
 confirmProjectWater(s,courier,buildingKey(station),home,3);
 assert.equal(s.causalFacts.water.length,1);
 const [first]=s.causalFacts.water;
 assert.equal(first.amount,3);
 s.buildings.pop();
 assert.deepEqual(decode(encode(s)).causalFacts.water,[first]);
 const replacement={...station,humanWaterProject:{...station.humanWaterProject}};
 delete replacement.waterEntityId;
 delete replacement.humanWaterProject.delivery;
 s.buildings.push(replacement);
 bindWaterProject(s,replacement,home);
 confirmProjectWater(s,courier,buildingKey(replacement),home,2);
 const [,second]=s.causalFacts.water;
 assert.notEqual(second.stationId,first.stationId);
 assert.equal(second.homeId,first.homeId);
 assert.deepEqual(decode(encode(s)).causalFacts,s.causalFacts);
 s.causalFacts.water.push({...second});
 assert.equal(decode(encode(s)),null);
});

test('a remaining resident receives the first delivery after the original requester moves',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const home=s.buildings.find(b=>b.type==='house'),key=buildingKey(home);
 const [requester,recipient]=s.citizens.filter(c=>c.home===key);
 const courier=s.citizens.find(c=>c.home!==key);
 const station={type:'waterpoint',x:12,y:7,level:1,humanWaterProject:{organizerId:courier.id,requesterId:requester.id,home:key,startedAt:0}};
 s.buildings.push(station);
 bindWaterProject(s,station,home);
 requester.home=courier.home;
 confirmProjectWater(s,courier,buildingKey(station),home,3);
 confirmProjectWater(s,courier,buildingKey(station),home,3);
 const [fact]=s.causalFacts.water;
 assert.equal(s.causalFacts.water.length,1);
 assert.equal(fact.requesterId,requester.id);
 assert.equal(fact.recipientId,recipient.id);
 assert.equal(householdNameEvidence(s,[requester]).water,null);
 assert.equal(householdNameEvidence(s,[recipient]).water,fact);
 const raw=encode(s);
 assert.equal(encode(decode(raw)),raw);
 fact.recipientId=s.demography.nextId;
 assert.equal(decode(encode(s)),null);
});

test('a replaced recipient dwelling cannot receive evidence intended for its predecessor',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const home=s.buildings.find(b=>b.type==='house'),key=buildingKey(home);
 const requester=s.citizens.find(c=>c.home===key),courier=s.citizens.find(c=>c.home!==key);
 const station={type:'waterpoint',x:12,y:7,level:1,humanWaterProject:{organizerId:courier.id,requesterId:requester.id,home:key,startedAt:0}};
 s.buildings.push(station);
 bindWaterProject(s,station,home);
 const replacement={...home};
 delete replacement.waterEntityId;
 s.buildings[s.buildings.indexOf(home)]=replacement;
 confirmProjectWater(s,courier,buildingKey(station),replacement,3);
 assert.equal(station.humanWaterProject.delivery,undefined);
 assert.deepEqual(s.causalFacts.water,[]);
 assert.ok(decode(encode(s)));
});

test('neighbor deliveries deduplicate a trip and both directions of a pair for one day',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const [origin,home]=s.buildings.filter(b=>b.type==='house');
 const first=s.citizens.find(c=>c.home===buildingKey(origin)),second=s.citizens.find(c=>c.home===buildingKey(home));
 const route=(courier,target)=>({station:null,origin:courier.home,target:buildingKey(target)});
 const trip=route(first,home);
 recordNeighborWaterFact(s,first,home,trip,0);
 assert.equal(s.causalFacts,undefined);
 recordNeighborWaterFact(s,first,home,trip,3);
 recordNeighborWaterFact(s,second,origin,route(second,origin),2);
 assert.equal(s.causalFacts.neighborWater.length,1);
 s.simTime=60;s.seasonElapsed=15;s.tick=1;s.season=1;
 advanceTrade(s);
 recordNeighborWaterFact(s,first,home,trip,1);
 assert.equal(s.causalFacts.neighborWater.length,1);
 recordNeighborWaterFact(s,first,home,route(first,home),2);
 assert.equal(s.causalFacts.neighborWater.length,2);
 const saved=decode(encode(s));
 assert.ok(saved);
 assert.deepEqual(saved.causalFacts,s.causalFacts);
 saved.causalFacts.neighborWater.push({...saved.causalFacts.neighborWater.at(-1)});
 assert.equal(decode(encode(saved)),null);
});

test('rebuilding a recipient on the same cell keeps the old fact distinct',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const [origin,home]=s.buildings.filter(b=>b.type==='house');
 const helper=s.citizens.find(c=>c.home===buildingKey(origin));
 const trip=()=>({station:null,origin:helper.home,target:buildingKey(home)});
 recordNeighborWaterFact(s,helper,home,trip(),2);
 const replacement={...home};
 delete replacement.waterEntityId;
 s.buildings[s.buildings.indexOf(home)]=replacement;
 recordNeighborWaterFact(s,helper,replacement,trip(),2);
 const [a,b]=s.causalFacts.neighborWater;
 assert.equal(a.home,b.home);
 assert.notEqual(a.homeId,b.homeId);
 assert.equal(a.originId,b.originId);
 const saved=decode(encode(s));
 assert.ok(saved);
 assert.deepEqual(saved.causalFacts,s.causalFacts);
});

test('food and water for the same pair on the same day are one aid event',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const [origin,home]=s.buildings.filter(b=>b.type==='house');
 const helper=s.citizens.find(c=>c.home===buildingKey(origin));
 helper.pantryTarget=buildingKey(home);
 recordNeighborFoodFact(s,helper,home,2);
 recordNeighborWaterFact(s,helper,home,{station:null,origin:helper.home,target:buildingKey(home)},3);
 delete helper.pantryTarget;
 assert.equal(s.causalFacts.neighborFood.length,1);
 assert.equal(s.causalFacts.neighborWater,undefined);
 const saved=decode(encode(s));
 assert.ok(saved);
 saved.causalFacts.neighborWater=[{...saved.causalFacts.neighborFood[0]}];
 assert.equal(decode(encode(saved)),null);
});

test('a second occupied courtyard records an actual project delivery once and keeps it after demolition',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const [home,neighbor]=s.buildings.filter(b=>b.type==='house');
 const requester=s.citizens.find(c=>c.home===buildingKey(home));
 const courier=s.citizens.find(c=>c.home===buildingKey(neighbor));
 const station={type:'waterpoint',x:12,y:7,level:1,humanWaterProject:{organizerId:courier.id,requesterId:requester.id,home:buildingKey(home),startedAt:0}};
 s.buildings.push(station);
 bindWaterProject(s,station,home);
 confirmProjectWater(s,courier,buildingKey(station),neighbor,0);
 const evacuated=s.citizens.filter(c=>c.home===buildingKey(neighbor));
 for(const c of evacuated)c.floodShelter=buildingKey(home);
 confirmProjectWater(s,courier,buildingKey(station),neighbor,3);
 for(const c of evacuated)delete c.floodShelter;
 assert.equal(s.causalFacts.waterWitnesses,undefined);
 confirmProjectWater(s,courier,buildingKey(station),neighbor,3);
 confirmProjectWater(s,courier,buildingKey(station),neighbor,2);
 assert.equal(s.causalFacts.waterWitnesses.length,1);
 const [receipt]=s.causalFacts.waterWitnesses;
 const recipient=s.citizens.find(c=>c.id===receipt.recipientId);
 assert.equal(recipient.home,buildingKey(neighbor));
 assert.deepEqual(householdNameEvidence(s,[recipient]).water,receipt);
 assert.equal(householdNameEvidence(s,[requester]).water,null);
 const legacy=JSON.parse(encode(s));
 delete legacy.causalFacts.waterWitnesses[0].recipientId;
 const old=decode(JSON.stringify(legacy));
 assert.ok(old);
 assert.equal(householdNameEvidence(old,[recipient]).water,null);
 legacy.causalFacts.waterWitnesses[0].recipientId=s.demography.nextId;
 assert.equal(decode(JSON.stringify(legacy)),null);
 delete s.causalFacts.waterWitnesses;
 assert.equal(decode(encode(s)),null);
 s.causalFacts.waterWitnesses=[receipt];
 assert.deepEqual([receipt.stationId,receipt.homeId,receipt.courierId,receipt.amount],[station.waterEntityId,neighbor.waterEntityId,courier.id,3]);
 assert.equal(station.humanWaterProject.delivery,undefined);
 const raw=encode(s);
 assert.equal(encode(decode(raw)),raw);
 s.causalFacts.waterWitnesses.push({...receipt});
 assert.equal(decode(encode(s)),null);
 s.causalFacts.waterWitnesses.pop();
 s.buildings.pop();
 assert.deepEqual(decode(encode(s)).causalFacts.waterWitnesses,[receipt]);
});

test('the water name needs two distinct courtyards and keeps its first witnesses when the archive fills',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const [origin,first]=s.buildings.filter(b=>b.type==='house');
 const second={...first,x:10,y:8};
 s.buildings.push(second);
 s.capacity=housingOf(s);
 const requester=s.citizens.find(c=>c.home===buildingKey(origin));
 const courier=s.citizens.find(c=>c.home===buildingKey(first));
 const resident=s.citizens.find(c=>c!==courier&&c.home===buildingKey(first));
 resident.home=buildingKey(second);
 const nextStation=()=>{
  const station={type:'waterpoint',x:12,y:7,level:1,humanWaterProject:{organizerId:courier.id,requesterId:requester.id,home:buildingKey(origin),startedAt:0}};
  s.buildings.push(station);
  bindWaterProject(s,station,origin);
  return station;
 };
 const station=nextStation();
 confirmProjectWater(s,courier,buildingKey(station),first,3);
 confirmProjectWater(s,courier,buildingKey(station),first,2);
 assert.equal(waterNameEvidence(s),null);
 s.buildings.pop();
 for(let i=0;i<34;i++){
  const next=nextStation();
  confirmProjectWater(s,courier,buildingKey(next),first,3);
  s.buildings.pop();
 }
 assert.equal(waterNameEvidence(s),null);
 const secondStation=nextStation();
 confirmProjectWater(s,courier,buildingKey(secondStation),second,1);
 const evidence=waterNameEvidence(s);
 assert.deepEqual(evidence?.map(f=>f.home),[buildingKey(first),buildingKey(second)]);
 assert.deepEqual(evidence?.map(f=>f.stationId),[station.waterEntityId,secondStation.waterEntityId]);
 s.buildings.pop();
 for(let i=0;i<20;i++){
  const next=nextStation();
  confirmProjectWater(s,courier,buildingKey(next),first,3);
  confirmProjectWater(s,courier,buildingKey(next),second,2);
  s.buildings.pop();
 }
 assert.equal(s.causalFacts.waterWitnesses.length,32);
 assert.deepEqual(waterNameEvidence(s),evidence);
 const restored=decode(encode(s));
 assert.ok(restored);
 assert.deepEqual(waterNameEvidence(restored),evidence);
});

test('a rebuilt house cannot consume the second witness slot at the same address',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const [origin,first]=s.buildings.filter(b=>b.type==='house');
 const second={...first,x:10,y:8};
 s.buildings.push(second);s.capacity=housingOf(s);
 const requester=s.citizens.find(c=>c.home===buildingKey(origin));
 const courier=s.citizens.find(c=>c.home===buildingKey(first));
 s.citizens.find(c=>c!==courier&&c.home===courier.home).home=buildingKey(second);
 const station={type:'waterpoint',x:12,y:7,level:1,humanWaterProject:{organizerId:courier.id,requesterId:requester.id,home:buildingKey(origin),startedAt:0}};
 s.buildings.push(station);bindWaterProject(s,station,origin);
 confirmProjectWater(s,courier,buildingKey(station),first,3);
 const replacement={...first};
 delete replacement.waterEntityId;
 s.buildings[s.buildings.indexOf(first)]=replacement;
 const legacy=JSON.parse(encode(s));
 delete legacy.buildings.find(b=>b.humanWaterProject).humanWaterProject.witnessHomePlaces;
 for(const input of [encode(s),JSON.stringify(legacy)]){
  const copy=decode(input);assert.ok(copy);
  const site=copy.buildings.find(b=>b.humanWaterProject),p=site.humanWaterProject;
  const resident=copy.citizens.find(c=>c.id===courier.id);
  const houseAt=key=>copy.buildings.find(b=>buildingKey(b)===key);
  confirmProjectWater(copy,resident,buildingKey(site),houseAt(buildingKey(first)),2);
  assert.deepEqual(p.witnessHomeIds,[first.waterEntityId]);
  confirmProjectWater(copy,resident,buildingKey(site),houseAt(buildingKey(second)),2);
  assert.deepEqual(waterNameEvidence(copy).map(f=>f.home),[buildingKey(first),buildingKey(second)]);
  assert.deepEqual(p.witnessHomePlaces,[buildingKey(first),buildingKey(second)]);
  assert.equal(encode(decode(encode(copy))),encode(copy));
  p.witnessHomePlaces[0]=p.witnessHomePlaces[1];
  assert.equal(decode(encode(copy)),null);
 }
});
