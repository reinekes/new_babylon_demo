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
 const {beds,home,homeRef}=arrivalOffer(s,networkFor(s));
 assert.equal(miracle(s,'healing',{count:beds+1,home}).ok,false);
 assert.equal(s.resources.faith,100);
 const index=s.buildings.indexOf(homeRef);
 assert.ok(index>=0);
 s.buildings[index]={...homeRef};
 const before=encode(s);
 assert.equal(miracle(s,'healing',{count:beds,home,homeRef}).ok,false);
 assert.equal(encode(s),before);
 s.buildings[index].water=0;
 assert.notEqual(arrivalOffer(s,networkFor(s))?.home,home);
 s.buildings[index].water=homeRef.water;
 const fresh=arrivalOffer(s,networkFor(s));
 assert.equal(miracle(s,'healing',{count:fresh.beds,home:fresh.home,homeRef:fresh.homeRef}).ok,true);
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
 const {arrivalWelcomeHouse,lastArrivalWelcome,householdWelcomeEvidence}=await import('../arrival-hospitality.js');
 const welcome=loaded.arrivalHospitality.welcomes[0];
 assert.ok(Number.isSafeInteger(welcome.homeId));
 const original=arrivalWelcomeHouse(loaded,welcome);
 assert.ok(original);
 const replacement={...original};
 delete replacement.waterEntityId;
 loaded.buildings[loaded.buildings.indexOf(original)]=replacement;
 assert.equal(arrivalWelcomeHouse(loaded,welcome),undefined);
 assert.equal(lastArrivalWelcome(loaded,welcome.home,family),null);
 assert.equal(householdWelcomeEvidence(loaded,family),welcome);
 const raw=encode(loaded);
 assert.equal(encode(decode(raw)),raw);
 const old=JSON.parse(raw);
 delete old.arrivalHospitality.welcomes[0].homeId;
 delete old.causalFacts;
 const legacyRaw=JSON.stringify(old);
 assert.equal(encode(decode(legacyRaw)),legacyRaw);
});

