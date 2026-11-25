import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,encode,decode} from '../engine.js';
import {startFuneral,advanceFuneral,funeralView,validateFuneral} from '../funerals.js';
const bodies=n=>Array.from({length:n},(_,i)=>({id:100+i,name:`Покойный ${i}`,x:8,y:8}));
test('each deceased has a stable white-shrouded bier, adult carrier associations and actual rail targets',()=>{
 const s=createGame({start:'established'});startFuneral(s,bodies(3));let view=funeralView(s);
 assert.equal(view.biers.length,3);assert.deepEqual(view.biers.map(b=>b.deceasedId),[100,101,102]);assert.equal(new Set(view.biers.map(b=>b.id)).size,3);
 for(let i=0;i<2500&&s.funeral?.stage!=='procession';i++)advanceFuneral(s,.1);
 view=funeralView(s);const carried=view.biers.filter(b=>b.carriers.length);
 assert.ok(carried.length);for(const b of carried)for(const c of b.carriers){assert.ok(s.citizens.find(a=>a.id===c.id).age>=16);for(const h of Object.values(c.hands)){assert.ok(Number.isFinite(h.height));assert.ok(Math.hypot(h.x-c.x,h.y-c.y)<.12);}}
 assert.equal(new Set(carried.flatMap(b=>b.carriers.map(c=>c.id))).size,carried.flatMap(b=>b.carriers).length);
});
test('scarce adults transport batches, set down, bow, recede before jackals, and all save stages roundtrip',()=>{
 const s=createGame({start:'established'});s.citizens=s.citizens.slice(0,2);s.citizens.forEach(c=>c.age=30);s.population=2;startFuneral(s,bodies(3),{sequentialRite:true});const stages=new Set(),seenBatches=new Set();
 for(let i=0;i<20000&&s.funeral;i++){const f=s.funeral;stages.add(f.stage);seenBatches.add(f.batch);assert.equal(validateFuneral(s),true);const view=funeralView(s);assert.equal(view.biers.length,3);if(f.stage==='farewell'){if(view.participants.some(p=>p.bow>0))stages.add('bow');assert.equal(view.jackals.length,0);if(f.timer>=1.2)assert.ok(Math.abs(view.biers.find(b=>b.deceasedId===100+f.batch).height-.0225)<1e-8);}if(f.stage==='jackals')assert.ok(view.participants.every(p=>Math.hypot(p.x-f.boundary.x,p.y-f.boundary.y)>.8));if(!stages.has(`save:${f.stage}`)){assert.ok(decode(encode(s)),f.stage);stages.add(`save:${f.stage}`);}advanceFuneral(s,.2);}
 assert.equal(s.funeral,null);assert.equal(seenBatches.size,3);assert.ok(stages.has('bow'));assert.ok(stages.has('collecting'));assert.ok(stages.has('farewell'));assert.ok(stages.has('receding'));assert.ok(stages.has('jackals'));
});
test('unattended funeral completes, leaves no simulated cargo mutation, and pauses exactly',()=>{
 const s=createGame({start:'established'});s.citizens=[];s.population=0;startFuneral(s,bodies(4));const before=JSON.stringify(s.funeral);advanceFuneral(s,0);assert.equal(JSON.stringify(s.funeral),before);for(let i=0;i<20000&&s.funeral;i++)advanceFuneral(s,.5);assert.equal(s.funeral,null);
});
test('malformed ceremony counters cannot skip deceased or fabricate completed batches',()=>{const s=createGame({start:'established'});startFuneral(s,bodies(3));for(const change of [{batch:2},{laid:2},{deceased:null},{actors:null},{bierProgress:[]},{bierProgress:[0,.5,0]},{bierProgress:[0,0,1.5]}]){const bad=structuredClone(s);Object.assign(bad.funeral,change);assert.equal(validateFuneral(bad),false);}});
test('large casualty layouts keep one unique bounded bier per deceased',()=>{const s=createGame({start:'established'});s.citizens=s.citizens.slice(0,2);s.population=2;startFuneral(s,bodies(1000));const view=funeralView(s);assert.equal(view.biers.length,1000);assert.equal(new Set(view.biers.map(b=>`${b.x},${b.y}`)).size,1000);assert.ok(view.biers.every(b=>b.x>=.5&&b.x<40&&b.y>=.5&&b.y<30));});
test('carried biers follow dry routes outside occupied building footprints',async()=>{const {isDryPoint}=await import('../world.js'),{footprintSize}=await import('../footprints.js'),s=createGame({start:'established'});s.citizens.forEach(c=>{c.age=30;c.cargo={};c.buildCargo={};});startFuneral(s,bodies(3));while(s.funeral.stage!=='procession')advanceFuneral(s,.2);for(let n=0;n<25&&s.funeral.stage==='procession';n++){for(const b of funeralView(s).biers.filter(b=>b.carriers.length)){assert.ok(isDryPoint(s,b.x,b.y));assert.ok(!s.buildings.some(p=>{if(['field','garden','bridge'].includes(p.type))return false;const size=footprintSize(p);return Math.abs(b.x-p.x-(size-1)/2)<size/2-.04&&Math.abs(b.y-p.y-(size-1)/2)<size/2-.04;}),`${b.id} outside occupied footprints`);}advanceFuneral(s,.2);}});
test('forty farewell mourners stand on separate dry clear stations around an occupied boundary house',async()=>{const {isDryPoint}=await import('../world.js'),{footprintSize}=await import('../footprints.js'),s=createGame({start:'established'}),base=s.citizens[0];s.citizens=Array.from({length:40},(_,id)=>({...structuredClone(base),id,age:30,cargo:{},buildCargo:{}}));s.population=40;s.buildings.push({type:'house',x:3,y:8,level:1});startFuneral(s,bodies(1));s.funeral.stage='farewell';s.funeral.timer=2;const before=JSON.stringify(s),view=funeralView(s),points=view.participants;assert.equal(points.length,40);assert.equal(new Set(points.map(p=>`${p.x},${p.y}`)).size,40);for(const p of points){assert.ok(isDryPoint(s,p.x,p.y));assert.ok(!s.buildings.some(b=>{if(['field','garden','bridge'].includes(b.type))return false;const size=footprintSize(b);return Math.abs(p.x-b.x-(size-1)/2)<size/2+.08&&Math.abs(p.y-b.y-(size-1)/2)<size/2+.08;}),`mourner ${p.id} clears every building`);}assert.equal(JSON.stringify(s),before);});


