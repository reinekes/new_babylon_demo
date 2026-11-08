import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,decode,encode,advanceTime} from '../engine.js';
import {strictScenario} from '../scenario-profiles.js';
import {approveWaterProject,waterProjectProposal,sendWaterProjectDream,acceptWaterProjectDream,discardWaterProjectDream,waterDreamProposal,waterProjectDeliveryWait} from '../human-projects.js';
import {assignWorkplace,setCitizenRole} from '../management.js';
import {syncCitizens,invalidateAssignments} from '../workforce.js';
import {buildingKey} from '../definitions.js';

test('a dry household and a ready organizer can approve exactly one real waterpoint order',()=>{
 let s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const house=s.buildings.findLast(b=>b.type==='house'),requester=s.citizens.find(c=>c.home===buildingKey(house));
 const organizer=s.citizens.find(c=>c.age>=16&&c.home!==requester.home);
 const x=12,y=7;
 assert.match(waterProjectProposal(s,organizer.id,requester.id,x,y).reason,/запас воды/);
 house.water=0;
 assert.ok(setCitizenRole(s,organizer.id,'builder').ok);
 organizer.hunger=40;
 const before=encode(s);
 assert.match(approveWaterProject(s,organizer.id,requester.id,x,y).reason,/голод/);
 assert.equal(encode(s),before);
 organizer.hunger=0;
 const clay=s.resources.clay;
 const result=approveWaterProject(s,organizer.id,requester.id,x,y);
 assert.ok(result.ok,result.reason);
 assert.equal(s.resources.clay,clay-12);
 assert.equal(approveWaterProject(s,organizer.id,requester.id,x,y).ok,false);
 const raw=encode(s);s=decode(raw);assert.ok(s);assert.equal(encode(s),raw);
 let organizerWorked=false;
 for(let i=0;i<500&&s.buildings.find(b=>buildingKey(b)===result.key).construction;i++){
  s.event=null;advanceTime(s,.25);
  organizerWorked||=s.citizens.some(c=>c.id===organizer.id&&c.site===result.key&&c.phase==='constructing');
 }
 assert.ok(organizerWorked);
 const project=s.buildings.find(b=>buildingKey(b)===result.key);
 assert.equal(project.construction,undefined);
 assert.equal(project.humanWaterProject.organizerId,organizer.id);
 assert.equal(project.humanWaterProject.delivery,undefined);
 const waitingHome=s.buildings.find(b=>buildingKey(b)===requester.home);
 waitingHome.water=waitingHome.waterDelivered;
 assert.match(waterProjectDeliveryWait(s,project,waitingHome),/запас воды/);
 waitingHome.water=0;
 assert.match(waterProjectDeliveryWait(s,project,waitingHome),/назначить водоноса/);
 assert.ok(decode(encode(s)));
 const courier=s.citizens.find(c=>c.id===organizer.id);
 assert.ok(setCitizenRole(s,courier.id,'watercarrier').ok);
 assert.ok(assignWorkplace(s,courier.id,result.key).ok);
 for(let i=0;i<400&&s.citizens.find(c=>c.id===courier.id).phase!=='working';i++){s.event=null;advanceTime(s,.2);}
 s.buildings.find(b=>buildingKey(b)===requester.home).water=0;
 let observed=false;
 for(let i=0;i<900&&!project.humanWaterProject.delivery;i++){
  s.event=null;advanceTime(s,.2);
  if(courier.waterTrip?.station===result.key&&courier.waterTrip.target===requester.home){
   assert.match(waterProjectDeliveryWait(s,project,waitingHome),/рейс/);
   observed=true;
  }
 }
 assert.ok(observed);
 const delivery=project.humanWaterProject.delivery;

 assert.ok(delivery);
 assert.equal(delivery.courierId,courier.id);
 assert.ok(delivery.amount>0);
 assert.deepEqual(s.causalFacts.water.map(f=>[f.stationId,f.homeId,f.courierId,f.amount]),[[project.waterEntityId,project.humanWaterProject.homeId,courier.id,delivery.amount]]);
 const restored=decode(encode(s));assert.ok(restored);
 assert.deepEqual(restored.buildings.find(b=>buildingKey(b)===result.key).humanWaterProject.delivery,delivery);
});

