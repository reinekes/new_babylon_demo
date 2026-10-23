import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,yieldSummary,encode,decode} from '../engine.js';
import {initializeArtisans,workArtisan,advanceArtisans,collectArtisan,artisanSummary} from '../artisan.js';
import {weatherAt} from '../environment.js';import {seasonBalance} from '../season-balance.js';
import {syncCitizens} from '../workforce.js';import {setCitizenRole,assignWorkplace} from '../management.js';
const fixture=(type,level=1)=>{const s=createGame({start:'established'});s.buildings.push({type,x:10,y:9,level});initializeArtisans(s);syncCitizens(s);return s;};
for(const [type,recipe,work,stage,amount]of [['pottery',{clay:4,reed:2,water:2},5,'drying',2],['brewery',{food:4,water:3,pottery:1},15,'ready',3]]){
 test(`${type} level III accelerates labor without increasing inputs or batch output`,()=>{
  const low=fixture(type),high=fixture(type,3),a=low.buildings.at(-1),b=high.buildings.at(-1);Object.assign(a.artisan,recipe);Object.assign(b.artisan,recipe);
  workArtisan(a,work/2.4+1e-10);workArtisan(b,work/2.4+1e-10);assert.equal(b.artisan.stage,stage);assert.notEqual(a.artisan.stage,stage);
  for(const k of Object.keys(recipe)){assert.equal(a.artisan[k],0);assert.equal(b.artisan[k],0);}
  if(type==='pottery'){
   const dryingState={...high};for(let i=0;i<1000;i++){dryingState.simTime=i;if(weatherAt(dryingState).type==='sunny')break;}
   advanceArtisans(dryingState,11.9);assert.equal(b.artisan.stage,'drying');advanceArtisans(dryingState,.1);assert.equal(b.artisan.stage,'firing');
   advanceArtisans(dryingState,11.9);assert.equal(b.artisan.stage,'firing');advanceArtisans(dryingState,.1);assert.equal(b.artisan.stage,'cooling');
   advanceArtisans(dryingState,5.9);assert.equal(b.artisan.stage,'cooling');advanceArtisans(dryingState,.1);
  }
  assert.equal(collectArtisan(b),amount);assert.equal(collectArtisan(b),0);assert.ok(decode(encode(low)));assert.ok(decode(encode(high)));
  assert.equal(artisanSummary(b).laborMultiplier,2.4);assert.match(yieldSummary(high,b),/труд ×2[.,]4/);
 });
 test(`${type} forecast applies the upgrade multiplier to remaining active labor`,()=>{
  const s=fixture(type),b=s.buildings.at(-1);for(const c of s.citizens)if(c.age>=16)setCitizenRole(s,c.id,'carrier');const worker=s.citizens.find(c=>c.age>=16);setCitizenRole(s,worker.id,'production');assignWorkplace(s,worker.id,'10,9');Object.assign(worker,{health:100,mood:0,hunger:0});delete worker.calling;
  Object.assign(b.artisan,{stage:type==='pottery'?'forming':'brewing',elapsed:0,...type==='brewery'?{vesselUses:3}:{}});
  for(let i=0;i<1000;i++){s.simTime=i;if(weatherAt(s).type==='sunny')break;}
  const key=type==='pottery'?'pottery':'beer';assert.equal(seasonBalance(s)[key].income,0);b.level=3;assert.equal(seasonBalance(s)[key].income,amount);
 });
}
for(const [type,recipe,output,amount,mood]of [['pottery',{clay:4,reed:2,water:2},'pottery',2,0],['brewery',{food:4,water:3,pottery:1},'beer',3,75]])test(`${type} idle forecast budgets faster labor after an upgrade`,()=>{
 const s=fixture(type),b=s.buildings.at(-1);b.y=8;syncCitizens(s);for(const c of s.citizens)if(c.age>=16)setCitizenRole(s,c.id,'carrier');
 const worker=s.citizens.find(c=>c.age>=16);setCitizenRole(s,worker.id,'production');assert.ok(assignWorkplace(s,worker.id,'10,8').ok);Object.assign(worker,{health:100,mood,hunger:0});delete worker.calling;Object.assign(b.artisan,recipe);
 for(let i=0;i<1000;i++){s.simTime=i;if(weatherAt(s).type==='sunny')break;}
 assert.equal(seasonBalance(s)[output].income,0);b.level=3;assert.equal(seasonBalance(s)[output].income,amount);
});
