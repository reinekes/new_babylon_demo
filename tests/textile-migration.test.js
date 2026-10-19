import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGame,decode,encode,VERSION,advanceSeason} from '../engine.js';
import {advanceTrade} from '../trading.js';
import {MATERIALS} from '../definitions.js';
const fixture=()=>JSON.parse(readFileSync(new URL('./fixtures/legacy-v15-districts.json',import.meta.url),'utf8'));
const oldKeys=(actual,old)=>Object.fromEntries(Object.keys(old).map(k=>[k,actual[k]]));
test('actual v15 districts migrate without changing people, cargo, stocks or merchant orders',()=>{
 const old=fixture();assert.equal(old.version,15);const s=decode(JSON.stringify(old));assert.ok(s);assert.equal(s.version,20);
 assert.deepEqual(oldKeys(s.resources,old.resources),old.resources);assert.deepEqual(oldKeys(s.delivered,old.delivered),old.delivered);
 assert.deepEqual(s.citizens.map((c,i)=>Object.fromEntries(Object.keys(old.citizens[i]).map(k=>[k,c[k]]))),old.citizens);assert.deepEqual(s.district,old.district);
 for(let i=0;i<old.buildings.length;i++){const b=old.buildings[i];assert.deepEqual(oldKeys(s.buildings[i],b),b.stock?{...b,stock:{...b.stock,wool:0,cloth:0,clothing:0,brick:0,firedBrick:0}}:b);if(b.stock)assert.equal(s.buildings[i].stock.wool+s.buildings[i].stock.cloth,0);}
 assert.equal(s.trade.caravan,old.trade.caravan);
 assert.deepEqual(s.trade.sales,old.trade.sales);assert.deepEqual(s.trade.deliveries,old.trade.deliveries);assert.equal(s.trade.silver,old.trade.silver);
 assert.equal(s.resources.wool+s.resources.cloth,0);assert.deepEqual(decode(encode(s)),s);
});
test('new saves require textile keys and new caravans value cloth above three wool',()=>{
 const s=createGame();assert.equal(VERSION,20);assert.equal(MATERIALS.length,11);assert.equal(s.resources.wool+s.resources.cloth,0);s.tick=1;advanceTrade(s);
 assert.ok(s.trade.caravan.prices.cloth.sell>3*s.trade.caravan.prices.wool.buy);assert.ok(decode(encode(createGame())));
 const raw=JSON.parse(encode(createGame()));delete raw.resources.wool;assert.equal(decode(JSON.stringify(raw)),null);
});

test('v15 active merchant gains only textile prices and zero new stock',()=>{
 const old=createGame();advanceSeason(old);old.version=15;
 for(const r of [old.resources,old.delivered,...old.buildings.map(b=>b.stock),old.trade.caravan.stock,old.trade.caravan.prices])if(r){delete r.wool;delete r.cloth;}
 const s=decode(JSON.stringify(old));assert.ok(s);const c=s.trade.caravan,previous=old.trade.caravan;
 assert.deepEqual(oldKeys(c.stock,previous.stock),previous.stock);assert.deepEqual(oldKeys(c.prices,previous.prices),previous.prices);assert.equal(c.silver,previous.silver);assert.equal(c.stock.wool+c.stock.cloth,0);assert.deepEqual(s.trade.deliveries,old.trade.deliveries);assert.deepEqual(s.trade.sales,old.trade.sales);assert.deepEqual(decode(encode(s)),s);
});