test('the hospitality name requires different hosts at different occupied courtyards and retains their welcomes',async()=>{
 const {createArrivalFamily,hospitalityNameEvidence,lastArrivalWelcome,householdWelcomeEvidence}=await import('../arrival-hospitality.js');
 const s=createNewCity({mode:'awakening',seed:1}),first=s.citizens[0],second=s.citizens[1];
 first.age=second.age=30;
 const a=first.home,b='10,8';
 assert.notEqual(a,b);
 const unhosted=createArrivalFamily(s,b,2);
 assert.equal(householdWelcomeEvidence(s,unhosted),null);
 const guests=createArrivalFamily(s,a,2);
 const firstWelcome=s.arrivalHospitality.welcomes.at(-1);
 assert.deepEqual(householdWelcomeEvidence(s,[first]),firstWelcome);
 assert.deepEqual(householdWelcomeEvidence(s,[{...guests[0],home:b}]),firstWelcome);
 assert.equal(householdWelcomeEvidence(s,[second]),null);
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

test('the Call reserves only water left after families sheltering from fire are supplied',async()=>{
 const {arrivalOffer,reserveArrival}=await import('../arrival-hospitality.js');
 const {networkFor}=await import('../workforce.js');
 const {waterDemand}=await import('../water.js');
 const s=createNewCity({mode:'awakening',seed:1});
 const home=s.buildings.find(b=>b.type==='house'),key=`${home.x},${home.y}`;
 const residentWater=s.citizens.filter(c=>c.home===key).reduce((n,c)=>n+waterDemand(c),0);
 const guest=s.citizens.find(c=>c.home!==key&&c.age>=16);
 const guestWater=waterDemand(guest);
 for(const b of s.buildings)if(b.type==='house')b.water=0;
 home.level=3;
 home.water=residentWater+guestWater+1;
 guest.fireShelter={host:key,kiln:'2,2'};
 const network=networkFor(s);
 assert.equal(arrivalOffer(s,network)?.beds,1,'water is reserved for the guest even while travelling to shelter');
 guest.fireShelter.returning=true;
 assert.equal(arrivalOffer(s,network)?.beds,2,'the guest will again draw water at their home');
 delete guest.fireShelter.returning;
 assert.equal(reserveArrival(s,network,{home:key,count:2}),false,'a stale two-person offer must be refused');
 assert.equal(home.water,residentWater+guestWater+1);
 assert.equal(reserveArrival(s,network,{home:key,count:1}),true);
 assert.equal(home.water,residentWater+guestWater);
});

test('an arrival agreement reserves one additional water and follows the family after settlement',async()=>{
 const {arrivalOffer,reserveArrival}=await import('../arrival-hospitality.js');
 const {networkFor}=await import('../workforce.js');
 const {advanceTime}=await import('../engine.js');
 const {housingOf}=await import('../definitions.js');
 let s=createNewCity({mode:'awakening',seed:1});
 const house=s.buildings.find(b=>b.type==='house'),home=`${house.x},${house.y}`;
 for(const b of s.buildings)if(b.type==='house')b.water=0;
 house.level=3;s.capacity=housingOf(s);
 house.water=12;
 const network=networkFor(s),offer=arrivalOffer(s,network,{custom:'libation'});
 assert.equal(offer.home,home);
 assert.equal(offer.water,offer.beds+1);
 assert.equal(reserveArrival(s,network,{home,count:offer.beds,custom:'libation'}),true);
 assert.equal(house.water,12-offer.water);
 const raw=encode(s);s=decode(raw);assert.ok(s);assert.equal(encode(s),raw);
 assert.equal(s.arrivalGroup.custom,'libation');
 const invalid=JSON.parse(raw);invalid.arrivalGroup.water--;
 assert.equal(decode(JSON.stringify(invalid)),null);
 for(let i=0;i<400&&s.arrivalGroup;i++){s.event=null;advanceTime(s,.25);}
 assert.equal(s.arrivalGroup,undefined);
 const welcome=s.arrivalHospitality.welcomes.at(-1);
 assert.equal(welcome.custom,'libation');
 assert.equal(welcome.members.length,offer.beds);
 assert.ok(welcome.members.every(id=>s.citizens.some(c=>c.id===id&&c.faith<50)));
 const complete=encode(s);assert.equal(encode(decode(complete)),complete);
});

test('a household water dispute has a one-time outcome tied to the people who were present',async()=>{
 const {reserveArrival,arrivalCustomDispute,resolveArrivalCustomDispute}=await import('../arrival-hospitality.js');
 const {advanceTime}=await import('../engine.js');
 const {housingOf}=await import('../definitions.js');
 const {networkFor}=await import('../workforce.js');
 let s=createNewCity({mode:'awakening',seed:1});
 let house=s.buildings.find(b=>b.type==='house');
 const home=`${house.x},${house.y}`;
 for(const b of s.buildings)if(b.type==='house')b.water=0;
 house.level=3;s.capacity=housingOf(s);house.water=12;
 assert.ok(reserveArrival(s,networkFor(s),{home,count:6,custom:'libation'}));
 for(let i=0;i<400&&s.arrivalGroup;i++){s.event=null;advanceTime(s,.25);}
 let welcome=s.arrivalHospitality.welcomes.at(-1);
 const host=s.citizens.find(c=>c.id===welcome.host),guest=s.citizens.find(c=>c.id===welcome.members[0]);
 for(const c of [host,guest]){c.phase='home';c.mood=70;}
 house.water=0;
 assert.deepEqual(arrivalCustomDispute(s,house,welcome),{host:host.id,guest:guest.id});
 guest.phase='working';
 assert.equal(resolveArrivalCustomDispute(s,house,welcome,'queue',guest.id).ok,false);
 guest.phase='home';
 const faith=[host.faith,guest.faith];
 const alternative=decode(encode(s));assert.ok(alternative);
 const otherHouse=alternative.buildings.find(b=>`${b.x},${b.y}`===home);
 const otherWelcome=alternative.arrivalHospitality.welcomes.at(-1);
 assert.ok(resolveArrivalCustomDispute(alternative,otherHouse,otherWelcome,'pause',guest.id).ok);
 assert.equal(otherHouse.water,0);
 assert.deepEqual([host.id,guest.id].map(id=>alternative.citizens.find(c=>c.id===id).mood),[72,68]);
 assert.equal(resolveArrivalCustomDispute(s,house,welcome,'queue',guest.id).ok,true);
 assert.equal(resolveArrivalCustomDispute(s,house,welcome,'pause',guest.id).ok,false);
 assert.equal(house.water,0);
 assert.deepEqual([host.faith,guest.faith],faith);
 assert.deepEqual([host.mood,guest.mood],[73,73]);
 const raw=encode(s);s=decode(raw);assert.ok(s);assert.equal(encode(s),raw);
 house=s.buildings.find(b=>`${b.x},${b.y}`===home);
 welcome=s.arrivalHospitality.welcomes.at(-1);
 assert.deepEqual(welcome.dispute,{choice:'queue',guest:guest.id,at:s.simTime});
 assert.equal(resolveArrivalCustomDispute(s,house,welcome,'queue',guest.id).ok,false);
 const corrupt=JSON.parse(raw);corrupt.arrivalHospitality.welcomes.at(-1).dispute.guest=host.id;
 assert.equal(decode(JSON.stringify(corrupt)),null);
});

test('a paid arrival keeps the original courtyard identity and loads an older address-only reservation',async()=>{
 const {reserveArrival,advanceArrivalGroup}=await import('../arrival-hospitality.js');
 const {networkFor}=await import('../workforce.js');
 const s=createNewCity({mode:'awakening',seed:1}),network=networkFor(s);
 for(const b of s.buildings)if(b.type==='house')b.water=8;
 assert.ok(reserveArrival(s,network));
 const group=s.arrivalGroup,house=s.buildings.find(b=>`${b.x},${b.y}`===group.home);
 assert.ok(Number.isSafeInteger(group.homeId));
 assert.equal(group.homeId,house.waterEntityId);
 const raw=encode(s);
 assert.equal(encode(decode(raw)),raw);
 const legacy=JSON.parse(raw);
 delete legacy.arrivalGroup.homeId;
 const old=JSON.stringify(legacy);
 assert.equal(encode(decode(old)),old);
 house.waterEntityId=s.causalFacts.nextEntityId++;
 assert.equal(decode(encode(s)),null);
 const position=[group.x,group.y,group.routeIndex];
 assert.equal(advanceArrivalGroup(s,120,network),false);
 assert.deepEqual([group.x,group.y,group.routeIndex],position);
});

test('a paid group waits at a real gate, keeps its reserve on reload and settles once after reopening',async()=>{
 const {arrivalOffer,advanceArrivalGroup}=await import('../arrival-hospitality.js');
 const {networkFor,visibleCitizens}=await import('../workforce.js');
 const {advanceTime,miracle}=await import('../engine.js');
 const s=createNewCity({mode:'awakening',seed:1});
 for(let y=4;y<=10;y++)for(let x=4;x<=8;x++){
  if((x===4||y===4||x===8||y===10)&&!(x===8&&[6,7].includes(y)))s.buildings.push({type:'cityWall',x,y,level:1});
 }
 const gate={type:'cityGate',x:8,y:6,footprint:2,rotation:0,level:1};
 s.buildings.push(gate);
 for(const b of s.buildings)if(b.type==='house')b.water=b.x===6&&b.y===7?12:0;
 const witness=s.citizens[0];
 Object.assign(s.godhood,{stage:'recognized',witnessId:witness.id,recognitionAt:0,believerIds:[witness.id]});
 const {recordNeighborWaterFact}=await import('../causal-facts.js');
 for(const home of s.buildings.filter(b=>b.type==='house').slice(1,3)){
  recordNeighborWaterFact(s,witness,home,{station:null,origin:witness.home,target:`${home.x},${home.y}`},2);
 }
 s.blessingDiscovery.qualifiedAt=0;
 recordArrivalHospitality(s,'envoy',{phase:'departed',outcome:'accepted',destination:'6,7'});
 recordArrivalHospitality(s,'artisan',{phase:'departed',outcome:'taught',fed:true,home:'6,7'});
 s.resources.faith=100;
 const open=networkFor(s),offer=arrivalOffer(s,open,{custom:'libation'});
 assert.equal(offer.home,'6,7');
 assert.ok(offer.route.some(p=>p.x===8.5&&p.y===6.5));
 assert.ok(miracle(s,'healing',{home:offer.home,count:offer.beds,custom:'libation'}).ok);
 assert.equal(s.resources.faith,55);
 const ids=s.citizens.map(c=>c.id),reserve=structuredClone(s.arrivalGroup.provisions);
 gate.rotation=1;
 const closed=networkFor(s);
 assert.equal(arrivalOffer(s,closed),null);
 assert.equal(advanceArrivalGroup(s,60,closed),false);
 assert.equal(s.arrivalGroup.waiting,'route');
 const waiting=encode(s),copy=decode(waiting);
 assert.equal(encode(copy),waiting);
 assert.deepEqual(copy.arrivalGroup.provisions,reserve);
 for(const invalidRoute of [
  g=>{g.x+=3;},
  g=>{g.routeIndex=g.route.length;},
  g=>{g.route=[];g.routeIndex=0;}
 ]){
  const invalid=JSON.parse(waiting);
  invalidRoute(invalid.arrivalGroup);
  assert.equal(decode(JSON.stringify(invalid)),null);
 }
 const {cityToolsHTML}=await import('../ui-city-tools.js');
 assert.match(cityToolsHTML(copy),/Ждут открытия пути/);
 assert.equal(advanceArrivalGroup(copy,60,networkFor(copy)),false);
 assert.equal(encode(copy),waiting);
 const traveler=()=>visibleCitizens(copy).find(c=>c.id===1000010);
 assert.equal(traveler().walking,false);
 assert.deepEqual(traveler().cargo,{food:offer.beds});
 copy.buildings.find(b=>b.type==='cityGate').rotation=0;
 assert.equal(advanceArrivalGroup(copy,.05,networkFor(copy)),false);
 assert.equal(traveler().walking,true);
 for(let i=0;i<400&&copy.arrivalGroup;i++){copy.event=null;advanceTime(copy,.25);}
 assert.equal(copy.arrivalGroup,undefined);
 assert.deepEqual(copy.citizens.slice(0,ids.length).map(c=>c.id),ids);
 const welcomes=copy.arrivalHospitality.welcomes;
 assert.equal(welcomes.length,1);
 assert.equal(welcomes[0].custom,'libation');
 assert.equal(welcomes[0].members.length,offer.beds);
 advanceTime(copy,.25);
 assert.equal(copy.population,ids.length+offer.beds);
 assert.equal(encode(decode(encode(copy))),encode(copy));
});
