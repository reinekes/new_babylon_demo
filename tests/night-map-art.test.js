import test from 'node:test';
import assert from 'node:assert/strict';
import {houseVariant,drawCourtyardHouse} from '../map-art.js';
import {drawBuilding} from '../architecture.js';
import {drawActorGesture,residentPose} from '../actor-art.js';
import {houseLightCount} from '../households.js';
import {Renderer} from '../renderer.js';
import {createGame} from '../engine.js';
import {animalsFor} from '../fauna.js';
import {isDryPoint,terrain} from '../world.js';

test('courtyard variants are deterministic, distinct and independent of time or population',()=>{
 const variants=new Set();for(let x=0;x<20;x++){const b={x,y:8,type:'house'};variants.add(houseVariant(b));assert.equal(houseVariant(b),houseVariant({...b,pantry:99}));}assert.equal(variants.size,4);
});
test('courtyard houses fit the cached footprint and preserve the exact occupied window count',()=>{
 const s=createGame(),b={type:'house',x:8,y:8,level:3};
 for(const count of [0,4,12]){const coordinates=[],ctx=new Proxy({},{get:()=>()=>{}}),r=Object.create(Renderer.prototype);Object.assign(r,{ctx,s:1,point:()=>({x:0,y:0}),lighting:{night:1},houseOccupancy:new Map([['8,8',count]]),lights:[],polygon:(points)=>coordinates.push(...points),line:(points)=>coordinates.push(...points)});drawCourtyardHouse(r,b,s);assert.equal(r.lights.length,houseLightCount(b,count));assert.ok(coordinates.flat().every(Number.isFinite));assert.ok(coordinates.every(p=>Math.abs(p[0])<=32&&p[1]>=-112&&p[1]<=25));}
});
test('expressive poses respect cargo, mourning and movement before decorative work',()=>{
 assert.equal(residentPose({phase:'working',carrying:true},'weaver',3).kind,'carry');
 assert.equal(residentPose({phase:'working',mourningTorch:true},'weaver',3).kind,'walk');
 assert.equal(residentPose({phase:'working',walking:true},'weaver',3).kind,'walk');
 for(const [craft,kind]of [['weaver','weave'],['brickyard','mould'],['field','harvest']])assert.equal(residentPose({phase:'working'},craft,3).kind,kind);
 assert.equal(residentPose({phase:'home',age:65},null,3).kind,'elder');
});
test('animal idle variety never moves actors off their valid routes',()=>{
 const s=createGame(),behaviors=new Set();for(let t=0;t<90;t+=.5){s.simTime=t;for(const a of animalsFor(s)){behaviors.add(a.behavior);if(a.kind==='fish')assert.equal(terrain(Math.round(a.x),Math.round(a.y),s),'water',a.id);else assert.ok(isDryPoint(s,a.x,a.y));}}
 assert.ok(behaviors.has('resting'));assert.ok(behaviors.has('drinking'));assert.ok(behaviors.has('looking'));
});

test('all renewed architectural levels and actor gestures render finite coordinates without changing state',()=>{
 const state=createGame(),before=structuredClone(state),points=[];
 const ctx=new Proxy({},{get:(target,key)=>target[key]??((...args)=>{if(['ellipse','arc','moveTo','lineTo','fillRect'].includes(key))points.push(...args.filter(a=>typeof a==='number'));}),set:(target,key,value)=>(target[key]=value,true)});
 const r=Object.create(Renderer.prototype);Object.assign(r,{ctx,s:1,tw:60,th:30,ox:400,oy:100,lights:[],reduce:true,lighting:{night:0},state});
 for(const night of [0,1]){r.lighting.night=night;for(const type of ['house','shrine','ziggurat','granary','market','harbor','weaver','brickyard'])for(const level of [1,2,3])drawBuilding(r,{type,x:8,y:8,level},state,12);}
 for(const kind of ['weave','mould','harvest','carry','play','elder'])drawActorGesture(r,{x:10,y:20},1,{age:65},{kind,beat:.7});
 assert.ok(points.length>100);assert.ok(points.every(Number.isFinite));assert.deepEqual(state,before);
});

test('real visible citizens keep carrying arms while walking and unload only at an unloading stop',async()=>{
 const {visibleCitizens}=await import('../workforce.js');const s=createGame(),c=s.citizens.find(c=>c.age>=16);c.phase='toStore';c.cargo={clay:1};
 const walker=visibleCitizens(s).find(p=>p.id===c.id);assert.ok(walker.walking&&walker.carrying);assert.equal(residentPose(walker,'clay',3).kind,'carry');
 c.phase='unloading';const stopped=visibleCitizens(s).find(p=>p.id===c.id);assert.equal(residentPose(stopped,'clay',3).kind,'unload');assert.equal(residentPose({...stopped,mourningTorch:true},'clay',3).kind,'walk');
 assert.equal(residentPose({...walker,guarding:true},'clay',3).kind,'walk');
 assert.equal(residentPose({phase:'working'},'pottery',3).kind,'mould');assert.equal(residentPose({phase:'working'},'brewery',3).kind,'stir');
});
test('artisan artwork reads real stages, keeps ready counts and only fires a loaded kiln',async()=>{
 const {drawArtisan,artisanArtState}=await import('../artisan-art.js'),{initializeArtisans}=await import('../artisan.js');
 const s=createGame(),pot={type:'pottery',x:8,y:8,level:1},brew={type:'brewery',x:9,y:8,level:3};s.buildings.push(pot,brew);initializeArtisans(s);
 const points=[],ctx=new Proxy({},{get:(target,key)=>target[key]??((...args)=>{if(['ellipse','arc','moveTo','lineTo','fillRect'].includes(key))points.push(...args.filter(a=>typeof a==='number'));}),set:(target,key,value)=>(target[key]=value,true)}),r=Object.create(Renderer.prototype);Object.assign(r,{ctx,s:1,tw:60,th:30,ox:400,oy:100,lights:[],reduce:true,lighting:{night:0}});
 for(const b of [pot,brew])for(const stage of b.type==='pottery'?['idle','forming','drying','firing','cooling','ready']:['idle','brewing','ready']){
  b.artisan.stage=stage;b.artisan.ready=stage==='ready'?(b.type==='pottery'?2:3):0;const before=structuredClone(s);r.lights=[];const view=artisanArtState(b);assert.equal(view.stage,stage);assert.equal(view.ready,b.artisan.ready);drawArtisan(r,b,s,12);assert.equal(r.lights.length,stage==='firing'?1:0);assert.deepEqual(s,before);
 }
 assert.ok(points.every(Number.isFinite));assert.equal(artisanArtState({...pot,artisan:undefined}).ready,0);
 for(const kind of ['unload','stir'])drawActorGesture(r,{x:0,y:0},1,{age:30},{kind,beat:.5});assert.ok(points.every(Number.isFinite));
});
