import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeDairy,workDairy,dairyNeeds,dairyRecipe,validateDairy} from '../dairy.js';
test('milk requires local feed, water and actual labour; partial work survives reload',()=>{
 const s={buildings:[{type:'cowshed'}]};initializeDairy(s);let b=s.buildings[0];
 assert.equal(workDairy(b,100),0);assert.deepEqual(dairyRecipe,{reed:1,water:4});
 Object.assign(b.dairy,{reed:2,water:8});assert.equal(workDairy(b,4),0);
 b=JSON.parse(JSON.stringify(b));assert.equal(workDairy(b,4),3);
 assert.equal(b.dairy.reed,1);assert.equal(b.dairy.water,4);assert.equal(workDairy(b,8),3);assert.equal(workDairy(b,100),0);
 assert.equal(b.dairy.cows,3);assert.equal(b.dairy.calves,2);
});
test('initialization preserves cattle, supplies and progress; invalid dairy is rejected',()=>{
 const s={buildings:[{type:'cowshed',dairy:{reed:2,water:7,elapsed:3,cows:3,calves:2}}]};const before=JSON.stringify(s);initializeDairy(s);assert.equal(JSON.stringify(s),before);assert.ok(validateDairy(s));
 assert.deepEqual(dairyNeeds(s.buildings[0]),{reed:1,water:5});s.buildings[0].dairy.water=-1;assert.equal(validateDairy(s),false);
});
test('a level II dairy fills the last three output places and displays its real fixed batch',async()=>{
 const {createGame,advanceTime}=await import('../engine.js'),{assignWorkplace}=await import('../management.js'),{initializeBuildingInventory}=await import('../building-inventory.js'),{productionReadout}=await import('../ui-production.js'),{seasonBalance}=await import('../season-balance.js');
 const s=createGame({start:'established'});s.buildings=s.buildings.filter(b=>['house','shrine'].includes(b.type));s.buildings.push({type:'cowshed',x:10,y:8,level:2});s.citizens=[s.citizens[0]];s.population=1;const c=s.citizens[0];c.role='production';initializeBuildingInventory(s);const b=s.buildings.at(-1);Object.assign(b.dairy,{reed:1,water:12});b.workshopStock.output.milk=45;assignWorkplace(s,c.id,'10,8');Object.assign(c,{phase:'working',x:10.5,y:8.5});
 assert.match(productionReadout(s,b),/3 молока/);assert.doesNotMatch(productionReadout(s,b),/4\.8 молока/);
 for(let i=0;i<80&&b.workshopStock.output.milk<48;i++)advanceTime(s,.1);
 assert.equal(b.workshopStock.output.milk,48);assert.equal(b.dairy.reed,0);assert.equal(b.dairy.water,8);b.dairy.cows=0;b.dairy.reed=3;b.dairy.water=12;assert.equal(seasonBalance(s).milk.income,0);
});
test('carriers deliver real dairy feed, export milk and stock homes without teleporting it',async()=>{
 const {createGame,advanceTime,encode,decode}=await import('../engine.js'),{assignWorkplace}=await import('../management.js'),{initializeBuildingInventory}=await import('../building-inventory.js'),{syncCitizens}=await import('../workforce.js');
 const s=createGame({start:'established'});s.buildings=s.buildings.filter(b=>['house','shrine'].includes(b.type));s.buildings.push({type:'cowshed',x:10,y:8,level:1});s.citizens=s.citizens.slice(0,3);s.population=3;for(const c of s.citizens)c.role='carrier';const maker=s.citizens[0];maker.role='production';initializeBuildingInventory(s);const b=s.buildings.at(-1);b.dairy.water=12;
 for(const h of s.buildings.filter(b=>b.type==='house')){h.pantry=100;h.pantryDelivered=100;h.water=100;h.waterDelivered=100;}
 syncCitizens(s);assignWorkplace(s,maker.id,'10,8');let carriedFeed=false,carriedMilk=false,localMilk=false,homeMilk=false;
 for(let i=0;i<900&&!homeMilk;i++){s.event=null;advanceTime(s,.1);carriedFeed||=s.citizens.some(c=>c.cargo.reed>0&&s.district.jobs.some(q=>q.id===c.districtJob&&q.target==='10,8'));carriedMilk||=s.citizens.some(c=>c.cargo.milk>0);localMilk||=b.workshopStock.output.milk>0;homeMilk||=s.buildings.some(h=>h.householdStock?.milk>0);if(i%100===0)assert.ok(decode(encode(s)));}
 assert.ok(carriedFeed,'fodder has a real courier');assert.ok(localMilk,'milk first enters its own output shed');assert.ok(carriedMilk,'milk has a real courier');assert.ok(homeMilk,'a home receives actual milk');assert.ok(s.delivered.milk>0);assert.ok(decode(encode(s)));
});
