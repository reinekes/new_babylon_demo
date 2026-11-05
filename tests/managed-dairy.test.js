import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,encode,decode,advanceSeason,terrain} from '../engine.js';
import {strictScenario} from '../scenario-profiles.js';
import {startManagedDairy,settleManagedDairy,workDairy} from '../dairy.js';
import {startManagedFlock} from '../textiles.js';
import {pastureCredits} from '../pasture.js';
import {signedRiverDistance} from '../world.js';
import {syncCitizens} from '../workforce.js';

test('milking cannot spend the seasonal ration, and feeding changes the same cow count used in production',()=>{
 const b={type:'cowshed',level:1};
 const s={buildings:[b],season:0};
 startManagedDairy(b);
 Object.assign(b.dairy,{reed:3,water:7});
 assert.equal(workDairy(b,8),0);
 b.dairy.reed++;
 assert.equal(workDairy(b,8),3);
 assert.deepEqual([b.dairy.reed,b.dairy.water],[3,3]);
 settleManagedDairy(s,new Map([[b,1]]));
 assert.deepEqual([b.dairy.reed,b.dairy.water,b.dairy.cows,b.dairy.calves],[1,0,5,1]);
 s.season=1;settleManagedDairy(s,new Map());settleManagedDairy(s,new Map());
 assert.deepEqual([b.dairy.cows,b.dairy.calves,b.dairy.shortage],[5,0,1]);
 Object.assign(b.dairy,{reed:8,water:12});
 assert.equal(workDairy(b,8),0);
});

test('three shared tiles feed only one herd, with no pasture credit in winter',()=>{
 const s=createGame({start:'established',scenario:strictScenario()});
 const cow={type:'cowshed',x:12,y:9,level:1},sheep={type:'sheepfold',x:12,y:10,level:1};
 startManagedDairy(cow);startManagedFlock(sheep);
 const bank=Math.sign(signedRiverDistance(cow.x,cow.y,s)),open=[];
 for(let y=8;y<=11;y++)for(let x=10;x<=14;x++)
  if(terrain(x,y,s)==='fertile'&&Math.sign(signedRiverDistance(x,y,s))===bank&&(x!==12||![9,10].includes(y)))open.push(`${x},${y}`);
 assert.ok(open.length>=3);
 const available=new Set(open.slice(0,3));
 s.buildings=[cow,sheep];
 for(let y=7;y<=12;y++)for(let x=10;x<=14;x++)
  if((x!==12||![9,10].includes(y))&&!available.has(`${x},${y}`))s.buildings.push({type:'house',x,y});
 assert.deepEqual([...pastureCredits(s,0).values()],[1]);
 assert.equal(pastureCredits(s,3).size,0);
});

test('a managed dairy consumes its separate ration after exact reload',()=>{
 let s=createGame({start:'established',scenario:strictScenario()});
 const b={type:'cowshed',x:10,y:9,level:1};
 startManagedDairy(b);Object.assign(b.dairy,{reed:3,water:12});
 s.buildings.push(b);s.resources.reed=0;syncCitizens(s);
 const raw=encode(s);s=decode(raw);assert.ok(s);assert.equal(encode(s),raw);
 advanceSeason(s);
 const dairy=s.buildings.find(v=>v.type==='cowshed').dairy;
 assert.equal(dairy.cows,5);assert.equal(dairy.calves,0);
 assert.equal(dairy.pasture,1);assert.equal(dairy.reed,1);assert.equal(dairy.water,9);
 assert.ok(decode(encode(s)));
});
