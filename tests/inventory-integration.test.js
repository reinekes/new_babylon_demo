import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,build,decode,encode} from '../engine.js';
import {cancelConstruction,canDemolish,demolish} from '../management.js';
import {syncInventory,stockStores,takeStock,putStock,validateInventory} from '../inventory.js';
import {buildingKey} from '../definitions.js';

test('construction cancellation refunds each original local store',()=>{
 const s=createGame();s.buildings.push({type:'granary',x:10,y:9,level:1});syncInventory(s);
 const [central,local]=stockStores(s),a=buildingKey(central),b=buildingKey(local);
 takeStock(s,a,'clay',85);putStock(s,b,'clay',10);
 const before=stockStores(s).map(b=>structuredClone(b.stock));
 assert.equal(build(s,'house',11,9).ok,true);
 const q=s.buildings.at(-1).construction;assert.ok(q.sources[a].clay>0);assert.ok(q.sources[b].clay>0);
 assert.equal(cancelConstruction(s,11,9).ok,true);
 assert.deepEqual(stockStores(s).map(b=>b.stock),before);assert.ok(validateInventory(s));
});
test('v15 raw damaged stock or reserved origin is rejected without repair',()=>{
 const s=createGame(),raw=JSON.parse(encode(s));raw.buildings.find(b=>b.type==='shrine').stock.food++;
 assert.equal(decode(JSON.stringify(raw)),null);
 assert.equal(build(s,'house',10,9).ok,true);const reserved=JSON.parse(encode(s));reserved.buildings.at(-1).construction.sources={'999,999':{clay:12,reed:8}};
 assert.equal(decode(JSON.stringify(reserved)),null);
});
test('v14 migration preserves aggregate resources and construction escrow',()=>{
 const s=createGame();assert.equal(build(s,'house',10,9).ok,true);
 const before=structuredClone(s.resources),raw=JSON.parse(encode(s));raw.version=14;delete raw.inventory;delete raw.district;
 for(const b of raw.buildings){delete b.stock;if(b.construction){delete b.construction.sources;delete b.construction.allocations;}}
 const loaded=decode(JSON.stringify(raw));assert.ok(loaded);assert.deepEqual(loaded.resources,before);assert.ok(validateInventory(loaded));assert.ok(decode(encode(loaded)));
});
test('demolition blocks stocked local store before resources can disappear',()=>{
 const s=createGame();s.buildings.push({type:'granary',x:10,y:9,level:1});syncInventory(s);const local=s.buildings.at(-1);putStock(s,buildingKey(local),'clay',1);
 assert.match(canDemolish(s,local),/перенеси запасы/);
});
import {assignGuard} from '../management.js';
test('guard at a distribution yard remains valid after save/load',()=>{const s=createGame();s.buildings.push({type:'depot',x:10,y:9,level:1});syncInventory(s);assert.ok(assignGuard(s,s.citizens.find(c=>c.age>=16).id,'10,9').ok);assert.ok(decode(encode(s)));});
test('completed sale history remains valid after its empty origin warehouse is demolished',()=>{const s=createGame();s.buildings.push({type:'depot',x:10,y:9,level:1});syncInventory(s);s.trade.nextSale=2;s.trade.sales.push({id:1,market:'10,10',caravanId:'caravan:1',resource:'wood',amount:1,remaining:0,loaded:1,cancelled:0,unitPrice:1,sources:{'10,9':{wood:0}},allocations:{'10,9':{wood:1}}});assert.ok(decode(encode(s)));assert.ok(demolish(s,10,9).ok);assert.ok(decode(encode(s)));});
import {readFileSync} from 'node:fs';
test('authentic v14 city migrates stocks exactly once without losing families and carried food',()=>{const old=JSON.parse(readFileSync(new URL('./fixtures/legacy-v14-warning-city.json',import.meta.url),'utf8'));assert.equal(old.version,14);const s=decode(JSON.stringify(old));assert.ok(s);assert.deepEqual(Object.fromEntries(Object.keys(old.resources).map(k=>[k,s.resources[k]])),old.resources);assert.deepEqual(s.citizens.map((c,i)=>Object.fromEntries(Object.keys(old.citizens[i]).map(k=>[k,c[k]]))),old.citizens);assert.equal(s.version,23);for(const k of ['food','clay','reed','wood','stone','hides'])assert.equal(stockStores(s).reduce((n,b)=>n+b.stock[k],0),old.resources[k]);assert.ok(decode(encode(s)));});
