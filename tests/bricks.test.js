import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeBricks,brickNeeds,formBricks,advanceBricks,collectBricks,validateBricks} from '../bricks.js';
import {weatherAt} from '../environment.js';
const fixture=()=>{const s={buildings:[{type:'brickyard',level:1}],citizens:[],simTime:0};initializeBricks(s);return s;};
const fill=b=>Object.assign(b.brickmaking,{clay:4,reed:1,water:2});
function weather(s,type){s.rain=type==='rain'?1:0;for(let i=0;i<1000;i++){s.simTime=i;if(weatherAt(s).type===type)return;}throw Error('weather unavailable');}
test('initialization is idempotent and preserves buffers through upgrades',()=>{const s=fixture(),b=s.buildings[0];fill(b);b.construction={kind:'upgrade'};b.level=2;initializeBricks(s);assert.deepEqual(brickNeeds(b),{clay:0,reed:0,water:0});assert.equal(formBricks(b),4);initializeBricks(s);assert.equal(b.brickmaking.wet,4);assert.ok(validateBricks(s));});
test('a full recipe is consumed once; collection requires drying and never changes city stock',()=>{const s=fixture(),b=s.buildings[0];s.resources={clay:40,brick:0};assert.deepEqual(brickNeeds(b),{clay:4,reed:1,water:2});fill(b);assert.equal(formBricks(b),4);assert.equal(formBricks(b),0);assert.equal(collectBricks(b),0);weather(s,'sunny');advanceBricks(s,29);assert.equal(b.brickmaking.wet,4);advanceBricks(s,1);assert.equal(b.brickmaking.ready,4);assert.equal(collectBricks(b),4);assert.equal(collectBricks(b),0);assert.deepEqual(s.resources,{clay:40,brick:0});assert.ok(validateBricks(s));});
test('no automatic formation without worker action; missing inputs and new construction cannot form',()=>{const s=fixture(),b=s.buildings[0];fill(b);advanceBricks(s,100);assert.equal(b.brickmaking.wet,0);b.brickmaking.water=1;assert.equal(formBricks(b),0);b.brickmaking.water=2;b.construction={kind:'build'};assert.equal(formBricks(b),0);b.brickmaking.wet=4;advanceBricks(s,100);assert.equal(b.brickmaking.drying,0);});
test('rain pauses and cloudy/windy weather slows drying',()=>{for(const [type,rate] of [['rain',0],['cloudy',.6],['wind',.85]]){const s=fixture(),b=s.buildings[0];fill(b);formBricks(b);weather(s,type);advanceBricks(s,10);assert.equal(b.brickmaking.drying,10*rate);assert.equal(b.brickmaking.wet,4);}});
test('invalid time never damages or creates a batch',()=>{for(const dt of [NaN,Infinity,-1,0,'4']){const s=fixture(),b=s.buildings[0];fill(b);formBricks(b);const before=JSON.stringify(s);advanceBricks(s,dt);assert.equal(JSON.stringify(s),before);}});
test('strict validation rejects wrong buildings, nonfinite amounts, excess and inconsistent batches',()=>{for(const mutate of [b=>b.type='house',b=>b.brickmaking=null,b=>delete b.brickmaking.water,b=>b.brickmaking.clay=Infinity,b=>b.brickmaking.clay=-1,b=>b.brickmaking.water=3,b=>b.brickmaking.wet=3,b=>b.brickmaking.drying=1,b=>{b.brickmaking.wet=4;b.brickmaking.ready=4;},b=>b.brickmaking.extra=1]){const s=fixture();mutate(s.buildings[0]);assert.equal(validateBricks(s),false);}assert.ok(validateBricks({buildings:[{type:'house'}]}));});

test('the first dried batch after Hands of the Creator reserves one brick permanently',()=>{
 const s=fixture(),b=s.buildings[0];
 Object.assign(b,{x:1,y:2});
 s.creatorMaterials={version:1,clay:30,reed:20,projects:['2,2','2,3'],inspired:['clayworker','reedcutter']};
 weather(s,'sunny');
 fill(b);
 formBricks(b);
 advanceBricks(s,30);
 assert.equal(s.creatorMaterials.dedication,'1,2');
 assert.equal(b.creatorDedication,true);
 assert.ok(validateBricks(s));
 assert.equal(collectBricks(b),3);

 // A replacement at the same location has no marker or second deduction.
 s.buildings=[{type:'brickyard',level:1,x:1,y:2}];
 initializeBricks(s);
 const replacement=s.buildings[0];
 fill(replacement);
 formBricks(replacement);
 advanceBricks(s,30);
 assert.equal(replacement.creatorDedication,undefined);
 assert.equal(collectBricks(replacement),4);
});
