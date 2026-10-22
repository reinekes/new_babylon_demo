import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,build,canBuild,advanceTime,encode,decode} from '../engine.js';
import {irrigationFor,fieldWater} from '../irrigation.js';
import {syncCitizens} from '../workforce.js';
const canal=(x,y)=>({type:'canal',x,y,level:1});
test('only completed cardinal chains from the river carry water; cache invalidates on breaks',()=>{
 const s=createGame();s.buildings.push(canal(13,6),canal(12,6),canal(11,6),canal(10,6),canal(9,6));
 assert.ok(irrigationFor(s).wet.has('9,6'));assert.equal(irrigationFor(s),irrigationFor(s));
 s.buildings.find(b=>b.type==='canal'&&b.x===11).construction={kind:'new'};
 assert.ok(!irrigationFor(s).wet.has('9,6'));delete s.buildings.find(b=>b.type==='canal'&&b.x===11).construction;
 assert.ok(irrigationFor(s).wet.has('9,6'));s.buildings=s.buildings.filter(b=>!(b.type==='canal'&&b.x===10));
 assert.ok(!irrigationFor(s).wet.has('9,6'));
});
test('dryland fields require a wet adjacent canal; natural fields survive and dry fields remain saveable',()=>{
 const s=createGame();assert.ok(canBuild(s,'field',8,6));
 s.buildings.push(canal(13,6),canal(12,6),canal(11,6),canal(10,6),canal(9,6));
 assert.equal(canBuild(s,'field',8,6),'');assert.ok(build(s,'field',8,6).ok);
 const b=s.buildings.at(-1);assert.equal(fieldWater(s,b).productive,true);
 s.buildings=s.buildings.filter(b=>b.type!=='canal');assert.equal(fieldWater(s,b).productive,false);
 assert.ok(decode(encode(s)));assert.equal(fieldWater(s,s.buildings.find(b=>b.type==='field'&&b.x===12)).productive,true);
});
test('workers actually deliver materials and finish canals before water arrives, preserving saves',()=>{
 const s=createGame();assert.ok(build(s,'canal',13,6).ok);const b=s.buildings.at(-1);let cargo=false;
 assert.equal(irrigationFor(s).wet.size,0);
 for(let i=0;i<2400&&b.construction;i++){s.event=null;advanceTime(s,.1);cargo ||= s.citizens.some(c=>Object.values(c.buildCargo||{}).some(n=>n>0));if(b.construction)assert.equal(irrigationFor(s).wet.size,0);}
 assert.ok(cargo);assert.equal(b.construction,undefined);assert.ok(irrigationFor(s).wet.has('13,6'));assert.ok(decode(encode(s)));
});
test('old cities preserve residents and cargo; canals without cardinal contact with a source stay dry',()=>{
 const s=createGame(),copy=decode(encode(s));assert.deepEqual(copy,s);
 s.buildings.push(canal(3,3),canal(4,4));assert.equal(irrigationFor(s).wet.size,0);
});
test('summer dryland crops stop growing and resume when the river connection returns',async()=>{
 const {cropFor,advanceCrops}=await import('../agriculture.js');const s=createGame();s.buildings.push(canal(13,6),canal(12,6),canal(11,6),canal(10,6),canal(9,6),{type:'field',x:8,y:6,level:1});
 const b=s.buildings.at(-1),crop=cropFor(s,b);crop.sown=1;s.season=1;advanceCrops(s,10);assert.ok(crop.growth>0);
 const source=s.buildings.find(b=>b.type==='canal'&&b.x===13);s.buildings=s.buildings.filter(b=>b!==source);const before=crop.growth;advanceCrops(s,10);assert.equal(crop.growth,before);
 s.buildings.push(source);advanceCrops(s,10);assert.ok(crop.growth>before);
});
test('canal cancellation refunds reserved and carried goods; demolition cuts downstream water',async()=>{
 const {cancelConstruction,demolish}=await import('../management.js');const s=createGame(),clay=s.resources.clay,reed=s.resources.reed;
 build(s,'canal',13,6);for(let i=0;i<100;i++){s.event=null;advanceTime(s,.1);if(s.citizens.some(c=>Object.values(c.buildCargo||{}).some(n=>n>0)))break;}
 assert.ok(decode(encode(s)));assert.ok(cancelConstruction(s,13,6).ok);assert.equal(s.resources.clay,clay);assert.equal(s.resources.reed,reed);assert.ok(decode(encode(s)));
 s.buildings.push(canal(13,6),canal(12,6));syncCitizens(s);assert.ok(irrigationFor(s).wet.has('12,6'));assert.ok(demolish(s,13,6).ok);assert.equal(irrigationFor(s).wet.size,0);assert.ok(decode(encode(s)));
});
test('field inlet is drawn to the canal without letting a field carry water farther',()=>{
 const s=createGame();s.buildings.push(canal(13,6),{type:'field',x:12,y:6,level:1},canal(11,6));const n=irrigationFor(s);
 assert.ok(n.arms.get('13,6').some(([dx,dy])=>dx===-1&&dy===0));assert.ok(!n.wet.has('11,6'));
});
test('canals render below residents with finite coordinates and cross existing roads',async()=>{
 const {Renderer}=await import('../renderer.js');const gradient={addColorStop(){}};let strokes=0;
 const ctx=new Proxy({}, {get(t,k){if(k==='createRadialGradient')return()=>gradient;if(k==='moveTo'||k==='lineTo')return(...n)=>n.forEach(v=>assert.ok(Number.isFinite(v)));if(k==='stroke')return()=>strokes++;return t[k]??(()=>{});},set(t,k,v){t[k]=v;return true;}});
 const r=Object.create(Renderer.prototype);Object.assign(r,{ctx,canvas:{getBoundingClientRect:()=>({left:0,top:0})},w:945,h:715,zoom:1.25,pan:{x:0,y:0},ambient:12,visualLast:null,lightMode:'day',reduce:true,lights:[],effects:[],hover:null});
 const s=createGame();s.buildings.push(canal(13,6),canal(12,6));r.draw(s,null,1000);assert.ok(strokes>0);
});
test('a road crossing receives a three-plank deck above the finished canal',async()=>{
 const {drawCanal}=await import('../irrigation.js'),s=createGame();s.buildings.push(canal(13,6));const lines=[];
 const r={s:1,point:(x,y)=>({x,y}),line:(points,color,width)=>lines.push({points,color,width}),streets:{edges:[[{x:13.5,y:5.5},{x:13.5,y:6.5}]]}};
 drawCanal(r,s.buildings.at(-1),s,{crossings:true});assert.equal(lines.length,3);assert.ok(lines.every(l=>l.color==='#c5ad7d'));
});

