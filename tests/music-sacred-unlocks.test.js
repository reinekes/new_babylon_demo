import test from 'node:test';
import assert from 'node:assert/strict';
import {BUILDINGS,MIRACLES} from '../definitions.js';
import {canStaffBuilding,PROFESSION_IDS} from '../professions.js';

const load=async path=>{const m=await import(path).catch(()=>null);assert.ok(m,`${path} must provide the new gameplay rules`);return m;};
const fixture=()=>({year:2,season:1,tick:5,simTime:0,resources:{prestige:0,faith:200},buffs:{},news:[],buildings:[{type:'musicHouse',x:10,y:8,level:1}],citizens:[{id:1,age:30,role:'production',calling:'musician',phase:'working',work:'10,8',workplace:'10,8',x:10.5,y:8.5,workElapsed:0,cargo:{},buildCargo:{},mood:75,health:100,hunger:0}]});

test('the music court needs an inspired musician, never an arbitrary automatic worker',()=>{
 assert.ok(BUILDINGS.musicHouse);assert.ok(BUILDINGS.ishtarGate);assert.ok(MIRACLES.inannaProtection);assert.ok(PROFESSION_IDS.includes('musician'));
 const b={type:'musicHouse'};
 assert.equal(canStaffBuilding({age:30,role:'auto'},b),false);
 assert.equal(canStaffBuilding({age:30,role:'production',calling:'potter'},b),false);
 assert.equal(canStaffBuilding({age:30,role:'production',calling:'musician'},b),true);
 assert.equal(canStaffBuilding({age:12,role:'production',calling:'musician'},b),false);
});
test('music sounds only at the completed court in daylight with its pinned musician present',async()=>{
 const {musicWorking,musicPlaying}=await load('../music.js'),s=fixture(),b=s.buildings[0],c=s.citizens[0];
 assert.equal(musicWorking(s,b,c),true);assert.equal(musicPlaying(s,b),true);
 for(const changes of [{calling:'potter'},{workplace:null},{phase:'toWork'},{x:16},{cargo:{clay:1}},{age:8}]){const copy=structuredClone(s);Object.assign(copy.citizens[0],changes);assert.equal(musicWorking(copy,copy.buildings[0],copy.citizens[0]),false,JSON.stringify(changes));}
 b.construction={kind:'new'};assert.equal(musicPlaying(s,b),false);delete b.construction;
 s.simTime=30;assert.equal(musicPlaying(s,b),false);s.simTime=0;
 s.funeral={actors:[{id:c.id}]};assert.equal(musicPlaying(s,b),false);
});
test('actual playing credits modest prestige and nearby mood without inventing materials or freight',async()=>{
 const {workMusic}=await load('../music.js'),s=fixture(),b=s.buildings[0],c=s.citizens[0];
 s.citizens.push({...c,id:2,work:null,workplace:null,x:10.7,y:8.5,mood:50},{...c,id:3,work:null,workplace:null,x:20,y:8.5,mood:50});
 assert.equal(workMusic(s,b,c,6),0);assert.equal(s.resources.prestige,0);assert.ok(s.citizens[1].mood>50);assert.equal(s.citizens[2].mood,50);
 const restored=JSON.parse(JSON.stringify(s));assert.equal(workMusic(restored,restored.buildings[0],restored.citizens[0],6),.12);assert.equal(restored.resources.prestige,.12);
 assert.deepEqual(restored.citizens[0].cargo,{});assert.equal(restored.buildings[0].productionHistory[0].resources.prestige,.12);
 const before=JSON.stringify(restored);restored.citizens[0].phase='home';const beforeStock=restored.resources.prestige;assert.equal(workMusic(restored,restored.buildings[0],restored.citizens[0],100),0);assert.equal(restored.resources.prestige,beforeStock);
 assert.ok(before);
});
test('music metadata is optional on old buildings, but malformed new progress is rejected',async()=>{
 const {validateMusic,workMusic}=await load('../music.js'),s=fixture(),b=s.buildings[0];assert.equal(validateMusic(s),true);workMusic(s,b,s.citizens[0],1);assert.equal(validateMusic(s),true);b.music.seconds=-1;assert.equal(validateMusic(s),false);
});
test('Ishtar protection unlocks on completion once, persists after removal and never from a construction site',async()=>{
 const {initializeSacredUnlocks,syncSacredUnlocks,miracleLockReason,validateSacredUnlocks}=await load('../sacred-unlocks.js'),s=fixture();
 initializeSacredUnlocks(s);s.buildings.push({type:'ishtarGate',x:12,y:8,level:1,construction:{kind:'new'}});
 assert.ok(miracleLockReason(s,'inannaProtection'));assert.equal(syncSacredUnlocks(s),false);
 delete s.buildings[1].construction;assert.equal(syncSacredUnlocks(s),true);assert.equal(miracleLockReason(s,'inannaProtection'),'');
 const saved=JSON.stringify(s.sacred);assert.equal(syncSacredUnlocks(s),false);assert.equal(JSON.stringify(s.sacred),saved);assert.equal(s.news.length,1);
 s.buildings.pop();assert.equal(miracleLockReason(s,'inannaProtection'),'');assert.equal(validateSacredUnlocks(s),true);
 const row=s.sacred.unlocks.inannaProtection;row.source='999999,999999';assert.equal(validateSacredUnlocks(s),false);row.source='12,8';row.year=s.year+1;assert.equal(validateSacredUnlocks(s),false);
});
test('unlocked wonders apply bounded protection; relic power still requires an actual completed quest',async()=>{
 const {applySacredMiracle,miracleLockReason}=await load('../sacred-unlocks.js'),s=fixture();assert.ok(miracleLockReason(s,'relicAwakening'));
 s.relicQuest={phase:'completed'};assert.equal(miracleLockReason(s,'relicAwakening'),'');s.rain=0;s.drought=3;applySacredMiracle(s,'relicAwakening');assert.equal(s.rain,2);assert.equal(s.drought,0);
 applySacredMiracle(s,'inannaProtection');assert.equal(s.buffs.inannaProtection,3);assert.equal(s.citizens[0].mood,89);
});
test('the wonder halves actual mouse loss without creating food or changing courier loads',async()=>{
 const {createGame}=await import('../engine.js'),{advancePests}=await import('../pests.js'),bare=createGame({start:'established'}),protectedCity=structuredClone(bare);protectedCity.buffs.inannaProtection=3;
 advancePests(bare,5);advancePests(protectedCity,5);assert.ok(bare.pests.totalLoss>0);assert.ok(Math.abs(protectedCity.pests.totalLoss*2-bare.pests.totalLoss)<1e-7);assert.deepEqual(protectedCity.citizens.map(c=>c.cargo),bare.citizens.map(c=>c.cargo));
});
test('an unpinned inspired musician is not silently allocated to the leisure court',async()=>{
 const {createGame}=await import('../engine.js'),{syncCitizens,invalidateAssignments}=await import('../workforce.js'),s=createGame({start:'established'});s.buildings=s.buildings.filter(b=>['house','shrine'].includes(b.type));s.buildings.push({type:'musicHouse',x:10,y:8,level:1});
 for(const c of s.citizens)if(c.age>=16){c.role='production';c.calling='musician';}
 invalidateAssignments(s);syncCitizens(s);assert.equal(s.citizens.some(c=>c.work==='10,8'),false);
});
test('the musical calling gets a human byname and its courtyard explains the inspiration requirement',async()=>{
 const {createGame}=await import('../engine.js'),{cityDiagnostics}=await import('../city-diagnostics.js'),{recordProfessionEpithet,displayName}=await import('../citizen-epithets.js'),s=createGame({start:'established'});s.buildings.push({type:'musicHouse',x:10,y:8,level:1});
 assert.match(cityDiagnostics(s).workshops.find(b=>b.type==='musicHouse').reason.detail,/вдохновлённый музыкант/i);
 const c=s.citizens.find(c=>c.age>=16);c.role='production';c.calling='musician';recordProfessionEpithet(s,c);assert.match(displayName(s,c),/Музыкант/);
});
test('real assignment waits for arrival and plays on site without a fake prestige delivery trip',async()=>{
 const {createGame,advanceTime,encode,decode}=await import('../engine.js'),{inspireCitizen,assignWorkplace}=await import('../management.js'),{musicPlaying}=await load('../music.js'),s=createGame({start:'established'});s.buildings=s.buildings.filter(b=>['house','shrine'].includes(b.type));s.buildings.push({type:'musicHouse',x:10,y:8,level:1});
 const c=s.citizens.find(c=>c.age>=16);s.rngState=1;assert.equal(inspireCitizen(s,c.id,'musician').success,true);assert.ok(assignWorkplace(s,c.id,'10,8').ok);const b=s.buildings.at(-1);assert.equal(musicPlaying(s,b),false);let played=false;
 for(let i=0;i<250;i++){advanceTime(s,.1);played||=musicPlaying(s,b);}
 assert.ok(played);assert.ok(b.music?.seconds>0);assert.ok(b.music?.performances>0);assert.equal(c.cargo.prestige,undefined);assert.ok(decode(encode(s)));
});
test('old saves get only new miracle defaults, preserve people and loads, and cannot cast a locked power',async()=>{
 const {createGame,encode,decode,miracle}=await import('../engine.js'),s=createGame({start:'established'});delete s.sacred;delete s.cooldowns.inannaProtection;delete s.cooldowns.relicAwakening;delete s.buffs.inannaProtection;
 const people=structuredClone(s.citizens),loaded=decode(encode(s));assert.ok(loaded);assert.deepEqual(loaded.citizens,people);assert.equal(loaded.cooldowns.inannaProtection,0);assert.equal(loaded.cooldowns.relicAwakening,0);assert.equal(loaded.buffs.inannaProtection,0);
 const faith=loaded.resources.faith;assert.equal(miracle(loaded,'inannaProtection').ok,false);assert.equal(loaded.resources.faith,faith);delete loaded.cooldowns.rain;assert.equal(decode(encode(loaded)),null);
});
test('the season estimate never promises music prestige from an uninspired or unpinned person',async()=>{
 const {createGame}=await import('../engine.js'),{syncCitizens}=await import('../workforce.js'),{seasonBalance}=await import('../season-balance.js'),s=createGame({start:'established'});s.buildings=s.buildings.filter(b=>['house','shrine'].includes(b.type));s.buildings.push({type:'musicHouse',x:10,y:8,level:1});
 for(const c of s.citizens){c.work=null;c.site=null;c.role='carrier';}const c=s.citizens.find(c=>c.age>=16);c.role='production';c.work='10,8';c.store='9,8';syncCitizens(s);c.work='10,8';c.store='9,8';assert.equal(seasonBalance(s).prestige.income,0);c.calling='musician';assert.equal(seasonBalance(s).prestige.income,0);c.workplace='10,8';assert.ok(seasonBalance(s).prestige.income>0);
});
test('one central instrument has one permanent musician seat',async()=>{
 const {createGame}=await import('../engine.js'),{assignWorkplace}=await import('../management.js'),{cityDiagnostics}=await import('../city-diagnostics.js'),s=createGame({start:'established'});s.buildings.push({type:'musicHouse',x:10,y:8,level:1});const adults=s.citizens.filter(c=>c.age>=16).slice(0,2);for(const c of adults){c.role='production';c.calling='musician';}assert.ok(assignWorkplace(s,adults[0].id,'10,8').ok);assert.equal(assignWorkplace(s,adults[1].id,'10,8').ok,false);assert.equal(cityDiagnostics(s).workshops.find(b=>b.type==='musicHouse').staffing.capacity,1);
});
