import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,encode,decode,advanceTime} from '../engine.js';
import {strictScenario} from '../scenario-profiles.js';
import {recordLifeDeath,familyMemorialsAt,syncLifeAnalytics} from '../life-analytics.js';
import {buildingKey} from '../definitions.js';

test('a recorded death anchors a named memorial to the actual home across save and rebuild',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const c=s.citizens[0],home=s.buildings.find(b=>buildingKey(b)===c.home);
 c.age=85;c.builderSkill={level:2,projects:2};
 advanceTime(s,45,{calendarRate:1});
 const record=s.lifeAnalytics.people.find(p=>p.id===c.id);
 assert.equal(record.cause,'oldAge');
 assert.deepEqual(record.memorial.skills,[{kind:'builder',level:2}]);
 assert.equal(familyMemorialsAt(s,home)[0].id,c.id);
 assert.equal(familyMemorialsAt(s,home)[0].name,record.name);
 const raw=encode(s),loaded=decode(raw);
 assert.ok(loaded);
 assert.equal(encode(loaded),raw);
 const house=loaded.buildings.find(b=>buildingKey(b)===c.home);
 assert.equal(familyMemorialsAt(loaded,house).length,1);
 assert.equal(familyMemorialsAt(loaded,{...house,built:{year:1,season:0,elapsed:1,order:10}}).length,0);
});

test('an unknown disappearance and a legacy death never invent a home memorial',()=>{
 for(const scenario of [undefined,strictScenario()]){
  const s=createGame({start:'established',mode:'mature',scenario});
  const c=s.citizens[0],home=s.buildings.find(b=>buildingKey(b)===c.home);
  if(!scenario)recordLifeDeath(s,c,'oldAge');
  s.citizens=s.citizens.filter(p=>p!==c);s.population--;
  syncLifeAnalytics(s);
  assert.deepEqual(familyMemorialsAt(s,home),[]);
 }
});

test('a relative carries the memorial to the new home without changing the biography',async()=>{
 const {advanceGenerations}=await import('../demography.js');
 const {networkFor,syncCitizens}=await import('../workforce.js');
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const deceased=s.citizens[0],carrier=s.citizens.find(c=>c.id===deceased.partner);
 const origin=s.buildings.find(b=>buildingKey(b)===deceased.home);
 deceased.age=85;advanceTime(s,45,{calendarRate:1});
 s.funeral=null;
 assert.equal(carrier.home,buildingKey(origin));
 const destination={type:'house',x:6,y:8,level:1,built:{year:1,season:1,elapsed:0,order:5}};
 s.buildings.push(destination);s.capacity+=8;
 const partner=s.citizens.find(c=>c.id===2),previous=s.citizens.find(c=>c.id===partner.partner);
 previous.partner=null;partner.partner=carrier.id;carrier.partner=partner.id;
 const port=networkFor(s).ports.find(p=>p.building===origin);
 Object.assign(carrier,{phase:'home',x:port.x,y:port.y});
 advanceGenerations(s);
 assert.equal(carrier.home,buildingKey(destination));
 assert.equal(carrier.memorialMove.id,deceased.id);
 syncCitizens(s);
 assert.equal(familyMemorialsAt(s,destination).length,0);
 assert.equal(familyMemorialsAt(s,origin).length,1);
 const raw=encode(s),restored=decode(raw);
 assert.ok(restored);
 assert.equal(encode(restored),raw);
 for(let i=0;i<300&&restored.citizens.find(c=>c.id===carrier.id).memorialMove;i++)advanceTime(restored,.1,{calendarRate:1});
 const record=restored.lifeAnalytics.people.find(p=>p.id===deceased.id);
 assert.equal(record.home,buildingKey(origin));
 assert.equal(record.memorial.home,buildingKey(destination));
 assert.equal(familyMemorialsAt(restored,origin).length,0);
 assert.equal(familyMemorialsAt(restored,destination).length,1);
});
