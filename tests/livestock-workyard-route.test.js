import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.js';
import {generateStreets} from '../city-life.js';
import {actorViewCitizens,residentViewPositions} from '../game3d/actors.js';
import {artisanWalk} from '../game3d/artisan-contacts.js';
import {sheepfoldLayout,sheepfoldWorldPoint} from '../sheepfold-layout.js';
import {startManagedDairy} from '../dairy.js';

for(const type of ['cowshed','sheepfold'])test(type+' workers walk from the two-tile street corner to their equipment',()=>{
 const s=createGame({start:'established'});
 for(const rotation of [0,1,2,3]){
  const b={type,x:10,y:9,level:1,rotation,footprint:2};
  if(type==='cowshed'){startManagedDairy(b);Object.assign(b.dairy,{reed:12,water:18});}
  else b.flock={fleece:2};
  s.buildings=[b];
  const port=generateStreets(s.buildings,s).ports[0];
  const c={...s.citizens[0],id:1,age:30,phase:'working',work:'10,9',workplace:'10,9',role:'production',x:port.x,y:port.y};
  s.citizens=[c];
  const views=actorViewCitizens(s),contact=residentViewPositions(s,views).get(c.id)?.contact;
  assert.equal(contact?.kind,type==='cowshed'?'dairy':'fleece',type+' '+rotation);
  if(type==='cowshed'){
   const gate=sheepfoldWorldPoint(b,0,sheepfoldLayout(b).halfWidth,0);
   assert.ok(contact.via.some(p=>Math.hypot(p.x-gate.x,p.y-gate.y)*6<.9),'walk crosses the open gate');
  }else assert.ok(Math.hypot(contact.stand.x-port.x,contact.stand.y-port.y)*6<1,'fleece rack faces the street');
  const actor={lastX:port.x,lastY:port.y};
  let last=port,walk,steps=0;
  do{
   walk=artisanWalk(actor,contact,c,.05,1,false);
   const p=walk?{x:walk.x,y:walk.y}:contact.stand;
   assert.ok(Math.hypot(p.x-last.x,p.y-last.y)*6<=(contact.aisleSpeed??1.4)*.05+.001);
   last=p;
  }while(walk&&++steps<800);
  assert.ok(steps<800&&steps>1,JSON.stringify({steps,rotation,via:contact.via}));
 }
});
