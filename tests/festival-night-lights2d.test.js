import test from 'node:test';
import assert from 'node:assert/strict';
import {Renderer} from '../renderer.js';
import * as festivalArt from '../festival-art.js';
import {createGame,encode,advanceTime} from '../engine.js';
import {orderFestival,cancelFestival,festivalCitizenView} from '../festival.js';
import {navigationSegmentClear} from '../navigation.js';
import {visibleCitizens} from '../workforce.js';
import {sceneDepth} from '../city-life.js';
import {testingCity,advanceUntil} from './helpers/testing-ceremonies.js';
import {createOrder} from '../construction.js';

function canvasRenderer(){
 const r=Object.create(Renderer.prototype),gradient={addColorStop(){}};
 const ctx=new Proxy({},{get(t,k){if(k==='createRadialGradient')return()=>gradient;return t[k]??(()=>{});},set(t,k,v){t[k]=v;return true;}});
 Object.assign(r,{ctx,canvas:{getBoundingClientRect:()=>({left:0,top:0})},w:945,h:715,zoom:1.25,pan:{x:0,y:0},ambient:12,visualLast:null,lightMode:'night',reduce:true,lights:[],effects:[],hover:null});
 return r;
}

test('Night of Lights gives every finished building its own oil flames without adding lamps to fields, canals or bridges',()=>{
 const s=createGame({start:'established'}),r=canvasRenderer();r.layout();
 s.festival={stage:'celebrating',occasion:'nightLights',elapsed:12};
 const before=encode(s);
 assert.equal(typeof festivalArt.drawFestivalBuildingLights,'function');
 for(const type of ['house','shrine','ziggurat','brewery','garden','harbor','musicHouse','brickyard','tailor']){
  r.lights=[];festivalArt.drawFestivalBuildingLights(r,{type,x:8,y:8},s);
  assert.ok(r.lights.length>=3,`${type} needs several visible flames`);
  assert.ok(r.lights.every(p=>[p.x,p.y,p.size].every(Number.isFinite)&&p.size>0&&p.size<40*r.s));
 }
 for(const b of [{type:'field'},{type:'canal'},{type:'bridge'},{type:'house',construction:{kind:'new'}}]){
  r.lights=[];festivalArt.drawFestivalBuildingLights(r,{x:8,y:8,...b},s);assert.equal(r.lights.length,0);
 }
 assert.equal(encode(s),before,'decorative oil flames do not consume stock or change saves');
 for(const festival of [null,{stage:'waiting',occasion:'nightLights'},{stage:'celebrating',occasion:'firstBeer'}]){
  s.festival=festival;r.lights=[];festivalArt.drawFestivalBuildingLights(r,{type:'house',x:8,y:8},s);assert.equal(r.lights.length,0);
 }
});

test('2D ceremony depth sorting uses real guests at their shown courtyard and moving torch-route positions exactly once',()=>{
 const s=testingCity();assert.ok(orderFestival(s).ok);assert.ok(advanceUntil(s,state=>state.festival?.stage==='celebrating'));advanceTime(s,3);
 const before=encode(s),r=canvasRenderer(),drawn=[];
 r.person=e=>drawn.push(e);r.building=e=>drawn.push({...e,kind:'building'});
 r.draw(s,null,1000);
 const people=drawn.filter(e=>e.kind==='person'),visible=visibleCitizens(s),walkers=people.filter(e=>e.festivalTorch);
 assert.ok(walkers.length>=2&&walkers.length<=3);
 assert.equal(people.length,visible.length);assert.equal(new Set(people.map(p=>p.id)).size,people.length);
 for(const p of people){const view=festivalCitizenView(s,s.citizens.find(c=>c.id===p.id)),place=view.eventContact||view.festivalContact;if(place)assert.deepEqual([p.x,p.y],[place.x,place.y]);}
 for(let i=1;i<drawn.length;i++)assert.ok(sceneDepth(drawn[i])>=sceneDepth(drawn[i-1])-1e-8);
 assert.equal(encode(s),before);
 const initial=walkers.map(p=>[p.id,p.x,p.y]);s.festival.elapsed+=5;drawn.length=0;r.draw(s,null,2000);
 assert.notDeepEqual(drawn.filter(p=>p.festivalTorch).map(p=>[p.id,p.x,p.y]),initial);
});

