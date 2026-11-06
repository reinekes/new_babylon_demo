import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,miracle,encode,decode} from '../engine.js';
import {createNewCity} from '../new-game.js';
import {strictScenario,CAT_DISCOVERY_RULES} from '../scenario-profiles.js';
import {syncInventory,putStock} from '../inventory.js';
import {abundanceQuote,newAbundanceGift} from '../abundance-gift.js';

function fixture(){
 const s=createGame({start:'established',mode:'awakening',scenario:{...strictScenario(),miracles:CAT_DISCOVERY_RULES}});
 s.abundanceGift=newAbundanceGift();
 const c=s.citizens.find(c=>c.age>=16);
 Object.assign(s.godhood,{stage:'recognized',witnessId:c.id,believerIds:[c.id],recognitionAt:0});
 Object.assign(c,{calling:'builder',role:'builder',builderSkill:{level:2,projects:2}});
 s.resources.faith=100;
 const b={type:'depot',x:10,y:9,level:1};
 s.buildings.push(b);
 syncInventory(s);
 return {s,b};
}

test('a selected warehouse accepts only its quoted room and the receipt survives loading',()=>{
 const {s,b}=fixture(),target={x:b.x,y:b.y};
 assert.equal(putStock(s,'10,9','food',33),33);
 const before=encode(s),total=s.resources.food,other=s.buildings.find(b=>b.type==='shrine'),otherFood=other.stock.food;
 assert.equal(abundanceQuote(s,target).amount,27);
 assert.equal(encode(s),before);
 assert.equal(miracle(s,'abundance',target).ok,true);
 assert.equal(s.resources.faith,75);
 assert.equal(s.resources.food,total+27);
 assert.equal(b.stock.food,60);
 assert.equal(other.stock.food,otherFood);
 assert.deepEqual(s.abundanceGift.last,{store:'10,9',amount:27,at:s.simTime});
 const raw=encode(s);
 assert.equal(encode(decode(raw)),raw);
 const forged=JSON.parse(raw);
 forged.abundanceGift.last.amount=46;
 assert.equal(decode(JSON.stringify(forged)),null);
});

test('missing or full targets cost nothing, while previous cities retain the aggregate gift',()=>{
 const {s,b}=fixture();
 putStock(s,'10,9','food',60);
 const before=encode(s);
 for(const target of [null,{x:8,y:8},b])assert.equal(miracle(s,'abundance',target).ok,false);
 assert.equal(encode(s),before);
 delete s.abundanceGift;
 const food=s.resources.food;
 assert.equal(miracle(s,'abundance').ok,true);
 assert.equal(s.resources.food,food+45);
 assert.ok(createNewCity({mode:'awakening'}).abundanceGift);
});

test('food keeps its gift origin through mixed stock, split loads and a return',async()=>{
 const {takeStock}=await import('../inventory.js');
 const {s,b}=fixture();
 assert.equal(putStock(s,'10,9','food',50),50);
 assert.equal(miracle(s,'abundance',b).ok,true);
 assert.deepEqual(b.giftStock,[-50,10]);
 assert.equal(takeStock(s,'10,9','food',54),54);
 const c={cargo:{}};
 c.cargo.food=takeStock(s,'10,9','food',4,{giftTo:c});
 assert.deepEqual(c.giftCargo,[4]);
 assert.deepEqual(b.giftStock,[2]);
 assert.equal(putStock(s,'9,8','food',4,{gift:c.giftCargo}),4);
 assert.deepEqual(s.buildings.find(b=>b.type==='shrine').giftStock,[-100,4]);
 const raw=encode(s);
 assert.equal(encode(decode(raw)),raw);
 const corrupt=JSON.parse(raw);
 corrupt.citizens[0].giftCargo=[5];
 assert.equal(decode(JSON.stringify(corrupt)),null);
});

test('an actual district transfer carries marked gift food across a reload',async()=>{
 const {advanceTime}=await import('../engine.js');
 const {requestTransfer}=await import('../district-logistics.js');
 const {invalidateAssignments,syncCitizens}=await import('../workforce.js');
 let {s,b}=fixture();
 assert.equal(miracle(s,'abundance',b).ok,true);
 for(const c of s.citizens.filter(c=>c.age>=16))c.role='carrier';
 invalidateAssignments(s);syncCitizens(s);
 const order=requestTransfer(s,'10,9','9,8','food',6);
 assert.ok(order.ok,order.reason);
 const step=()=>{s.event=null;advanceTime(s,.2);};
 for(let i=0;i<1000&&!s.citizens.some(c=>c.districtJob===order.id&&c.giftCargo);i++)step();
 const porter=s.citizens.find(c=>c.districtJob===order.id&&c.giftCargo);
 assert.ok(porter);
 assert.deepEqual(porter.giftCargo,[6]);
 const raw=encode(s);
 s=decode(raw);
 assert.ok(s);
 assert.equal(encode(s),raw);
 const job=s.district.jobs.find(q=>q.id===order.id);
 for(let i=0;i<1000&&!job.delivered;i++)step();
 assert.equal(job.delivered,6);
 assert.equal(s.buildings.find(b=>b.type==='shrine').giftStock.at(-1),6);
 assert.equal(encode(decode(encode(s))),encode(s));
});