test('a waterpoint project records consenting helpers and prioritizes their actual construction after reload',()=>{
 let s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const house=s.buildings.findLast(b=>b.type==='house');
 const requester=s.citizens.find(c=>c.home===buildingKey(house));
 const adults=s.citizens.filter(c=>c.age>=16&&c.home!==requester.home);
 const organizer=adults[0],helper=adults.at(-1);
 setCitizenRole(s,organizer.id,'builder');
 setCitizenRole(s,helper.id,'builder');
 house.water=0;
 const result=approveWaterProject(s,organizer.id,requester.id,12,7,[helper.id]);
 assert.ok(result.ok,result.reason);
 assert.deepEqual(s.buildings.find(b=>buildingKey(b)===result.key).humanWaterProject.participantIds,[helper.id]);
 const raw=encode(s);
 s=decode(raw);
 assert.ok(s);
 assert.equal(encode(s),raw);
 let joined=false;
 for(let i=0;i<500&&!joined;i++){
  s.event=null;
  advanceTime(s,.25);
  joined=s.citizens.some(c=>c.id===helper.id&&c.site===result.key&&c.phase==='constructing');
 }
 assert.ok(joined,'the chosen helper physically joins construction');
});

test('invalid or unavailable helpers refuse before reservation and legacy projects still load',()=>{
 const fixture=()=>{
  const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
  const house=s.buildings.findLast(b=>b.type==='house');
  const requester=s.citizens.find(c=>c.home===buildingKey(house));
  const [organizer,helper]=s.citizens.filter(c=>c.age>=16&&c.home!==requester.home);
  setCitizenRole(s,organizer.id,'builder');
  setCitizenRole(s,helper.id,'builder');
  house.water=0;
  return {s,organizer,helper,requester};
 };
 for(const choice of ['duplicate','organizer','missing','hungry','cargo','guard','flood','fire','manual','clothing','memory','meal','seed','craft','school','new-role','too-many']){
  const {s,organizer,helper,requester}=fixture();
  let ids=[helper.id];
  if(choice==='duplicate')ids.push(helper.id);
  if(choice==='organizer')ids=[organizer.id];
  if(choice==='missing')ids=[s.demography.nextId];
  if(choice==='hungry')helper.hunger=40;
  if(choice==='cargo')helper.cargo={clay:1};
  if(choice==='guard')helper.guardPost='9,8';
  if(choice==='flood')helper.floodShelter=true;
  if(choice==='fire')helper.fireShelter={host:requester.home,kiln:'10,10'};
  if(choice==='manual')helper.manualGathering={key:'7,7'};
  if(choice==='clothing')helper.clothingTarget=requester.id;
  if(choice==='memory')helper.memorialMove={id:1};
  if(choice==='meal')helper.commonMealTarget='9,8';
  if(choice==='seed')helper.seedField='12,8';
  if(choice==='craft')helper.craftSite='9,8';
  if(choice==='school')helper.school='9,8';
  if(choice==='new-role')helper.pendingRole='carrier';
  if(choice==='too-many')ids=[1,2,3,4];
  const before=encode(s);
  assert.equal(approveWaterProject(s,organizer.id,requester.id,12,7,ids).ok,false,choice);
  assert.equal(encode(s),before,choice);
 }
 const {s,organizer,helper,requester}=fixture();
 for(const person of [organizer,requester]){
  person.fireShelter={host:person===organizer?requester.home:organizer.home,kiln:'10,10',returning:true};
  const before=encode(s);
  assert.match(approveWaterProject(s,organizer.id,requester.id,12,7,[helper.id]).reason,/эвакуаци/);
  assert.equal(encode(s),before);
  delete person.fireShelter;
 }
 assert.ok(approveWaterProject(s,organizer.id,requester.id,12,7,[helper.id]).ok);
 const p=s.buildings.find(b=>b.humanWaterProject).humanWaterProject;
 for(const ids of [[helper.id,helper.id],[organizer.id],[s.demography.nextId],null]){
  p.participantIds=ids;
  assert.equal(decode(encode(s)),null);
 }
 delete p.participantIds;
 assert.ok(decode(encode(s)),'projects created before helpers remain supported');
});


