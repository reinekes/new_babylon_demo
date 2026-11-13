import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTime,build,canBuild,canUpgrade,createGame,decode,encode} from '../engine.js';
import {buildingKey,housingOf} from '../definitions.js';
import {strictScenario} from '../scenario-profiles.js';
import {invalidateAssignments,syncCitizens} from '../workforce.js';

function matureCity(scenario=strictScenario()){
 const s=createGame({start:'established',scenario});
 for(let x=2;x<=9;x++)s.buildings.push({type:'house',x,y:4,level:1});
 s.capacity=housingOf(s);s.population=48;
 invalidateAssignments(s);syncCitizens(s);
 s.resources.brick=40;s.resources.wood=40;
 return s;
}

test('a small Southern Sumer city can order walls with the required materials',()=>{
 const s=createGame({start:'established',scenario:strictScenario()});
 s.resources.brick=8;
 assert.equal(canBuild(s,'cityWall',3,7),'');
 const legacy=matureCity(createGame().scenario);
 assert.match(canBuild(legacy,'cityWall',3,7),/Южном Шумере/);
 assert.ok(decode(encode(legacy)));
});

test('villagers deliver materials, build an oriented gate, and keep old resident identities across loading',()=>{
 let s=matureCity();
 const ids=s.citizens.map(c=>c.id);
 const result=build(s,'cityGate',3,7,1);
 assert.ok(result.ok,result.reason);
 const key='3,7',gate=()=>s.buildings.find(b=>buildingKey(b)===key);
 assert.equal(gate().footprint,2);
 const raw=encode(s);s=decode(raw);assert.ok(s);assert.equal(encode(s),raw);
 for(let i=0;i<200&&gate().construction;i++){s.event=null;advanceTime(s,.5);}
 assert.equal(gate().construction,undefined);
 assert.equal(gate().rotation,1);
 assert.match(canUpgrade(s,gate()),/один уровень/);
 assert.ok(ids.every(id=>s.citizens.some(c=>c.id===id)));
 assert.ok(decode(encode(s)));
 delete gate().footprint;
 assert.equal(decode(encode(s)),null);
});

test('a porter approaching a newly closed wall keeps their load and position on the original side',()=>{
 const s=matureCity(),c=s.citizens.find(c=>c.age>=16),store=s.buildings.find(b=>b.type==='shrine');
 Object.assign(c,{x:2.4,y:7,phase:'toStore',store:buildingKey(store),cargo:{wood:3},route:[{x:2.4,y:7},{x:3.5,y:7}],routeIndex:1});
 const result=build(s,'cityWall',3,7);
 assert.ok(result.ok,result.reason);
 const porter=()=>s.citizens.find(p=>p.id===c.id);
 advanceTime(s,.1);
 assert.equal(porter().x,2.4);
 assert.equal(porter().cargo.wood,3);
 assert.ok(decode(encode(s)));
});

test('an inspired builder I can place and lead every ordinary building in Southern Sumer',async()=>{
 const {buildingKnowledgeReason,canLeadConstruction}=await import('../godhood.js');
 const {BUILDINGS}=await import('../definitions.js');
 const s=createGame({start:'established',mode:'awakening',scenario:strictScenario()});
 const builder=s.citizens.find(c=>c.age>=16);
 s.godhood.stage='recognized';s.godhood.believerIds=[builder.id];
 Object.assign(builder,{role:'builder',calling:'builder',builderSkill:{level:1,projects:0}});
 for(const type of Object.keys(BUILDINGS).filter(type=>!['ziggurat','ishtarGate','watchHouse'].includes(type))){
  assert.equal(buildingKnowledgeReason(s,type),'',type);
  assert.ok(canLeadConstruction(s,builder,{type,level:1,construction:{kind:'new'}}),type);
 }
 for(const type of ['cityWall','cityGate','joineryYard']){
  const game=structuredClone(s);
  game.resources.brick=40;
  const result=build(game,type,3,7);
  assert.ok(result.ok,type+': '+result.reason);
 }
 assert.match(buildingKnowledgeReason(s,'joineryYard',2),/II/);
 assert.ok(buildingKnowledgeReason(s,'ziggurat'));
 assert.ok(buildingKnowledgeReason(s,'ishtarGate'));
});