test('a new rite carries biers beyond edge-of-town buildings on the same dry bank',async()=>{
 const {signedRiverDistance,isDryPoint}=await import('../world.js');
 for(const seed of [0,137]){
  const s=createGame({start:'established',seed}),gather=s.buildings.find(b=>b.type==='shrine')||s.buildings[0];
  for(let y=2;y<=14;y+=2)if(isDryPoint(s,2,y))s.buildings.push({type:'house',x:2,y,level:1});
  assert.ok(startFuneral(s,bodies(1)));
  const {boundary:p,procession}=s.funeral,view=funeralView(s);
  assert.ok(isDryPoint(s,p.x,p.y));
  assert.equal(Math.sign(signedRiverDistance(p.x,p.y,s)),Math.sign(signedRiverDistance(gather.x,gather.y,s)));
  assert.deepEqual(procession.at(-1),p);
  assert.ok(s.buildings.every(b=>Math.hypot(b.x-p.x,b.y-p.y)>=5));
  assert.equal(view.biers[0].laid,false);
 }
});

test('only four free adult bearers retrieve the dead, while neighbours wait outside on repeat trips',()=>{
 const s=createGame({start:'established'}),load=s.citizens[0];
 load.cargo={clay:2};load.phase='toStore';
 const ids=s.citizens.map(c=>c.id),stock=JSON.stringify(s.resources);
 startFuneral(s,bodies(2),{sequentialRite:true});const f=s.funeral;
 const throughTemple=a=>a.route.some(p=>Math.abs(p.x-f.gather.x)<.46&&Math.abs(p.y-f.gather.y)<.46);
 const team=f.actors.filter(throughTemple).map(a=>a.id);
 assert.equal(team.length,4);
 assert.ok(!team.includes(load.id));
 assert.ok(team.every(id=>s.citizens.find(c=>c.id===id).age>=16));
 const others=f.actors.filter(a=>!team.includes(a.id));
 assert.ok(others.length);
 assert.ok(others.every(a=>a.route.length&& !throughTemple(a)));
 let repeats=0,joined=false;
 for(let step=0;s.funeral&&step<2000;step++){
  if(f.stage==='procession'&&!f.batch){
   const view=funeralView(s);
   assert.deepEqual(view.biers.flatMap(b=>b.carriers.map(c=>c.id)),team);
   joined||=view.participants.some(p=>p.role==='mourner'&&p.walking);
  }
  if(f.stage==='collecting'&&f.timer===0){
   repeats++;
   assert.deepEqual(f.actors.filter(throughTemple).map(a=>a.id),team);
   assert.ok(others.every(a=>a.route.length===0));
   assert.equal(encode(decode(encode(s))),encode(s));
  }
  advanceFuneral(s,.2);
 }
 assert.equal(s.funeral,null);assert.equal(repeats,1);assert.ok(joined);
 assert.deepEqual(s.citizens.map(c=>c.id),ids);assert.deepEqual(load.cargo,{clay:2});assert.equal(JSON.stringify(s.resources),stock);
});

