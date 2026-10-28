import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,decode,encode} from '../engine.js';
import {initializeArtisans,workArtisan} from '../artisan.js';
import {collectReadyOutputs,initializeBuildingInventory,validateBuildingInventory} from '../building-inventory.js';
import {advanceFestival,cancelFestival,orderFestival,validateFestival,festivalSummary} from '../festival.js';
import {syncInventory,validateInventory} from '../inventory.js';
import {syncCitizens,recoverCitizenCargo} from '../workforce.js';
const city=(start='established')=>{const s=createGame({start});s.resources.prestige=100;s.resources.food=200;syncInventory(s);s.buildings.push({type:'brewery',x:10,y:9,level:1});initializeArtisans(s);initializeBuildingInventory(s);syncCitizens(s);for(const c of s.citizens){Object.assign(c,{age:25,role:'carrier',work:null,phase:'home',cargo:{},buildCargo:{},mealEaten:.8});delete c.pantryTrip;delete c.waterTrip;}return s;};
const brew=(s,b=s.buildings.find(b=>b.type==='brewery'))=>{Object.assign(b.artisan,{food:4,water:3,...!b.artisan.vesselUses?{pottery:1}:{}});workArtisan(b,15,s);collectReadyOutputs(s);return b;};
const step=(s,seconds=.1)=>{for(let t=0;t<seconds-1e-8;t+=.1){advanceFestival(s,.1);s.simTime+=.1;}};
const saved=s=>{s.tick=Math.floor(s.simTime/45);s.season=s.tick%4;s.year=1+Math.floor(s.tick/4);s.seasonElapsed=s.simTime-s.tick*45;return decode(encode(s));};
const toParty=s=>{for(let i=0;i<1800&&s.festival?.stage!=='celebrating';i++)step(s);assert.equal(s.festival?.stage,'celebrating');};
const allBeer=s=>(s.resources.beer||0)+s.buildings.reduce((n,b)=>n+(b.workshopStock?.output?.beer||0)+(b.artisan?.ready&&b.type==='brewery'?b.artisan.ready:0),0)+s.citizens.reduce((n,c)=>n+(c.cargo?.beer||0),0)+(s.festival&&!s.festival.consumed?1:0);

