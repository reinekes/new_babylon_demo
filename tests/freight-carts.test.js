import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,build,decode,encode} from '../engine.js';
import {syncInventory,putStock,takeStock,storeStock} from '../inventory.js';
import {borrowFreightCart,availableFreightCarts} from '../freight-carts.js';
import {requestTransfer,setStoreMinimum,cancelTransfer} from '../district-logistics.js';
import {recordFootsteps,visibleFootpaths} from '../footpaths.js';
import {recoverCitizenCargo} from '../workforce.js';
import {cancelConstruction,demolish} from '../management.js';
import {trade} from '../trading.js';
import {advanceCalendar} from './helpers/calendar-time.js';

function depotCity(){
 const s=createGame({start:'established'});
 const granary={type:'granary',x:5,y:8,level:1},depot={type:'depot',x:10,y:9,level:1};
 s.buildings.push(granary,depot);
 syncInventory(s);
 setStoreMinimum(s,'10,9','food',0);
 return {s,granary,depot};
}
function until(s,predicate,step=advanceTime){
 for(let i=0;i<1500;i++){
  s.event=null;
  step(s,.1);
  const result=predicate();
  if(result)return result;
 }
 assert.fail('Expected phase did not occur');
}

test('one warehouse cart travels with a physical shipment and returns empty; both legs survive saving',()=>{
 const {s,granary}=depotCity();
 putStock(s,'5,8','wood',36);
 assert.ok(requestTransfer(s,'5,8','10,9','wood',36).ok);
 assert.equal(availableFreightCarts(s,granary),1);
 assert.equal(borrowFreightCart(s,s.citizens[0],granary),false,'a resident at home cannot collect a remote vehicle');
 const porter=until(s,()=>s.citizens.find(c=>c.freightCart==='5,8'&&c.cargo.wood));
 assert.equal(availableFreightCarts(s,granary),0);
 assert.equal(porter.phase,'toDistrictStore');
 assert.equal(porter.cargo.wood,24);
 const onFoot=until(s,()=>s.citizens.find(c=>c.districtJob===porter.districtJob&&!c.freightCart&&c.cargo.wood));
 assert.equal(onFoot.cargo.wood,12);
 const loaded=decode(encode(s));assert.ok(loaded);
 const duplicate=structuredClone(loaded);
 duplicate.citizens.find(c=>c.id!==porter.id).freightCart=porter.freightCart;
 assert.equal(decode(encode(duplicate)),null,'two porters cannot own the same saved vehicle');
 const loan=loaded.citizens.find(c=>c.id===porter.id);
 assert.equal(loan.freightCart,'5,8');assert.equal(loan.cargo.wood,porter.cargo.wood);
 until(loaded,()=>loan.phase==='toReturnCart');
 assert.deepEqual(loan.cargo,{});
 assert.equal(availableFreightCarts(loaded,granary),0);
 assert.equal(storeStock(loaded,'10,9','wood'),36);
 const returning=decode(encode(loaded));assert.ok(returning);
 assert.ok(returning.footpaths.filter(p=>p.cartWear>0).length>=3);
 until(returning,()=>availableFreightCarts(returning,granary)===1);
 assert.equal(storeStock(returning,'10,9','wood'),36);
 assert.ok(decode(encode(returning)));
});

test('a district porter fetches an empty cart at the receiving depot and brings it back on cancellation',()=>{
 const {s,depot}=depotCity();
 const {id}=requestTransfer(s,'9,8','10,9','wood',6);
 const porter=until(s,()=>s.citizens.find(c=>c.districtJob===id&&c.phase==='toCollectCart'));
 assert.equal(porter.freightCart,undefined);
 until(s,()=>porter.phase==='toDistrictSupply'&&porter.freightCart);
 assert.equal(porter.freightCart,'10,9');
 const before=storeStock(s,'9,8','wood');
 assert.ok(cancelTransfer(s,id).ok);
 until(s,()=>availableFreightCarts(s,depot)===1);
 assert.equal(storeStock(s,'9,8','wood'),before);
 assert.equal(storeStock(s,'10,9','wood'),0);
 assert.ok(decode(encode(s)));
});

