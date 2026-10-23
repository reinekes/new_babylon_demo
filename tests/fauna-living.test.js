import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,miracle} from '../engine.js';
import {animalsFor,naturalAnimalsFor} from '../fauna.js';
import {pestActors,catPettingPairs,advancePests} from '../pests.js';
import {terrain,isDryPoint} from '../world.js';

test('natural wildlife is denser and fish swim only in the saved river/lakes without mutating city',()=>{
 const s=createGame({start:'established'}),before=structuredClone(s),first=naturalAnimalsFor(s);
 for(const [kind,min]of [['goat',7],['gazelle',12],['bird',12],['jackal',4]])assert.ok(first.filter(a=>a.kind===kind).length>=min,kind);
 assert.ok(first.filter(a=>a.kind==='fish').length>=36);assert.deepEqual(naturalAnimalsFor(structuredClone(s)),first);
 const positions=new Set();for(let t=0;t<90;t+=.5){s.simTime=t;for(const fish of naturalAnimalsFor(s).filter(a=>a.kind==='fish')){assert.equal(terrain(Math.round(fish.x),Math.round(fish.y),s),'water',fish.id);assert.equal(fish.waterLevel,-.18);positions.add(`${fish.id}:${fish.x.toFixed(2)},${fish.y.toFixed(2)}`);}}
 assert.ok(positions.size>500);s.simTime=before.simTime;assert.deepEqual(s,before);
});

test('hunting pins working prey, shows corpse briefly, suppresses killed identity and respects respawn',()=>{
 const s=createGame({start:'established'}),prey=naturalAnimalsFor(s).find(a=>a.kind==='gazelle');s.gathering={jobs:[{citizen:1,kind:'hunting',stage:'working',target:{id:prey.id,kind:prey.kind,x:prey.x,y:prey.y}}],kills:[]};s.simTime+=2;
 const pinned=animalsFor(s).find(a=>a.id===prey.id);assert.equal(pinned.x,prey.x);assert.equal(pinned.y,prey.y);
 s.gathering.jobs=[];s.gathering.kills.push({...prey,time:s.simTime,respawnAt:s.simTime+60});s.simTime+=1;
 const dead=animalsFor(s).find(a=>a.id===prey.id);assert.equal(dead.behavior,'dead');assert.equal(dead.deathProgress,1);assert.equal(dead.x,prey.x);
 s.simTime+=8;assert.ok(!animalsFor(s).some(a=>a.id===prey.id));assert.ok(naturalAnimalsFor(s).some(a=>a.id===prey.id));s.simTime+=60;assert.ok(animalsFor(s).some(a=>a.id===prey.id));
});

test('gift cats wander streets safely when mice absent; petting uses only available nearby citizens',()=>{
 const s=createGame({start:'established'});miracle(s,'cat');s.pests.sites[0].mice=0;const before=structuredClone(s),positions=new Set();
 for(let t=0;t<80;t+=.5){s.simTime=t;const cat=pestActors(s).find(a=>a.kind==='cat');positions.add(`${cat.x.toFixed(2)},${cat.y.toFixed(2)}`);assert.ok(isDryPoint(s,cat.x,cat.y));assert.ok(!s.buildings.some(b=>Math.abs(b.x-cat.x)<.48&&Math.abs(b.y-cat.y)<.48));}
 assert.ok(positions.size>40);s.simTime=0;const cat=pestActors(s).find(a=>a.kind==='cat'),child={id:999,age:8,phase:'home',x:cat.x,y:cat.y,cargo:{}};
 let pair;for(let t=0;t<80;t+=.1){s.simTime=t;const current=pestActors(s).find(a=>a.kind==='cat');child.x=current.x;child.y=current.y;pair=catPettingPairs(s,[child])[0];if(pair)break;}assert.ok(pair);assert.equal(pair.catId,cat.id);assert.equal(pair.citizenId,999);
 assert.equal(catPettingPairs(s,[{...child,phase:'toStore',cargo:{food:1}}]).length,0);assert.equal(catPettingPairs(s,[{...child,age:30}]).length,0);
 s.pests.sites[0].mice=1;assert.equal(catPettingPairs(s,[child]).length,0,'hunting takes priority');s.pests.sites[0].mice=0;s.simTime=before.simTime;assert.deepEqual(s,before);
 const bare=createGame({start:'established'});assert.equal(bare.pests.cats.length,0);bare.pests.totalLoss=4;advancePests(bare,0);assert.equal(bare.pests.cats.length,1,'first cat arrives as the existing unexpected divine gift');assert.ok(bare.news.some(n=>n.title==='Неожиданный гость'));
});
