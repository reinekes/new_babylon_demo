import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,encode,decode,advanceTime} from '../engine.js';
import {strictScenario} from '../scenario-profiles.js';
import {advanceTrade,advanceTradeLogistics,acceptTradeContract,trade,tradeContractOffer,loadSaleCargo,tradePartnerTrust} from '../trading.js';
import {takeReserved} from '../inventory.js';
import {workOnAccount,ACCOUNT_WORK_SECONDS} from '../scribes.js';

function fixture(){
 const s=createGame({start:'established',scenario:strictScenario()});
 s.buildings.push({type:'market',x:10,y:9,level:1});
 s.tick=1;s.year=1;s.season=1;s.simTime=45;advanceTrade(s);
 Object.assign(s.trade.caravan,{phase:'trading',market:'10,9'});
 s.resources.cloth=4;
 return s;
}
function handOver(s,n){
 const sale=s.trade.sales[0],carrier=s.citizens[0],key=Object.keys(sale.sources)[0];
 sale.remaining-=takeReserved(s,sale.sources,key,'cloth',n);
 Object.assign(carrier,{saleJob:sale.id,saleMarket:sale.market,cargo:{cloth:n}});
 assert.equal(loadSaleCargo(s,carrier),true);
}
test('the same cloth and reserved timber cannot be sold twice, and full exchange queues a physical delivery',()=>{
 const s=fixture(),offer=tradeContractOffer(s);
 assert.equal(offer.reason,'');
 const silver=s.trade.silver,stock=s.trade.caravan.stock.wood;
 assert.equal(acceptTradeContract(s).ok,true);
 assert.equal(s.resources.cloth,0);
 assert.equal(trade(s,'cloth','sell',1).ok,false);
 assert.equal(acceptTradeContract(s).ok,false);
 assert.equal(s.trade.caravan.stock.wood,stock-12);
 assert.equal(s.resources.wood,20);
 handOver(s,4);
 assert.equal(s.tradeContracts[0].status,'fulfilled');
 assert.equal(s.trade.deliveries.at(-1).remaining,12);
 assert.equal(s.resources.wood,20);
 assert.equal(s.trade.silver,silver);
 assert.equal(tradePartnerTrust(s,offer.partner),1);
 const copy=decode(encode(s));assert.ok(copy);assert.equal(encode(copy),encode(s));
});
test('late trade releases the unpicked cloth and converts loaded cloth to a smaller stone shipment',()=>{
 const s=fixture(),offer=tradeContractOffer(s);
 assert.ok(acceptTradeContract(s).ok);
 handOver(s,2);
 s.tick=3;s.season=3;s.simTime=135;advanceTrade(s);
 assert.equal(s.tradeContracts[0].status,'breached');
 assert.equal(s.resources.cloth,2);
 assert.equal(s.trade.deliveries.at(-1).resource,'stone');
 assert.equal(s.trade.deliveries.at(-1).remaining,4);
 assert.equal(tradePartnerTrust(s,offer.partner),-1);
 const granary={type:'granary',x:10,y:8,level:1},scribe=s.citizens[1];
 workOnAccount(s,granary,scribe,ACCOUNT_WORK_SECONDS);
 assert.equal(s.tradeContracts[0].seal,undefined);
 const payment=s.trade.deliveries.at(-1);
 for(let i=0;i<150&&payment.delivered<4;i++){s.event=null;advanceTime(s,.5);}
 assert.equal(payment.delivered,4);
 workOnAccount(s,granary,scribe,ACCOUNT_WORK_SECONDS);
 assert.equal(s.tradeContracts[0].seal.author,scribe.id);
 assert.ok(decode(encode(s)));
});

test('cloth already in transit keeps its carrier at the deadline and settles only on arrival',()=>{
 const s=fixture();
 assert.ok(acceptTradeContract(s).ok);
 const sale=s.trade.sales[0],carrier=s.citizens[0],key=Object.keys(sale.sources)[0];
 sale.remaining-=takeReserved(s,sale.sources,key,'cloth',2);
 Object.assign(carrier,{saleJob:sale.id,saleMarket:sale.market,cargo:{cloth:2},phase:'blocked',route:[],routeIndex:0});
 s.tick=3;s.season=3;s.simTime=135;advanceTrade(s);
 assert.equal(s.tradeContracts[0].deliveryId,null);
 assert.deepEqual(carrier.cargo,{cloth:2});
 assert.equal(s.resources.cloth,2);
 const copy=decode(encode(s));assert.ok(copy);
 const saved=copy.citizens.find(c=>c.id===carrier.id);
 assert.equal(loadSaleCargo(copy,saved),true);
 assert.equal(copy.trade.deliveries.at(-1).resource,'stone');
 assert.equal(copy.trade.deliveries.at(-1).remaining,4);
 assert.equal(loadSaleCargo(copy,saved),false);
 assert.equal(copy.trade.deliveries.length,1);
});

