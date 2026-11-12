import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,encode,decode} from '../engine.js';
import {strictScenario} from '../scenario-profiles.js';
import {buildingKey} from '../definitions.js';
import {syncInventory} from '../inventory.js';

test('field grain passes through mixed stock and a saved ration trip before dinner',()=>{
 let s=createGame({start:'established',scenario:strictScenario(),seed:137});
 const field=s.buildings.find(b=>b.type==='field');
 field.crop.sheaves=30;
 s.resources.food=4;syncInventory(s);
 const progress={output:false,stock:false,pickup:false,arrival:false,dinner:false};
 let firstDinner;
 for(let i=0;i<2200&&!progress.dinner;i++){
  if(s.event)s.event=null;
  advanceTime(s,4/60);
  progress.output ||= !!field.grainOutput;
  progress.stock ||= s.buildings.some(b=>b.grainStock?.some(p=>p.field===buildingKey(field)));
  if(!progress.pickup&&s.citizens.some(c=>c.grainPantry?.length)){
   progress.pickup=true;
   const raw=encode(s);
   const loaded=decode(raw);
   assert.ok(loaded);
   assert.equal(encode(loaded),raw);
   const corrupt=JSON.parse(raw);
   corrupt.citizens.find(c=>c.grainPantry).grainPantry[0].end=100;
   assert.equal(decode(JSON.stringify(corrupt)),null);
   s=loaded;
  }
  progress.arrival ||= s.buildings.some(b=>b.lastRation?.grain?.length&&b.lastRation.source!==buildingKey(field));
  const home=s.buildings.find(b=>b.grainDinner);
  if(home){progress.dinner=true;firstDinner={home:buildingKey(home),...home.grainDinner};}
 }
 assert.equal(firstDinner.fields[0].field,buildingKey(field));
 assert.ok(Object.values(progress).every(Boolean));
 assert.ok(decode(encode(s)));
});
