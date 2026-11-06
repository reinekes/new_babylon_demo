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
