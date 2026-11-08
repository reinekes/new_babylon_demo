import test from 'node:test';
import assert from 'node:assert/strict';
import {applyBuilderInstruction,builderLevel} from '../godhood.js';

const builder=(id,projects)=>({id,age:32,role:'builder',calling:'builder',
 builderSkill:{projects,level:projects>=5?3:projects>=2?2:1}});
const city={godhood:{mode:'awakening',believerIds:[1,2]}};

test('only shared productive work trains the pupil and teaching takes construction effort',()=>{
 const mentor=builder(1,2),pupil=builder(2,1);
 assert.equal(applyBuilderInstruction(city,[{c:mentor,work:4}]),4);
 assert.equal(pupil.builderSkill.practice,undefined);
 assert.equal(applyBuilderInstruction(city,[{c:mentor,work:4},{c:pupil,work:2}]),5);
 assert.equal(pupil.builderSkill.practice,2);
 assert.equal(applyBuilderInstruction(city,[{c:mentor,work:8},{c:pupil,work:6}]),11);
 assert.equal(pupil.builderSkill.projects,1);
 assert.equal(builderLevel(pupil),2);
 assert.equal(applyBuilderInstruction(city,[{c:mentor,work:4},{c:pupil,work:2}]),6);
 assert.equal(pupil.builderSkill.practice,8);
});

test('two builders train on a real site, and changing the mentor role preserves saved practice',async()=>{
 const {createGame,build,advanceTime,encode,decode}=await import('../engine.js');
 const {setCitizenRole}=await import('../management.js');
 const {buildingKey,MATERIALS}=await import('../definitions.js');
 const {networkFor,syncCitizens}=await import('../workforce.js');
 let s=createGame({mode:'awakening'});
 const [mentor,pupil]=s.citizens.filter(c=>c.age>=16);
 Object.assign(s.godhood,{stage:'recognized',witnessId:mentor.id,believerIds:[mentor.id,pupil.id],recognitionAt:0});
 Object.assign(mentor,{role:'builder',calling:'builder',builderSkill:{level:2,projects:2}});
 Object.assign(pupil,{role:'builder',calling:'builder',builderSkill:{level:1,projects:0}});
 for(const k of MATERIALS)s.resources[k]=100;
 assert.ok(build(s,'house',2,2).ok);
 const b=s.buildings.at(-1),key=buildingKey(b),q=b.construction;
 for(const k of MATERIALS){q.delivered[k]=q.required[k];q.remaining[k]=0;}
 for(const source of Object.values(q.sources))for(const k of Object.keys(source))source[k]=0;
 syncCitizens(s);
 const port=networkFor(s).ports.find(p=>p.building===b);
 for(const c of [mentor,pupil])Object.assign(c,{site:key,sitePort:key,siteDuty:'builder',phase:'constructing',x:port.x,y:port.y,route:[],routeIndex:0});
 advanceTime(s,.5);
 const practice=pupil.builderSkill.practice;
 assert.ok(practice>0);assert.ok(q.work>practice);assert.equal(pupil.builderSkill.projects,0);
 const raw=encode(s);s=decode(raw);assert.ok(s);assert.equal(encode(s),raw);
 assert.ok(setCitizenRole(s,mentor.id,'carrier').ok);
 advanceTime(s,.5);
 assert.equal(s.citizens.find(c=>c.id===pupil.id).builderSkill.practice,practice);
 assert.ok(decode(encode(s)));
 const {recordLifeDeath}=await import('../life-analytics.js');
 const retired=s.citizens.find(c=>c.id===mentor.id);
 recordLifeDeath(s,retired,'age');
 s.citizens=s.citizens.filter(c=>c.id!==mentor.id);s.population--;s.deaths++;
 const widowed=s.citizens.find(c=>c.partner===mentor.id);
 if(widowed)widowed.partner=null;
 syncCitizens(s);
 assert.ok(decode(encode(s)));
 assert.equal(s.citizens.find(c=>c.id===pupil.id).builderSkill.practice,practice);
 const bad=structuredClone(s);
 bad.citizens.find(c=>c.id===pupil.id).builderSkill.practice=-1;
 assert.equal(decode(encode(bad)),null);
});

