import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY_SECONDS} from '../city-life.js';
import {legacyScenario,strictScenario} from '../scenario-profiles.js';
import {createHomeVisits} from '../game3d/home-visits.js';
import {workHourAt,residentDepartureHour} from '../work-schedule.js';

const house={type:'house',x:6,y:11,level:1,rotation:0};
function city(b=house,scenario=strictScenario()){
 const home=b.x+','+b.y,c={id:7,x:b.x,y:b.y-1,age:41,phase:'home',home,cargo:{},route:[]};
 return {buildings:[{...b}],citizens:[c],simTime:0,scenario};
}
const simulationSecondsPerVisitSecond=DAY_SECONDS/(24*20);
const seen=(s,view,time,street=[])=>{s.simTime=time*simulationSecondsPerVisitSecond;return view(s,street);};
const distance=(a,b)=>Math.hypot((a.x-b.x)*6,(a.y-b.y)*6,a.homeVisit.height-b.homeVisit.height);

test('all five house forms have reachable seating and an enclosed threshold; roofs use a ladder or eleven stairs',()=>{
 for(const catalogue of [true,false])for(const [b,scenario,expected] of [
  [house,strictScenario(),['bench','roof']],[{...house,level:2},strictScenario(),['bench','roof']],
  [{...house,level:3},strictScenario(),['bench','roof']],[{...house,starterHut:true},legacyScenario(),['mat']],
  [{...house,reedCamp:true},strictScenario(),['mat']]
 ]){
  const view=createHomeVisits(()=>catalogue),s=city(b,scenario),sit=new Set();let prev=null,climbed=false;
  for(let t=0;t<1200;t+=.25){
   const [actor]=seen(s,view,t);
   if(!actor){prev=null;continue;}
   if(prev)assert.ok(distance(prev,actor)<.28,'continuous walking route, including steps');
   const v=actor.homeVisit;
   if(v.climbing){climbed=true;assert.equal(v.yaw,-Math.PI/2);}
   if(!actor.walking&&!v.morning){sit.add(v.stage);assert.ok(v.seatHeight>0);assert.ok(workHourAt(s.simTime)<19&&workHourAt(s.simTime)>=6);}
   prev=actor;
  }
  assert.deepEqual([...sit].sort(),expected);
  assert.equal(climbed,b.level<3&&!b.reedCamp&&!b.starterHut);
 }
});

test('rotating the home carries its real bench, outward facing, and terrace as a single object',()=>{
 const base=city(),turned=city({...house,rotation:1}),a=createHomeVisits(),b=createHomeVisits();let measures=0;
 for(let t=0;t<660;t+=1){
  const [x]=seen(base,a,t),[y]=seen(turned,b,t);if(!x?.homeVisit.seatHeight)continue;
  assert.ok(Math.abs((x.y-house.y)-(y.x-house.x))<1e-7);assert.ok(Math.abs((x.x-house.x)+(y.y-house.y))<1e-7);
  assert.equal(x.homeVisit.height,y.homeVisit.height);assert.ok(Math.abs(y.homeVisit.yaw-x.homeVisit.yaw-Math.PI/2)<1e-7);measures++;
 }
 assert.ok(measures>12);
});

test('night return follows the street corner and the doorway; pantry goods remain visible until inside',()=>{
 const s=city(),view=createHomeVisits(),c=s.citizens[0];c.phase='toPantryHome';c.pantryFood=2;
 seen(s,view,275,[{...c,carrying:true,cargo:{food:2}}]);c.phase='home';c.pantryFood=0;const end=structuredClone(c);
 let last=null,crossed=false,hidden=false;
 for(let t=275.1;t<320;t+=.1){
  const [v]=seen(s,view,t);if(!v){hidden=true;continue;}assert.equal(hidden,false,'stayed indoors');
  assert.deepEqual(v.cargo,{food:2});assert.equal(v.carrying,true);assert.equal(v.homeVisit.stage,'enter');
  if(!last){assert.equal(v.x,c.x);assert.equal(v.y,c.y);}else assert.ok(distance(v,last)<.113);
  if(v.homeVisit.height>.125)crossed=true;last=v;
 }
 assert.ok(crossed&&hidden);assert.ok(Math.abs((last.x-house.x)*6+.23)<.06);assert.ok((last.y-house.y)*6<-.4);
 assert.deepEqual(c,end);
});

