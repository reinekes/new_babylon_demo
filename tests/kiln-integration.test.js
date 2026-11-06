import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,advanceTime,decode,encode,build,upgradeCost,BUILDINGS} from '../engine.js';
import {initializeKilns} from '../kilns.js';import {putStock} from '../inventory.js';
import {syncCitizens,recoverCitizenCargo} from '../workforce.js';import {assignWorkplace,setCitizenRole,canDemolish,demolitionRefund} from '../management.js';
const fixture=()=>{const s=createGame({start:'established'});s.buildings.push({type:'kiln',x:10,y:9,level:1});initializeKilns(s);syncCitizens(s);putStock(s,'9,8','brick',8);assignWorkplace(s,0,'10,9');assignWorkplace(s,1,'10,9');return s;};
const incoming=(s,c,k)=>c.craftSite==='10,9'&&c.craftMaterial===k?(c.craftAmount||0):s.district?.jobs.some(q=>q.id===c.districtJob&&q.target==='10,9'&&q.resource===k)?c.cargo?.[k]||0:0;
test('kiln needs only existing materials to build; upper homes and monument need fired facing',()=>{const s=createGame({start:'established'});assert.ok(!BUILDINGS.kiln.firedBrick);assert.equal(build(s,'kiln',10,9).ok,false);putStock(s,'9,8','brick',12);assert.ok(build(s,'kiln',10,9).ok);assert.ok(decode(encode(s)));assert.equal(upgradeCost({type:'house',level:1}).firedBrick,undefined);assert.equal(upgradeCost({type:'house',level:2}).firedBrick,30);assert.equal(BUILDINGS.ziggurat.firedBrick,40);});
test('real raw/fuel couriers, ignition, cooling and finished-brick courier preserve every brick',()=>{const s=fixture(),b=s.buildings.at(-1);let raw=false,fuel=false,hot=false,cool=false,cargo=false;for(let i=0;i<2400;i++){s.event=null;advanceTime(s,.1);raw||=s.citizens.some(c=>incoming(s,c,'brick')>0);fuel||=s.citizens.some(c=>incoming(s,c,'reed')>0);hot||=b.firing.hot>0;cool||=b.firing.time>=20;cargo||=s.citizens.some(c=>c.cargo.firedBrick>0);const hands=s.citizens.reduce((n,c)=>n+incoming(s,c,'brick')+(c.cargo.firedBrick||0),0);assert.ok(Math.abs(s.resources.brick+s.resources.firedBrick+b.firing.brick+b.firing.hot+b.firing.ready+(b.workshopStock?.output?.firedBrick||0)+hands-8)<1e-6);const fuelHands=s.citizens.reduce((n,c)=>n+incoming(s,c,'reed'),0),made=s.resources.firedBrick+(b.workshopStock?.output?.firedBrick||0)+b.firing.hot+b.firing.ready+s.citizens.reduce((n,c)=>n+(c.cargo.firedBrick||0),0);assert.ok(Math.abs(s.resources.reed+b.firing.reed+fuelHands+made*.75-45)<1e-6);assert.ok(decode(encode(s)),`save at ${i}`);if(s.resources.firedBrick>=4)break;}assert.ok(raw&&fuel&&hot&&cool&&cargo);assert.equal(s.resources.firedBrick,4);});
test('no staff means no ignition, and hot kiln cannot be demolished',()=>{const s=fixture(),b=s.buildings.at(-1);for(const c of s.citizens)if(c.age>=16)setCitizenRole(s,c.id,'carrier');Object.assign(b.firing,{brick:4,reed:3});advanceTime(s,20);assert.equal(b.firing.hot,0);assert.equal(s.resources.firedBrick,0);b.firing.brick=0;b.firing.reed=0;b.firing.hot=4;assert.match(canDemolish(s,b),/обжига/);});
test('interrupted ingredient delivery returns its original material exactly once',()=>{const s=fixture();let c;for(let i=0;i<600;i++){advanceTime(s,.1);c=s.citizens.find(c=>incoming(s,c,'brick')>0);if(c)break;}assert.ok(c);const n=incoming(s,c,'brick'),before=s.resources.brick;recoverCitizenCargo(s,c.id);assert.equal(s.resources.brick,before+n);recoverCitizenCargo(s,c.id);assert.equal(s.resources.brick,before+n);assert.ok(decode(encode(s)));});
test('v18 resources, workers and paid recipes survive; old monuments cannot refund unpaid fired brick',async()=>{const {readFileSync}=await import('node:fs');const old=JSON.parse(readFileSync(new URL('./fixtures/legacy-v18-kiln.json',import.meta.url))),s=decode(JSON.stringify(old));assert.ok(s);assert.equal(s.version,30);for(const [k,v]of Object.entries(old.resources))assert.equal(s.resources[k],v);assert.deepEqual(s.citizens,old.citizens);for(let i=0;i<old.buildings.length;i++)if(old.buildings[i].construction){assert.deepEqual(s.buildings[i].construction.required,old.buildings[i].construction.required);assert.equal(s.buildings[i].construction.legacyFiring,true);}assert.equal(s.resources.firedBrick,0);assert.equal(demolitionRefund({type:'ziggurat',level:1,legacyFiringLevel:1}).firedBrick,undefined);assert.equal(demolitionRefund({type:'ziggurat',level:1}).firedBrick,20);assert.ok(decode(encode(s)));});

