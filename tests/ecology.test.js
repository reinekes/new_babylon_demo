import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,encode,decode,advanceTime,canBuild} from '../engine.js';import {initializeEcology,advanceEcology,ECOLOGY_SPECIES,validateEcology} from '../ecology.js';import {workGathering,validateGathering} from '../labor-life.js';
test('default ecology starts paired and births use simulation time and independent deadlines',()=>{
 const s=createGame();for(const [i,k]of ECOLOGY_SPECIES.entries()){assert.equal(s.ecology.populations[k].count,2);assert.equal(s.ecology.populations[k].nextBirth,240+i*17);}const before=structuredClone(s.ecology);advanceTime(s,0);advanceTime(s,-1);assert.deepEqual(s.ecology,before);
 s.simTime=239.99;advanceEcology(s);assert.equal(s.ecology.populations.goat.count,2);s.simTime=240;advanceEcology(s);assert.equal(s.ecology.populations.goat.count,3);assert.equal(s.ecology.populations.gazelle.count,2);s.simTime=257;advanceEcology(s);assert.equal(s.ecology.populations.gazelle.count,3);
});
test('population growth is bounded and legacy hunting identities retain their previous count',()=>{
 const s={simTime:0};initializeEcology(s);s.simTime=100000;advanceEcology(s);assert.ok(Object.values(s.ecology.populations).every(p=>p.count===6));assert.ok(validateEcology(s));const old={simTime:0};initializeEcology(old,{legacy:true});assert.equal(old.ecology.populations.goat.count,7);assert.equal(old.ecology.populations.gazelle.count,12);old.simTime=100000;advanceEcology(old);assert.equal(old.ecology.populations.goat.count,7);assert.equal(old.ecology.populations.gazelle.count,12);
});
test('birth deadlines survive a real current save and malformed ecology is rejected',()=>{
 const s=createGame();s.ecology.populations.goat={count:4,nextBirth:812.5};const restored=decode(encode(s));assert.ok(restored);assert.deepEqual(restored.ecology,s.ecology);
 for(const mutate of [s=>s.ecology.version=2,s=>delete s.ecology.populations.goat,s=>s.ecology.populations.goat.count=1,s=>s.ecology.populations.goat.count=13,s=>s.ecology.populations.goat.nextBirth=-1]){const s=createGame();mutate(s);assert.equal(decode(encode(s)),null);}
});
test('version 26 fishing claims remain valid after ecology migration and a second reload',()=>{
 const s=createGame({start:'established'});delete s.ecology;s.version=26;let b;for(let y=3;y<14&&!b;y++)for(let x=9;x<17;x++)if(!canBuild(s,'fishing',x,y,true)){b={type:'fishing',x,y,level:1};break;}s.buildings.push(b);const p={x:b.x-.5,y:b.y+.5},c=s.citizens.find(c=>c.age>=16);Object.assign(c,{work:`${b.x},${b.y}`,phase:'working',workElapsed:0,x:p.x,y:p.y});workGathering(s,c,b,.1,1,p);assert.ok(s.gathering.jobs.length);assert.ok(validateGathering(s));
 const restored=decode(encode(s));assert.ok(restored);assert.ok(validateGathering(restored),'a previously claimed fish identity must remain available');assert.ok(decode(encode(restored)),'the migrated game must remain loadable on the following save');
});
test('migration retains every legacy river/lake fish and gazelle identity including an existing prey death',async()=>{
 const {naturalAnimalsFor,animalsFor}=await import('../fauna.js');const s=createGame({start:'established'});delete s.ecology;s.version=26;const natural=naturalAnimalsFor(s),prey=natural.find(a=>a.id==='gazelle-11');assert.ok(prey);s.gathering.kills.push({id:prey.id,kind:'gazelle',x:prey.x,y:prey.y,time:s.simTime,respawnAt:s.simTime+180});const ids=natural.filter(a=>['fish','gazelle','goat','jackal'].includes(a.kind)).map(a=>a.id).sort();
 const restored=decode(encode(s));assert.ok(restored);assert.deepEqual(naturalAnimalsFor(restored).filter(a=>['fish','gazelle','goat','jackal'].includes(a.kind)).map(a=>a.id).sort(),ids);assert.deepEqual(restored.gathering.kills,s.gathering.kills);assert.equal(animalsFor(restored).find(a=>a.id===prey.id)?.dead,true);assert.ok(decode(encode(restored)));
});
