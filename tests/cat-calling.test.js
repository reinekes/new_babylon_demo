import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,encode,decode} from '../engine.js';
import {strictScenario,CAT_DISCOVERY_RULES} from '../scenario-profiles.js';
import {inspirationReason,inspirationSuccessChance,inspireCitizen} from '../management.js';

function prepared(){
 const s=createGame({mode:'awakening',scenario:{...strictScenario(),miracles:CAT_DISCOVERY_RULES}});
 const c=s.citizens.find(c=>c.age>=16);
 s.godhood.stage='recognized';s.godhood.believerIds=[s.citizens.find(v=>v.id!==c.id).id];s.godhood.witnessId=s.godhood.believerIds[0];s.godhood.recognitionAt=0;
 s.catFishing.lessons[c.id]=3;s.catFishing.candidateId=c.id;s.catFishing.completed=3;s.resources.faith=1;
 return {s,c};
}
test('three accepted own catches let the first prepared fisher accept calling for exactly one faith',()=>{
 const {s,c}=prepared();assert.equal(inspirationReason(s,c.id,'fisher'),'');assert.equal(inspirationSuccessChance(s,c,'fisher'),1);
 const result=inspireCitizen(s,c.id,'fisher');assert.equal(result.success,true);assert.equal(s.resources.faith,0);assert.equal(c.calling,'fisher');assert.ok(s.godhood.believerIds.includes(c.id));
 assert.equal(s.catDiscovery.firstCallingId,c.id);assert.ok(inspirationReason(s,c.id,'fisher'));assert.equal(s.pests.cats.length,0);
 const loaded=decode(encode(s));assert.ok(loaded);assert.equal(loaded.catDiscovery.firstCallingId,c.id);
});
test('untrained children, unrecognized presence and classic cities do not gain the fisher guarantee',()=>{
 for(const change of [(s,c)=>s.catFishing.lessons[c.id]=2,(s,c)=>c.age=12,(s)=>s.godhood.stage='unseen',(s)=>s.scenario.miracles='classic-v1']){
  const {s,c}=prepared();change(s,c);assert.notEqual(inspirationSuccessChance(s,c,'fisher'),1);assert.ok(inspirationReason(s,c.id,'fisher'));
 }
});
test('a living first fisher consumes the guarantee across career changes; another prepared fisher can replace the deceased',()=>{
 const {s,c}=prepared();assert.equal(inspireCitizen(s,c.id,'fisher').success,true);
 const other=s.citizens.find(v=>v.id!==c.id&&v.age>=16);s.catFishing.lessons[other.id]=3;
 assert.notEqual(inspirationSuccessChance(s,other,'fisher'),1);c.calling='farmer';assert.notEqual(inspirationSuccessChance(s,c,'fisher'),1);
 s.citizens=s.citizens.filter(v=>v.id!==c.id);assert.equal(inspirationSuccessChance(s,other,'fisher'),1);
});
test('malformed discovery state cannot enter a saved C01 city',()=>{
 const {s}=prepared();for(const q of [undefined,{version:1,firstCallingId:-1},{version:1,firstCallingId:s.demography.nextId},{version:1,firstCallingId:null,extra:true}]){
  const bad=JSON.parse(encode(s));bad.catDiscovery=q;assert.equal(decode(JSON.stringify(bad)),null);
 }
});