test('new funerals move independent crews together and resume each moving bier from a save',()=>{
 const s=createGame({start:'established'}),busy=s.citizens[0];
 busy.cargo={clay:2};busy.phase='toStore';
 assert.ok(startFuneral(s,bodies(4)));
 const stages=new Set();
 for(let step=0;step<2000&&s.funeral.stage!=='procession';step++)advanceFuneral(s,.2);
 const before=funeralView(s).biers;
 assert.ok(before.every(b=>b.carriers.length>0));
 const carriers=before.flatMap(b=>b.carriers.map(c=>c.id));
 assert.equal(new Set(carriers).size,carriers.length);
 assert.ok(!carriers.includes(busy.id));
 advanceFuneral(s,2);
 assert.ok(funeralView(s).biers.every((b,i)=>Math.hypot(b.x-before[i].x,b.y-before[i].y)>0));
 const saved=encode(s),loaded=decode(saved);
 assert.ok(loaded);
 assert.equal(encode(loaded),saved);
 assert.deepEqual(funeralView(loaded),funeralView(s));
 for(let step=0;step<2000&&s.funeral;step++){
  stages.add(s.funeral.stage);
  if(s.funeral.stage==='procession'){
   const biers=funeralView(s).biers;
   for(const [i,bier] of biers.entries())for(const other of biers.slice(i+1)){
    assert.ok(Math.hypot(bier.x-other.x,bier.y-other.y)>.39,'separate teams have room for the full length of their litters');
   }
  }
  advanceFuneral(s,.2);advanceFuneral(loaded,.2);
 }
 assert.equal(s.funeral,null);
 assert.equal(encode(loaded),encode(s));
 assert.ok(stages.has('procession')&&stages.has('farewell')&&stages.has('jackals'));
 assert.ok(!stages.has('collecting'));
 assert.deepEqual(busy.cargo,{clay:2});
});

