import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,decode,encode} from '../engine.js';
import {syncCitizens} from '../workforce.js';
import {syncInventory} from '../inventory.js';
import {startRelicQuest,cancelRelicQuest} from '../relic-quest.js';
import {setSeedProtection} from '../food-planning.js';
import {setStoreMinimum,setStoreExports,requestTransfer,cancelTransfer,syncDistrictJobs} from '../district-logistics.js';
import {upgradeRoad,upgradeRoadRoute,layRoad} from '../roads.js';
import {advanceTrade,advanceTradeLogistics,trade,cancelSale} from '../trading.js';
import {orderFestival,cancelFestival,advanceFestival} from '../festival.js';

function city(){
 const s=createGame({start:'established'});s.buildings.push({type:'depot',x:10,y:9,level:1});
 s.resources.faith=1000;s.resources.prestige=100;s.resources.beer=20;syncInventory(s);
 for(const c of s.citizens){c.age=25;c.role='carrier';c.work=null;c.site=null;c.phase='home';c.cargo={};c.buildCargo={};delete c.pantryTrip;delete c.waterTrip;}
 syncCitizens(s);return s;
}
function possess(s){assert.equal(startRelicQuest(s,s.citizens[0].id).ok,true);return s;}
function merchants(s){
 s.buildings.push({type:'market',x:6,y:9,level:1});s.tick=1;s.year=1;s.season=1;s.simTime=45;advanceTrade(s);
 for(let i=0;i<500&&s.trade.caravan?.phase!=='trading';i++)advanceTradeLogistics(s,.1);
 assert.equal(s.trade.caravan?.phase,'trading');s.trade.silver=1000;return s;
}
const commands=[
 ['seed policy',s=>setSeedProtection(s,false)],
 ['store minimum',s=>setStoreMinimum(s,'9,8','food',1)],
 ['store exports',s=>setStoreExports(s,'9,8',false)],
 ['manual transfer',s=>requestTransfer(s,'9,8','10,9','wood',6)],
 ['transfer cancellation',s=>cancelTransfer(s,s.district.jobs[0].id),s=>assert.ok(requestTransfer(s,'9,8','10,9','wood',6).ok)],
 ['single road upgrade',s=>upgradeRoad(s,s.roads[0])],
 ['road route upgrade',s=>upgradeRoadRoute(s,s.roads[0].id,s.roads[0].id)],
 ['new road',s=>layRoad(s,{x:1,y:1},{x:3,y:1})],
 ['purchase',s=>trade(s,'stone','buy',1),merchants],
 ['sale',s=>trade(s,'wood','sell',1),merchants],
 ['sale cancellation',s=>cancelSale(s,s.trade.sales[0].id),s=>{merchants(s);assert.ok(trade(s,'wood','sell',1).ok);}],
 ['festival order',s=>orderFestival(s)]
];
for(const [name,command,prepare=()=>{}]of commands)test(`possession rejects ${name} without changing city state`,()=>{
 const ordinary=city();prepare(ordinary);assert.equal(command(ordinary).ok,true,'command is valid before possession');
 const s=city();prepare(s);possess(s);const before=JSON.stringify(s),result=command(s);
 assert.equal(result.ok,false);assert.match(result.reason,/ведёшь/);assert.equal(JSON.stringify(s),before);
 assert.equal(cancelRelicQuest(s).ok,true);assert.equal(command(s).ok,true,'command works again after release');
});

test('automatic transfers still start and real carriers deliver while the chosen resident remains controlled',()=>{
 const s=possess(city()),id=s.relicQuest.actorId;
 assert.ok(requestTransfer(s,'9,8','10,9','wood',6,{automatic:true}).ok);
 syncDistrictJobs(s);assert.ok(s.district.jobs.some(q=>q.automatic&&q.resource==='food'));
 let carried=false;for(let i=0;i<150;i++){advanceTime(s,.1);carried||=s.citizens.some(c=>c.id!==id&&c.cargo.wood>0);if(s.district.jobs.find(q=>q.resource==='wood').delivered>=6)break;}
 assert.ok(carried);assert.equal(s.district.jobs.find(q=>q.resource==='wood').delivered,6);
 assert.equal(s.citizens.find(c=>c.id===id).phase,'relic');assert.ok(decode(encode(s)));
});

test('public festival cancellation is locked while internal invalid-festival cleanup can still refund',()=>{
 const s=city();assert.ok(orderFestival(s).ok);const booked=s.festival;s.festival=null;possess(s);s.festival=booked;
 const before=JSON.stringify(s),result=cancelFestival(s);assert.equal(result.ok,false);assert.match(result.reason,/ведёшь/);assert.equal(JSON.stringify(s),before);
 const beer=s.resources.beer;s.lost=true;advanceFestival(s,.1);assert.equal(s.festival,null);assert.equal(s.resources.beer,beer+6);
});
