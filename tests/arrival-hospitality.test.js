import assert from 'node:assert/strict';
import test from 'node:test';
import {createNewCity} from '../new-game.js';
import {encode,decode} from '../engine.js';
import {recordArrivalHospitality,arrivalHospitalityView} from '../arrival-hospitality.js';

test('only completed provisioned visits count once, and receipts survive reload',()=>{
 const s=createNewCity({mode:'awakening',seed:1}),g={phase:'returning',outcome:'accepted',destination:'6,7'};
 recordArrivalHospitality(s,'envoy',g);
 assert.equal(arrivalHospitalityView(s).visits,0);
 g.phase='departed';g.outcome='interrupted';recordArrivalHospitality(s,'envoy',g);
 assert.equal(arrivalHospitalityView(s).visits,0);
 g.outcome='accepted';recordArrivalHospitality(s,'envoy',g);recordArrivalHospitality(s,'envoy',g);
 assert.equal(arrivalHospitalityView(s).visits,1);
 recordArrivalHospitality(s,'artisan',{phase:'departed',outcome:'taught',fed:true,home:'6,7'});
 assert.equal(arrivalHospitalityView(s).visits,2);
 const raw=encode(s);assert.equal(encode(decode(raw)),raw);
 const broken=JSON.parse(raw);broken.arrivalHospitality.receipts[0].at=100;
 assert.equal(decode(JSON.stringify(broken)),null);
});

test('only a served and arrived evacuee from the opposite bank records a hosting household',async()=>{
 const {recordArrivalShelter}=await import('../arrival-hospitality.js');
 const {signedRiverDistance}=await import('../world.js');
 const s=createNewCity({mode:'awakening',seed:1}),host=s.citizens[0],visitor=s.citizens[1];
 const b=s.buildings.find(b=>`${b.x},${b.y}`===host.home),side=Math.sign(signedRiverDistance(b.x,b.y,s));
 let origin;
 for(let x=0;x<64&&!origin;x++)for(let y=0;y<64&&!origin;y++)if(signedRiverDistance(x,y,s)*side < -3)origin={type:'house',x,y,level:1};
 s.buildings.push(origin);
 Object.assign(visitor,{home:`${origin.x},${origin.y}`,floodShelter:host.home,route:[{}],routeIndex:0});
 recordArrivalShelter(s,b,visitor,.8);assert.equal(arrivalHospitalityView(s).shelters,0);
 visitor.routeIndex=1;
 recordArrivalShelter(s,b,visitor,0);assert.equal(arrivalHospitalityView(s).shelters,0);
 const {advanceWellbeing}=await import('../wellbeing.js');
 s.simTime=35;b.pantry=20;b.pantryDelivered=20;
 const prior=b.pantry;
 advanceWellbeing(s,.25);advanceWellbeing(s,.25);
 assert.ok(b.pantry<prior);
 assert.equal(arrivalHospitalityView(s).shelters,1);
 assert.equal(arrivalHospitalityView(s).qualified,false);
});

test('arrival housing counts permanent residents and temporary evacuees, excluding closed houses',async()=>{
 const {arrivalHousing}=await import('../arrival-hospitality.js');
 const s=createNewCity({mode:'awakening',seed:1});
 s.buildings=[
  {type:'house',x:6,y:7,level:1,starterHut:true},
  {type:'house',x:8,y:7,level:1,starterHut:true},
  {type:'house',x:10,y:7,level:1,construction:{kind:'new'}}
 ];
 s.citizens=[{home:'6,7',floodShelter:'8,7'},{home:'8,7'},{home:'8,7'}];
 assert.deepEqual(arrivalHousing(s),[{home:'6,7',beds:3},{home:'8,7',beds:1}]);
});
