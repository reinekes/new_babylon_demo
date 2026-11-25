import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.js';
import {advanceWellbeing} from '../wellbeing.js';
import {buildingKey} from '../definitions.js';
import {strictScenario} from '../scenario-profiles.js';
import {recordLifeDeath,validateLifeAnalytics,syncLifeAnalytics} from '../life-analytics.js';
import {lifeAnalyticsHTML} from '../ui-life-analytics.js';

test('a resident working through dinner receives a ration from their home pantry',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const resident=s.citizens[0],home=s.buildings.find(b=>buildingKey(b)===resident.home);
 s.citizens=[resident];
 Object.assign(s,{simTime:40,seasonElapsed:40});
 Object.assign(resident,{phase:'working',mealDay:0,mealEaten:0,mealEvaluated:-1,missedMeals:0,hunger:70,health:70});
 home.pantry=2;
 const before=home.pantry;
 for(let i=0;i<3;i++)advanceWellbeing(s,1);
 assert.ok(resident.mealEaten>=.8-1e-8,`ate ${resident.mealEaten} of 0.8`);
 assert.ok(home.pantry<before,'the away meal must be paid from the resident household');
 assert.ok(resident.hunger<70,'eating must reduce hunger while away');
});

test('a distant city stockpile is not silently counted as a household meal',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const resident=s.citizens[0],home=s.buildings.find(b=>buildingKey(b)===resident.home);
 s.citizens=[resident];
 Object.assign(s,{simTime:40,seasonElapsed:40});
 Object.assign(resident,{phase:'working',mealDay:0,mealEaten:0,mealEvaluated:-1,missedMeals:0});
 home.pantry=0;s.resources.food=800;
 advanceWellbeing(s,1);
 assert.equal(resident.mealEaten,0);
 assert.equal(s.resources.food,800);
});

test('a death record preserves the conditions that caused starvation',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const resident=s.citizens[0],home=s.buildings.find(b=>buildingKey(b)===resident.home);
 Object.assign(s,{simTime:123,tick:2,seasonElapsed:33,year:1,season:2});
 Object.assign(resident,{phase:'toWork',hunger:100,thirst:14,health:0,missedMeals:3,mealEaten:0,lastMealQuality:0,workplace:'9,8'});
 home.pantry=5;
 s.resources.food=800;
 const archived=recordLifeDeath(s,resident,'starvation');
 assert.deepEqual({...archived.deathEvidence,mealRequired:Math.round(archived.deathEvidence.mealRequired*10)/10},{time:123,phase:'toWork',home:resident.home,workplace:'9,8',x:resident.x,y:resident.y,health:0,hunger:100,thirst:14,missedMeals:3,mealEaten:0,mealRequired:.8,lastMealQuality:0,homeFood:5,homeMilk:0,homeWater:16,cityFood:800,cityWater:null});
 s.citizens=s.citizens.filter(c=>c.id!==resident.id);s.population=s.citizens.length;s.deaths++;syncLifeAnalytics(s);
 assert.equal(validateLifeAnalytics(s),true);
 const serialized=JSON.parse(JSON.stringify(s));
 assert.equal(serialized.lifeAnalytics.people.find(p=>p.id===resident.id).deathEvidence.homeFood,5);
 const html=lifeAnalyticsHTML(s,{tab:'family',selectedId:resident.id});
 assert.match(html,/Состояние перед смертью/);
 assert.match(html,/Еда дома: 5/);
 assert.match(html,/мог быть недоступен жителю без доставки/);
});