test('market imports send a loaded cart from the market court, and recovery restores the delivery queue and vehicle ownership',()=>{
 const s=createGame({start:'established'}),market={type:'market',x:10,y:9,level:1};
 s.buildings.push(market);
 until(s,()=>s.trade.caravan?.phase==='trading',advanceCalendar);
 s.trade.silver=1000;assert.ok(trade(s,'stone','buy',8).ok);
 const c=until(s,()=>s.citizens.find(c=>c.freightCart==='10,9'&&c.tradeJob),advanceCalendar);
 const q=s.trade.deliveries.find(q=>q.id===c.tradeJob),remaining=q.remaining,load=c.cargo.stone;
 assert.equal(load,8);assert.equal(availableFreightCarts(s,market),0);
 assert.ok(recoverCitizenCargo(s,c.id));
 assert.equal(availableFreightCarts(s,market),1);
 assert.equal(q.remaining,remaining+load);
 assert.ok(decode(encode(s)));
});

test('demolishing a depot after delivery retires its returning cart and leaves the delivered load intact',()=>{
 const {s,granary}=depotCity();putStock(s,'5,8','wood',6);
 assert.ok(requestTransfer(s,'5,8','10,9','wood',6).ok);
 const c=until(s,()=>s.citizens.find(c=>c.freightCart==='5,8'&&c.phase==='toReturnCart'));
 assert.ok(demolish(s,granary.x,granary.y).ok);
 assert.equal(c.freightCart,undefined);
 assert.notEqual(c.phase,'toReturnCart');
 assert.equal(storeStock(s,'10,9','wood'),6);
 assert.ok(decode(encode(s)));
});

test('a construction cart doubles a reserved batch and returning it after cancellation conserves the refund',()=>{
 const {s,granary}=depotCity();
 for(const k of ['clay','reed'])putStock(s,'5,8',k,takeStock(s,'9,8',k,storeStock(s,'9,8',k)));
 const clay=s.resources.clay,reed=s.resources.reed;
 assert.ok(build(s,'house',5,10).ok);
 const porter=until(s,()=>s.citizens.find(c=>c.freightCart&&c.phase==='toSite'));
 assert.equal(porter.buildCargo.clay,12);
 assert.ok(decode(encode(s)));
 assert.ok(cancelConstruction(s,5,10).ok);
 assert.deepEqual(porter.buildCargo,{});
 assert.equal(s.resources.clay,clay);assert.equal(s.resources.reed,reed);
 until(s,()=>availableFreightCarts(s,granary)===1);
 assert.ok(decode(encode(s)));
});

test('only moving wheels form ruts; footsteps on the same edge do not keep old ruts alive',()=>{
 const s=createGame({start:'established'}),a={x:1.5,y:1.5},b={x:2.5,y:1.5};
 for(let i=0;i<16;i++)recordFootsteps(s,a,b,1);
 assert.equal(visibleFootpaths(s)[0].cartTraffic,0);
 recordFootsteps(s,b,a,1,undefined,true);
 const first=visibleFootpaths(s)[0].cartTraffic;assert.ok(first>0);

 s.simTime+=100;
 for(let i=0;i<16;i++)recordFootsteps(s,a,b,1);
 assert.equal(visibleFootpaths(s)[0].cartTraffic,0);
});

test('a cart and a porter finish the same transfer across shorter days',async()=>{
 const {useOneDayCalendar}=await import('../calendar.js');
 const {s,granary}=depotCity();useOneDayCalendar(s);
 putStock(s,'5,8','wood',36);
 assert.ok(requestTransfer(s,'5,8','10,9','wood',36).ok);
 const porter=until(s,()=>s.citizens.find(c=>c.freightCart==='5,8'&&c.cargo.wood===24));
 assert.ok(until(s,()=>s.citizens.some(c=>!c.freightCart&&c.cargo.wood===12)));
 const copy=decode(encode(s));assert.ok(copy);
 const owner=copy.citizens.find(c=>c.id===porter.id);
 until(copy,()=>owner.phase==='toReturnCart');
 until(copy,()=>availableFreightCarts(copy,granary)===1);
 assert.equal(storeStock(copy,'10,9','wood'),36);
 assert.ok(decode(encode(copy)));
});
