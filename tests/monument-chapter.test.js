import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewCity} from '../new-game.js';
import {advanceTime,build,canBuild,createGame,decode,encode,goals,resolveEvent} from '../engine.js';
import {buildingKnowledgeReason} from '../godhood.js';
import {advanceMonumentChapter,newMonumentChapter} from '../monument-chapter.js';
import {grantTestResources} from '../test-tools.js';
import {strictScenario} from '../scenario-profiles.js';

test('only new Southern Sumer cities enroll in the late monument chapter',()=>{
 for(const mode of ['awakening','mature']){
  const s=decode(encode(createNewCity({mode,seed:137})));
  assert.ok(s);
  assert.match(buildingKnowledgeReason(s,'ziggurat'),/поздн/i);
  assert.ok(goals(s).some(goal=>/48 жител/.test(goal.label)));
  assert.match(goals(s).at(-1).label,/В 10-м году.*не менее 30 жителей.*готовый зиккурат/);
 }
 const old=createGame({mode:'mature',scenario:strictScenario()});
 assert.equal(buildingKnowledgeReason(decode(encode(old)),'ziggurat'),'');
});

test('the city milestone waits for a season and an operational temple, then stays unlocked',()=>{
 const s=createNewCity({mode:'mature',seed:137});
 assert.match(canBuild(s,'ziggurat',10,10),/Поздняя глава/);
 s.population=48;
 assert.equal(advanceMonumentChapter(s),false);
 assert.deepEqual(s.monumentChapter,{version:1,cityAt:0,openedAt:null});
 assert.match(buildingKnowledgeReason(s,'ziggurat'),/смены сезона/);
 s.tick=1;
 assert.equal(advanceMonumentChapter(s),false);
 assert.match(buildingKnowledgeReason(s,'ziggurat'),/действующий храм/);
 s.buildings.push({type:'shrine',x:10,y:9,level:1,construction:{kind:'new'}});
 assert.equal(advanceMonumentChapter(s),false);
 delete s.buildings.at(-1).construction;
 assert.equal(advanceMonumentChapter(s),true);
 assert.equal(buildingKnowledgeReason(s,'ziggurat'),'');
 s.population=12;s.buildings.pop();
 assert.equal(advanceMonumentChapter(s),false);
 assert.equal(buildingKnowledgeReason(s,'ziggurat'),'');
});

test('the season simulation opens the chapter only once and persists it on save',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 s.monumentChapter=newMonumentChapter();
 // The city's earlier population milestone survived a later contraction.
 s.monumentChapter.cityAt=0;
 for(let i=0;i<100&&s.tick===0;i++){
  if(s.event)resolveEvent(s,'skip');
  advanceTime(s,.5);
 }
 assert.equal(s.tick,1);
 assert.equal(s.monumentChapter.openedAt,1);
 assert.equal(s.news.filter(n=>n.title==='Поздняя глава · Великий зиккурат').length,1);
 const saved=encode(s),loaded=decode(saved);
 assert.ok(loaded);
 assert.equal(encode(loaded),saved);
 assert.equal(buildingKnowledgeReason(loaded,'ziggurat'),'');
 loaded.monumentChapter.openedAt=0;
 assert.equal(decode(encode(loaded)),null);
});

test('existing Southern Sumer cities keep an early paid ziggurat order and its allocations',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 grantTestResources(s);
 assert.ok(build(s,'ziggurat',2,2).ok);
 const raw=encode(s),loaded=decode(raw);
 assert.ok(loaded);
 assert.equal(loaded.monumentChapter,undefined);
 assert.equal(encode(loaded),raw);
});
