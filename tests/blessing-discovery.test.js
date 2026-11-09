import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewCity} from '../new-game.js';
import {advanceTime,decode,encode,miracle} from '../engine.js';
import {recordNeighborWaterFact} from '../causal-facts.js';
import {buildingKey} from '../definitions.js';
import {blessingCupAt} from '../blessing-discovery.js';
import {cityToolsHTML} from '../ui-city-tools.js';

test('new Awakening remembers the neighborhood milestone only after two deliveries and three supplied homes',()=>{
 const s=createNewCity({mode:'awakening',seed:137});
 const [a,b,c]=s.buildings.filter(h=>h.type==='house'&&s.citizens.some(p=>p.home===buildingKey(h)));
 assert.ok(c);
 assert.match(miracle(s,'bless').reason,/доставки/);
 const helper=s.citizens.find(p=>p.home===buildingKey(a));
 const help=home=>recordNeighborWaterFact(s,helper,home,{station:null,origin:helper.home,target:buildingKey(home)},2);
 for(const home of s.buildings){home.pantry=home.pantryDelivered=0;home.water=100;home.waterDelivered=100;}
 for(const home of [a,b])home.pantry=home.pantryDelivered=20;
 help(b);
 advanceTime(s,.1);
 assert.equal(s.blessingDiscovery.qualifiedAt,null);
 assert.match(cityToolsHTML(s),/Подтверждённая помощь · 1 из 2/);
 help(c);
 advanceTime(s,.1);
 assert.equal(s.blessingDiscovery?.qualifiedAt,null);
 assert.match(cityToolsHTML(s),/Снабжённые дворы · 2 из 3/);
 c.pantry=c.pantryDelivered=20;
 advanceTime(s,.1);
 const qualified=s.blessingDiscovery.qualifiedAt;
 assert.equal(qualified,s.simTime);
 assert.deepEqual(s.blessingDiscovery.cup,{home:buildingKey(c),homeId:c.waterEntityId});
 assert.equal(blessingCupAt(s,c),true);
 s.happiness=70;
 s.resources.faith=0;
 const population=s.population;
 const trial=miracle(s,'bless');
 assert.ok(trial.ok,trial.reason);
 assert.equal(trial.receipt.faithSpent,0);
 assert.equal(s.population,population);
 assert.equal(s.miracleHistory.trials.bless.at,s.simTime);
 const afterTrial=encode(s);
 assert.equal(encode(decode(afterTrial)),afterTrial);
 const loadedTrial=decode(afterTrial);
 loadedTrial.cooldowns.bless=0;
 assert.match(miracle(loadedTrial,'bless').reason,/20 веры/);
 const invalid=JSON.parse(afterTrial);
 delete invalid.miracleHistory.trials.bless;
 assert.equal(decode(JSON.stringify(invalid)),null);
 assert.equal(s.blessingDiscovery.openingPending,true);

 c.pantry=0;
 advanceTime(s,.1);
 const loaded=decode(encode(s));
 assert.ok(loaded);
 assert.equal(loaded.blessingDiscovery.qualifiedAt,qualified);
 assert.match(cityToolsHTML(loaded),/Условия выполнены/);
 const index=loaded.buildings.findIndex(b=>buildingKey(b)===buildingKey(c));
 const replacement={...loaded.buildings[index]};
 delete replacement.waterEntityId;
 loaded.buildings[index]=replacement;
 assert.equal(blessingCupAt(loaded,replacement),false);
 const raw=encode(loaded);
 assert.equal(encode(decode(raw)),raw);
 const old=JSON.parse(raw);
 delete old.blessingDiscovery.cup;
 delete old.blessingDiscovery.openingPending;
 assert.equal(encode(decode(JSON.stringify(old))),JSON.stringify(old));

});

test('mature towns do not enroll in the awakening milestone',()=>{
 assert.equal(createNewCity({mode:'mature',seed:137}).blessingDiscovery,undefined);
 const old=createNewCity({mode:'awakening',seed:137});
 delete old.blessingDiscovery;
 const raw=encode(old);
 assert.equal(encode(decode(raw)),raw);
});

test('evacuated families do not qualify an empty origin and shelters need supplies for their guests',async()=>{
 const {blessingDiscoveryView}=await import('../blessing-discovery.js');
 const {ration}=await import('../households.js');
 const {waterDemand}=await import('../water.js');
 const s=createNewCity({mode:'awakening',seed:137});
 const [origin,host,other]=s.buildings.filter(b=>b.type==='house'&&s.citizens.some(c=>c.home===buildingKey(b)));
 for(const b of s.buildings){b.pantry=0;b.water=0;}
 for(const b of [origin,host,other]){
  const residents=s.citizens.filter(c=>c.home===buildingKey(b));
  b.pantry=residents.reduce((n,c)=>n+ration(c)*4/3,0);
  b.water=residents.reduce((n,c)=>n+waterDemand(c),0);
 }
 assert.equal(blessingDiscoveryView(s).homes,3);
 const moved=s.citizens.filter(c=>c.home===buildingKey(origin));
 for(const c of moved){
  c.fireShelter={host:buildingKey(host),kiln:'2,2'};
  c.route=[{x:host.x,y:host.y}];c.routeIndex=1;
 }
 assert.equal(blessingDiscoveryView(s).homes,1);
 host.pantry+=moved.reduce((n,c)=>n+ration(c)*4/3,0);
 host.water+=moved.reduce((n,c)=>n+waterDemand(c),0);
 assert.equal(blessingDiscoveryView(s).homes,2);
});

test('new Awakening blesses existing residents while version-one cities can still gain residents',async()=>{
 const {miracle}=await import('../engine.js');
 for(const legacy of [false,true]){
  const s=createNewCity({mode:'awakening',seed:137});
  s.blessingDiscovery.version=legacy?1:2;
  const stored=encode(s);
  assert.equal(encode(decode(stored)),stored);
  const town=decode(stored);
  const builder=town.citizens.find(person=>person.age>=16);
  Object.assign(builder,{role:'builder',calling:'builder',mood:70});
  town.godhood.stage='recognized';
  town.godhood.believerIds=[builder.id];
  town.resources.faith=100;
  town.happiness=70;
  assert.ok(town.capacity>town.population);
  const population=town.population;
  const cast=miracle(town,'bless');
  assert.ok(cast.ok,cast.reason);
  assert.equal(town.happiness,85);
  assert.ok(builder.mood>70);
  assert.equal(town.resources.faith,80);
  assert.equal(town.population-population,cast.receipt.population.newResidents);
  if(legacy)assert.ok(cast.receipt.population.newResidents>0);
  else {
   assert.equal(cast.receipt.population.newResidents,0);
   town.happiness=100;
   town.cooldowns.bless=0;
   for(const person of town.citizens)person.mood=100;
   assert.match(miracle(town,'bless').reason,/уже максимальны/);
   assert.equal(town.resources.faith,80);
  }
 }
});

test('saved Blessing receipts must respect the population rule of their city',()=>{
 const town=createNewCity({mode:'awakening',seed:137});
 town.blessingDiscovery.version=2;
 town.miracleCount=1;
 const population={newResidents:0,happiness:15,reserved:0};
 town.miracleHistory={version:1,trials:{},paid:{bless:{number:1,at:0,faithSpent:20,population}}};
 const supported=encode(town);
 assert.equal(encode(decode(supported)),supported);

 population.newResidents=3;
 assert.equal(decode(encode(town)),null);

 town.blessingDiscovery.version=1;
 const legacy=encode(town);
 assert.equal(encode(decode(legacy)),legacy);
});
