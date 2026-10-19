import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,terrain} from '../engine.js';
import {syncCitizens,invalidateAssignments} from '../workforce.js';
import {housingOf} from '../definitions.js';
test('large assignment pass does not scan city geometry for every candidate and keeps assignments stable',()=>{
 const s=createGame();for(let y=2;y<22;y+=2)for(let x=2;x<30;x+=2)if(terrain(x,y,s)!=='water'&&!s.buildings.some(b=>b.x===x&&b.y===y))s.buildings.push({type:(x+y)%4?'house':'field',x,y,level:1});s.population=200;s.capacity=housingOf(s);syncCitizens(s);
 const previous=s.citizens.map(c=>[c.id,c.home,c.work,c.store]);let scans=0;
 s.buildings=new Proxy(s.buildings,{get(t,k,r){if(k===Symbol.iterator)scans++;return Reflect.get(t,k,r);}});invalidateAssignments(s);syncCitizens(s);
 assert.ok(scans<1000,`city geometry scanned ${scans} times`);assert.deepEqual(s.citizens.map(c=>[c.id,c.home,c.work,c.store]),previous);
});
test('unchanged workforce stats reuse access maps but rebuild them when the storage network changes',async()=>{
 const {networkFor,workforceStats}=await import('../workforce.js');const s=createGame();workforceStats(s);const net=networkFor(s);let scans=0;
 net.ports=new Proxy(net.ports,{get(t,k,r){if(k==='filter')scans++;return Reflect.get(t,k,r);}});
 for(let i=0;i<20;i++)workforceStats(s);assert.ok(scans<5,`port tables rebuilt ${scans} times`);
 s.buildings=s.buildings.filter(b=>b.type!=='shrine');s.buildings.push({type:'granary',x:10,y:8,level:1});syncCitizens(s);assert.ok(s.citizens.some(c=>c.work));assert.ok(s.citizens.filter(c=>c.work).every(c=>c.store==='10,8'));
});
