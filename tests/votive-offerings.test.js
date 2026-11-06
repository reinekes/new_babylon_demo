import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,encode,decode} from '../engine.js';
import {strictScenario,CAT_DISCOVERY_RULES} from '../scenario-profiles.js';
import {putStock,storeStock} from '../inventory.js';
import {orderVotive,templeOfferings} from '../votive-offerings.js';
import {cancelTransfer} from '../district-logistics.js';
import {recoverCitizenCargo} from '../workforce.js';

function fixture(awakening=false){
 const s=createGame({start:'established',...awakening?{mode:'awakening'}:{},scenario:{...strictScenario(),...awakening?{miracles:CAT_DISCOVERY_RULES}:{}}});
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

test('an assigned priest records the donor at work and the temple kitchen commemorates only after serving',async()=>{
 const {assignWorkplace}=await import('../management.js');
 const {orderFestival,cancelFestival}=await import('../festival.js');
 let {s,donor,source,temple}=fixture();
 const priest=s.citizens.find(c=>c.age>=16&&c.id!==donor.id);
 Object.assign(priest,{calling:'priest',role:'production'});
 assert.ok(assignWorkplace(s,priest.id,temple).ok);
 const {id}=orderVotive(s,temple,source,donor.id);
 const item=()=>templeOfferings(s,temple).find(v=>v.id===id);
 assert.equal(orderFestival(s,{dedicationId:id}).ok,false);
 for(let i=0;i<140&&!item().memory;i++)advanceTime(s,.25);
 assert.equal(item().memory.keeperId,priest.id);
 assert.equal(item().feastTick,undefined);
 s.resources.food=190;s.resources.beer=10;s.resources.prestige=100;
 assert.equal(orderFestival(s,{dedicationId:id}).ok,true);
 assert.equal(s.resources.beer,4);
 assert.equal(item().feastTick,undefined);
 assert.equal(cancelFestival(s).ok,true);
 assert.equal(s.resources.beer,10);
 assert.equal(orderFestival(s,{dedicationId:id}).ok,true);
 const raw=encode(s);s=decode(raw);assert.ok(s);assert.equal(encode(s),raw);
 for(let i=0;i<450&&item().feastTick===undefined;i++){advanceTime(s,.25);if(s.event)s.event=null;}
 assert.ok(Number.isInteger(item().feastTick));
 assert.equal(item().receivedTick,0);
 assert.equal(s.festival.delivered.beer,6);
 assert.equal(s.news.filter(n=>n.title==='Дарителя вспомнили за храмовым угощением').length,1);
 assert.ok(decode(encode(s)));
 assert.equal(orderFestival(s,{dedicationId:id}).ok,false);
});


test('sunlight counts only accepted vessels from different donor households',async()=>{
 const {sunlightDedications}=await import('../votive-offerings.js');
 let {s,donor,source,temple}=fixture(true);
 putStock(s,source,'pottery',2);
 const neighbor=s.citizens.find(c=>c.age>=16&&c.home===donor.home&&c.id!==donor.id);
 const other=s.citizens.find(c=>c.age>=16&&c.home!==donor.home);
 for(const c of [donor,neighbor,other])assert.ok(orderVotive(s,temple,source,c.id).ok);
 assert.deepEqual(sunlightDedications(s),[]);
 for(let i=0;i<500&&s.votiveOfferings.some(v=>v.receivedTick===null);i++){s.event=null;advanceTime(s,.25);}
 assert.ok(s.votiveOfferings.every(v=>v.receivedTick!==null));
 assert.equal(sunlightDedications(s).length,2);
 assert.equal(s.votiveOfferings[0].donorHome,donor.home);
 const raw=encode(s);s=decode(raw);
 assert.ok(s);
 assert.equal(encode(s),raw);
 assert.equal(sunlightDedications(s).length,2);
});

test('Sunlight records real work after an inspired priest is assigned',async()=>{
 const {assignWorkplace}=await import('../management.js');
 const {s,donor,temple}=fixture(true);
 Object.assign(donor,{calling:'priest',role:'production'});
 assert.ok(assignWorkplace(s,donor.id,temple).ok);
 assert.equal(s.sunlightService,undefined);
 for(let i=0;i<500&&!s.sunlightService;i++){s.event=null;advanceTime(s,.25);}
 assert.equal(s.sunlightService?.priest,donor.id);
 assert.equal(s.sunlightService.temple,temple);
 const raw=encode(s);
 assert.equal(encode(decode(raw)),raw);
});

test('Sunlight requires offerings, a real service record and a completed gathering',async()=>{
 const {miracle}=await import('../engine.js');
 const {assignWorkplace}=await import('../management.js');
 const {s,donor,temple}=fixture(true);
 s.sunlightChapter=1;
 s.resources.faith=100;
 const before=encode(s);
 assert.match(miracle(s,'sunlight').reason,/посвящения/);
 assert.equal(encode(s),before);
 s.votiveOfferings=[0,1,2].map((donorId,i)=>({donorId,donorHome:`${8+i},8`,receivedTick:0}));
 assert.match(miracle(s,'sunlight').reason,/жрец/);
 Object.assign(donor,{calling:'priest',role:'production'});
 assert.ok(assignWorkplace(s,donor.id,temple).ok);
 assert.match(miracle(s,'sunlight').reason,/жрец/);
 for(let i=0;i<500&&!s.sunlightService;i++){s.event=null;advanceTime(s,.25);}
 assert.ok(s.sunlightService);
 assert.match(miracle(s,'sunlight').reason,/трапеза/);
 s.sunlightFeast={temple,guests:4,at:s.simTime};
 s.event=null;s.resources.faith=100;
 assert.ok(miracle(s,'sunlight').ok);
 assert.equal(s.resources.faith,70);
 assert.equal(s.buffs.sunlight,3);
});
