import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,miracle,advanceTime,encode,decode} from '../engine.js';
import * as scene from '../miracle-celebration.js';
import {isDryPoint} from '../world.js';
import {advancePests,pestActors} from '../pests.js';
test('cat arrival creates sixty seconds of serializable celebration without moving citizen cargo or calendar',()=>{
 const s=createGame({start:'established'});assert.ok(miracle(s,'cat').ok);assert.equal(s.miracleCelebration?.duration,60);
 const citizens=structuredClone(s.citizens),clock=s.seasonElapsed,time=s.simTime;advanceTime(s,20);
 assert.equal(s.seasonElapsed,clock);assert.equal(s.simTime,time);assert.deepEqual(s.citizens,citizens);
 assert.equal(scene.miracleCelebrationView(s).participants.length,s.citizens.length);assert.equal(pestActors(s).filter(a=>a.kind==='cat').length,1);
 const loaded=decode(encode(s));assert.ok(loaded);assert.deepEqual(scene.miracleCelebrationView(loaded),scene.miracleCelebrationView(s));
 advanceTime(loaded,40);assert.equal(loaded.miracleCelebration,null);assert.equal(loaded.seasonElapsed,clock);advanceTime(loaded,1);assert.ok(loaded.seasonElapsed>clock);
});
test('fertility respects target and refuses overlapping miracle before costs',()=>{
 const s=createGame({start:'established'});assert.ok(scene.startMiracleCelebration(s,'fertility',{center:{x:15,y:12}}));assert.deepEqual(s.miracleCelebration.center,{x:15,y:12});const faith=s.resources.faith;assert.equal(miracle(s,'cat').ok,false);assert.equal(s.resources.faith,faith);
 const before=structuredClone(scene.miracleCelebrationView(s));scene.advanceMiracleCelebration(s,0);assert.deepEqual(scene.miracleCelebrationView(s),before);
});
test('automatic first cat starts celebration and malformed scene is rejected',()=>{
 const s=createGame({start:'established'});s.pests.totalLoss=3;advancePests(s,.1);assert.equal(s.miracleCelebration.kind,'cat');s.miracleCelebration.elapsed=-1;assert.equal(decode(encode(s)),null);
});
test('cat walks among the crowd in the middle of the celebration and all people return continuously',()=>{
 const s=createGame({start:'established'});miracle(s,'cat');scene.advanceMiracleCelebration(s,20);const first=scene.miracleCelebrationView(s);scene.advanceMiracleCelebration(s,5);const second=scene.miracleCelebrationView(s);assert.equal(first.cat.walking,true);assert.ok(Math.hypot(first.cat.x-second.cat.x,first.cat.y-second.cat.y)>0);
 scene.advanceMiracleCelebration(s,34.999);for(const actor of scene.miracleCelebrationView(s).participants){const c=s.citizens.find(c=>c.id===actor.id);assert.ok(Math.hypot(actor.x-c.x,actor.y-c.y)<.001);}
});
test('saved routes cannot teleport residents or cross water, and old saves do not gain a scene',()=>{
 const s=createGame({start:'established'});assert.equal(scene.miracleCelebrationView(decode(encode(s))),null);scene.startMiracleCelebration(s,'fertility');const q=s.miracleCelebration,a=q.participants.find(a=>a.joined);assert.ok(a);a.path[0].x+=.1;assert.equal(decode(encode(s)),null);a.path[0].x-=.1;let wet;for(let y=0;y<32&&!wet;y++)for(let x=0;x<40&&!wet;x++)if(!isDryPoint(s,x,y))wet={x,y};a.path.push(wet);assert.equal(scene.validateMiracleCelebration(s),false);
});
test('real fertility miracle preserves selected target and refuses wet target before any cost',()=>{
 const s=createGame({start:'established',mode:'mature'});s.resources.faith=1000;const target={x:6,y:5};assert.ok(miracle(s,'fertility',target).ok);assert.deepEqual(s.miracleCelebration.center,target);assert.equal(s.resources.faith,965);
 const other=createGame({start:'established'});other.resources.faith=1000;let wet;for(let y=0;y<32&&!wet;y++)for(let x=0;x<40&&!wet;x++)if(!isDryPoint(other,x,y))wet={x,y};const before=encode(other);assert.equal(miracle(other,'fertility',wet).ok,false);assert.equal(encode(other),before);
});
test('celebration refuses building, upgrade and decision changes before spending or mutation',async()=>{
 const {build,upgrade,resolveEvent}=await import('../engine.js');const s=createGame({start:'established'});miracle(s,'cat');const before=encode(s);assert.equal(build(s,'house',5,5).ok,false);assert.equal(upgrade(s,8,8).ok,false);resolveEvent(s,'accept');assert.equal(encode(s),before);
});
test('unrelated rain retains its old availability during a funeral',async()=>{
 const {startFuneral}=await import('../funerals.js');const s=createGame({start:'established'});s.resources.faith=1000;startFuneral(s,[{id:1000,name:'Покойный',x:8,y:8}]);assert.equal(miracle(s,'rain').ok,true);
});
test('large gatherings keep separated places and include over eighty reachable residents',async()=>{
 const {syncCitizens}=await import('../workforce.js');const {housingOf}=await import('../definitions.js');const {terrain}=await import('../engine.js');const s=createGame({start:'established'});for(let y=2;y<22;y+=2)for(let x=2;x<30;x+=2)if(terrain(x,y,s)!=='water'&&!s.buildings.some(b=>b.x===x&&b.y===y))s.buildings.push({type:(x+y)%4?'house':'field',x,y,level:1});s.population=200;s.capacity=housingOf(s);syncCitizens(s);const before=structuredClone(s.citizens);scene.startMiracleCelebration(s,'fertility');const places=s.miracleCelebration.participants.filter(a=>a.joined).map(a=>a.path.at(-1));assert.ok(places.length>=80);for(let i=0;i<places.length;i++)for(let j=i+1;j<places.length;j++)assert.ok(Math.hypot(places[i].x-places[j].x,places[i].y-places[j].y)>=.18-1e-7);assert.deepEqual(s.citizens,before);assert.equal(scene.validateMiracleCelebration(s),true);scene.advanceMiracleCelebration(s,20);assert.equal(scene.miracleCelebrationView(s).participants.filter(a=>a.celebrating).length,200);
});

test('test killing, demolition and relic possession cannot invalidate an active scene',async()=>{
 const {killTestCitizens}=await import('../test-tools.js'),{demolish}=await import('../management.js'),{startRelicQuest}=await import('../relic-quest.js');
 const s=createGame({start:'established'});s.resources.faith=1000;assert.ok(miracle(s,'cat').ok);const before=encode(s);
 assert.equal(killTestCitizens(s,1).ok,false);assert.equal(demolish(s,9,8).ok,false);assert.equal(startRelicQuest(s,s.citizens[0].id).ok,false);assert.equal(encode(s),before);assert.ok(decode(before));
});
