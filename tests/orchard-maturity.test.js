import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrder,finishConstruction} from '../construction.js';
import {orchardMaturity,orchardPalms,validateOrchards} from '../orchard-layout.js';

import {strictScenario} from '../scenario-profiles.js';

const scenario=strictScenario();
test('new gardens grow from saplings to full yields while old gardens stay mature',()=>{
 const old={type:'garden',x:2,y:2,level:1};
 const garden={type:'garden',x:3,y:2,level:1,construction:createOrder({})};
 const s={scenario,tick:3,year:1,season:3,buildings:[old,garden],news:[]};
 garden.construction.work=12;
 assert.equal(finishConstruction(s),true);
 assert.equal(garden.orchardPlantedTick,3);
 assert.equal(orchardMaturity(s,old).yield,1);
 const stages=[[3,0,.35],[6,0,.35],[7,.35,.58],[11,.7,.8],[15,1,1]];
 for(const [tick,food,size] of stages){
  s.tick=tick;
  assert.equal(orchardMaturity(s,garden).yield,food);
  assert.equal(orchardPalms(garden,s)[0].growth,size);
  assert.equal(validateOrchards(JSON.parse(JSON.stringify(s))),true);
 }
 garden.orchardPlantedTick=16;
 assert.equal(validateOrchards(s),false);
});

test('young garden yield reaches storage and the forecast uses the same multiplier',async()=>{
 const {advanceTime,createGame,decode,encode,yieldSummary}=await import('../engine.js');
 const {assignWorkplace,setCitizenRole}=await import('../management.js');
 const {syncCitizens}=await import('../workforce.js');
 const {seasonBalance}=await import('../season-balance.js');
 function run(tick){
  const s=createGame({start:'established',scenario});
  Object.assign(s,{tick,year:1+Math.floor(tick/4),season:tick%4,simTime:tick*45});
  const garden={type:'garden',x:10,y:9,level:1,orchardPlantedTick:0};
  s.buildings.push(garden);syncCitizens(s);
  for(const c of s.citizens)if(c.age>=16)setCitizenRole(s,c.id,'carrier');
  const c=s.citizens.find(c=>c.age>=16);
  setCitizenRole(s,c.id,'production');
  assert.ok(assignWorkplace(s,c.id,'10,9').ok);
  const expected=seasonBalance(s).food.income;
  const amounts=[];let previous=0;
  for(let i=0;i<110;i++){
   advanceTime(s,.25);
   const produced=garden.productionAnnual?.rows.at(-1)?.resources.food||0;
   if(produced>previous){amounts.push(produced-previous);previous=produced;}
  }
  if(tick===0){const raw=encode(s);assert.equal(encode(decode(raw)),raw);}
  return {expected,amounts,summary:yieldSummary(s,garden)};
 }
 const sapling=run(0),young=run(4),mature=run(12);
 assert.equal(sapling.expected,0);
 assert.deepEqual(sapling.amounts,[]);
 assert.match(sapling.summary,/Саженцы/);
 assert.ok(young.expected>0&&mature.expected>0);
 assert.ok(Math.abs(young.expected/mature.expected-.35)<1e-9);
 assert.ok(young.amounts.length&&young.amounts.every(n=>Math.abs(n-3.5*.35)<1e-9));
 assert.ok(mature.amounts.length&&mature.amounts.every(n=>n===3.5));
});
