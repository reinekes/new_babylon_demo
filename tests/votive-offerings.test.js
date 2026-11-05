import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,encode,decode} from '../engine.js';
import {strictScenario} from '../scenario-profiles.js';
import {putStock,storeStock} from '../inventory.js';
import {orderVotive,templeOfferings} from '../votive-offerings.js';
import {cancelTransfer} from '../district-logistics.js';
import {recoverCitizenCargo} from '../workforce.js';

function fixture(){
 const s=createGame({start:'established',scenario:strictScenario()});
 s.buildings.push({type:'granary',x:10,y:9,level:1});
 assert.equal(putStock(s,'10,9','pottery',1),1);
 for(const b of s.buildings)if(b.type==='house')Object.assign(b,{pantry:30,pantryDelivered:30});
 return {s,donor:s.citizens.find(c=>c.age>=16),source:'10,9',temple:'9,8'};
}
test('one vessel is reserved, carried after reload and entered only in the temple collection',()=>{
 let {s,donor,source,temple}=fixture();
 const stock=s.resources.pottery;
 const result=orderVotive(s,temple,source,donor.id);assert.equal(result.ok,true);
 assert.equal(s.resources.pottery,stock-1);
 assert.equal(orderVotive(s,temple,source,donor.id).ok,false);
 assert.equal(templeOfferings(s,temple)[0].receivedTick,null);
 for(let i=0;i<160&&!s.citizens.some(c=>c.districtJob===result.id&&c.cargo.pottery);i++)advanceTime(s,.25);
 assert.ok(s.citizens.some(c=>c.districtJob===result.id&&c.cargo.pottery));
 const raw=encode(s);s=decode(raw);assert.ok(s);assert.equal(encode(s),raw);
 for(let i=0;i<160&&templeOfferings(s,temple)[0].receivedTick===null;i++)advanceTime(s,.25);
 const item=templeOfferings(s,temple)[0];
 assert.equal(item.id,result.id);assert.equal(item.donorId,donor.id);assert.equal(item.source,source);
 assert.equal(item.receivedTick,0);
 assert.equal(storeStock(s,temple,'pottery'),0);
 assert.equal(s.resources.pottery,stock-1);
 assert.equal(s.news.filter(n=>n.title==='Именной сосуд принят в храм').length,1);
 assert.ok(decode(encode(s)));
});

test('cancelling restores one uncollected vessel, while carrier recovery keeps the dedication intact',()=>{
 const {s,donor,source,temple}=fixture();
 const first=orderVotive(s,temple,source,donor.id);assert.ok(first.ok);
 assert.ok(cancelTransfer(s,first.id).ok);assert.equal(storeStock(s,source,'pottery'),1);
 assert.equal(cancelTransfer(s,first.id).ok,false);
 const second=orderVotive(s,temple,source,donor.id);assert.ok(second.ok);assert.notEqual(second.id,first.id);
 for(let i=0;i<160&&!s.citizens.some(c=>c.districtJob===second.id&&c.cargo.pottery);i++)advanceTime(s,.25);
 const carrier=s.citizens.find(c=>c.districtJob===second.id&&c.cargo.pottery);assert.ok(carrier);
 assert.equal(recoverCitizenCargo(s,carrier.id),true);
 assert.equal(s.district.jobs.find(q=>q.id===second.id).remaining,1);
 assert.equal(storeStock(s,source,'pottery'),0);
 assert.ok(decode(encode(s)));
});