test('first actual brewed batch queues once; construction and purchased beer never create an occasion',()=>{
 const s=city();assert.equal(s.firstBeerFeast?.status,'unbrewed');s.resources.beer=7;syncInventory(s);step(s,1);assert.equal(s.firstBeerFeast.status,'unbrewed');assert.equal(s.festival,null);
 const b=brew(s);assert.equal(s.firstBeerFeast.status,'pending');assert.equal(s.firstBeerFeast.brewery,'10,9');assert.equal(b.productionHistory.at(-1).resources.beer,3);assert.equal(s.festival,null);const stamp=structuredClone(s.firstBeerFeast);brew(s);assert.deepEqual(s.firstBeerFeast,stamp);
});
test('the first real brewed batch announces its local feast once instead of silently waiting for guests',()=>{
 const s=city();s.resources.beer=50;syncInventory(s);step(s,1);
 const announcements=()=>s.news.filter(n=>n.title==='Первая партия пива выпущена');
 assert.equal(announcements().length,0,'purchased stock and an idle brewery do not announce brewing');
 brew(s);assert.equal(announcements().length,1);assert.match(announcements()[0].text,/пивоварн/i);assert.match(announcements()[0].text,/пир|праздник/i);
 const announcement=structuredClone(announcements()[0]);brew(s);assert.equal(announcements().length,1);assert.deepEqual(announcements()[0],announcement);
 const restored=saved(s);assert.ok(restored);brew(restored);assert.equal(restored.news.filter(n=>n.title==='Первая партия пива выпущена').length,1);
});
test('one real local cup supports a small daytime brewery party without a temple or prestige charge',()=>{
 const s=city('beehives');s.resources.prestige=0;const b=brew(s),faith=s.resources.faith,food=s.resources.food;assert.equal(allBeer(s),3);step(s);assert.equal(s.festival?.occasion,'firstBeer');assert.equal(s.festival.temple,'10,9');assert.equal(allBeer(s),3);assert.equal(b.workshopStock.output.beer,2);assert.equal(s.resources.prestige,0);assert.ok(validateFestival(s));toParty(s);assert.ok(s.festival.actors.some(a=>a.stage==='dancing'));assert.equal(s.resources.faith,faith);assert.equal(s.resources.food,food);assert.equal(s.firstBeerFeast.status,'done');assert.equal(allBeer(s),2);assert.deepEqual(festivalSummary(s).cost,{food:0,beer:1,prestige:0});assert.match(festivalSummary(s).venueLabel,/пивовар/);assert.ok(saved(s));step(s,15);assert.equal(s.festival,null);assert.equal(s.firstBeerFeast.status,'done');brew(s);step(s);assert.equal(s.festival,null);
});
test('active night feast, funerals and possession defer the first-beer occasion without losing its goods',()=>{
 const s=city();s.resources.beer=20;syncInventory(s);assert.ok(orderFestival(s).ok);const night=s.festival;brew(s);step(s);assert.equal(s.festival,night);assert.equal(s.festival.occasion,'nightLights');assert.equal(s.firstBeerFeast.status,'pending');cancelFestival(s);s.funeral={scope:'family',actors:[]};step(s);assert.equal(s.festival,null);s.funeral=null;const phase=s.relicQuest.phase;s.relicQuest.phase='controlled';step(s);assert.equal(s.festival,null);s.relicQuest.phase=phase;step(s);assert.equal(s.festival.occasion,'firstBeer');assert.ok(validateFestival(s));
});
test('unconsumed local reservation survives reload, cancellation and death without duplication',()=>{
 let s=city();brew(s);step(s);assert.equal(allBeer(s),3);assert.ok(saved(s));for(let i=0;i<100&&!s.festival.actors.some(a=>a.load>0);i++)step(s);const carrier=s.festival.actors.find(a=>a.load>0);assert.ok(carrier);assert.ok(saved(s));recoverCitizenCargo(s,carrier.id);assert.equal(allBeer(s),3);assert.ok(validateFestival(s));s=saved(s);assert.ok(s);assert.equal(cancelFestival(s).refunded,true);assert.equal(allBeer(s),3);assert.equal(s.firstBeerFeast.status,'pending');assert.ok(validateInventory(s));step(s);assert.equal(allBeer(s),3);assert.ok(saved(s));
});
test('funeral before drinking refunds once then retries; funeral after drinking cannot replay',()=>{
 const s=city();brew(s);step(s);s.funeral={scope:'family',actors:[]};step(s);assert.equal(s.festival,null);assert.equal(s.firstBeerFeast.status,'pending');assert.equal(allBeer(s),3);s.funeral=null;step(s);toParty(s);assert.equal(allBeer(s),2);s.funeral={scope:'family',actors:[]};step(s);assert.equal(s.festival,null);assert.equal(s.firstBeerFeast.status,'done');s.funeral=null;step(s,2);assert.equal(s.festival,null);assert.equal(allBeer(s),2);
});
test('a full local output store still records the first batch and refunds its real cup into a valid holder',()=>{
 const s=city(),b=s.buildings.find(b=>b.type==='brewery');b.workshopStock.output.beer=24;brew(s);assert.equal(s.firstBeerFeast.status,'pending');assert.equal(b.artisan.ready,3);step(s);assert.equal(s.festival.occasion,'firstBeer');assert.equal(b.workshopStock.output.beer,23);assert.equal(b.artisan.ready,3);b.workshopStock.output.beer=24;assert.ok(cancelFestival(s).ok);assert.equal(b.stock.beer,1);assert.equal(s.resources.beer,1);assert.ok(validateInventory(s));assert.ok(validateBuildingInventory(s));assert.ok(saved(s));
});
test('old saves with an ambiguous existing brewery never replay a first-beer party; untouched cities can discover brewing',()=>{
 for(const alreadyBrewed of [false,true]){const s=alreadyBrewed?city():createGame();if(alreadyBrewed)brew(s);delete s.firstBeerFeast;const people=structuredClone(s.citizens),resources=structuredClone(s.resources),restored=saved(s);assert.ok(restored);assert.equal(restored.firstBeerFeast.status,alreadyBrewed?'legacy':'unbrewed');assert.deepEqual(restored.citizens,people);assert.deepEqual(restored.resources,resources);if(alreadyBrewed){brew(restored);step(restored);assert.equal(restored.festival,null);}}
});
test('tampered occasion, local reservations and first-beer ledger reject decoding',()=>{
 const s=city();brew(s);step(s);for(const mutate of [s=>s.firstBeerFeast.status='surprise',s=>s.firstBeerFeast.producedAt=-1,s=>s.festival.occasion='moon',s=>s.festival.sourceKinds['10,9']='teleport',s=>s.festival.allocations['10,9'].beer=2,s=>s.firstBeerFeast.status='unbrewed']){const copy=structuredClone(s);mutate(copy);assert.equal(saved(copy),null);}
});
test('the employed brewer can host the daytime first-cup gathering without a separate idle porter',async()=>{
 const {advanceWorkers}=await import('../workforce.js'),{assignWorkplace,setCitizenRole}=await import('../management.js');
 const s=city(),b=s.buildings.find(b=>b.type==='brewery');for(const c of s.citizens)setCitizenRole(s,c.id,'builder');const brewer=s.citizens.find(c=>c.age>=16);setCitizenRole(s,brewer.id,'production');assert.ok(assignWorkplace(s,brewer.id,'10,9').ok);Object.assign(brewer,{work:'10,9',phase:'working',mealEaten:0,hunger:0,x:10,y:9.5});brew(s,b);
 let celebrated=false;for(let i=0;i<600&&!celebrated;i++){advanceWorkers(s,.1);celebrated=s.festival?.actors.some(a=>a.id===brewer.id&&a.stage==='dancing');}assert.ok(celebrated,'the brewer must join after safe local delivery');assert.equal(s.festival.occasion,'firstBeer');assert.ok(s.festival.actors.some(a=>a.id===brewer.id&&a.stage==='dancing'));assert.ok(saved(s));
});
test('a pending occasion survives demolition of its original brewery and can use a replacement venue',()=>{
 const s=city();brew(s);s.buildings=s.buildings.filter(b=>b.type!=='brewery');assert.ok(saved(s),'queued historical venue need not remain present');s.buildings.push({type:'brewery',x:11,y:9,level:1});initializeArtisans(s);initializeBuildingInventory(s);syncCitizens(s);s.resources.beer=1;syncInventory(s);step(s);assert.equal(s.festival.occasion,'firstBeer');assert.equal(s.festival.temple,'11,9');assert.equal(s.firstBeerFeast.brewery,'10,9');assert.ok(saved(s));
});
test('brewing during an upgrade records the unique occasion and legacy upgrading breweries cannot replay it',async()=>{
 const {upgrade}=await import('../engine.js'),{cancelConstruction}=await import('../management.js');const s=city(),b=s.buildings.find(b=>b.type==='brewery');for(const k of Object.keys(s.resources))s.resources[k]=1000;syncInventory(s);assert.ok(upgrade(s,10,9).ok);brew(s,b);assert.equal(b.artisan.vesselUses,3);assert.equal(s.firstBeerFeast.status,'pending');delete s.firstBeerFeast;const old=saved(s);assert.ok(old);assert.equal(old.firstBeerFeast.status,'legacy');assert.ok(cancelConstruction(old,10,9).ok);brew(old);step(old);assert.equal(old.festival,null);
});
for(const which of ['firstBeer','nightLights'])test(`active ${which} venue cannot be upgraded into an invalid immediate save`,async()=>{
 const {canUpgrade,upgrade}=await import('../engine.js');const s=city();for(const k of ['clay','reed','wood','stone','brick','firedBrick'])s.resources[k]=1000;syncInventory(s);
 if(which==='firstBeer'){brew(s);step(s);}else{s.resources.beer=20;syncInventory(s);assert.ok(orderFestival(s).ok);}
 const venue=s.buildings.find(b=>`${b.x},${b.y}`===s.festival.temple);assert.ok(saved(s));const before=encode(s);assert.match(canUpgrade(s,venue),/праздник/);const result=upgrade(s,venue.x,venue.y);assert.equal(result.ok,false);assert.match(result.reason,/праздник/);assert.equal(encode(s),before,'denied upgrade must not reserve resources or alter jobs');assert.ok(saved(s));
});
test('an active feast source also remains protected from upgrade until cancellation',async()=>{
 const {canUpgrade,upgrade}=await import('../engine.js');const s=city(),shrine=s.buildings.find(b=>b.type==='shrine'),home=s.buildings.find(b=>b.type==='house');for(const k of ['clay','reed','wood','stone','brick','firedBrick'])s.resources[k]=1000;syncInventory(s);s.resources.beer=6;shrine.stock.beer=0;home.stock=Object.fromEntries(Object.keys(shrine.stock).map(k=>[k,0]));home.stock.beer=6;assert.ok(orderFestival(s).ok);assert.ok(s.festival.allocations[`${home.x},${home.y}`]);assert.match(canUpgrade(s,home),/праздник/);assert.equal(upgrade(s,home.x,home.y).ok,false);assert.ok(saved(s));assert.ok(cancelFestival(s).ok);assert.equal(canUpgrade(s,home),'');assert.ok(upgrade(s,home.x,home.y).ok);assert.ok(saved(s));
});
