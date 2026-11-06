import assert from 'node:assert/strict';
import test from 'node:test';
import {createNewCity} from '../new-game.js';
import {decode,encode,upgrade} from '../engine.js';
import {applyBuilderInstruction} from '../godhood.js';
import {finishConstruction} from '../construction.js';
import {syncCitizens} from '../workforce.js';
import {advanceRevelationEvidence} from '../revelation-evidence.js';

test('two distinct pupils working with one master on the same finished project can open Revelation',()=>{
 const s=createNewCity({mode:'awakening',seed:1});
 const [mentor,first,second]=s.citizens.filter(c=>c.age>=16);
 assert.ok(second);
 Object.assign(s.godhood,{stage:'recognized',witnessId:mentor.id,recognitionAt:0,believerIds:[mentor.id,first.id,second.id]});
 for(const c of [mentor,first,second])Object.assign(c,{role:'builder',calling:'builder'});
 mentor.builderSkill={level:2,projects:2};
 const b=s.buildings.find(b=>b.type==='house');
 s.resources.brick=100;
 const result=upgrade(s,b.x,b.y);assert.ok(result.ok,result.reason);
 const q=b.construction;
 for(const key of Object.keys(q.required)){q.delivered[key]=q.required[key];q.remaining[key]=0;}
 for(const source of Object.values(q.sources))for(const key of Object.keys(source))source[key]=0;
 function work(pupil,amount){q.work+=applyBuilderInstruction(s,[{c:mentor,work:amount},{c:pupil,work:amount}],24-q.work,b);}
 work(first,1);work(first,1);
 assert.equal(q.revelationTraining.length,1);
 assert.equal(q.revelationTraining[0].pupils.length,1);
 assert.equal(s.revelationEvidence.apprenticeship,undefined);
 const raw=encode(s);
 const loaded=decode(raw);assert.ok(loaded);assert.equal(encode(loaded),raw);
 work(second,1);
 advanceRevelationEvidence(s);
 assert.equal(s.revelationEvidence.opening,undefined);
 work(second,20);
 assert.equal(finishConstruction(s),true);
 syncCitizens(s);
 assert.deepEqual(s.revelationEvidence.apprenticeship.pupils,[first.id,second.id]);
 advanceRevelationEvidence(s);
 assert.equal(s.revelationEvidence.opening.citizenId,mentor.id);
 const completed=encode(s);
 assert.equal(encode(decode(completed)),completed);
 const broken=JSON.parse(completed);broken.revelationEvidence.apprenticeship.pupils=[first.id,first.id];
 assert.equal(decode(JSON.stringify(broken)),null);
});

test('road testimony at a half-tile node survives loading older journals',async()=>{
 const {recordRevelationFact}=await import('../revelation-evidence.js');
 const s=createNewCity({mode:'awakening',seed:1});
 recordRevelationFact(s,'building',s.citizens[0],s.roads[0].a);
 const raw=encode(s);
 assert.equal(encode(decode(raw)),raw);
});
