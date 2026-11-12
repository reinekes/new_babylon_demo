import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewCity} from '../new-game.js';
import {advanceTime,decode,encode} from '../engine.js';
import {inspireCitizen,inspirationSuccessChance,setCitizenRole} from '../management.js';
import {innateProfession,inspirationCost} from '../professions.js';

test('every paid inspiration doubles the city price and survives save loading',()=>{
 const s=createNewCity({mode:'mature',seed:137});
 s.resources.faith=100;
 let refused=0;
 const [a,b,c]=s.citizens;
 for(const [person,price] of [[a,1],[b,2],[c,4]]){
  assert.equal(inspirationCost(s),price);
  const before=s.resources.faith,result=inspireCitizen(s,person.id,'musician');
  assert.equal(result.ok,true);
  if(!result.success)refused++;
  assert.equal(s.resources.faith,before-price);
 }
 assert.ok(refused>0);
 assert.equal(inspirationCost(decode(encode(s))),8);
});

test('innate profession strongly improves the matching chance and a self-chosen career resists a change',()=>{
 const s=createNewCity({mode:'mature',seed:137}),c=s.citizens[0],innate=innateProfession(s,c),different=innate==='musician'?'clayworker':'musician';
 assert.equal(innateProfession(decode(encode(s)),c),innate);
 assert.ok(inspirationSuccessChance(s,c,innate)>=.8);
 const baseline=inspirationSuccessChance(s,c,different);
 c.calling=innate;c.selfCalling=true;
 assert.ok(inspirationSuccessChance(s,c,different)<baseline);
 assert.equal(setCitizenRole(s,c.id,'carrier').ok,false);
});

test('adults take suitable permanent jobs without spending faith or changing identities',()=>{
 const s=createNewCity({mode:'mature',seed:137}),ids=s.citizens.map(c=>c.id);
 s.buildings.push({type:'pottery',x:7,y:9,level:1});
 for(let i=0;i<1300&&!s.citizens.some(c=>c.selfCalling&&c.workplace);i++){if(s.event)s.event=null;advanceTime(s,.5);}
 assert.ok(s.citizens.some(c=>c.selfCalling&&c.workplace));
 assert.deepEqual(s.citizens.slice(0,ids.length).map(c=>c.id),ids);
 assert.equal(s.divinity.inspirationAttempts,0);
 const saved=encode(s),loaded=decode(saved);assert.ok(loaded);assert.equal(encode(loaded),saved);
});

test('the resident register submits the innate profession shown with the current city price',async()=>{
 const {JSDOM}=await import('jsdom'),{renderCityTools}=await import('../ui-city-tools.js');
 const s=createNewCity({mode:'mature',seed:137}),c=s.citizens[0];
 const {window}=new JSDOM('<main></main>'),root=window.document.querySelector('main');
 let submitted;
 renderCityTools(root,s,{tab:'citizens',residentView:{id:c.id},onInspire:(id,profession)=>{submitted=[id,profession];}});
 root.querySelector(`[data-city-inspect="${c.id}"]`)?.click();
 const button=root.querySelector(`[data-city-inspire="${c.id}"]`);
 assert.ok(button);
 assert.match(button.textContent,/1 вера/);
 button.click();
 assert.deepEqual(submitted,[c.id,innateProfession(s,c)]);
});
