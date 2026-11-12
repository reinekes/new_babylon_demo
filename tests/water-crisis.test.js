import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,encode,decode} from '../engine.js';
import {strictScenario} from '../scenario-profiles.js';
import {buildingKey} from '../definitions.js';
import {setFieldWaterPriority} from '../irrigation.js';
import {newCivicOrder,sendCivicAid} from '../civic-order.js';
import {linkWaterCrisisAid} from '../water-crisis.js';
import {cropFor,workField} from '../agriculture.js';

test('a scarce share, real aid delivery and the affected fields remain linked through harvest',()=>{
 let city=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 city.civicOrder=newCivicOrder();
 const lower={type:'field',x:10,y:5,level:1},upper={type:'field',x:10,y:7,level:1};
 city.buildings.push({type:'canal',x:13,y:6,level:1,silt:.8},lower,upper);
 for(const [x,y] of [[12,6],[11,6],[11,5],[11,7]])city.buildings.push({type:'canal',x,y,level:1});
 for(const field of [lower,upper]){
  cropFor(city,field).seedStock=4;
  workField(city,field,12);
 }
 assert.ok(setFieldWaterPriority(city,upper).ok);
 const record=city.waterCrises[0];
 assert.deepEqual(record.fields.map(f=>[f.key,f.irrigated]),[['10,7',true],['10,5',false]]);
 const resident=city.citizens.find(p=>p.age>=16),home=city.buildings.find(b=>buildingKey(b)===resident.home);
 home.pantry=0;resident.hunger=45;
 const incident={person:resident.id,name:resident.name||'Житель',home:resident.home,day:0};
 city.civicOrder.case=incident;
 const order=sendCivicAid(city);
 assert.ok(order.ok,order.reason);
 assert.ok(linkWaterCrisisAid(city,record,incident,city.district.jobs.find(job=>job.id===order.id)));
 const raw=encode(city);
 city=decode(raw);assert.ok(city);assert.equal(encode(city),raw);
 for(let step=0;step<1000;step++){
  if(city.event)city.event=null;
  advanceTime(city,.5);
  const latest=city.waterCrises[0];
  if(latest.aid.after&&latest.fields.every(f=>f.harvested!==null))break;
 }
 const result=city.waterCrises[0];
 assert.equal(result.aid.delivered,result.aid.ordered);
 assert.ok(result.aid.after?.day>=3);
 assert.ok(result.fields.every(f=>f.yield!==null&&f.harvested!==null));
 assert.ok(decode(encode(city)));
});