test('a resident returns from the roof on the same access before joining a real street route',()=>{
 const s=city(),view=createHomeVisits(),c=s.citizens[0];let t=0,top;
 for(;t<700;t+=.2){[top]=seen(s,view,t);if(top?.homeVisit.stage==='roof')break;}
 assert.equal(top.homeVisit.stage,'roof');c.phase='toWork';c.route=[{x:c.x,y:c.y},{x:c.x-1,y:c.y}];c.routeIndex=1;
 let previous=top,onLadder=false,onRoad=false;
 for(let i=0;i<300;i++){
  const real={...c,walking:true},[v]=seen(s,view,t+i*.15,[real]);
  if(!v.homeVisit){onRoad=true;break;}
  assert.equal(v.homeVisit.stage,'leave');assert.ok(distance(v,previous)<.17);
  onLadder||=v.homeVisit.climbing;previous=v;
 }
 assert.ok(onLadder&&onRoad);
});

test('household members share one seat, children reach the door after play, and cargo and emergencies keep priority',()=>{
 const s=city(),view=createHomeVisits(),c=s.citizens[0];s.citizens.push({...c,id:8},{...c,id:9,age:7},{...c,id:10,cargo:{clay:1}},{...c,id:11,fireShelter:'x'});const ids=new Set();
 for(let t=0;t<1400;t+=.5){
  const residents=seen(s,view,t);assert.ok(residents.filter(p=>p.homeVisit?.seatHeight).length<=1);
  for(const a of residents){assert.ok([7,8].includes(a.id));if(a.homeVisit.seatHeight)ids.add(a.id);}
 }
 assert.deepEqual([...ids].sort(),[7,8]);
 const child=s.citizens[2];const yard={...child,playing:true,x:child.x+.2,y:child.y+.2};assert.ok(seen(s,view,280,[yard]).includes(yard));
 const cameIn=seen(s,view,280.1,[]).find(p=>p.id===child.id);assert.equal(cameIn.homeVisit.stage,'enter');assert.equal(cameIn.x,yard.x);
 const paused=seen(s,view,280.1,[]).find(p=>p.id===child.id);assert.deepEqual(paused,cameIn);
 s.funeral={scope:'city'};const ceremonial={...c,eventContact:{}};assert.deepEqual(seen(s,view,280.2,[ceremonial]),[ceremonial]);
});

test('residents staying indoors do not repeatedly query the house model or deck',()=>{
 const s=city(),family=s.citizens[0];
 s.citizens=Array.from({length:80},(_,id)=>({...family,id}));
 let modelReads=0,deckReads=0;
 const view=createHomeVisits(()=>{modelReads++;return true;},()=>{deckReads++;return null;});
 for(let i=0;i<20;i++){
  modelReads=0;deckReads=0;
  const people=seen(s,view,i*.1);
  assert.ok(modelReads<=1,'only the resident with the seat can need the model');
  assert.equal(deckReads,people.length,'only visible outings need the deck height');
 }
});

test('a raised house enters from the dry timber stairs before using its deck and its elevated roof',()=>{
 const s=city(),c=s.citizens[0],p={half:2.95,run:.88,wetDirection:[-1,0],lift:.55},view=createHomeVisits(()=>true,()=>p);
 c.phase='toHome';seen(s,view,270,[c]);c.phase='home';
 let atStairs=false,atDoor=false,roof=false;
 for(let t=270.1;t<1200;t+=.1){
  const [v]=seen(s,view,t);if(!v)continue;
  const x=(v.x-house.x)*6,z=(v.y-house.y)*6,h=v.homeVisit;
  if(h.stage==='enter'&&x>p.half&&x<p.half+p.run&&Math.abs(z)<.02)atStairs=true;
  if(h.stage==='enter'&&h.height>.125&&h.deck===p.lift)atDoor=true;
  if(h.stage==='roof'){assert.equal(h.deck+h.height,p.lift+2.175);roof=true;break;}
 }
 assert.ok(atStairs&&atDoor&&roof);
});

