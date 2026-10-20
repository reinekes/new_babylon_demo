import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,encode,decode,advanceTime,canBuild,VERSION} from '../engine.js';
import {workGathering,advanceGathering,actorWorkActivity,initializeGathering,validateGathering,gatheringPathClear} from '../labor-life.js';
import {naturalAnimalsFor,animalsFor} from '../fauna.js';
import {invalidateAssignments,syncCitizens} from '../workforce.js';

function worker(s,b,p){s.buildings.push(b);const c=s.citizens.find(c=>c.age>=16);c.work=`${b.x},${b.y}`;c.phase='working';c.workElapsed=0;c.x=p.x;c.y=p.y;return c;}
function step(s,c,b,p,until,limit=1000){for(let i=0;i<limit;i++){const done=workGathering(s,c,b,.1,1,p);s.simTime+=.1;if(until(done))return done;}assert.fail('local work did not progress');}
test('hunter approaches one existing gazelle, kills that identity once, receives one completed load permission',()=>{
 const s=createGame(),a=naturalAnimalsFor(s).find(a=>a.kind==='gazelle'),b={type:'hunting',x:5,y:15,level:1},p={x:a.x-.8,y:a.y},c=worker(s,b,p),food=s.resources.food;
 assert.ok(gatheringPathClear(s,p,a));workGathering(s,c,b,.1,1,p);const job=s.gathering.jobs[0];assert.ok(job);assert.equal(job.stage,'approach');assert.equal(s.gathering.kills.length,0);assert.equal(s.resources.food,food);
 const target=job.target.id;step(s,c,b,p,()=>s.gathering.jobs[0]?.stage==='working');const before=structuredClone(s);assert.equal(actorWorkActivity(s,c).kind,'hunting');assert.deepEqual(s,before);
 const via=step(s,c,b,p,done=>!!done);assert.deepEqual(via,p);assert.equal(s.gathering.kills.length,1);assert.equal(s.gathering.kills[0].id,target);assert.equal(animalsFor(s).find(a=>a.id===target).behavior,'dead');assert.ok(!s.gathering.jobs.length);
 c.phase='toStore';advanceGathering(s);assert.equal(s.gathering.kills.length,1);assert.equal(s.resources.food,food,'renderer/work target does not credit global stock');
});
test('wood is worked at a real tree, falls once, recovers on simulation time; stone target uses a pick activity',()=>{
 for(const [type,x,y]of [['logging',6,10],['quarry',5,6]]){const s=createGame(),b={type,x,y,level:1},p={x:x-.5,y:y+.5},c=worker(s,b,p);workGathering(s,c,b,.1,1,p);assert.ok(s.gathering.features.length);const id=s.gathering.jobs[0].target.id;
 step(s,c,b,p,done=>!!done);const f=s.gathering.features.find(f=>f.id===id);assert.equal(f.health,type==='logging'?0:.8);assert.equal(s.resources.wood,20);if(type==='logging'){assert.ok(f.recoverAt>s.simTime);s.simTime=f.recoverAt;advanceGathering(s);assert.equal(f.health,1);assert.equal(f.felledAt,null);}
 }
});
test('gathering migration preserves identities and existing cargo; invalid/deceptive jobs are rejected',()=>{
 const s=createGame(),before=s.citizens.map(c=>({id:c.id,cargo:{...c.cargo},home:c.home}));const raw=JSON.parse(encode(s));raw.version=22;delete raw.gathering;
 const migrated=decode(JSON.stringify(raw));assert.ok(migrated);assert.equal(migrated.version,VERSION);assert.deepEqual(migrated.citizens.map(c=>({id:c.id,cargo:c.cargo,home:c.home})),before);assert.deepEqual(migrated.gathering,{jobs:[],features:[],kills:[]});
 migrated.gathering.jobs.push({citizen:999999,kind:'hunting',work:'5,15',target:{id:'gazelle-0',x:5,y:5},stand:{x:5,y:5},origin:{x:5,y:5},stage:'working',progress:1});assert.equal(decode(encode(migrated)),null);
});
test('real worker integration yields materials only after target work and preserves pending trips through save reload',()=>{
 const s=createGame(),b={type:'logging',x:6,y:10,level:1};assert.equal(canBuild(s,b.type,b.x,b.y,true),'');s.buildings.push(b);const c=s.citizens.find(c=>c.age>=16);c.workplace='6,10';invalidateAssignments(s);syncCitizens(s);
 let sawJob=false,sawCargo=false;for(let i=0;i<450;i++){s.event=null;advanceTime(s,.1);if(s.gathering.jobs.some(j=>j.citizen===c.id))sawJob=true;if(c.cargo.wood>0){sawCargo=true;assert.ok(s.gathering.features.some(f=>f.health===0));const restored=decode(encode(s));assert.ok(restored);assert.equal(restored.citizens.find(p=>p.id===c.id).cargo.wood,c.cargo.wood);break;}}
 assert.ok(sawJob);assert.ok(sawCargo);assert.ok(validateGathering(s));
});
test('two fishermen reserve distinct fish and dry stances; fabricated prey cannot survive loading',()=>{
 const s=createGame();let b;for(let y=3;y<14&&!b;y++)for(let x=9;x<17;x++)if(!canBuild(s,'fishing',x,y,true)){b={type:'fishing',x,y,level:1};break;}s.buildings.push(b);
 const p={x:b.x-.5,y:b.y+.5},cs=s.citizens.filter(c=>c.age>=16).slice(0,2);for(const c of cs){Object.assign(c,{work:`${b.x},${b.y}`,phase:'working',workElapsed:0,x:p.x,y:p.y});workGathering(s,c,b,.1,1,p);}
 assert.equal(s.gathering.jobs.length,2);assert.notEqual(s.gathering.jobs[0].target.id,s.gathering.jobs[1].target.id);assert.ok(Math.hypot(s.gathering.jobs[0].stand.x-s.gathering.jobs[1].stand.x,s.gathering.jobs[0].stand.y-s.gathering.jobs[1].stand.y)>.18);
 const good=encode(s);assert.ok(decode(good));const raw=JSON.parse(good);raw.gathering.jobs[0].target.id='fish:does-not-exist';assert.equal(decode(JSON.stringify(raw)),null);
 const missing=JSON.parse(encode(createGame()));delete missing.gathering;assert.equal(decode(JSON.stringify(missing)),null,'current format requires gathering state');
});
test('new construction obstructing a local work leg cancels that claim',()=>{
 const s=createGame(),b={type:'logging',x:6,y:10,level:1},p={x:5.5,y:10.5},c=worker(s,b,p);workGathering(s,c,b,.1,1,p);
 const other=s.citizens.find(p=>p.id!==c.id&&p.age>=16);Object.assign(other,{work:c.work,phase:'working',workElapsed:0,x:p.x,y:p.y});workGathering(s,other,b,.1,1,p);
 const stand=s.gathering.jobs.find(j=>j.citizen===other.id).stand;s.buildings.push({type:'house',x:Math.round(stand.x),y:Math.round(stand.y),level:1,construction:{kind:'new'}});advanceGathering(s);assert.ok(!s.gathering.jobs.some(j=>j.citizen===other.id));
});
test('mixed real extraction city survives repeated reloads with jobs, prey deaths and goods in transit',()=>{
 let s=createGame();for(const [type,x,y]of [['logging',6,10],['quarry',5,6],['hunting',5,15]])s.buildings.push({type,x,y,level:1});let fishing;for(let y=3;y<14&&!fishing;y++)for(let x=9;x<17;x++)if(!canBuild(s,'fishing',x,y,true)){fishing={type:'fishing',x,y,level:1};break;}s.buildings.push(fishing);
 const adults=s.citizens.filter(c=>c.age>=16);s.buildings.filter(b=>['logging','quarry','hunting','fishing'].includes(b.type)).forEach((b,i)=>{adults[i].workplace=`${b.x},${b.y}`;});invalidateAssignments(s);syncCitizens(s);let claims=false,killed=false,loads=false;
 for(let i=0;i<450;i++){s.event=null;advanceTime(s,.1);claims||=s.gathering.jobs.length>0;killed||=s.gathering.kills.length>0;loads||=s.citizens.some(c=>Object.values(c.cargo).some(n=>n>0));if(i%30===0){const snapshot=encode(s),restored=decode(snapshot);assert.ok(restored,`save ${i} rejected`);assert.deepEqual(restored.gathering,s.gathering);assert.deepEqual(restored.citizens.map(c=>[c.id,c.cargo]),s.citizens.map(c=>[c.id,c.cargo]));s=restored;}}
 assert.ok(claims);assert.ok(killed);assert.ok(loads);
});
