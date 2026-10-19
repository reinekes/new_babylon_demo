import test from 'node:test';
import assert from 'node:assert/strict';
import {Renderer} from '../renderer.js';
import {drawBuilding} from '../architecture.js';
import {createGame} from '../engine.js';
function setup(){let strokes=0,blits=0;const ctx=new Proxy({drawImage(){blits++;}}, {get(t,k){return t[k]??(()=>{strokes++;});},set(t,k,v){t[k]=v;return true;}});const r=Object.create(Renderer.prototype);Object.assign(r,{ctx,canvas:{width:1600,height:1200},w:800,h:600,s:1,tw:60,th:30,ox:400,oy:100,lighting:{night:1},lights:[],reduce:false,createLayerCanvas:()=>({getContext:()=>ctx})});return {r,counts:()=>({strokes,blits})};}
test('static houses reuse pixels, retain night lights and invalidate for upgrades, night and scale',()=>{
 const {r,counts}=setup(),s=createGame(),b={type:'house',x:8,y:8,level:1};r.building(b,s,0);const first=counts().strokes,lights=structuredClone(r.lights);r.lights=[];r.building(b,s,1);assert.equal(counts().strokes,first);assert.equal(counts().blits,2);assert.deepEqual(r.lights,lights);
 const direct=setup().r;drawBuilding(direct,b,s,1);assert.deepEqual(r.lights,direct.lights);
 b.level=2;r.building(b,s,2);assert.ok(counts().strokes>first);const second=counts().strokes;r.lighting.night=0;r.building(b,s,3);assert.ok(counts().strokes>second);
 const old=r.buildingSprites;r.s=1.2;r.building(b,s,4);assert.notEqual(r.buildingSprites,old);
});
test('market cargo stays live and animated crops bypass the building cache',()=>{
 const {r,counts}=setup(),s=createGame();let cargo=0;r.marketCargo=()=>cargo++;
 r.building({type:'market',x:7,y:8},s,0);r.building({type:'market',x:7,y:8},s,1);assert.equal(cargo,2);
 const n=counts().blits;r.building({type:'field',x:12,y:8},s,0);r.building({type:'field',x:12,y:8},s,1);assert.equal(counts().blits,n);
});
test('identical warehouse variants share a sprite across locations without moving their scene entry',()=>{
 const {r,counts}=setup(),s=createGame();r.building({type:'granary',x:4,y:4,level:3},s,0);const n=counts().strokes;r.building({type:'granary',x:15,y:12,level:3},s,0);assert.equal(counts().strokes,n);assert.equal(r.buildingSprites.size,1);
});
test('sprite storage stays bounded when many unique workshops are drawn',()=>{
 const {r}=setup(),s=createGame();for(let x=0;x<160;x++){r.lights=[];r.building({type:'clay',x,y:6,level:3},s,0);}
 assert.ok(r.buildingSprites.size<=128);assert.ok(r.spriteBytes<=24*1024*1024);
});
test('cached house lights refresh when residents leave or fill the house',()=>{const {r}=setup(),s=createGame(),b={type:'house',x:8,y:8,level:2},counts=[];for(const residents of [0,4,12,0]){r.houseOccupancy=new Map([['8,8',residents]]);r.lights=[];r.building(b,s,0);counts.push(r.lights.length);}assert.equal(counts[0],0);assert.ok(counts[1]>0&&counts[1]<counts[2]);assert.equal(counts[3],0);});
