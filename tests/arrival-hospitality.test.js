import assert from 'node:assert/strict';
import test from 'node:test';
import {createNewCity} from '../new-game.js';
import {encode,decode} from '../engine.js';
import {recordArrivalHospitality,arrivalHospitalityView} from '../arrival-hospitality.js';

test('only completed provisioned visits count once, and receipts survive reload',()=>{
 const s=createNewCity({mode:'awakening',seed:1}),g={phase:'returning',outcome:'accepted',destination:'6,7'};
 recordArrivalHospitality(s,'envoy',g);
 assert.equal(arrivalHospitalityView(s).visits,0);
 g.phase='departed';g.outcome='interrupted';recordArrivalHospitality(s,'envoy',g);
 assert.equal(arrivalHospitalityView(s).visits,0);
 g.outcome='accepted';recordArrivalHospitality(s,'envoy',g);recordArrivalHospitality(s,'envoy',g);
 assert.equal(arrivalHospitalityView(s).visits,1);
 recordArrivalHospitality(s,'artisan',{phase:'departed',outcome:'taught',fed:true,home:'6,7'});
 assert.equal(arrivalHospitalityView(s).visits,2);
 const raw=encode(s);assert.equal(encode(decode(raw)),raw);
 const broken=JSON.parse(raw);broken.arrivalHospitality.receipts[0].at=100;
 assert.equal(decode(JSON.stringify(broken)),null);
});

test('only a served and arrived evacuee from the opposite bank records a hosting household',async()=>{
 const {recordArrivalShelter}=await import('../arrival-hospitality.js');
 const {signedRiverDistance}=await import('../world.js');
 const s=createNewCity({mode:'awakening',seed:1}),host=s.citizens[0],visitor=s.citizens[1];
 const b=s.buildings.find(b=>`${b.x},${b.y}`===host.home),side=Math.sign(signedRiverDistance(b.x,b.y,s));
 let origin;
 for(let x=0;x<64&&!origin;x++)for(let y=0;y<64&&!origin;y++)if(signedRiverDistance(x,y,s)*side < -3)origin={type:'house',x,y,level:1};
 s.buildings.push(origin);
 Object.assign(visitor,{home:`${origin.x},${origin.y}`,floodShelter:host.home,route:[{}],routeIndex:0});
 recordArrivalShelter(s,b,visitor,.8);assert.equal(arrivalHospitalityView(s).shelters,0);
 visitor.routeIndex=1;
 recordArrivalShelter(s,b,visitor,0);assert.equal(arrivalHospitalityView(s).shelters,0);
 const {advanceWellbeing}=await import('../wellbeing.js');
 s.simTime=35;b.pantry=20;b.pantryDelivered=20;
 const prior=b.pantry;
 advanceWellbeing(s,.25);advanceWellbeing(s,.25);
 assert.ok(b.pantry<prior);
 assert.equal(arrivalHospitalityView(s).shelters,1);
 assert.equal(arrivalHospitalityView(s).qualified,false);
});

test('arrival housing counts permanent residents and temporary evacuees, excluding closed houses',async()=>{
 const {arrivalHousing}=await import('../arrival-hospitality.js');
 const s=createNewCity({mode:'awakening',seed:1});
 s.buildings=[
  {type:'house',x:6,y:7,level:1,starterHut:true},
  {type:'house',x:8,y:7,level:1,starterHut:true},
  {type:'house',x:10,y:7,level:1,construction:{kind:'new'}}
 ];
 s.citizens=[{home:'6,7',floodShelter:'8,7'},{home:'8,7'},{home:'8,7'}];
 assert.deepEqual(arrivalHousing(s),[{home:'6,7',beds:3},{home:'8,7',beds:1}]);
});

test('an arrival route uses a connected map edge and a dry house with vacancies',async()=>{
 const {arrivalRoute}=await import('../arrival-hospitality.js');
 const {networkFor}=await import('../workforce.js');
 const s=createNewCity({mode:'awakening',seed:1});
 const network=networkFor(s);
 const offer=arrivalRoute(s,network);
 assert.ok(offer);
 const {route,home,beds}=offer;
 assert.ok(beds>0&&beds<=6);
 assert.ok(route[0].x===-.5||route[0].y===-.5||route[0].x===63.5||route[0].y===63.5);
 assert.equal(route.at(-1).key,network.ports.find(p=>`${p.building.x},${p.building.y}`===home).key);
 assert.ok(route.slice(1).every((p,i)=>network.graph.get(route[i].key).has(p.key)));
 assert.equal(arrivalRoute(s,{...network,components:new Map()}),null);
});

