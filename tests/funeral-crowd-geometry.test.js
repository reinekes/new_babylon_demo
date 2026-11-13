import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,encode,decode} from '../engine.js';
import {startFuneral,funeralView} from '../funerals.js';
import {isDryPoint,river} from '../world.js';
import {footprintSize} from '../footprints.js';
import {syncCitizens} from '../workforce.js';

function farewell(count=40){
 const state=createGame({start:'established'});
 state.buildings.push(...[3,4,5].map(x=>({type:'house',x,y:8,level:1})));state.capacity=40;state.population=count;syncCitizens(state);
 state.citizens.forEach(c=>{c.age=30;c.cargo={};c.buildCargo={};});
 startFuneral(state,[{id:9990,name:'Покойный',x:8,y:8}]);state.funeral.stage='farewell';state.funeral.timer=2.5;
 return state;
}

test('farewell mourners form a compact, clear group and each faces the closest laid bier',()=>{
 const state=farewell(),before=JSON.stringify(state),view=funeralView(state),people=view.participants;
 assert.equal(people.length,40);assert.equal(new Set(people.map(p=>`${p.x},${p.y}`)).size,40);
 const bank=state.funeral.gather.x<river(state.funeral.gather.y);
 for(const p of people){
  assert.ok(isDryPoint(state,p.x,p.y));assert.equal(p.x<river(p.y),bank,'a farewell cannot place a mourner on the opposite bank');
  assert.ok(state.buildings.every(b=>{if(['field','garden','bridge'].includes(b.type))return true;const size=footprintSize(b);return Math.abs(p.x-b.x-(size-1)/2)>=size/2+.08||Math.abs(p.y-b.y-(size-1)/2)>=size/2+.08;}),`mourner ${p.id} clears every building`);
  const nearest=view.biers.filter(b=>b.laid&&b.visible!==false).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0],dx=nearest.x-p.x,dy=nearest.y-p.y,d=Math.hypot(dx,dy);
  assert.ok(d>=.32-1e-8,'laid shrouds retain clear space');assert.ok((Math.sin(p.yaw)*dx+Math.cos(p.yaw)*dy)/d>.99999,'each mourner looks toward the bier rather than sharing an unrelated procession heading');
  const distances=people.filter(other=>other.id!==p.id).map(other=>Math.hypot(other.x-p.x,other.y-p.y));
  assert.ok(Math.min(...distances)>=.17,'neighbours retain shoulder room');assert.ok(Math.min(...distances)<.30,'mourners gather together instead of standing three metres apart');assert.ok(p.bow<=.16,'a farewell is a modest bow');
 }
 assert.equal(JSON.stringify(state),before,'layout cannot change a saved person or cargo');assert.ok(decode(encode(state)),'the old save envelope remains valid');
});

test('farewell layout is deterministic across a save roundtrip',()=>{
 const state=farewell(18),first=funeralView(state).participants,loaded=decode(encode(state));assert.ok(loaded);assert.deepEqual(funeralView(loaded).participants,first);
});

test('the walking mourners spread on clear ground without moving saved citizens',async()=>{
 const {advanceFuneral}=await import('../funerals.js');
 const state=farewell(24);state.funeral=null;
 startFuneral(state,[{id:9990,name:'Покойный',x:8,y:8}]);
 for(let step=0;step<1000&&state.funeral.stage!=='procession';step++)advanceFuneral(state,.2);
 assert.equal(state.funeral.stage,'procession');
 for(let step=0;step<18&&state.funeral.stage==='procession';step++)advanceFuneral(state,.2);
 assert.equal(state.funeral.stage,'procession');
 const before=encode(state),people=funeralView(state).participants.filter(p=>p.role==='mourner');
 assert.equal(encode(state),before);
 assert.ok(people.every(p=>isDryPoint(state,p.x,p.y)));
 const positions=people.map(p=>[Math.round(p.x*100),Math.round(p.y*100)].join(','));
 assert.ok(new Set(positions).size>=people.length*.9);
 assert.ok(people.filter(p=>{
  const c=state.citizens.find(c=>c.id===p.id);
  return Math.hypot(p.x-c.x,p.y-c.y)>.07;
 }).length>=people.length*.5);
});

test('recessing releases small groups at different times and a mid-stage save preserves them',async()=>{
 const {advanceFuneral}=await import('../funerals.js');
 let state=farewell(24);state.funeral=null;
 startFuneral(state,[{id:9990,name:'Покойный',x:8,y:8}]);
 for(let step=0;step<1000&&state.funeral.stage!=='receding';step++)advanceFuneral(state,.1);
 assert.equal(state.funeral.stage,'receding');
 assert.ok(decode(encode(state)));
 const before=state.citizens.map(c=>[c.x,c.y]);
 advanceFuneral(state,.65);
 const early=state.citizens.filter((c,i)=>c.x!==before[i][0]||c.y!==before[i][1]).length;
 assert.ok(early>0&&early<state.citizens.length/2);
 const beforeSave=encode(state);state=decode(beforeSave);assert.ok(state);
 const standing=funeralView(state).participants.filter(p=>!p.walking).length;
 assert.ok(standing>state.citizens.length/2);
 for(let step=0;step<1000&&state.funeral;step++)advanceFuneral(state,.2);
 assert.equal(state.funeral,null);
});
