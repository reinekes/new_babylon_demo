import assert from 'node:assert/strict';
import test from 'node:test';
import {createNewCity} from '../new-game.js';
import {decode,encode,miracle} from '../engine.js';
import {advanceRevelationEvidence,recordRevelationFact} from '../revelation-evidence.js';
import {revelationAdviceView} from '../revelation-advice.js';

test('advice charges exactly 15, records a specific next step and becomes stale',()=>{
 const s=createNewCity({mode:'awakening',seed:1}),c=s.citizens.find(c=>c.age>=16),home=s.buildings.find(b=>b.type==='house');
 Object.assign(s.godhood,{stage:'recognized',witnessId:c.id,believerIds:[c.id],recognitionAt:0});
 for(const kind of ['family','building','food'])recordRevelationFact(s,kind,c,home);
 advanceRevelationEvidence(s);
 const shrine={type:'shrine',x:home.x+1,y:home.y,level:1};
 s.buildings.push(shrine);
 Object.assign(c,{calling:'priest',role:'production',workplace:`${shrine.x},${shrine.y}`,work:`${shrine.x},${shrine.y}`});
 s.resources.faith=15;
 const prestige=s.resources.prestige;
 assert.equal(miracle(s,'revelation',{branch:'rain'}).ok,false);
 assert.equal(s.resources.faith,15);
 assert.equal(miracle(s,'revelation',{branch:'sunlight'}).ok,true);
 assert.equal(s.resources.faith,0);
 assert.equal(s.resources.prestige,prestige+12);
 assert.equal(revelationAdviceView(s).person,c);
 const raw=encode(s);
 assert.equal(encode(decode(raw)),raw);
 c.workplace=null;
 assert.equal(revelationAdviceView(s).stale,true);
});

test('only an explicit prestige choice can spend faith without a recommendation',()=>{
 const s=createNewCity({mode:'awakening',seed:1}),c=s.citizens.find(c=>c.age>=16),home=s.buildings.find(b=>b.type==='house');
 Object.assign(s.godhood,{stage:'recognized',witnessId:c.id,believerIds:[c.id],recognitionAt:0});
 for(const kind of ['family','building','food'])recordRevelationFact(s,kind,c,home);
 advanceRevelationEvidence(s);
 s.resources.faith=15;
 const before=encode(s);
 assert.equal(miracle(s,'revelation').ok,false);
 assert.equal(encode(s),before);
 assert.equal(miracle(s,'revelation',{branch:'prestige'}).ok,true);
 assert.equal(s.resources.faith,0);
 assert.equal(revelationAdviceView(s),null);
});
