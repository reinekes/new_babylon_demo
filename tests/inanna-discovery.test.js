import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewCity} from '../new-game.js';
import {miracleLockReason,syncSacredUnlocks} from '../sacred-unlocks.js';

test('a new Inanna chapter keeps the finished threshold closed until a guard proves protection',()=>{
 const s=createNewCity({mode:'awakening',seed:137});
 const gate={type:'ishtarGate',x:10,y:10,level:1};
 s.buildings.push(gate);
 const priest=s.citizens.find(c=>c.age>=16);
 priest.calling='priest';
 assert.equal(syncSacredUnlocks(s),false);
 assert.match(miracleLockReason(s,'inannaProtection'),/сторож/i);
});

test('only stocked shifts on distinct days count, then the earned unlock survives losing the gate',async()=>{
 const {createGame}=await import('../engine.js');
 const {strictScenario,CAT_DISCOVERY_RULES}=await import('../scenario-profiles.js');
 const {newInannaDiscovery}=await import('../inanna-discovery.js');
 const {advancePests}=await import('../pests.js');
 const {buildingKey}=await import('../definitions.js');
 const {takeStock,putStock}=await import('../inventory.js');
 const s=createGame({start:'established',mode:'awakening',scenario:{...strictScenario(),miracles:CAT_DISCOVERY_RULES}});
 s.inannaDiscovery=newInannaDiscovery();
 const store=s.buildings.find(b=>b.type==='shrine'),key=buildingKey(store);
 const [guard,priest]=s.citizens.filter(c=>c.age>=16);
 const gate={type:'ishtarGate',x:10,y:10,level:1};
 s.buildings.push(gate);
 Object.assign(guard,{guardPost:key,work:key,phase:'working'});
 const food=takeStock(s,key,'food',store.stock.food);
 advancePests(s,.1);
 assert.deepEqual(s.inannaDiscovery.days,[]);
 putStock(s,key,'food',food||20);
 for(const time of [1,2,61,121]){
  s.simTime=time;advancePests(s,.1);
 }
 assert.deepEqual(s.inannaDiscovery.days,[0,1,2]);
 assert.equal(syncSacredUnlocks(s),false);
 assert.match(miracleLockReason(s,'inannaProtection'),/жрецом/);
 priest.calling='priest';
 assert.equal(syncSacredUnlocks(s),false);
 assert.match(miracleLockReason(s,'inannaProtection'),/встречу/i);
 const {startInannaMeeting,advanceMiracleCelebration,validateMiracleCelebration}=await import('../miracle-celebration.js');
 const started=startInannaMeeting(s);
 assert.ok(started.ok,started.reason);
 assert.ok(validateMiracleCelebration(s));
 assert.equal(s.sacred.unlocks.inannaProtection,undefined);
 const {guest}=s.miracleCelebration.inanna;
 assert.ok(!s.godhood.believerIds.includes(guest));
 advanceMiracleCelebration(s,59);
 assert.equal(s.sacred.unlocks.inannaProtection,undefined);
 advanceMiracleCelebration(s,1);
 assert.ok(s.sacred.unlocks.inannaProtection);
 s.buildings.pop();
 assert.equal(miracleLockReason(s,'inannaProtection'),'');
});
