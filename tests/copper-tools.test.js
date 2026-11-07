import test from 'node:test';
import assert from 'node:assert/strict';
import {build,createGame,advanceTime,decode,encode} from '../engine.js';
import {finishConstruction,workRequired} from '../construction.js';
import {assignWorkplace} from '../management.js';
import {syncCitizens} from '../workforce.js';
import {putStock} from '../inventory.js';
import {strictScenario} from '../scenario-profiles.js';

test('a copper workshop works delivered metal and fuel into an axe for the warehouse',()=>{
 const s=createGame({start:'established',scenario:strictScenario()});
 putStock(s,'9,8','copper',2);
 const result=build(s,'coppersmith',10,9);assert.ok(result.ok,result.reason);
 const b=s.buildings.at(-1);
 b.construction.delivered={...b.construction.required};
 for(const k of Object.keys(b.construction.remaining))b.construction.remaining[k]=0;
 b.construction.work=workRequired(b);assert.ok(finishConstruction(s));
 syncCitizens(s);assert.ok(assignWorkplace(s,0,'10,9').ok);assert.ok(assignWorkplace(s,1,'10,9').ok);
 let worked=false;
 for(let i=0;i<2400&&s.resources.axe<1;i++){
  s.event=null;advanceTime(s,.1);worked||=b.artisan.stage==='castingAxe';
  if(i%30===0)assert.ok(decode(encode(s)));
 }
 assert.ok(worked);
 assert.equal(s.resources.axe,1);
 assert.equal(s.resources.copper,0);
 assert.ok(s.district.jobs.some(q=>q.source==='10,9'&&q.resource==='axe'&&q.delivered===1));
});

test('a logging yard equips a delivered axe and restores a worn edge with real copper',async()=>{
 const {putBuildingInput,buildingInputRoom}=await import('../building-inventory.js');
 const s=createGame({start:'established',scenario:strictScenario()});
 const b={type:'logging',level:1,x:4,y:4};
 assert.equal(buildingInputRoom(s,b,'axe'),1);
 assert.equal(putBuildingInput(s,b,'axe',1),1);
 assert.equal(b.axeKit.edge,6);
 assert.equal(buildingInputRoom(s,b,'axe'),0);
 b.axeKit.edge=0;
 assert.equal(putBuildingInput(s,b,'copper',.5),.5);
 assert.equal(b.axeKit.edge,0);
 assert.equal(putBuildingInput(s,b,'copper',.5),.5);
 assert.equal(b.axeKit.edge,6);
 assert.equal(b.axeKit.copper,0);
});

test('copper is sold by visiting merchants and reaches storage through an actual purchase',async()=>{
 const {trade}=await import('../trading.js');
 let s=createGame({start:'established',scenario:strictScenario()});
 assert.ok(build(s,'market',10,9).ok);
 for(let i=0;i<3000&&s.trade.caravan?.phase!=='trading';i++){s.event=null;advanceTime(s,.1);}
 assert.ok(s.trade.caravan?.stock.copper>0);
 assert.ok(trade(s,'copper','buy',2).ok);
 assert.equal(s.resources.copper,0);
 let carried=false;
 for(let i=0;i<1200&&s.resources.copper<2;i++){
  s.event=null;advanceTime(s,.1);
  if(!carried&&s.citizens.some(c=>c.tradeJob&&c.cargo.copper>0)){
   const raw=encode(s);s=decode(raw);assert.ok(s);assert.equal(encode(s),raw);carried=true;
  }
 }
 assert.ok(carried);
 assert.equal(s.resources.copper,2);
});

test('a delivered axe wears only after the logging yard produces real wood',async()=>{
 const {stampBuildingCompletion}=await import('../building-chronology.js');
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const site=s.world.deposits.find(d=>d.kind==='forest'&&d.x<12);
 const yard={type:'logging',x:site.x,y:site.y,level:1};
 s.buildings.push(yard);stampBuildingCompletion(s,yard);syncCitizens(s);
 putStock(s,'9,8','axe',1);
 for(let i=0;i<1600&&!(yard.axeKit?.edge<6);i++){s.event=null;advanceTime(s,.1);}
 assert.equal(s.resources.axe,0);
 assert.ok(yard.axeKit.edge>=4&&yard.axeKit.edge<=5);
 assert.ok(s.district.jobs.some(q=>q.target===`${yard.x},${yard.y}`&&q.resource==='axe'&&q.delivered===1));
 assert.ok(s.citizens.some(c=>c.work===`${yard.x},${yard.y}`&&c.cargo.wood>0));
 const raw=encode(s);assert.equal(encode(decode(raw)),raw);
});

test('copper workshop saves its selected product and cannot switch a funded batch in progress',async()=>{
 const {initializeArtisans,workArtisan,collectArtisan,setCopperProduct}=await import('../artisan.js');
 const s=createGame({start:'established',scenario:strictScenario()});
 const b={type:'coppersmith',level:1,x:10,y:9};s.buildings.push(b);initializeArtisans(s);
 assert.ok(setCopperProduct(s,b,'chisel').ok);
 b.artisan.copper=2;b.artisan.reed=2;
 workArtisan(b,1,s);
 assert.equal(setCopperProduct(s,b,'blade').ok,false);
 syncCitizens(s);
 const restored=decode(encode(s));assert.ok(restored);
 const shop=restored.buildings.at(-1);
 assert.equal(shop.toolProduct,'chisel');
 workArtisan(shop,14,restored);assert.equal(shop.productionHistory[0].resources.chisel,1);
 assert.equal(collectArtisan(shop),1);
 assert.ok(setCopperProduct(restored,shop,'blade').ok);
});

test('a quarry takes only its own delivered tool and uses copper for repair',async()=>{
 const {buildingInputRoom,putBuildingInput}=await import('../building-inventory.js');
 const s=createGame({start:'established',scenario:strictScenario()});
 const b={type:'quarry',level:1,x:4,y:4};
 assert.equal(buildingInputRoom(s,b,'axe'),0);
 assert.equal(putBuildingInput(s,b,'chisel',1),1);
 assert.equal(b.toolKit.edge,6);
 b.toolKit.edge=0;
 assert.equal(putBuildingInput(s,b,'copper',1),1);
 assert.equal(b.toolKit.edge,6);
});
