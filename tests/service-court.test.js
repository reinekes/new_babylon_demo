import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,encode,decode} from '../engine.js';
import {assignWorkplace,inspireCitizen} from '../management.js';
import {requestTransfer} from '../district-logistics.js';
import {putStock,storeStock} from '../inventory.js';
import {actorViewCitizens,residentViewPositions} from '../game3d/actors.js';
import {serviceStation,serviceApproach,freightGesture,canalWorkContact} from '../service-court.js';
import {workplaceActivity,workplaceIndex} from '../game3d/work-poses.js';

test('each quarter-turn keeps the receiving place and the offering within arm’s reach',()=>{
 const state=createGame({start:'established'});
 for(const type of ['market','harbor','depot','granary','shrine','ziggurat'])for(const rotation of [0,1,2,3]){
  const b={x:5,y:8,type,rotation,footprint:['market','ziggurat'].includes(type)?2:1};
  const port={x:b.x+b.footprint-.5,y:b.y+b.footprint-.5};
  const mode=['shrine','ziggurat'].includes(type)?'service':'receive';
  const path=serviceApproach(state,b,port,mode),{stand,target}=serviceStation(b,mode);
  assert.deepEqual(path.at(-1),stand,type+'/'+rotation);
  const distance=Math.hypot(target.x-stand.x,target.y-stand.y)*6;
  assert.ok(distance>.3&&distance<.8&&target.height>0,type);
 }
});

test('the named priest uses a bowl while a carrier takes one batch from the temple to the granary',()=>{
 let city=createGame({start:'established',mode:'mature'});
 for(const home of city.buildings.filter(b=>b.type==='house'))Object.assign(home,{pantry:13,pantryDelivered:13});
 assert.equal(inspireCitizen(city,0,'priest').success,true);
 assert.equal(assignWorkplace(city,0,'9,8').ok,true);
 const store='10,9';city.buildings.push({x:10,y:9,type:'granary',level:1});putStock(city,'9,8','wood',12);
 const order=requestTransfer(city,'9,8',store,'wood',6);assert.ok(order.ok);
 let prayer=false,collect=false,receive=false,owner;
 for(let i=0;i<5000;i++){
  city.event=null;advanceTime(city,.025);const actors=actorViewCitizens(city);
  if(!prayer){const c=actors.find(person=>person.id===0&&person.activity?.task==='offering');
   if(c){const contact=residentViewPositions(city,[c]).get(c.id)?.contact;prayer=contact?.kind==='offering'&&contact.via.length>0;}}
  for(const c of actors.filter(c=>c.districtJob===order.id&&c.freightHandoff)){
   const hand=c.freightHandoff;
   if(hand.kind==='collect'&&hand.progress>.5&&!collect){assert.equal(c.carrying,false);owner=c.id;collect=true;}
   if(hand.kind==='receive'&&hand.progress>.5&&!receive){
    assert.equal(c.id,owner);assert.equal(c.cargo.wood,6);assert.equal(storeStock(city,store,'wood'),0);
    const raw=encode(city);city=decode(raw);assert.ok(city);assert.equal(encode(city),raw);receive=true;
   }
  }
  if(city.district.jobs.find(job=>job.id===order.id)?.delivered===6)break;
 }
 assert.ok(prayer&&collect&&receive);assert.equal(storeStock(city,store,'wood'),6);
 assert.equal(freightGesture({phase:'toStore',route:[{x:0,y:0}],routeIndex:0,carrying:true,store},workplaceIndex(city)),null);
});

test('a silt worker targets the near bank of a connected channel and stops on clean ground',()=>{
 const city=createGame({start:'established'});
 const b={type:'canal',x:6,y:8,level:1,silt:.55,canalCleaning:true};city.buildings.push(b,{type:'canal',x:6,y:9,level:1});
 const c={id:5,phase:'working',age:31,x:6.5,y:8.5,work:'6,8'};
 c.activity=workplaceActivity(city,c,workplaceIndex(city));const contact=canalWorkContact(city,b,c);
 assert.equal(contact.stand.y,8.3);assert.ok(contact.stand.x>contact.target.x&&contact.target.x>6);
 delete b.canalCleaning;delete b.silt;c.activity=workplaceActivity(city,c,workplaceIndex(city));
 assert.equal(c.activity.stage,'waiting');assert.equal(canalWorkContact(city,b,c),null);
});

test('a healer in training handles a clay tablet in the temple during actual study',()=>{
 const city=createGame({start:'established'});
 for(const b of city.buildings.filter(b=>b.type==='house'))Object.assign(b,{pantry:13,pantryDelivered:13});
 city.rngState=2000;assert.ok(inspireCitizen(city,0,'healer').success);
 let seen=false;
 for(let i=0;i<240;i++){
  advanceTime(city,.12);const c=actorViewCitizens(city).find(p=>p.id===0);
  if(c?.phase!=='studying')continue;
  assert.equal(c.activity.task,'school-tablet');
  const contact=residentViewPositions(city,[c]).get(c.id)?.contact;
  assert.equal(contact?.kind,'study');assert.ok(contact.via.length);
  assert.equal(encode(decode(encode(city))),encode(city));seen=true;break;
 }
 assert.ok(seen);
});

test('both temple attendants can use opposite sides of the same bowl simultaneously',()=>{
 const city=createGame({start:'established'}),b=city.buildings.find(b=>b.type==='shrine');
 const attendants=[0,1].map(id=>({id,age:30,phase:'working',work:'9,8',x:9.5,y:8.5,
  activity:{kind:'work',task:'offering',stage:'working',target:b}}));
 const positions=residentViewPositions(city,attendants);
 const [first,second]=attendants.map(c=>positions.get(c.id)?.contact);
 assert.equal(first?.kind,'offering');assert.equal(second?.kind,'offering');
 assert.deepEqual(first.target,second.target);
 assert.ok(Math.hypot(first.stand.x-second.stand.x,first.stand.y-second.stand.y)*6>.6);
});
