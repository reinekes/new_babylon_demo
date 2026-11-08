import {advanceTrade} from '../trading.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceFamilyCare} from '../family-care.js';
import {serveCommonMeal} from '../common-meal.js';
import {createNewCity} from '../new-game.js';
import {decode,encode} from '../engine.js';
import {putStock} from '../inventory.js';
import {cityToolsHTML} from '../ui-city-tools.js';

test('completed care records the actual recipient once, including after reload',()=>{
 let s=createNewCity({mode:'awakening',seed:137});
 const helper=s.citizens.find(p=>p.partner!==null),target=s.citizens.find(p=>p.id===helper.partner);
 const home=s.buildings.find(b=>`${b.x},${b.y}`===helper.home);
 Object.assign(target,{home:helper.home,health:55});
 Object.assign(s,{simTime:28,seasonElapsed:28});
 Object.assign(home,{pantry:40,pantryDelivered:40,water:20,waterDelivered:20});
 advanceFamilyCare(s,.4);
 assert.deepEqual(s.peaceDiscovery?.care,[]);
 s=decode(encode(s));assert.ok(s);
 advanceFamilyCare(s,1.2);
 assert.deepEqual(s.peaceDiscovery.care,[{helperId:helper.id,recipientId:target.id,time:28}]);
 advanceFamilyCare(s,1.5);
 assert.equal(s.peaceDiscovery.care.length,1);
 assert.match(cityToolsHTML(s),/Получили уход · 1 из 3/);
});

test('a calm meal needs two diners who ate, and each day counts once',()=>{
 const s=createNewCity({mode:'awakening',seed:137});
 const [a,b]=[s.citizens[0],s.citizens.find(c=>c.age>=16&&c.home!==s.citizens[0].home)];
 const depot={type:'depot',x:10,y:9,level:1,commonMeals:true};
 s.buildings.push(depot);putStock(s,'10,9','food',20);
 s.simTime=12;s.seasonElapsed=12;
 assert.ok(serveCommonMeal(s,a,depot));
 assert.deepEqual(s.peaceDiscovery?.meals,[]);
 Object.assign(a,{phase:'commonMeal',commonMealTarget:'10,9',commonMealUntil:13});
 assert.ok(serveCommonMeal(s,b,depot));
 assert.equal(s.peaceDiscovery.meals.length,1);
 assert.equal(serveCommonMeal(s,b,depot),false);
 s.simTime=72;s.seasonElapsed=27;s.tick=1;s.season=1;advanceTrade(s);
 assert.ok(serveCommonMeal(s,a,depot));
 a.commonMealUntil=73;
 assert.ok(serveCommonMeal(s,b,depot));
 assert.equal(s.peaceDiscovery.meals.length,2);
 assert.match(cityToolsHTML(s),/Условия выполнены/);
 const raw=encode(s),saved=decode(raw);
 assert.ok(saved);
 assert.equal(encode(saved),raw);
 saved.peaceDiscovery.meals[1].day=0;
 assert.equal(decode(encode(saved)),null);
});

test('Peace applies only to the quoted neighborhood after real care, preserving health and cargo',async()=>{
 const {miracle}=await import('../engine.js');
 const {peaceQuote,recordCompletedCare}=await import('../peace-discovery.js');
 const s=createNewCity({mode:'awakening',seed:137});
 Object.assign(s.godhood,{stage:'recognized',witnessId:0,believerIds:[0],recognitionAt:0});
 s.resources.faith=100;s.simTime=s.seasonElapsed=1;
 const home=s.buildings.find(b=>b.type==='house');
 const target={x:home.x,y:home.y};
 assert.match(miracle(s,'peace',target).reason,/уход|трапез/);
 const helper=s.citizens[0];
 for(const resident of s.citizens.slice(1,4))recordCompletedCare(s,helper,resident);
 assert.equal(miracle(s,'peace').ok,false);
 const quote=peaceQuote(s,target);
 assert.ok(quote.ids.length>0&&quote.ids.length<=12);
 const mood=s.citizens.map(c=>[c.id,c.mood,c.health,c.hunger,structuredClone(c.cargo)]);
 const happiness=s.happiness;
 assert.equal(miracle(s,'peace',{...target,ids:[]}).ok,false);
 assert.equal(s.resources.faith,100);
 assert.equal(miracle(s,'peace',{...target,ids:quote.ids}).ok,true);
 assert.equal(s.resources.faith,70);
 assert.equal(s.happiness,happiness);
 for(const [id,oldMood,health,hunger,cargo] of mood){
  const c=s.citizens.find(c=>c.id===id);
  assert.equal(c.mood,quote.ids.includes(id)?Math.min(100,oldMood+25):oldMood);
  assert.equal(c.health,health);
  assert.equal(c.hunger,hunger);
  assert.deepEqual(c.cargo,cargo);
 }
 assert.deepEqual(s.peaceDiscovery.lastCast.ids,quote.ids);
 const raw=encode(s);
 assert.equal(encode(decode(raw)),raw);
 const wrongDate=JSON.parse(raw);
 wrongDate.miracleHistory.paid.peace.at=.5;
 assert.equal(decode(JSON.stringify(wrongDate)),null);
});