function lakeCanals(){
 const s=createGame();s.world.lakes=[{id:'lake-irrigation-probe',cells:[{x:3,y:3},{x:4,y:3},{x:3,y:4}]}];s.world.deposits=s.world.deposits.filter(d=>!s.world.lakes[0].cells.some(c=>c.x===d.x&&c.y===d.y));
 s.buildings.push(canal(4,4),canal(5,4),canal(5,5),canal(6,5));return s;
}
test('a completed turning canal carries lake water to a desert field without making the field a conduit',()=>{
 const s=lakeCanals(),n=irrigationFor(s);assert.ok(n.wet.has('6,5'),'lake must fill the entire cardinal chain');assert.deepEqual(n.arms.get('5,4'),[[0,1],[-1,0]],'corner shares the same two actual ports');
 assert.equal(canBuild(s,'field',7,5),'');assert.ok(build(s,'field',7,5).ok);assert.equal(fieldWater(s,s.buildings.at(-1)).canal,true);assert.ok(canBuild(s,'field',6,5),'an occupied canal tile cannot also become a field');assert.ok(canBuild(s,'field',4,3),'an irrigated lake-water tile is not buildable land');
 s.buildings.push(canal(8,5),canal(7,6));assert.ok(!irrigationFor(s).wet.has('8,5'),'a field does not carry canal water onward');assert.ok(!irrigationFor(s).wet.has('7,6'),'diagonal contact does not carry water');assert.ok(decode(encode(s)));
});
test('new construction interrupts lake water and a restored complete link resumes crop growth',async()=>{
 const {cropFor,advanceCrops}=await import('../agriculture.js');const s=lakeCanals(),field={type:'field',x:7,y:5,level:1};s.buildings.push(field);const crop=cropFor(s,field);crop.sown=1;s.season=1;advanceCrops(s,4);assert.ok(crop.growth>0);
 const link=s.buildings.find(b=>b.type==='canal'&&b.x===5&&b.y===4);link.construction={kind:'new'};const before=crop.growth;advanceCrops(s,4);assert.equal(crop.growth,before);assert.equal(fieldWater(s,field).canal,false);delete link.construction;advanceCrops(s,4);assert.ok(crop.growth>before);
});
test('lake membership changes invalidate derived irrigation without changing saved state or the river',()=>{
 const s=lakeCanals();s.buildings.push(canal(13,6));const before=encode(s),wet=irrigationFor(s);assert.ok(wet.wet.has('6,5'));assert.ok(wet.wet.has('13,6'));assert.equal(encode(s),before);
 s.world.lakes[0].cells.splice(1);const after=irrigationFor(s);assert.notEqual(after,wet);assert.equal(after.wet.has('6,5'),false);assert.ok(after.wet.has('13,6'),'the unchanged river source remains wet');assert.ok(canBuild(s,'field',7,5));
 s.world.lakes[0].cells.push({x:4,y:3});assert.ok(irrigationFor(s).wet.has('6,5'));assert.deepEqual(decode(encode(s)).world,s.world);
});