test('craft title counts mastery earned through shared work in two households',async()=>{
 const {createGame,encode,decode}=await import('../engine.js');
 const {strictScenario}=await import('../scenario-profiles.js');
 const {craftNameEvidence,householdNameEvidence}=await import('../causal-facts.js');
 const s=createGame({start:'established',mode:'awakening',scenario:strictScenario()});
 const mentor=s.citizens[0],first=s.citizens[1],second=s.citizens.find(c=>c.home!==first.home&&c.age>=16);
 Object.assign(s.godhood,{stage:'recognized',witnessId:mentor.id,recognitionAt:0,believerIds:[mentor.id,first.id,second.id]});
 Object.assign(mentor,{role:'builder',calling:'builder',builderSkill:{level:3,projects:5}});
 for(const pupil of [first,second])Object.assign(pupil,{role:'builder',calling:'builder',builderSkill:{level:2,projects:4,practice:7.5}});
 const site={type:'house',x:10,y:9,construction:{kind:'new'}};
 const practice=(pupil,place=site)=>applyBuilderInstruction(s,[{c:mentor,work:1},{c:pupil,work:1}],4,place);
 practice(first);
 assert.equal(builderLevel(first),3);
 assert.equal(craftNameEvidence(s),null);
 practice(first);
 assert.equal(s.causalFacts.craft.length,1);
 practice(second,{type:'road',x:10.5,y:9,construction:{kind:'new'}});
 assert.equal(builderLevel(second),3);
 const pair=craftNameEvidence(s);
 assert.deepEqual(pair?.map(row=>row.pupilId),[first.id,second.id]);
 assert.deepEqual(pair[1].site,[10.5,9]);
 const loaded=decode(encode(s));
 assert.deepEqual(craftNameEvidence(loaded),pair);
 assert.deepEqual(householdNameEvidence(loaded,[{...second,home:'2,2'}]).craft,pair[1]);
 assert.equal(householdNameEvidence(loaded,[mentor]).craft,null);
});

test('the craft forecast suggests compatible unassigned builders on connected land',async()=>{
 const {builderTeachingCandidates}=await import('../godhood.js');
 const mentor={...builder(1,5),home:'1,1'};
 const pupil={...builder(2,2),home:'2,1'};
 const equal={...builder(3,5),home:'1,1'};
 const otherBank={...builder(4,1),home:'1,8'};
 const busy={...builder(5,1),home:'1,1',site:'4,4'};
 const pending={...builder(6,1),home:'1,1',pendingRole:'farmer'};
 const unaware={...builder(7,1),home:'1,1'};
 const sick={...builder(8,1),home:'1,1',clinic:'8,8'};
 const s={godhood:{mode:'awakening',believerIds:[1,2,3,4,5,6,8]},citizens:[unaware,busy,pupil,mentor,equal,otherBank,pending,sick]};
 const network={
  ports:[{key:'a',building:{x:1,y:1}},{key:'b',building:{x:2,y:1}},{key:'c',building:{x:1,y:8}}],
  components:new Map([['a',0],['b',0],['c',1]])
 };
 const before=structuredClone(s);
 assert.deepEqual(builderTeachingCandidates(s,network),[{mentor,pupil}]);
 assert.deepEqual(s,before);
 assert.deepEqual(builderTeachingCandidates({...s,godhood:{mode:'mature'}},network),[]);
});

test('a younger pupil who reaches mastery after the name is earned can qualify for the craft ending',async()=>{
 const {createNewCity}=await import('../new-game.js');
 const {recordCraftNameEvidence}=await import('../causal-facts.js');
 const {craftEndingOffer,recordCraftEnding,validateCraftEnding}=await import('../campaign.js');
 const s=createNewCity({mode:'awakening',seed:137});
 const [mentor,first,second,pupil]=s.citizens.filter(c=>c.age>=16);
 const site={x:5,y:5,construction:{kind:'new'}};
 Object.assign(mentor,{generation:1});
 Object.assign(pupil,{generation:2,role:'builder',calling:'builder',builderSkill:{projects:5,level:3}});
 recordCraftNameEvidence(s,site,{mentor,pupil:first});
 recordCraftNameEvidence(s,site,{mentor,pupil:second});
 assert.equal(s.causalFacts.craft.length,2);
 recordCraftNameEvidence(s,site,{mentor,pupil});
 assert.equal(s.causalFacts.craft.length,2);
 assert.equal(s.causalFacts.craftSuccession[0].pupilId,pupil.id);
 s.tradeContracts=[{status:'fulfilled',visit:1,deliveryId:3,wood:12}];
 s.trade.deliveries=[{id:3,resource:'wood',amount:12,delivered:11}];
 assert.equal(craftEndingOffer(s),null);
 s.trade.deliveries[0].delivered=12;
 assert.equal(craftEndingOffer(s)?.pupilId,pupil.id);
 assert.ok(recordCraftEnding(s).ok);
 s.lifeAnalytics.people.find(c=>c.id===pupil.id).generation=2;
 assert.ok(validateCraftEnding(s));
 const siteAtEnding=s.craftEnding.site;
 s.craftEnding.site=[6,6];
 assert.equal(validateCraftEnding(s),false);
 s.craftEnding.site=siteAtEnding;
 const receipt=s.causalFacts.craftSuccession[0];
 for(let i=0;i<33;i++)recordCraftNameEvidence(s,site,{mentor,pupil:{...pupil,id:100+i}});
 assert.equal(s.causalFacts.craftSuccession.length,32);
 assert.ok(s.causalFacts.craftSuccession.includes(receipt));
 assert.ok(validateCraftEnding(s));
 assert.equal(recordCraftEnding(s).ok,false);
});