test('a single reachable adult pulls a grounded bier and other bodies receive a stationary farewell',()=>{
 const s=createGame({start:'established'});s.citizens=s.citizens.slice(0,1);s.citizens[0].age=30;s.population=1;
 assert.ok(startFuneral(s,bodies(3)));
 const initial=funeralView(s).biers;
 for(let step=0;step<2000&&s.funeral.stage!=='procession';step++)advanceFuneral(s,.2);
 advanceFuneral(s,2);
 for(const [i,b] of funeralView(s).biers.entries()){
  assert.equal(b.height,.0225);
  if(!i){assert.equal(b.transport,'sledge');assert.equal(b.carriers.length,1);assert.notDeepEqual([b.x,b.y],[initial[i].x,initial[i].y]);}
  else {assert.equal(b.transport,'stationary');assert.equal(b.carriers.length,0);assert.deepEqual([b.x,b.y],[initial[i].x,initial[i].y]);}
 }
 for(let step=0;step<2000&&s.funeral.stage!=='jackals';step++)advanceFuneral(s,.2);
 assert.deepEqual(funeralView(s).jackals.map(j=>j.bundleId),[initial[0].id]);
});

test('jackals approach the foot, pull along the laid shroud and the body never returns to the bier',()=>{
 const s=createGame({start:'established'});startFuneral(s,bodies(1));
 while(s.funeral.stage!=='jackals')advanceFuneral(s,.2);
 const f=s.funeral;
 let previous,resting;
 for(const t of [0,2,3.65,4,4.25,5,6.95]){
  f.timer=2*t;const {biers:[b],jackals:[j]}=funeralView(s);
  resting??=b.yaw;assert.equal(b.yaw,resting);
  assert.equal(j.bundleId,b.id);
  const d=(b.x-j.x)*Math.sin(b.yaw)+(b.y-j.y)*Math.cos(b.yaw);
  assert.ok(d>0);
  if(previous!==undefined&&t<4)assert.ok(d<previous);
  if(t>4){assert.ok(d>previous);assert.equal(j.pulling,true);}
  previous=d;
 }
 advanceFuneral(s,.2);
 assert.equal(f.stage,'returning');assert.ok(funeralView(s).biers.every(b=>b.visible===false));
});

test('a saved version-two multi-bier procession keeps its original progress and carriers',()=>{
 const s=createGame({start:'established'});s.citizens.forEach(c=>{c.age=30;});
 startFuneral(s,bodies(3),{legacyRite:true});
 while(s.funeral.stage!=='procession')advanceFuneral(s,.2);
 advanceFuneral(s,1);
 const raw=encode(s),loaded=decode(raw);assert.ok(loaded);
 assert.equal(loaded.funeral.ritualVersion,2);assert.equal(encode(loaded),raw);
 assert.equal(funeralView(loaded).biers.filter(b=>b.carriers.length).length,3);
 for(let i=0;i<1200&&s.funeral;i++){advanceFuneral(s,.2);advanceFuneral(loaded,.2);}
 assert.equal(s.funeral,null);assert.equal(encode(loaded),encode(s));
});

test('residents stranded on the opposite bank never appear carrying a bier across the river',()=>{
 const s=createGame({start:'established'}),remote=s.citizens.slice(0,4);
 for(const c of remote){c.x=35.5;c.y=8.5;}
 startFuneral(s,bodies(1));
 assert.equal(s.funeral.bearers.length,4);
 assert.ok(s.funeral.bearers.every(id=>!remote.some(c=>c.id===id)));
 const saved=decode(encode(s));assert.deepEqual(saved.funeral.bearers,s.funeral.bearers);
 while(s.funeral.stage==='gathering')advanceFuneral(s,.1);
 assert.deepEqual(funeralView(s).biers[0].carriers.map(c=>c.id),s.funeral.bearers);
 for(const c of remote){const p=funeralView(s).participants.find(p=>p.id===c.id);assert.deepEqual([p.x,p.y],[35.5,8.5]);}
});

