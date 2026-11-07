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