test('2D upgraded buildings retain festive oil flames while a new construction site stays unlit',()=>{
 const s=createGame({start:'established'}),r=canvasRenderer(),house=s.buildings.find(b=>b.type==='house');
 s.festival={stage:'celebrating',occasion:'nightLights',elapsed:12,actors:[],temple:'9,8',delivered:{food:0,beer:0}};
 house.construction=createOrder({},2,'upgrade');r.inView=()=>true;
 r.draw(s,null,1000);
 const p=r.point(house.x,house.y),hasEntranceFlame=()=>r.lights.some(light=>Math.abs(light.x-p.x)<1e-8&&Math.abs(light.y-(p.y+9*r.s))<1e-8&&Math.abs(light.size-22*r.s)<1e-8);
 assert.ok(hasEntranceFlame(),'scaffolding must not extinguish the existing building entrance');
 house.construction=createOrder({},1,'new');r.draw(s,null,2000);
 assert.equal(hasEntranceFlame(),false,'an unfinished new site has no household celebration lamps');
});

test('a 2D torchbearer carries a visible flame and warm halo that remain still while ceremony time is paused',()=>{
 const r=canvasRenderer();r.layout();r.reduce=false;r.state={simTime:32.5,festival:{elapsed:5}};
 const shapes=[];r.polygon=(points,color)=>shapes.push({points,color});
 const c={id:3,x:8,y:8,age:25,phase:'festival',walking:true,festivalTorch:true};
 r.person(c);assert.ok(shapes.some(p=>p.color==='#ee983f'),'the carried torch has a flame');assert.ok(r.lights.length>0,'the torch adds a small warm halo');
 const first=structuredClone(shapes);shapes.length=0;r.person(c);assert.deepEqual(shapes,first,'redrawing does not advance a paused flame');
 r.state.festival.elapsed+=.25;shapes.length=0;r.person(c);assert.notDeepEqual(shapes,first,'the flame flickers when ceremony time advances');
});

test('2D cancellation returns a torchbearer along a safe path without jumping while paused',()=>{
 const s=testingCity();assert.ok(orderFestival(s).ok);assert.ok(advanceUntil(s,state=>state.festival?.stage==='celebrating'));advanceTime(s,3);
 const r=canvasRenderer(),drawn=[];r.person=p=>drawn.push(p);r.draw(s,null,1000,{paused:false,speed:1});
 const torch=drawn.find(p=>p.festivalTorch);assert.ok(torch);assert.ok(cancelFestival(s).ok);
 const before=encode(s);drawn.length=0;r.draw(s,null,1016,{paused:true,speed:4});
 let current=drawn.find(p=>p.id===torch.id);assert.deepEqual([current.x,current.y],[torch.x,torch.y],'cancel on pause must retain the last shown street position');
 drawn.length=0;r.draw(s,null,1032,{paused:false,speed:1});current=drawn.find(p=>p.id===torch.id);
 assert.ok(Math.hypot(current.x-torch.x,current.y-torch.y)<=.30*.016+1e-8,'the first exit step cannot teleport');
 assert.ok(navigationSegmentClear(s,torch,current));assert.equal(encode(s),before);
});

test('2D entering a torch patrol walks from the last courtyard position and clears deleted IDs and replaced cities',()=>{
 const s=testingCity();assert.ok(orderFestival(s).ok);assert.ok(advanceUntil(s,state=>state.festival?.stage==='celebrating'));advanceTime(s,3);
 const guest=s.festival.actors.find(a=>a.kind==='guest'),c=s.citizens.find(c=>c.id===guest.id),r=canvasRenderer(),drawn=[];
 guest.stage='arriving';r.person=p=>drawn.push(p);r.draw(s,null,1000,{paused:false,speed:1});const initial=drawn.find(p=>p.id===c.id);
 guest.stage='dancing';const before=encode(s);drawn.length=0;r.draw(s,null,1016,{paused:true,speed:1});
 let current=drawn.find(p=>p.id===c.id);assert.ok(current.festivalTorch);assert.deepEqual([current.x,current.y],[initial.x,initial.y],'a paused role change cannot move the guest');
 drawn.length=0;r.draw(s,null,1032,{paused:false,speed:4});current=drawn.find(p=>p.id===c.id);
 assert.ok(Math.hypot(current.x-initial.x,current.y-initial.y)<=.30*.016*4+1e-8);assert.ok(navigationSegmentClear(s,initial,current));assert.equal(encode(s),before);
 const replacement=structuredClone(s);drawn.length=0;r.draw(replacement,null,1048,{paused:true,speed:1});
 const restored=drawn.find(p=>p.id===c.id),target=festivalCitizenView(replacement,replacement.citizens.find(p=>p.id===c.id)).eventContact;
 assert.deepEqual([restored.x,restored.y],[target.x,target.y],'a replacement city must not reuse a previous city join');
 replacement.citizens=replacement.citizens.filter(p=>p.id!==c.id);replacement.festival.actors=replacement.festival.actors.filter(a=>a.id!==c.id);
 drawn.length=0;r.draw(replacement,null,1064,{paused:true,speed:1});assert.ok(!drawn.some(p=>p.id===c.id));assert.ok(!r.ceremonyPositions.has(c.id));
});
