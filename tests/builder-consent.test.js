import test from 'node:test';
import assert from 'node:assert/strict';
import {decode,encode} from '../engine.js';
import {createNewCity} from '../new-game.js';
import {inspirationReason,inspireCitizen} from '../management.js';

test('a hungry builder candidate declines without cost, even after reload, then accepts after recovery',()=>{
 let s=createNewCity({mode:'awakening',seed:137});
 const [first,second]=s.citizens.filter(c=>c.age>=16);
 Object.assign(s.godhood,{stage:'recognized',witnessId:first.id,believerIds:[first.id,second.id],recognitionAt:0,firstBuilderGift:true});
 s.resources.faith=5;second.hunger=35;
 const id=second.id,faith=s.resources.faith,rng=s.rngState;
 const reason=inspirationReason(s,id,'builder');
 assert.match(reason,/ед/);
 assert.deepEqual(inspireCitizen(s,id,'builder'),{ok:false,reason,message:reason});
 const raw=encode(s);s=decode(raw);assert.ok(s);assert.equal(encode(s),raw);
 assert.equal(inspirationReason(s,id,'builder'),reason);
 assert.equal(inspireCitizen(s,id,'builder').ok,false);
 assert.equal(s.resources.faith,faith);
 assert.equal(s.rngState,rng);
 s.citizens.find(c=>c.id===id).hunger=0;
 assert.equal(inspireCitizen(s,id,'builder').success,true);
 assert.equal(s.citizens.find(c=>c.id===id).calling,'builder');
 assert.equal(s.resources.faith,faith-1);
 assert.equal(s.rngState,rng);
 assert.equal(inspireCitizen(s,id,'builder').ok,false);
});