test('automatic helpers take both carrier slots and the second builder slot',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const house=s.buildings.findLast(b=>b.type==='house');
 const requester=s.citizens.find(c=>c.home===buildingKey(house));
 const adults=s.citizens.filter(c=>c.age>=16&&c.home!==requester.home);
 const organizer=adults[0],helpers=adults.slice(-3);
 setCitizenRole(s,organizer.id,'builder');
 for(const c of helpers)setCitizenRole(s,c.id,'auto');
 house.water=0;
 const result=approveWaterProject(s,organizer.id,requester.id,12,7,helpers.map(c=>c.id));
 assert.ok(result.ok,result.reason);
 const worked=new Set(),assigned=new Set();
 for(let i=0;i<500&&s.buildings.find(b=>buildingKey(b)===result.key).construction;i++){
  s.event=null;advanceTime(s,.25);
  for(const c of s.citizens)if(c.site===result.key){
   assigned.add(c.id);
   if(c.phase==='constructing'||Object.values(c.buildCargo||{}).some(n=>n>0))worked.add(c.id);
  }
 }
 for(const c of helpers)assert.ok(assigned.has(c.id),'helper '+c.id+' assigned to the project');
 assert.ok(helpers.filter(c=>worked.has(c.id)).length>=2,'helpers deliver actual cargo and construct');
});


test('completed project membership gives no priority to a later construction order',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const house=s.buildings.findLast(b=>b.type==='house'),requester=s.citizens.find(c=>c.home===buildingKey(house));
 const adults=s.citizens.filter(c=>c.age>=16&&c.home!==requester.home);
 const organizer=adults.at(-1),helper=adults.at(-2);
 setCitizenRole(s,organizer.id,'builder');setCitizenRole(s,helper.id,'builder');house.water=0;
 assert.ok(approveWaterProject(s,organizer.id,requester.id,12,7,[helper.id]).ok);
 const site=s.buildings.find(b=>b.humanWaterProject);
 site.construction.kind='upgrade';
 for(const c of s.citizens){delete c.site;delete c.siteDuty;delete c.store;c.phase='home';}
 const without=structuredClone(s);
 delete without.buildings.find(b=>b.humanWaterProject).humanWaterProject;
 invalidateAssignments(s);invalidateAssignments(without);
 syncCitizens(s);syncCitizens(without);
 assert.deepEqual(s.citizens,without.citizens);
});

