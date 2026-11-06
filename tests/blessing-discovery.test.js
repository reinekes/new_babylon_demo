import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewCity} from '../new-game.js';
import {advanceTime,decode,encode} from '../engine.js';
import {recordNeighborWaterFact} from '../causal-facts.js';
import {buildingKey} from '../definitions.js';
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
 c.pantry=0;
 advanceTime(s,.1);
 const loaded=decode(encode(s));
 assert.ok(loaded);
 assert.equal(loaded.blessingDiscovery.qualifiedAt,qualified);
 assert.match(cityToolsHTML(loaded),/Условия выполнены/);
});

test('mature towns do not enroll in the awakening milestone',()=>{
 assert.equal(createNewCity({mode:'mature',seed:137}).blessingDiscovery,undefined);
 const old=createNewCity({mode:'awakening',seed:137});
 delete old.blessingDiscovery;
 const raw=encode(old);
 assert.equal(encode(decode(raw)),raw);
});