test('arrival offer limits the group to water surplus and reachable food outside seed reserves',async()=>{
 const {arrivalOffer}=await import('../arrival-hospitality.js');
 const {syncInventory}=await import('../inventory.js');
 const {networkFor}=await import('../workforce.js');
 const s=createNewCity({mode:'awakening',seed:1}),network=networkFor(s);
 const home=s.buildings.find(b=>b.type==='house');
 const key=`${home.x},${home.y}`;
 home.level=2;
 for(const b of s.buildings)if(b.type==='house')b.water=0;
 home.water=s.citizens.filter(c=>c.home===key).reduce((n,c)=>n+(c.age<16?.5:1),0)+2;
 const offers=arrivalOffer(s,network);
 assert.ok(offers);
 assert.equal(offers.home,key);
 assert.equal(offers.beds,2);
 assert.equal(offers.food,2);
 assert.equal(offers.water,2);
 s.buildings.push({type:'field',x:0,y:0,level:1});
 s.resources.food=4;syncInventory(s);
 assert.equal(arrivalOffer(s,network),null,'the seed reserve cannot become a travel ration');
});

test('reserving the arrival ration debits supplies once and survives a reload',async()=>{
 const {reserveArrival,arrivalHousing}=await import('../arrival-hospitality.js');
 const {canDemolish}=await import('../management.js');
 const {networkFor}=await import('../workforce.js');
 const s=createNewCity({mode:'awakening',seed:1}),network=networkFor(s);
 for(const b of s.buildings)if(b.type==='house')b.water=8;
 const water=s.buildings.reduce((n,b)=>n+(b.water||0),0),food=s.resources.food,population=s.population;
 const before=new Map(arrivalHousing(s).map(row=>[row.home,row.beds]));
 assert.ok(reserveArrival(s,network));
 const {count,home}=s.arrivalGroup;
 assert.equal(arrivalHousing(s).find(row=>row.home===home)?.beds||0,before.get(home)-count);
 assert.match(canDemolish(s,s.buildings.find(b=>`${b.x},${b.y}`===home)),/зарезервированы/);
 assert.equal(s.resources.food,food-count);
 assert.equal(s.buildings.reduce((n,b)=>n+(b.water||0),0),water-count);
 assert.equal(s.population,population);
 assert.equal(reserveArrival(s,network),false);
 const raw=encode(s);
 assert.equal(encode(decode(raw)),raw);
 const broken=JSON.parse(raw);broken.arrivalGroup.count++;
 assert.equal(decode(JSON.stringify(broken)),null);
});

test('a group waits behind a blocked path, then settles once through the normal simulation',async()=>{
 const {reserveArrival,advanceArrivalGroup}=await import('../arrival-hospitality.js');
 const {networkFor}=await import('../workforce.js');
 const {advanceTime}=await import('../engine.js');
 const s=createNewCity({mode:'awakening',seed:1}),network=networkFor(s);
 for(const b of s.buildings)if(b.type==='house')b.water=8;
 assert.ok(reserveArrival(s,network));
 const {count,home,x,y}=s.arrivalGroup,ids=s.citizens.map(c=>c.id);
 assert.equal(advanceArrivalGroup(s,60,{...network,nodes:new Map(),components:new Map()}),false);
 assert.deepEqual([s.arrivalGroup.x,s.arrivalGroup.y],[x,y]);
 const copy=decode(encode(s));
 assert.ok(copy);
 for(let i=0;i<400&&copy.arrivalGroup;i++){copy.event=null;advanceTime(copy,.25);}
 assert.equal(copy.arrivalGroup,undefined);
 assert.equal(copy.population,ids.length+count);
 assert.deepEqual(copy.citizens.slice(0,ids.length).map(c=>c.id),ids);
 assert.ok(copy.citizens.slice(ids.length).every(c=>c.home===home));
 const population=copy.population;
 advanceTime(copy,.25);
 assert.equal(copy.population,population);
 assert.equal(encode(decode(encode(copy))),encode(copy));
});

