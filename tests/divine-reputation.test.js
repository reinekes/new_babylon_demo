import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDivinity,registerInspiration,registerMiracle} from '../divinity.js';
const state=()=>({name:'Безымянный дух',divinity:createDivinity()});
test('successful inspiration improves reputation, craft deeds and divine name',()=>{const s=state();registerInspiration(s,true);assert.equal(s.divinity.rating,3);assert.equal(s.divinity.inspirationAttempts,1);assert.equal(s.divinity.inspirationSuccesses,1);assert.equal(s.divinity.domains.craft,1);assert.equal(s.name,'Направляющий руки');assert.ok(s.divinity.names.includes(s.name));});
test('refused inspiration affects reputation but never erases earned names or makes rating negative',()=>{const s=state();registerInspiration(s,true);const names=[...s.divinity.names];registerInspiration(s,false);assert.equal(s.divinity.rating,2);assert.equal(s.divinity.inspirationAttempts,2);assert.equal(s.divinity.inspirationSuccesses,1);assert.deepEqual(s.divinity.names,names);for(let i=0;i<10;i++)registerInspiration(s,false);assert.equal(s.divinity.rating,0);});
test('inspiration and miracles share domain ranks without counting attempts as miracles',()=>{const s=state();registerMiracle(s,'craft');registerInspiration(s,true);assert.equal(s.name,'Покровитель мастеров');assert.equal(s.divinity.rating,5);assert.equal(s.divinity.domains.craft,2);assert.equal(s.divinity.inspirationAttempts,1);});

test('recognized strict Awakening uses real outcomes while repeated acts still earn reputation',async()=>{
 const {refreshResultName}=await import('../divinity.js');
 const s={...state(),name:'Услышанный у воды',scenario:{history:'sumer-iii-v1'},godhood:{mode:'awakening',stage:'recognized'}};
 s.divinity.names.push(s.name);
 for(let i=0;i<10;i++)registerMiracle(s,'water');
 registerInspiration(s,true);
 assert.equal(s.name,'Услышанный у воды');
 assert.equal(s.divinity.rating,23);
 const one={home:'1,1',homeId:1,time:1};
 s.causalFacts={waterWitnesses:[one,{...one,time:2}]};
 assert.equal(refreshResultName(s),null);
 s.causalFacts.waterWitnesses.push({home:'2,2',homeId:2,time:3});
 s.causalFacts.healing=[one,{home:'3,3',homeId:3,time:4}];
 assert.equal(refreshResultName(s),'Вернувший силы');
 assert.deepEqual(s.divinity.names,['Услышанный у воды','Напоивший дворы','Вернувший силы']);
 assert.equal(refreshResultName(s),null);
 registerMiracle(s,'craft');
 assert.equal(s.name,'Вернувший силы');
 s.name='Хранитель памяти';
 assert.equal(refreshResultName(s),null);
 assert.equal(s.name,'Хранитель памяти');
});

test('the clay shrine tablet follows earned names even after the public name changes',async()=>{
 const {RESULT_NAMES,refreshResultName}=await import('../divinity.js');
 const {cultSign}=await import('../cult-sign.js');
 const s={...state(),scenario:{history:'sumer-iii-v1'},godhood:{mode:'awakening',stage:'recognized'}};
 const shrine={type:'shrine',level:1};
 const a={home:'1,1',homeId:1,time:1},b={home:'2,2',homeId:2,time:2};
 s.causalFacts={waterWitnesses:[a,b]};
 assert.deepEqual(cultSign(s,shrine),[]);
 refreshResultName(s);
 assert.deepEqual(cultSign(s,shrine).map(mark=>mark.id),['water']);
 s.causalFacts.harvest=[a,b];refreshResultName(s);
 assert.equal(s.name,RESULT_NAMES.harvest);
 assert.deepEqual(cultSign(structuredClone(s),shrine).map(mark=>mark.id),['water','grain']);
 assert.deepEqual(cultSign(s,{...shrine,construction:{kind:'new'}}),[]);
 assert.deepEqual(cultSign({...s,scenario:undefined},shrine),[]);
});
