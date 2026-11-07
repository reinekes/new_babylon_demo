import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,encode} from '../engine.js';
import {strictScenario} from '../scenario-profiles.js';
import {buildingKey} from '../definitions.js';
import {weatherAt} from '../environment.js';
import {FIRING_SECONDS} from '../kilns.js';
import {fireForecast} from '../fire-forecast.js';

test('a dry wind exposes occupied homes beside a burning kiln and only surplus water can protect them',()=>{
 const s=createGame({start:'established',scenario:strictScenario()});
 const home=s.buildings.find(b=>b.type==='house'&&s.citizens.some(c=>c.home===buildingKey(b)));
 const kiln={type:'kiln',x:home.x-1,y:home.y,level:1,firing:{hot:4,time:0}};
 s.buildings.push(kiln);
 s.drought=1;
 for(let i=0;i<2000&&weatherAt(s).type!=='wind';i++)s.simTime+=1;
 assert.equal(weatherAt(s).type,'wind');
 home.water=0;
 const before=encode(s),risk=fireForecast(s).sites.find(row=>row.key===buildingKey(kiln));
 assert.equal(risk.level,'high');
 assert.ok(risk.homes.includes(buildingKey(home)));
 assert.equal(encode(s),before);
 home.water=30;
 assert.equal(fireForecast(s).sites.find(row=>row.key===risk.key).level,'watch');
 s.rain=1;
 assert.equal(fireForecast(s).sites.find(row=>row.key===risk.key).level,'low');
 s.rain=0;kiln.firing.time=FIRING_SECONDS;
 assert.equal(fireForecast(s).sites.length,0);
});
