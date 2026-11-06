import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,decode,encode} from '../engine.js';
import {syncCitizens} from '../workforce.js';
import {advanceTrade} from '../trading.js';
import {stampBuildingCompletion} from '../building-chronology.js';
import {advanceCrops,changeCropSeason,workField} from '../agriculture.js';
import {CAT_DISCOVERY_RULES,strictScenario} from '../scenario-profiles.js';

function harvestCity({canal=true,rain=0}={}){
 const s=createGame({start:'established',mode:'awakening',scenario:{...strictScenario(),miracles:CAT_DISCOVERY_RULES}});
 const field=s.buildings.find(b=>b.type==='field'),farmer=s.citizens.find(c=>c.age>=16);
 farmer.calling='farmer';
 field.crop.seedStock=4;
 workField(s,field,12,farmer);
 if(canal){const channel={type:'canal',x:12,y:7,level:1};s.buildings.push(channel);stampBuildingCompletion(s,channel);syncCitizens(s);}
 s.rain=rain;s.tick=1;s.season=1;s.simTime=45;advanceTrade(s);
 advanceCrops(s,45);
 s.tick=2;s.season=2;s.simTime=90;
 changeCropSeason(s,1);
 return {s,field,farmer};
}

test('the first human irrigated harvest records the actual inspired reaper once',()=>{
 const {s,field,farmer}=harvestCity();
 assert.equal(s.irrigatedHarvest,undefined);
 assert.ok(field.crop.remaining>0);
 workField(s,field,4,farmer);
 assert.deepEqual(s.irrigatedHarvest,{field:'12,8',farmerId:farmer.id,time:90});
 s.simTime=91;s.seasonElapsed=1;
 workField(s,field,4,farmer);
 workField(s,field,4,farmer);
 assert.equal(s.irrigatedHarvest.time,90);
 const raw=encode(s);
 const loaded=decode(raw);
 assert.ok(loaded);
 assert.deepEqual(loaded.irrigatedHarvest,s.irrigatedHarvest);
 assert.equal(encode(decode(encode(loaded))),encode(loaded));
});

test('rain alone and harvest without an inspired farmer do not qualify',()=>{
 const rain=harvestCity({canal:false,rain:1});
 assert.ok(rain.field.crop.remaining>0);
 workField(rain.s,rain.field,4,rain.farmer);
 assert.equal(rain.s.irrigatedHarvest,undefined);
 const ordinary=harvestCity();
 workField(ordinary.s,ordinary.field,4);
 assert.equal(ordinary.s.irrigatedHarvest,undefined);
});