test('communal residents reach the left bench and the right roof of the rotated four-cell plot',()=>{
 for(let rotation=0;rotation<4;rotation++){
  const b={type:'communalHouse',x:6,y:11,footprint:2,rotation};
  const s=city(b),view=createHomeVisits(),seats=new Set();
  const yaw=rotation*Math.PI/2,cos=Math.cos(yaw),sin=Math.sin(yaw);
  for(let t=0;t<1200;t+=.25){
   const [actor]=seen(s,view,t);
   if(!actor||actor.walking||actor.homeVisit.morning)continue;
   const stage=actor.homeVisit.stage;seats.add(stage);
   const [x,z,height]=stage==='bench'?[3.21,actor.homeVisit.companion===0?1.02:1.87,.065]:[-4.12,-.12,2.525];
   assert.ok(Math.abs(actor.x-(b.x+.5+(x*cos+z*sin)/6))<1e-8);
   assert.ok(Math.abs(actor.y-(b.y+.5+(z*cos-x*sin)/6))<1e-8);
   assert.equal(actor.homeVisit.height,height);
  }
  assert.deepEqual([...seats].sort(),['bench','roof']);
 }
});

test('a free resident sits at dusk and a late-returning housemate walks in before joining the conversation',()=>{
 const b={...house,type:'communalHouse',footprint:2},s=city(b),visit=createHomeVisits(),first=s.citizens[0];
 const late={...first,id:8,phase:'toHome',x:b.x+.5,y:b.y+.5+5.55/6};
 const ill={...first,id:9,health:44},carrier={...first,id:10,cargo:{food:1}},guard={...first,id:11,guardPost:'4,2'};
 const infant={...first,id:12,age:1,parents:[13]},parent={...first,id:13};
 s.citizens.push(late,ill,carrier,guard,infant,parent);
 let alone=false,entered=false,walkedOut=false,paired=0;
 for(let clock=183;clock<320;clock+=.2){
  s.simTime=clock*simulationSecondsPerVisitSecond;
  if(clock>285)late.phase='home';
  const cast=visit(s,late.phase==='toHome'?[late]:[],'sunny'),courtyard=cast.filter(c=>c.homeVisit);
  assert.ok(courtyard.every(c=>c.id===first.id||c.id===late.id));
  const early=courtyard.find(c=>c.id===first.id),arriving=courtyard.find(c=>c.id===late.id);
  if(workHourAt(s.simTime)<18&&early?.homeVisit.stage==='bench'){
   alone=true;assert.equal(early.homeVisit.speaking,undefined);
   const replay=createHomeVisits()(structuredClone(s),[late],'sunny').find(c=>c.id===first.id);
   assert.deepEqual([replay.x,replay.y,replay.homeVisit],[early.x,early.y,early.homeVisit]);
  }
  if(arriving?.homeVisit.stage==='enter')entered=true;
  if(arriving?.homeVisit.stage==='out'){assert.ok(entered);walkedOut=true;}
  if(arriving?.homeVisit.stage==='bench'&&early?.homeVisit.stage==='bench'){
   assert.ok(walkedOut);assert.equal([arriving,early].filter(c=>c.homeVisit.speaking).length,1);paired++;
  }
 }
 assert.ok(alone&&entered&&walkedOut&&paired>15);
});

test('a separate family funeral leaves the communal bench open for nonparticipants',()=>{
 const s=city({...house,type:'communalHouse'}),resident=s.citizens[0],mourner={...resident,id:42};
 s.citizens.push(mourner);s.funeral={scope:'family'};
 const visible={...mourner,phase:'mourning',funeralContact:{walking:true}},visit=createHomeVisits();
 s.simTime=235*simulationSecondsPerVisitSecond;const cast=visit(s,[visible],'sunny');
 assert.equal(cast.find(c=>c.id===resident.id)?.homeVisit?.stage,'bench');
 assert.equal(cast.find(c=>c.id===mourner.id),visible);
 s.funeral={scope:'city'};assert.deepEqual(visit(s,[visible],'sunny'),[visible]);
});

