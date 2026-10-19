import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,encode,decode} from '../engine.js';
import {initializeArtisans,workArtisan,validateArtisans} from '../artisan.js';
import {setCitizenRole,assignWorkplace} from '../management.js';
import {syncCitizens} from '../workforce.js';
import {seasonBalance} from '../season-balance.js';
import {weatherAt} from '../environment.js';
import {workRate} from '../wellbeing.js';
const fixture=type=>{const s=createGame();s.buildings.push({type,x:10,y:9,level:1});initializeArtisans(s);syncCitizens(s);return s;};
for(const [type,recipe,stage]of [['pottery',{clay:4,reed:2,water:2},'forming'],['brewery',{food:4,water:3,pottery:1},'brewing']]){
 test(`${type} accepts rounding-size recipe deficits without negative buffers or invalid saves`,()=>{
  for(const material of Object.keys(recipe)){
   const s=fixture(type),b=s.buildings.at(-1);Object.assign(b.artisan,recipe,{[material]:recipe[material]-1e-10});
   workArtisan(b,.1);assert.equal(b.artisan.stage,stage);assert.ok(validateArtisans(s),material);
   for(const k of Object.keys(recipe))assert.equal(b.artisan[k],0,`${material}: ${k}`);
   assert.ok(decode(encode(s)),`${material}: save`);
  }
 });
 test(`${type} refuses a genuine ingredient shortage without charging any inputs`,()=>{
  const s=fixture(type),b=s.buildings.at(-1),material=Object.keys(recipe)[0];Object.assign(b.artisan,recipe,{[material]:recipe[material]-1e-6});
  const before=structuredClone(b.artisan);workArtisan(b,100);assert.deepEqual(b.artisan,before);assert.ok(decode(encode(s)));
 });
 test(`${type} active forecast requires enough actual labor before promising finished goods`,()=>{
  const s=fixture(type),b=s.buildings.at(-1);for(const c of s.citizens)if(c.age>=16)setCitizenRole(s,c.id,'carrier');
  const worker=s.citizens.find(c=>c.age>=16);setCitizenRole(s,worker.id,'production');assert.ok(assignWorkplace(s,worker.id,'10,9').ok);
  Object.assign(worker,{health:25,mood:0,hunger:100});delete worker.calling;
  for(let i=0;i<1000;i++){s.simTime=i;if(weatherAt(s).type==='sunny')break;}
  Object.assign(b.artisan,{stage,elapsed:0,...type==='brewery'?{vesselUses:3}:{}});
  assert.equal(workRate(worker,'production'),.15);assert.equal(s.citizens.filter(c=>c.work==='10,9').length,1);
  assert.equal(seasonBalance(s)[type==='pottery'?'pottery':'beer'].income,0);
  Object.assign(worker,{health:100,mood:75,hunger:0});assert.ok(seasonBalance(s)[type==='pottery'?'pottery':'beer'].income>0);
 });
}
test('active brewing forecast sums the work of both assigned residents',()=>{
 const s=fixture('brewery'),b=s.buildings.at(-1);for(const c of s.citizens)if(c.age>=16)setCitizenRole(s,c.id,'carrier');
 const workers=s.citizens.filter(c=>c.age>=16).slice(0,2);
 Object.assign(b.artisan,{stage:'brewing',elapsed:0,vesselUses:3});
 for(const c of workers){Object.assign(c,{health:25,mood:75,hunger:0});delete c.calling;}
 setCitizenRole(s,workers[0].id,'production');assert.ok(assignWorkplace(s,workers[0].id,'10,9').ok);
 assert.equal(seasonBalance(s).beer.income,0);
 setCitizenRole(s,workers[1].id,'production');assert.ok(assignWorkplace(s,workers[1].id,'10,9').ok);
 assert.equal(seasonBalance(s).beer.income,3);
});
