import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTime,decode,encode} from '../engine.js';
import {createNewCity} from '../new-game.js';
import {beginFirstWaterHelp,firstWaterHelpChoices} from '../godhood.js';
import {personalMemory} from '../life-analytics.js';
import {lifeAnalyticsHTML} from '../ui-life-analytics.js';

test('a child hears the first water story at dinner and keeps the source after the teller dies',async()=>{
 const {hearthEndingOffer,recordHearthEnding}=await import('../campaign.js');
 let s=createNewCity({mode:'awakening',seed:137});
 const choice=firstWaterHelpChoices(s)[0],child=s.citizens.find(c=>c.age<16&&c.home===s.citizens.find(p=>p.id===choice.helperId).home);
 assert.ok(child);
 const family=s.citizens.filter(c=>c.home===child.home&&c.age>=16);
 child.parents=family.map(c=>c.id).sort((a,b)=>a-b);
 assert.ok(beginFirstWaterHelp(s,choice.helperId,choice.recipientId).ok);
 for(const b of s.buildings.filter(b=>b.type==='house')){b.pantry=40;b.pantryDelivered=40;}
 for(let i=0;i<1400&&!personalMemory(s,child.id);i++){
  if(s.godhood.stage!=='recognized')assert.equal(personalMemory(s,child.id),null);
  advanceTime(s,.1);
 }
 const heard=personalMemory(s,child.id);
 assert.equal(heard.role,'listener');
 assert.equal(heard.tellerId,choice.helperId);
 assert.deepEqual(heard.fact,personalMemory(s,choice.helperId).fact);
 assert.match(lifeAnalyticsHTML(s,{tab:'family',selectedId:child.id}),/Услышал за семейным ужином/);
 assert.equal(hearthEndingOffer(s),null);
 assert.equal(s.campaignChapter,1);
 const raw=encode(s);s=decode(raw);assert.ok(s);assert.equal(encode(s),raw);
 const invalidChapter=structuredClone(s);
 invalidChapter.campaignChapter=6;
 assert.equal(decode(encode(invalidChapter)),null);
 const teller=s.citizens.find(c=>c.id===choice.helperId);teller.age=85;
 for(let i=0;i<200&&!s.lifeAnalytics.people.find(p=>p.id===choice.helperId).diedTick;i++){s.event=null;advanceTime(s,.5);}
 assert.ok(s.lifeAnalytics.people.find(p=>p.id===choice.helperId).diedTick);
 const restored=decode(encode(s));assert.ok(restored);
 assert.deepEqual(personalMemory(restored,child.id),heard);
 const familyCity=structuredClone(restored);
 familyCity.funeral=null;familyCity.event=null;
 const listener=familyCity.citizens.find(c=>c.id===child.id);
 const home=familyCity.buildings.find(b=>b.x+','+b.y===listener.home);
 home.water=0;
 assert.equal(hearthEndingOffer(familyCity),null);
 home.water=home.waterDelivered;
 assert.equal(hearthEndingOffer(familyCity)?.listenerId,child.id);
 assert.equal(recordHearthEnding(familyCity).ok,true);
 assert.equal(recordHearthEnding(familyCity).ok,false);
 const final=encode(familyCity);
 assert.equal(encode(decode(final)),final);
 assert.equal(familyCity.won,false);
 const forgedEnding=structuredClone(familyCity);
 forgedEnding.hearthEnding.tellerId=child.id;
 assert.equal(decode(encode(forgedEnding)),null);
 const corrupt=structuredClone(restored);
 corrupt.lifeAnalytics.people.find(p=>p.id===child.id).waterStory.tellerId=choice.recipientId;
 assert.equal(decode(encode(corrupt)),null);

 const next=restored.citizens.find(c=>c.id>child.id&&c.age<16);
 const survivingTeller=restored.citizens.find(c=>c.id===child.id);
 const coParent=restored.citizens.find(c=>c.home===survivingTeller.home&&c.id<survivingTeller.id);
 assert.ok(next&&coParent);
 survivingTeller.age=32;
 Object.assign(next,{age:8,parents:[coParent.id,survivingTeller.id],generation:3,home:survivingTeller.home,
  phase:'home',x:survivingTeller.x,y:survivingTeller.y,route:[],routeIndex:0});
 for(let i=0;i<1600&&!personalMemory(restored,next.id);i++){restored.event=null;advanceTime(restored,.1);}
 const secondHand=personalMemory(restored,next.id);
 assert.equal(secondHand.tellerId,child.id);
 assert.deepEqual(secondHand.fact,heard.fact);
 assert.ok(secondHand.heardAt>heard.heardAt);
 const after=decode(encode(restored));assert.ok(after);
 assert.deepEqual(personalMemory(after,next.id),secondHand);
});

test('campaign chapters require causal milestones in order and survive loss of a live witness',async()=>{
 const {advanceCampaignChapter,campaignChapterView}=await import('../campaign.js');
 const s=createNewCity({mode:'awakening',seed:137});
 const witness=s.citizens[0];
 assert.equal(campaignChapterView(s).rank,0);
 assert.equal(advanceCampaignChapter(s),false);
 Object.assign(s.godhood,{stage:'recognized',recognitionAt:0,witnessId:witness.id,believerIds:[witness.id]});
 assert.ok(advanceCampaignChapter(s));
 assert.equal(campaignChapterView(s).rank,1);
 const first={home:'1,1',homeId:1,time:0};
 s.causalFacts={waterWitnesses:[first,{...first,time:1}]};
 assert.equal(advanceCampaignChapter(s),false);
 s.causalFacts.waterWitnesses.push({home:'2,2',homeId:2,time:2});
 assert.ok(advanceCampaignChapter(s));
 assert.equal(campaignChapterView(s).rank,2);
 s.causalFacts.water=[first];
 assert.equal(advanceCampaignChapter(s),false);
 s.arrivalHospitality.shelters=[{origin:'1,1',host:'2,2',at:3}];
 assert.ok(advanceCampaignChapter(s));
 assert.equal(campaignChapterView(s).rank,3);
 s.supplyVows={history:[{outcome:'fulfilled'}]};
 s.lifeAnalytics.people[0].waterStory={time:2};
 assert.ok(advanceCampaignChapter(s));
 assert.equal(campaignChapterView(s).rank,4);
 s.votiveOfferings=[{visitorKind:'pilgrim',receivedTick:0}];
 assert.equal(advanceCampaignChapter(s),false);
 s.votiveOfferings[0].memory={keeperId:witness.id};
 assert.ok(advanceCampaignChapter(s));
 assert.equal(campaignChapterView(s).rank,5);
 delete s.causalFacts;
 s.godhood.stage='unseen';
 assert.equal(advanceCampaignChapter(s),false);
 assert.equal(campaignChapterView(s).rank,5);
});