test('a shared dream charges once and prepares a water project for confirmation at dawn',()=>{
 let s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const house=s.buildings.findLast(b=>b.type==='house'),requester=s.citizens.find(c=>c.home===buildingKey(house));
 const [organizer,helper]=s.citizens.filter(c=>c.age>=16&&c.home!==requester.home);
 house.water=0;
 s.resources.faith=10;
 const before=encode(s);
 assert.equal(sendWaterProjectDream(s,organizer.id,requester.id,12,7,[]).ok,false);
 assert.equal(encode(s),before);
 assert.ok(sendWaterProjectDream(s,organizer.id,requester.id,12,7,[helper.id]).ok);
 assert.equal(s.resources.faith,7);
 assert.equal(s.waterProjectDream.readyAt,55);
 assert.equal(s.buildings.some(b=>b.humanWaterProject),false);
 assert.equal(sendWaterProjectDream(s,organizer.id,requester.id,12,7,[helper.id]).ok,false);
 assert.equal(s.resources.faith,7);
 const raw=encode(s);
 s=decode(raw);
 assert.ok(s);
 assert.equal(encode(s),raw);
 assert.equal(acceptWaterProjectDream(s).ok,false);
 const malformed=JSON.parse(raw);
 malformed.waterProjectDream.readyAt--;
 assert.equal(decode(JSON.stringify(malformed)),null);
 s.simTime=s.waterProjectDream.readyAt;
 const now=s.citizens.find(c=>c.id===helper.id);
 now.floodShelter=house.x+','+house.y;
 const waiting=encode(s),blocked=acceptWaterProjectDream(s);
 assert.match(blocked.reason,/эвакуации/);
 assert.doesNotMatch(blocked.reason,/^undefined/);
 assert.equal(waterDreamProposal(s).reason,blocked.reason);
 assert.equal(encode(s),waiting);
 delete now.floodShelter;
 now.hunger=40;
 assert.equal(acceptWaterProjectDream(s).ok,false);
 assert.match(waterDreamProposal(s).reason,/голоден/);
 assert.ok(s.waterProjectDream);
 now.hunger=0;
 assert.ok(waterDreamProposal(s).ok);
 s.buildings.push({type:'house',x:12,y:7,level:1});
 const occupied=encode(s),unavailable=waterDreamProposal(s);
 assert.match(unavailable.reason,/занята/);
 assert.deepEqual(acceptWaterProjectDream(s),unavailable);
 assert.equal(encode(s),occupied);
 s.buildings.pop();
 assert.ok(waterDreamProposal(s).ok);
 assert.ok(acceptWaterProjectDream(s).ok);
 assert.equal(s.waterProjectDream,undefined);
 assert.equal(s.resources.faith,7);
 assert.equal(acceptWaterProjectDream(s).ok,false);
});

test('a shared dream cannot start construction for a replacement courtyard',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const original=s.buildings.findLast(b=>b.type==='house');
 const requester=s.citizens.find(c=>c.home===buildingKey(original));
 const [organizer,helper]=s.citizens.filter(c=>c.age>=16&&c.home!==requester.home);
 original.water=0;
 s.resources.faith=10;
 assert.ok(sendWaterProjectDream(s,organizer.id,requester.id,12,7,[helper.id]).ok);
 const replacement={...original};
 delete replacement.waterEntityId;
 s.buildings[s.buildings.indexOf(original)]=replacement;
 const raw=encode(s),loaded=decode(raw);
 assert.ok(loaded);
 assert.equal(encode(loaded),raw);
 loaded.simTime=loaded.waterProjectDream.readyAt;
 const before=encode(loaded);
 assert.match(acceptWaterProjectDream(loaded).reason??'',/снесён или заменён/);
 assert.equal(encode(loaded),before);
 const legacy=JSON.parse(raw);
 delete legacy.waterProjectDream.homeId;
 delete legacy.causalFacts;
 const legacyRaw=JSON.stringify(legacy),old=decode(legacyRaw);
 assert.ok(old);
 assert.equal(encode(old),legacyRaw);
 old.simTime=old.waterProjectDream.readyAt;
 assert.ok(acceptWaterProjectDream(old).ok);
});

test('a water project and its paid dream refuse before spending when materials are across the river',async()=>{
 const {stockStores,syncInventory}=await import('../inventory.js');
 const {terrain}=await import('../engine.js');
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const home=s.buildings.findLast(b=>b.type==='house'),requester=s.citizens.find(c=>c.home===buildingKey(home));
 const [organizer,helper]=s.citizens.filter(c=>c.age>=16&&c.home!==requester.home);
 home.water=0;
 for(const c of [organizer,helper])assert.ok(setCitizenRole(s,c.id,'builder').ok);
 s.resources.faith=10;
 const local=stockStores(s)[0],wood=local.stock.wood;
 assert.ok(wood>=4);
 assert.notEqual(terrain(24,7,s),'water');
 local.stock.wood=0;
 s.buildings.push({type:'granary',x:24,y:7,level:1,stock:{wood}});
 syncInventory(s);
 const before=encode(s),args=[s,organizer.id,requester.id,12,7,[helper.id]];
 assert.match(waterProjectProposal(...args).reason,/доступных складах.*дерево/i);
 assert.match(sendWaterProjectDream(...args).reason,/доступных складах.*дерево/i);
 assert.equal(encode(s),before);
 const remote=s.buildings.find(b=>b.x===24&&b.y===7);
 local.stock.wood=4;remote.stock.wood-=4;
 const supplied=encode(s),offer=waterProjectProposal(...args);
 assert.ok(offer.ok,offer.reason);
 assert.equal(offer.availableStock.wood,4);
 assert.equal(offer.cost.wood,4);
 assert.ok(offer.reachableHomes.has(organizer.home));
 assert.ok(!offer.eligibleStores.has(buildingKey(remote)));
 assert.equal(encode(s),supplied);
});