test('finishing an already paid v18 upgrade never creates a fired-brick demolition refund',async()=>{const{readFileSync}=await import('node:fs');const{finishConstruction,workRequired}=await import('../construction.js');const s=decode(readFileSync(new URL('./fixtures/legacy-v18-kiln.json',import.meta.url),'utf8')),b=s.buildings[0];assert.equal(b.construction.target,3);b.construction.delivered={...b.construction.required};b.construction.remaining=Object.fromEntries(Object.keys(b.construction.required).map(k=>[k,0]));b.construction.work=workRequired(b);finishConstruction(s);assert.equal(b.legacyFiringLevel,3);assert.equal(demolitionRefund(b).firedBrick,undefined);});

test('strict kiln repair consumes delivered raw brick and waits for a worker across a save',async()=>{
 const {strictScenario}=await import('../scenario-profiles.js');
 const {finishConstruction,workRequired}=await import('../construction.js');
 const {KILN_WEAR_LIMIT,startFiring}=await import('../kilns.js');
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 putStock(s,'9,8','brick',30);
 assert.ok(build(s,'kiln',10,9).ok);
 const b=s.buildings.at(-1),order=b.construction;
 order.delivered={...order.required};order.remaining=Object.fromEntries(Object.keys(order.required).map(k=>[k,0]));order.sources={};order.work=workRequired(b);
 assert.ok(finishConstruction(s));
 assert.equal(b.kilnWear,0);
 b.kilnWear=KILN_WEAR_LIMIT;
 Object.assign(b.firing,{brick:4,reed:3});
 assert.equal(startFiring(b),0);
 Object.assign(b.firing,{brick:0,reed:0});
 for(const c of s.citizens)if(c.age>=16)setCitizenRole(s,c.id,'carrier');
 advanceTime(s,2);
 assert.equal(b.kilnWear,KILN_WEAR_LIMIT);
 assert.ok(setCitizenRole(s,0,'auto').ok);

 assert.ok(assignWorkplace(s,0,'10,9').ok);
 const initialBrick=s.resources.brick;
 let repaired=false,loaded=false,restored=s;
 for(let i=0;i<1100&&!repaired;i++){
  restored.event=null;
  advanceTime(restored,.1);
  const kiln=restored.buildings.at(-1);
  if(!loaded&&restored.citizens.some(c=>incoming(restored,c,'brick')>0)){
   const raw=encode(restored);
   restored=decode(raw);
   assert.ok(restored);
   assert.equal(encode(restored),raw);
   loaded=true;
  }
  repaired=kiln.kilnWear===0;
 }
 assert.ok(loaded&&repaired);
 assert.equal(restored.buildings.at(-1).firing.hot,0);
 assert.equal(restored.resources.brick,initialBrick-1);
 for(let i=0;i<1800&&restored.buildings.at(-1).kilnWear===0;i++){
  restored.event=null;
  advanceTime(restored,.1);
 }
 assert.equal(restored.buildings.at(-1).kilnWear,1);
});
