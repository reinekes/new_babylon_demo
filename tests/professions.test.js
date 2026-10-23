import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,encode,decode,advanceTime} from '../engine.js';
import {inspireCitizen,inspirationReason,setCitizenRole,assignWorkplace} from '../management.js';
import {workRate} from '../wellbeing.js';
import {syncCitizens,invalidateAssignments} from '../workforce.js';
import {initializeArtisans} from '../artisan.js';

const professions=[['farmer','field'],['lumberjack','logging'],['clayworker','clay'],['reedcutter','reed'],['quarrier','quarry'],['potter','pottery'],['brewer','brewery'],['weaver','weaver'],['shepherd','sheepfold'],['fisher','fishing'],['hunter','hunting'],['brickmaker','brickyard'],['kilnworker','kiln'],['gardener','garden'],['priest','shrine']];
for(const [profession,type] of professions)test(`${profession} inspiration retains the production role and improves only its actual task`,()=>{
 const s=createGame({start:'established'}),c=s.citizens.find(c=>c.age>=16);s.rngState=1;
 assert.equal(inspireCitizen(s,c.id,profession).success,true);
 assert.equal(c.calling,profession);assert.equal(c.role,'production');
 Object.assign(c,{health:100,mood:75,hunger:0});
 assert.equal(workRate(c,type),1.2);assert.equal(workRate(c,'builder'),1);
 assert.equal(workRate(c,type==='pottery'?'brewery':'pottery'),1);
 const faith=s.resources.faith;assert.ok(inspirationReason(s,c.id,profession));assert.equal(inspireCitizen(s,c.id,profession).ok,false);assert.equal(s.resources.faith,faith);
 assert.ok(decode(encode(s)));
});
test('a child specialization remains a future production job until sixteen and survives saving',()=>{
 const s=createGame({start:'established'}),c=s.citizens.find(c=>c.age<16);s.rngState=1;
 assert.equal(inspireCitizen(s,c.id,'potter').success,true);assert.equal(c.calling,'potter');assert.equal(c.role,'auto');assert.equal(c.futureRole,'production');
 const restored=decode(encode(s));assert.ok(restored);const child=restored.citizens.find(p=>p.id===c.id);assert.equal(child.calling,'potter');
 child.age=16;invalidateAssignments(restored);syncCitizens(restored);assert.equal(child.role,'production');assert.equal(child.futureRole,undefined);assert.equal(child.calling,'potter');
});
test('specializing a loaded carrier preserves stable identity and cargo through delivery and reload',()=>{
 const s=createGame({start:'established'}),c=s.citizens.find(c=>c.age>=16);Object.assign(c,{role:'carrier',cargo:{clay:3},phase:'toStore'});s.rngState=1;
 assert.equal(inspireCitizen(s,c.id,'weaver').success,true);assert.equal(c.pendingRole,'production');assert.equal(c.role,'carrier');assert.deepEqual(c.cargo,{clay:3});
 const restored=decode(encode(s));assert.ok(restored);assert.deepEqual(restored.citizens.find(p=>p.id===c.id).cargo,{clay:3});
 advanceTime(restored,5);assert.equal(restored.citizens.find(p=>p.id===c.id).id,c.id);assert.equal(restored.citizens.find(p=>p.id===c.id).role,'production');assert.ok(decode(encode(restored)));
});
test('matching inspiration accelerates real artisan labor but unrelated inspiration does not',()=>{
 const elapsed=calling=>{const s=createGame({start:'established'});for(const c of s.citizens)if(c.age>=16)setCitizenRole(s,c.id,'carrier');const c=s.citizens.find(c=>c.age>=16);s.buildings.push({type:'pottery',x:10,y:9,level:1});initializeArtisans(s);setCitizenRole(s,c.id,'production');assert.ok(assignWorkplace(s,c.id,'10,9').ok);Object.assign(c,{calling,health:100,mood:75,hunger:0});const b=s.buildings.at(-1);Object.assign(b.artisan,{stage:'forming',elapsed:0});Object.assign(c,{phase:'working',work:'10,9'});advanceTime(s,1);return b.artisan.elapsed;};
 assert.ok(elapsed('potter')>elapsed('brewer'));assert.equal(elapsed('brewer'),elapsed(undefined));
});
test('legacy general production calling retains its bonus and invented specializations remain invalid',()=>{
 const c={age:30,role:'production',calling:'production',mood:75,health:100,hunger:0};assert.equal(workRate(c,'pottery'),1.2);assert.equal(workRate(c,'production'),1.2);assert.equal(workRate(c,'builder'),1);
 const s=createGame({start:'established'});s.citizens[0].calling='invented-profession';assert.equal(decode(encode(s)),null);
});