test('two housemates speak in turn from different places on the communal bench, another reaches the roof and walks down in rain',()=>{
 const b={...house,type:'communalHouse',footprint:2},s=city(b),visit=createHomeVisits();
 s.citizens=Array.from({length:8},(_,id)=>({...s.citizens[0],id}));
 const frame=(clock,wet=false)=>{s.simTime=clock*simulationSecondsPerVisitSecond;return visit(s,[],wet?'rain':'sunny');};
 const speaks=new Set();let roof,previous,clock=219;
 for(;clock<272;clock+=.25){
  const actors=frame(clock),benches=actors.filter(p=>p.homeVisit.stage==='bench');roof=actors.find(p=>p.homeVisit.stage==='roof');
  assert.equal(new Set(actors.map(c=>c.id)).size,actors.length);
  if(benches.length!==2||!roof)continue;
  assert.ok(Math.hypot(benches[0].x-benches[1].x,benches[0].y-benches[1].y)*6>1);
  const talking=benches.filter(p=>p.homeVisit.speaking);assert.equal(talking.length,1);speaks.add(talking[0].id);
  if(speaks.size===2){previous=roof;break;}
 }
 assert.equal(speaks.size,2);assert.ok(previous.homeVisit.height>2);
 let descended=false,inside=false;
 for(let t=clock+.15;t<clock+28;t+=.15){
  const actors=frame(t,true);assert.ok(!actors.some(p=>p.homeVisit.stage==='roof'||p.homeVisit.stage==='bench'));
  const p=actors.find(c=>c.id===roof.id);
  if(!p){inside=true;break;}
  assert.equal(p.homeVisit.stage,'enter');assert.ok(distance(p,previous)<.20);
  if(p.homeVisit.height<.10)descended=true;previous=p;
 }
 assert.ok(descended&&inside);
 const restored=JSON.parse(JSON.stringify(s));assert.ok(!createHomeVisits()(restored,[],'rain').some(p=>p.homeVisit.stage==='roof'));
});

test('each free adult crosses their actual morning threshold, pauses in the court and resumes through a saved morning',async()=>{
 const {createGame,encode,decode}=await import('../engine.js');
 const state=createGame({start:'established'}),adults=state.citizens.filter(c=>c.age>=16),view=createHomeVisits();
 state.citizens.forEach(c=>{c.phase='home';c.diningUntil=0;});
 const visited=new Set();let restored=false;
 for(let time=52.4;time<63.7;time+=.025){
  state.simTime=state.calendarOffset=time;
  const cast=view(state,[],'sunny');
  for(const a of cast.filter(p=>p.homeVisit?.morning)){
   const scheduled=residentDepartureHour(undefined,a.id);assert.ok(workHourAt(time)+1e-7>=scheduled);
   if(a.homeVisit.stage==='courtyard')visited.add(a.id);
   if(!restored&&a.homeVisit.stage==='out'&&workHourAt(time)>scheduled+.04){
    const loaded=decode(encode(state));assert.ok(loaded);const replay=createHomeVisits()(loaded,[],'sunny').find(p=>p.id===a.id);
    assert.deepEqual([replay.x,replay.y,replay.homeVisit],[a.x,a.y,a.homeVisit]);restored=true;
   }
  }
 }
 assert.deepEqual([...visited].sort(),adults.map(c=>c.id).sort());assert.ok(restored);
});

