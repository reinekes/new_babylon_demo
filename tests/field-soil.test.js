import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,encode,decode} from '../engine.js';
import {strictScenario} from '../scenario-profiles.js';
import {fieldWater} from '../irrigation.js';
import {fieldActive,workField} from '../agriculture.js';
import {setCanalDrain,setFieldRest} from '../management.js';
import {nextFieldSalt,saltYieldFactor,settleFieldSoil} from '../field-soil.js';
import {seedTarget} from '../food-planning.js';
import {stampBuildingCompletion} from '../building-chronology.js';

test('salt rises slowly, only connected drainage removes it, and a planned rest keeps seed intact',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 assert.ok(decode(encode(s)),'existing soil-less save remains valid');
 const field={type:'field',x:12,y:7,level:1};
 for(const [x,y] of [[13,6],[12,6],[11,7],[11,8],[11,9]]){
  const canal={type:'canal',x,y,level:1};s.buildings.push(canal);stampBuildingCompletion(s,canal);
 }
 s.buildings.push(field);stampBuildingCompletion(s,field);
 field.crop={year:1,sown:1,growth:0,total:0,remaining:0,harvested:0,spoiled:0,seedStock:0,seedUsed:4,sheaves:0,threshed:0};
 assert.equal(fieldWater(s,field).canal,true);
 settleFieldSoil(s,1);settleFieldSoil(s,1);
 assert.equal(field.soil.salt,.24);
 assert.equal(saltYieldFactor(s,field),1);
 settleFieldSoil(s,1);
 assert.ok(saltYieldFactor(s,field)<1);
 assert.ok(setCanalDrain(s,'11,7',true).ok);
 assert.equal(fieldWater(s,field).drained,false);
 assert.ok(setCanalDrain(s,'11,8',true).ok);
 assert.ok(setCanalDrain(s,'11,9',true).ok);
 assert.equal(fieldWater(s,field).drained,true);
 assert.equal(fieldWater(s,field).canal,true);
 assert.equal(nextFieldSalt(s,field,fieldWater(s,field)),.27);
 assert.equal(setFieldRest(s,'12,7',true).year,2);
 assert.equal(field.crop.sown,1,'scheduling rest never removes the current crop');
 field.crop.sown=0;field.crop.seedUsed=0;field.crop.seedStock=2;
 const required=seedTarget(s);
 assert.equal(setFieldRest(s,'12,7',true).year,1);
 assert.equal(seedTarget(s),required-2);
 assert.equal(fieldActive(s,field),false);
 workField(s,field,20);
 assert.equal(field.crop.seedStock,2);
 settleFieldSoil(s,1);
 assert.equal(field.soil.salt,.08);
 const raw=encode(s),copy=decode(raw);
 assert.ok(copy);assert.equal(encode(copy),raw);
});
