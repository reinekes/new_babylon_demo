import test from 'node:test';
import assert from 'node:assert/strict';
import {BASE_TIME_RATE} from '../calendar.js';
import {legacyScenario,strictScenario} from '../scenario-profiles.js';
import {createHomeVisits} from '../game3d/home-visits.js';
import {workHourAt} from '../work-schedule.js';

const house={type:'house',x:6,y:11,level:1,rotation:0};
function city(b=house,scenario=strictScenario()){
 const home=b.x+','+b.y,c={id:7,x:b.x,y:b.y-1,age:41,phase:'home',home,cargo:{},route:[]};
 return {buildings:[{...b}],citizens:[c],simTime:0,scenario};
}
const seen=(s,view,time,street=[])=>{s.simTime=time*BASE_TIME_RATE;return view(s,street);};
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
   if(!actor.walking){sit.add(v.stage);assert.ok(v.seatHeight>0);assert.ok(workHourAt(s.simTime)<19&&workHourAt(s.simTime)>=6);}
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
  const residents=seen(s,view,t);assert.ok(residents.length<=1);
  for(const a of residents){assert.ok([7,8].includes(a.id));if(a.homeVisit.seatHeight)ids.add(a.id);}
 }
 assert.deepEqual([...ids].sort(),[7,8]);
 const child=s.citizens[2];const yard={...child,playing:true,x:child.x+.2,y:child.y+.2};assert.ok(seen(s,view,280,[yard]).includes(yard));
 const cameIn=seen(s,view,280.1,[]).find(p=>p.id===child.id);assert.equal(cameIn.homeVisit.stage,'enter');assert.equal(cameIn.x,yard.x);
 const paused=seen(s,view,280.1,[]).find(p=>p.id===child.id);assert.deepEqual(paused,cameIn);
 s.funeral={scope:'city'};const ceremonial={...c,eventContact:{}};assert.deepEqual(seen(s,view,280.2,[ceremonial]),[ceremonial]);
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
