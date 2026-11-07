import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewCity} from '../new-game.js';
import {advanceTime,decode,encode} from '../engine.js';
import {recordNeighborWaterFact} from '../causal-facts.js';
import {buildingKey} from '../definitions.js';
import {blessingCupAt} from '../blessing-discovery.js';
import {cityToolsHTML} from '../ui-city-tools.js';

test('new Awakening remembers the neighborhood milestone only after two deliveries and three supplied homes',()=>{
 const s=createNewCity({mode:'awakening',seed:137});
 const [a,b,c]=s.buildings.filter(h=>h.type==='house'&&s.citizens.some(p=>p.home===buildingKey(h)));
 assert.ok(c);
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