test('a city without reachable empty-handed adults holds a stationary farewell and resumes its deliveries',async()=>{
 const {advanceTime}=await import('../engine.js'),{killTestCitizens}=await import('../test-tools.js');
 for(const reason of ['cargo','opposite bank','only children']){
  const s=createGame({start:'established'});
  if(reason==='only children')assert.ok(killTestCitizens(s,s.citizens.filter(c=>c.age>=16).map(c=>c.id)).ok);
  for(const c of s.citizens.filter(c=>c.age>=16)){
   if(reason==='cargo'){c.cargo={clay:1};c.phase='toStore';}
   else {c.x=35.5;c.y=8.5;}
  }
  assert.ok(decode(encode(s)),reason);
  const people=JSON.stringify(s.citizens),stock=structuredClone(s.resources),now=s.simTime;
  if(reason!=='only children')startFuneral(s,bodies(2));
  assert.deepEqual(s.funeral.bearers,[]);
  const props=funeralView(s).biers;
  for(let t=0;t<5;t++){
   const view=funeralView(s);
   assert.equal(view.stage,'farewell');assert.deepEqual(view.biers,props);
   assert.ok(props.every(b=>b.transport==='stationary'&&b.carriers.length===0));
   assert.deepEqual(view.jackals,[]);
   const raw=encode(s),reloaded=decode(raw);assert.ok(reloaded);assert.equal(encode(reloaded),raw);
   advanceTime(s,1);
  }
  assert.equal(s.funeral,null);assert.equal(funeralView(s),null);
  assert.equal(JSON.stringify(s.citizens),people);assert.deepEqual(s.resources,stock);
  if(reason==='cargo'){
   const clay=s.resources.clay;advanceTime(s,4);assert.ok(s.simTime>now);
   assert.ok(s.resources.clay>clay,'the original real loads resume delivery after mourning');
  }
 }
});

test('one adult pulls grounded runners and two bear from opposite ends with both hands on the poles',()=>{
 for(const n of [1,2]){
  const s=createGame({start:'established'});
  for(const c of s.citizens.filter(c=>c.age>=16).slice(n)){c.cargo={clay:1};c.phase='toStore';}
  startFuneral(s,bodies(1));
  while(s.funeral.stage==='gathering')advanceFuneral(s,.2);
  const first=funeralView(s).biers[0];advanceFuneral(s,3);
  const b=funeralView(s).biers[0];assert.equal(b.carriers.length,n);
  assert.ok(Math.hypot(b.x-first.x,b.y-first.y)>.1);
  if(n===1){
   assert.equal(b.transport,'sledge');assert.equal(b.height,.0225);
   assert.equal(b.carriers[0].hands.right.height,.99);
  }else{
   assert.equal(b.transport,'carried');assert.ok(Math.abs(b.height-1.12)<1e-9);
   const longitudinal=c=>(c.x-b.x)*Math.sin(b.yaw)+(c.y-b.y)*Math.cos(b.yaw);
   assert.ok(longitudinal(b.carriers[0])>.17&&longitudinal(b.carriers[1])<-.17);
   for(const c of b.carriers)assert.ok(Math.abs(Math.hypot(c.hands.left.x-c.hands.right.x,c.hands.left.y-c.hands.right.y)*6-.756)<1e-7);
  }
  const raw=encode(s);assert.equal(encode(decode(raw)),raw);
  while(s.funeral.stage==='procession')advanceFuneral(s,.2);
  advanceFuneral(s,1.5);assert.equal(funeralView(s).biers[0].height,.0225);
 }
});

test('three bearers occupy three distinct holds and keep the bier balanced',()=>{
 const s=createGame({start:'established'});
 for(const c of s.citizens.filter(c=>c.age>=16).slice(3)){c.cargo={clay:1};c.phase='toStore';}
 startFuneral(s,bodies(1));
 while(s.funeral.stage==='gathering')advanceFuneral(s,.2);
 const b=funeralView(s).biers[0],crew=b.carriers;
 assert.equal(crew.length,3);
 for(const [i,c] of crew.entries())for(const other of crew.slice(i+1))assert.ok(Math.hypot(c.x-other.x,c.y-other.y)>.16);
});
