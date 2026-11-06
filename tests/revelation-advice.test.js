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

test('wind advice needs a qualifying workshop load still in transit',async()=>{
 const {revelationAdviceQuote}=await import('../revelation-advice.js');
 const s=createNewCity({mode:'awakening',seed:1}),person=s.citizens[0],place=s.buildings[0],key=`${place.x},${place.y}`;
 Object.assign(person,{calling:'carrier',phase:'toDistrictStore',store:key,districtJob:1,windCargo:5,cargo:{reed:5}});
 s.district.jobs.push({id:1,target:key,resource:'reed'});
 assert.equal(revelationAdviceQuote(s,'haste').note?.citizenId,person.id);
 s.windDelivery={version:1,amount:60,destinations:[key,'1,1']};
 assert.equal(revelationAdviceQuote(s,'haste').ok,false);
 person.windRoute='road';
 assert.equal(revelationAdviceQuote(s,'haste').ok,true);
 person.windCargo=0;
 assert.equal(revelationAdviceQuote(s,'haste').ok,false);
});

test('fishing and farming advice requires actual local eligibility and does not change the city',async()=>{
 const {revelationAdviceQuote}=await import('../revelation-advice.js');
 const s=createNewCity({mode:'awakening',seed:1}),c=s.citizens[0];
 const fishing={type:'fishing',x:12,y:9,level:1},field={type:'field',x:13,y:9,level:1,grainFieldId:1},home=s.buildings[0];
 s.buildings.push(fishing,field);
 s.godhood.stage='recognized';
 s.catFishing={lessons:{[c.id]:3}};
 Object.assign(c,{work:'12,9',role:'production'});
 assert.equal(revelationAdviceQuote(s,'cat').note?.citizenId,c.id);
 c.calling='fisher';
 assert.equal(revelationAdviceQuote(s,'cat').ok,false);
 assert.equal(revelationAdviceQuote(s,'richCatch').note?.x,12);
 s.richCatchEvidence.fisher=c.id;
 assert.equal(revelationAdviceQuote(s,'richCatch').ok,false);
 Object.assign(c,{phase:'toStore',store:`${home.x},${home.y}`,fieldGrain:{fieldId:1,amount:3},cargo:{food:3}});
 const before=JSON.stringify(s);
 assert.equal(revelationAdviceQuote(s,'fertility').note?.x,home.x);
 assert.equal(JSON.stringify(s),before);
 s.earthDiscovery.receipts.push({fieldId:1,inspired:true});
 assert.equal(revelationAdviceQuote(s,'fertility').ok,false);
});