test('real porters complete both legs of the exchange',()=>{
 const s=fixture();
 for(const b of s.buildings)if(b.type==='house')Object.assign(b,{pantry:40,pantryDelivered:40});
 assert.ok(acceptTradeContract(s).ok);
 for(let i=0;i<150&&!s.trade.deliveries.some(q=>q.delivered===12);i++)advanceTime(s,.5);
 assert.equal(s.tradeContracts[0].status,'fulfilled');
 assert.equal(s.trade.deliveries.at(-1).delivered,12);
 assert.equal(s.resources.wood,32);
});

test('the same partner offers better terms on a later visit after successful delivery',()=>{
 const s=fixture(),partner=s.trade.caravan.name;
 assert.ok(acceptTradeContract(s).ok);
 handOver(s,4);
 s.trade.caravan=null;
 for(const tick of [5,9,13]){
  s.tick=tick;s.year=1+Math.floor(tick/4);s.season=tick%4;advanceTrade(s);
  if(tick<13)s.trade.caravan=null;
 }
 Object.assign(s.trade.caravan,{phase:'trading',market:'10,9'});
 assert.equal(s.trade.caravan.name,partner);
 assert.equal(tradeContractOffer(s).wood,16);
});

test('a scribe seals the physical exchange once and the seal survives loading',()=>{
 const s=fixture(),granary={type:'granary',x:10,y:8,level:1},scribe=s.citizens[1];
 s.buildings.push(granary);
 assert.ok(acceptTradeContract(s).ok);
 handOver(s,4);
 const contract=s.tradeContracts[0];
 workOnAccount(s,granary,scribe,ACCOUNT_WORK_SECONDS);
 assert.equal(contract.seal,undefined);
 const delivery=s.trade.deliveries.at(-1);
 for(let i=0;i<150&&delivery.delivered<12;i++){s.event=null;advanceTime(s,.5);}
 assert.equal(delivery.delivered,12);
 const before={...s.resources};
 workOnAccount(s,granary,scribe,ACCOUNT_WORK_SECONDS);
 assert.deepEqual(contract.seal,{author:scribe.id,archive:'10,8',writtenAt:s.simTime});
 workOnAccount(s,granary,s.citizens[2],ACCOUNT_WORK_SECONDS);
 assert.equal(contract.seal.author,scribe.id);
 assert.deepEqual(s.resources,before);
 const copy=decode(encode(s));assert.ok(copy);
 assert.deepEqual(copy.tradeContracts[0].seal,contract.seal);
 contract.seal.writtenAt=s.simTime+1;
 assert.equal(decode(encode(s)),null);
});

test('only fodder carried to the land market unlocks the donkey packs, once',async()=>{
 const {feedDonkeyCaravan}=await import('../trading.js');
 let s=fixture();
 const c=s.trade.caravan,wood=c.stock.wood,stone=c.stock.stone,food=c.stock.food,silver=s.trade.silver;
 const order=feedDonkeyCaravan(s);
 assert.ok(order.ok,order.reason);
 assert.equal(c.stock.wood,wood);
 const unfed=fixture();unfed.resources.food=4;
 assert.equal(feedDonkeyCaravan(unfed).ok,false);
 const late=fixture(),stock=late.resources.food;
 assert.ok(feedDonkeyCaravan(late).ok);
 late.tick=3;late.season=3;late.simTime=135;advanceTradeLogistics(late,.1);
 assert.equal(late.resources.food,stock);
 assert.equal(late.trade.sales.find(q=>q.fodder).cancelled,4);
 assert.equal(feedDonkeyCaravan(s).ok,false);
 const raw=encode(s);s=decode(raw);assert.ok(s);assert.equal(encode(s),raw);
 const q=s.trade.sales.find(q=>q.fodder);
 for(let i=0;i<240&&q.loaded<4;i++){s.event=null;advanceTime(s,.25);}
 assert.equal(q.loaded,4);
 assert.equal(s.trade.caravan.stock.wood,wood+8);
 assert.equal(s.trade.caravan.stock.stone,stone+4);
 assert.equal(s.trade.caravan.stock.food,food);
 assert.equal(s.trade.silver,silver);
 const done=encode(s);assert.equal(encode(decode(done)),done);
});