test('the Call charges only for the displayed group and requires blessing and hospitality',async()=>{
 const {miracle}=await import('../engine.js');
 const {networkFor}=await import('../workforce.js');
 const {arrivalOffer}=await import('../arrival-hospitality.js');
 const s=createNewCity({mode:'awakening',seed:1});
 s.resources.faith=100;s.godhood.stage='recognized';
 for(const b of s.buildings)if(b.type==='house')b.water=8;
 const population=s.population;
 assert.match(miracle(s,'healing').reason,/Благословение/);
 s.blessingDiscovery.qualifiedAt=s.simTime;
 assert.match(miracle(s,'healing').reason,/гостеприимств/);
 recordArrivalHospitality(s,'envoy',{phase:'departed',outcome:'accepted',destination:'6,7'});
 recordArrivalHospitality(s,'artisan',{phase:'departed',outcome:'taught',fed:true,home:'6,7'});
 const {beds,home}=arrivalOffer(s,networkFor(s));
 assert.equal(miracle(s,'healing',{count:beds+1,home}).ok,false);
 assert.equal(s.resources.faith,100);
 assert.equal(miracle(s,'healing',{count:beds,home}).ok,true);
 assert.equal(s.arrivalGroup.count,beds);
 assert.equal(s.resources.faith,55);
 assert.equal(s.population,population);
});

test('an arriving family keeps its parents, home welcome and independent belief after reload',async()=>{
 const {reserveArrival}=await import('../arrival-hospitality.js');
 const {networkFor}=await import('../workforce.js');
 const {advanceTime}=await import('../engine.js');
 const s=createNewCity({mode:'awakening',seed:1}),house=s.buildings.find(b=>b.type==='house');
 for(const b of s.buildings)if(b.type==='house')b.water=0;
 house.level=3;house.water=12;
 const first=s.demography.nextId;
 assert.ok(reserveArrival(s,networkFor(s)));
 assert.equal(s.arrivalGroup.count,6);
 for(let i=0;i<400&&s.arrivalGroup;i++){s.event=null;advanceTime(s,.25);}
 const loaded=decode(encode(s));
 assert.ok(loaded);
 const family=loaded.citizens.filter(c=>c.id>=first);
 assert.equal(family.length,6);
 assert.equal(family[0].partner,first+1);
 assert.equal(family[1].partner,first);
 for(const child of family.slice(2)){
  assert.ok(child.age<16);
  assert.deepEqual(child.parents,[first,first+1]);
 }
 assert.ok(family.every(c=>!loaded.godhood.believerIds.includes(c.id)));
 assert.deepEqual(loaded.arrivalHospitality.welcomes[0].members,family.map(c=>c.id));
});

test('the hospitality name requires different hosts at different occupied courtyards and retains their welcomes',async()=>{
 const {createArrivalFamily,hospitalityNameEvidence,lastArrivalWelcome}=await import('../arrival-hospitality.js');
 const s=createNewCity({mode:'awakening',seed:1}),first=s.citizens[0],second=s.citizens[1];
 first.age=second.age=30;
 const a=first.home,b='10,8';
 assert.notEqual(a,b);
 createArrivalFamily(s,b,2);
 createArrivalFamily(s,a,2);
 assert.equal(hospitalityNameEvidence(s),null);
 first.home=b;
 second.home=a;
 createArrivalFamily(s,b,2);
 assert.equal(hospitalityNameEvidence(s),null);
 createArrivalFamily(s,a,2);
 const earned=hospitalityNameEvidence(s);
 assert.deepEqual(earned?.map(f=>f.host),[first.id,second.id]);
 assert.deepEqual(earned?.map(f=>f.home),[b,a]);
 assert.equal(lastArrivalWelcome(s,a,[{id:s.demography.nextId}]),null);
 assert.equal(lastArrivalWelcome(s,a,[second]),earned[1]);
 for(let i=0;i<85;i++)createArrivalFamily(s,b,1);
 assert.equal(s.arrivalHospitality.welcomes.length,80);
 assert.deepEqual(hospitalityNameEvidence(s),earned);
});