test('a porch visitor continues out to a newly assigned job without going back through the room',()=>{
 const s=city(),view=createHomeVisits(),c=s.citizens[0],start=((residentDepartureHour(undefined,c.id)-8+24)%24)*20;
 const frame=t=>{s.simTime=t*simulationSecondsPerVisitSecond;return view(s,c.phase==='home'?[]:[{...c,walking:true}],'sunny').find(p=>p.id===c.id);};
 let t=start,prior;for(;t<start+6;t+=.1){prior=frame(t);if(prior?.homeVisit.stage==='courtyard')break;}
 assert.equal(prior.homeVisit.stage,'courtyard');c.phase='toWork';c.route=[{x:c.x,y:c.y},{x:c.x+1,y:c.y}];c.routeIndex=1;
 let onStreet=false;const sill=(prior.y-house.y)*6;
 for(let i=0;i<240;i++){const actor=frame(t+i*.1);if(!actor.homeVisit){onStreet=true;break;}assert.equal(actor.homeVisit.stage,'leave');assert.ok(distance(prior,actor)<.12);if(i<10)assert.ok((actor.y-house.y)*6>sill-.4,'starts toward the gate at the current court position');prior=actor;}
 assert.ok(onStreet);
});

test('an infant and the parent caring for them, a sick resident, a watchman and a loaded courier keep their duties',()=>{
 const s=city(),c=s.citizens[0],view=createHomeVisits();s.citizens=[{...c,id:0,age:1,parents:[1]},{...c,id:1},{...c,id:2,health:42},{...c,id:3,guardPost:'1,1'},{...c,id:4,cargo:{clay:2}},{...c,id:5},{...c,id:6,fireShelter:'s'}];const outside=new Set();
 for(let t=415;t<508;t+=.2){s.simTime=t*simulationSecondsPerVisitSecond;for(const actor of view(s,[],'sunny'))if(actor.homeVisit.morning)outside.add(actor.id);}
 assert.deepEqual([...outside],[5]);
});


test('a rainy morning reaches just the covered door, and rain sends a courtyard visitor home on foot',()=>{
 const b={...house,rotation:1},s=city(b),c=s.citizens[0],start=((residentDepartureHour(undefined,c.id)-8+24)%24)*20;
 const run=(view,t,wet)=>{s.simTime=t*simulationSecondsPerVisitSecond;return view(s,[],wet?'rain':'sunny')[0];};
 const rainView=createHomeVisits();let found=false;
 for(let t=start-.2;t<start+12;t+=.1){
  const a=run(rainView,t,true);if(!a)continue;
  assert.ok((a.x-b.x)*6<=-.13+1e-8,'remains behind the real room doorway');
  assert.ok(!a.homeVisit.climbing&&a.homeVisit.stage!=='courtyard');
  if(a.homeVisit.stage==='threshold')found=true;
 }
 assert.ok(found);
 const visit=createHomeVisits();let previous,entered=false,finish=false;
 for(let t=start-.2;t<start+12;t+=.1){
  const a=run(visit,t,!!previous);
  if(!previous&&a?.homeVisit.stage==='courtyard'){previous=a;continue;}
  if(!previous)continue;
  if(!a){finish=true;continue;}
  assert.equal(finish,false);assert.equal(a.homeVisit.stage,'enter');assert.ok(distance(previous,a)<.12);
  previous=a;entered=true;
 }
 assert.ok(entered&&finish);
});


test('the last morning starter crosses the actual sill of every house by nine',()=>{
 const last=Array.from({length:500},(_,id)=>id).sort((a,b)=>residentDepartureHour(undefined,b)-residentDepartureHour(undefined,a))[0];
 for(const [b,sill] of [[house,.33],[{...house,level:2},-.46],[{...house,level:3},-.19],[{...house,reedCamp:true},1.40],[{...house,type:'communalHouse'},-1.92]]){
  const state=city(b);state.citizens[0].id=last;const view=createHomeVisits(),start=residentDepartureHour(undefined,last);let crossed=false;
  for(let h=start;h<=9;h+=.004){
   state.simTime=((h-8+24)%24)*20*simulationSecondsPerVisitSecond;const [a]=view(state,[],'sunny');
   if(a?.homeVisit?.morning&&(a.y-b.y-(b.type==='communalHouse'?.5:0))*6>=sill){crossed=true;break;}
  }
  assert.ok(crossed,b.type+' '+b.level);
 }
});