test('an existing water dream stays read-only after the nameless ending',async()=>{
 const {recordNamelessEnding}=await import('../godhood.js');
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const house=s.buildings.findLast(b=>b.type==='house'),requester=s.citizens.find(c=>c.home===buildingKey(house));
 const [organizer,helper]=s.citizens.filter(c=>c.age>=16&&c.home!==requester.home);
 house.water=0;s.resources.faith=10;
 const args=[organizer.id,requester.id,12,7,[helper.id]];
 assert.ok(sendWaterProjectDream(s,...args).ok);
 Object.assign(s.godhood,{mode:'awakening',stage:'unseen',recognitionAt:0,believerIds:[]});
 assert.ok(recordNamelessEnding(s).ok);
 const raw=encode(s),loaded=decode(raw);
 assert.ok(loaded);
 assert.equal(encode(loaded),raw);
 assert.match(discardWaterProjectDream(loaded).reason??'',/наблюдение/);
 assert.match(acceptWaterProjectDream(loaded).reason??'',/наблюдение/);
 assert.match(waterProjectProposal(loaded,...args).reason??'',/наблюдение/);
 assert.equal(encode(loaded),raw);
});

test('a placement draft cannot commit for a moved requester or a replacement courtyard',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const source=s.buildings.findLast(b=>b.type==='house');
 const requester=s.citizens.find(c=>c.home===buildingKey(source));
 const [organizer,helper]=s.citizens.filter(c=>c.age>=16&&c.home!==requester.home);
 source.water=0;
 assert.ok(setCitizenRole(s,organizer.id,'builder').ok);
 assert.ok(setCitizenRole(s,helper.id,'builder').ok);
 const args=[organizer.id,requester.id,12,7,[helper.id]];
 assert.ok(waterProjectProposal(s,...args,source).ok);
 const replacement={...source};
 s.buildings[s.buildings.indexOf(source)]=replacement;
 let before=encode(s);
 for(const action of [waterProjectProposal,approveWaterProject,sendWaterProjectDream]){
  assert.match(action(s,...args,source).reason,/Первоначальный двор/);
  assert.equal(encode(s),before);
 }
 assert.ok(waterProjectProposal(s,...args,replacement).ok);
 const other=s.buildings.find(b=>b.type==='house'&&b!==replacement);
 requester.home=buildingKey(other);
 before=encode(s);
 assert.match(approveWaterProject(s,...args,replacement).reason,/Проситель больше не живёт/);
 assert.equal(encode(s),before);
});

test('the proposal sees city materials that have yet to be reconciled to the connected store',async()=>{
 const {syncInventory}=await import('../inventory.js');
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const house=s.buildings.findLast(b=>b.type==='house'),requester=s.citizens.find(c=>c.home===buildingKey(house));
 const organizer=s.citizens.find(c=>c.age>=16&&c.home!==requester.home);
 house.water=0;
 assert.ok(setCitizenRole(s,organizer.id,'builder').ok);
 s.resources.clay=0;
 syncInventory(s);
 s.resources.clay=20;
 const before=JSON.stringify(s),offer=waterProjectProposal(s,organizer.id,requester.id,12,7);
 assert.ok(offer.ok,offer.reason);
 assert.equal(offer.availableStock.clay,20);
 assert.equal(JSON.stringify(s),before);
 assert.ok(approveWaterProject(s,organizer.id,requester.id,12,7).ok);
 assert.equal(s.resources.clay,8);
});
