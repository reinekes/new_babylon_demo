import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.js';
import {generateStreets} from '../city-life.js';
import {productionOutputFits} from '../building-inventory.js';
import {workplaceActivity,workplaceIndex} from '../game3d/work-poses.js';
import {residentViewPositions} from '../game3d/resident-motion.js';
import {artisanWalk} from '../game3d/artisan-contacts.js';
import {waterCarrierAtBank} from '../game3d/water-carrier.js';
import {renderedShoreDistance} from '../game3d/shore-profile.js';
import {riverPoint} from '../world.js';

const tasks={bakery:['milling','baking'],linenYard:['preparingFiber','weavingLinen'],basketry:['weavingBasket'],matYard:['weavingMat'],coppersmith:['castingAxe'],joineryYard:['cuttingJoinery'],dairyStore:['preservingMilk'],granary:['account']};

test('both artisan places remain usable on all four rotations and three levels, including a freshly loaded worker',()=>{
 const s=createGame({start:'established'});s.simTime=4;
 for(const [type,stages] of Object.entries(tasks))for(const task of stages)for(const level of [1,2,3])for(let rotation=0;rotation<4;rotation++){
  const b={type,x:6,y:10,level,rotation,artisan:{stage:task}};s.buildings=[b];const p=generateStreets([b],s).ports[0];
  const workers=[1,2].map(id=>({id,age:29,phase:'working',calling:'scribe',role:'production',workplace:'6,10',work:'6,10',x:p.x,y:p.y}));
  for(const c of workers)c.activity=workplaceActivity(s,c,workplaceIndex(s));
  const result=residentViewPositions(s,workers);
  for(const c of workers){const q=result.get(c.id),k=q.contact;assert.ok(k,JSON.stringify([type,task,level,rotation,c.id]));assert.equal(k.task,task);
   const a={lastX:null,lastY:null};assert.equal(artisanWalk(a,k,c,0,1,true),null);
   a.lastX=q.x;a.lastY=q.y;assert.equal(artisanWalk(a,k,c,.1,1,false),null,'reload at a station does not walk back through its doorway');
   const walking=artisanWalk(a,null,{...c,x:p.x,y:p.y},.05,1,false);assert.ok(walking);
  }
  assert.ok(Math.hypot(result.get(1).x-result.get(2).x,result.get(1).y-result.get(2).y)*6>.6);
 }
});
test('artisan work stops on a full local output shelf and can resume after a pickup',()=>{
 const s=createGame(),b={type:'bakery',x:6,y:10,level:1,artisan:{stage:'baking'},workshopStock:{input:{},output:{food:10000}}};s.buildings=[b];
 const c={id:1,age:30,phase:'working',work:'6,10'};assert.equal(productionOutputFits(s,b),false);assert.equal(workplaceActivity(s,c,workplaceIndex(s)).stage,'waiting');
 b.workshopStock.output={};assert.equal(workplaceActivity(s,c,workplaceIndex(s)).stage,'working');
});
test('the filling vessel meets the main-view river while feet stay on the bank, without writing trip coordinates',()=>{
 const s=createGame();s.buildings=[];const endpoint=riverPoint(9,s,1.88),c={...endpoint,waterTrip:{phase:'fill',index:1,route:[endpoint],elapsed:1}};
 const before=JSON.stringify(c),view=waterCarrierAtBank(s,c);assert.equal(view.walking,false);assert.ok(renderedShoreDistance(view.x,view.y,s)>0);assert.ok(renderedShoreDistance(view.waterDip.x,view.waterDip.y,s)<0);assert.equal(JSON.stringify(c),before);
});
test('actual extraction workers at the source receive the matching tool and a reachable display point',async()=>{
 const {workstationHands}=await import('../game3d/workstations.js'),s=createGame();
 for(const [task,tool] of Object.entries({clay:'clay-hoe',quarry:'quarry',reed:'reed-knife',garden:'date-pole',logging:'logging'})){
  const b={type:task,x:6,y:10,footprint:2};s.buildings=[b];
  const c={id:89,work:'6,10',phase:'working',x:6.31,y:10,activity:{kind:'gathering',task,stage:'strike',target:{id:'deposit:6,10:0',x:6,y:10}}};
  const contact=residentViewPositions(s,[c]).get(c.id).contact;assert.equal(contact?.kind,'gathering-site',task);
  assert.equal(workstationHands(contact,.5).tool,tool);assert.ok(Math.hypot(contact.stand.x-c.x,contact.stand.y-c.y)<.35);
 }
});
