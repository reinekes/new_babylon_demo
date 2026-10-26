import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,encode,decode} from '../engine.js';
import {trade} from '../trading.js';
import {syncCitizens} from '../workforce.js';
import {setCitizenRole} from '../management.js';
import {buildingInventory} from '../building-inventory.js';

for(const type of ['market','harbor'])test(`${type}: the readonly inventory separates paid goods at this port from purchased cargo in real hands`,()=>{
 const s=createGame({start:'established'});s.buildings.push({type,x:type==='market'?10:11,y:9,level:1});const port=s.buildings.at(-1);
 for(const b of s.buildings.filter(b=>b.type==='house')){b.pantry=100;b.pantryDelivered=100;b.water=100;b.waterDelivered=100;}for(const c of s.citizens)if(c.age>=16)c.role='builder';syncCitizens(s);
 for(let i=0;i<1200&&s.trade.caravan?.phase!=='trading';i++){s.event=null;advanceTime(s,.1);}assert.equal(s.trade.caravan?.phase,'trading');s.event=null;s.trade.silver=1000;
 s.buildings.push({type:'market',x:6,y:9,level:1});const other=s.buildings.at(-1);syncCitizens(s);const unpaidFood=s.trade.caravan.stock.food;assert.ok(unpaidFood>0);assert.ok(trade(s,'stone','buy',8).ok);
 let before=encode(s),view=buildingInventory(s,port);assert.equal(view.storage.stone,8);assert.equal(view.storage.food,undefined,'unbought merchant food is not city property');assert.equal(buildingInventory(s,other).storage.stone,undefined);assert.equal(view.inTransit.output.stone||0,0);assert.equal(encode(s),before);assert.equal(s.resources.stone,0);
 assert.ok(setCitizenRole(s,s.citizens[0].id,'carrier').ok);let porter;for(let i=0;i<300&&!porter;i++){s.event=null;advanceTime(s,.1);porter=s.citizens.find(c=>c.tradeJob&&c.cargo.stone>0);}assert.ok(porter);const order=s.trade.deliveries.find(q=>q.id===porter.tradeJob),carried=porter.cargo.stone;assert.ok(carried>0&&carried<8);
 before=encode(s);view=buildingInventory(s,port);assert.equal(view.storage.stone,order.remaining);assert.equal(view.inTransit.output.stone,carried);assert.equal(view.storage.stone+view.inTransit.output.stone,8);assert.equal(view.inTransit.input.stone,undefined);assert.equal(encode(s),before);const loaded=decode(before);assert.ok(loaded);assert.deepEqual(buildingInventory(loaded,loaded.buildings.find(b=>b.type===type&&b.x===port.x&&b.y===port.y)),view);
 for(let i=0;i<600&&order.delivered<8;i++){s.event=null;advanceTime(s,.1);}view=buildingInventory(s,port);assert.equal(order.delivered,8);assert.equal(s.resources.stone,8);assert.equal(view.storage.stone||0,0);assert.equal(view.inTransit.output.stone||0,0);assert.equal(s.trade.caravan?.stock.food,unpaidFood);assert.equal(port.productionHistory,undefined);assert.ok(decode(encode(s)));
});
