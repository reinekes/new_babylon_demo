import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Renderer} from '../renderer.js';
test('projection and hit testing agree after resize and zoom',()=>{for(const [w,h] of [[390,510],[510,510],[945,715],[1300,1000]])for(const zoom of [.7,1,1.45,1.7,3]){const r=Object.create(Renderer.prototype);Object.assign(r,{w,h,zoom,pan:{x:87,y:-42},canvas:{getBoundingClientRect:()=>({left:230,top:166})}});r.layout();for(let x=0;x<22;x++)for(let y=0;y<18;y++){const p=r.point(x,y);assert.deepEqual(r.pick(p.x+230,p.y+166),{x,y});}assert.equal(r.pick(-999,-999),null);}});

test('actual render queue interleaves people and solid buildings in depth order',async()=>{
 const {createGame,advanceTime}=await import('../engine.js');
 const {sceneDepth}=await import('../city-life.js');
 const r=Object.create(Renderer.prototype);
 const gradient={addColorStop(){}};
 const ctx=new Proxy({}, {get(target,key){if(key==='createRadialGradient')return ()=>gradient;return target[key]??(()=>{});},set(target,key,value){target[key]=value;return true;}});
 Object.assign(r,{ctx,canvas:{getBoundingClientRect:()=>({left:0,top:0})},w:945,h:715,zoom:1.25,pan:{x:0,y:0},ambient:12,visualLast:null,lightMode:'day',reduce:true,lights:[],effects:[],hover:null});
 const order=[];r.person=p=>order.push(p);r.building=b=>order.push({...b,kind:'building'});
 const state=createGame();advanceTime(state,1);r.draw(state,null,1000);
 assert.equal(order.filter(e=>e.kind==='person').length,6);
 for(let i=1;i<order.length;i++)assert.ok(sceneDepth(order[i])>=sceneDepth(order[i-1])-1e-8);
 assert.ok(order.findIndex(e=>e.kind==='person')<order.findLastIndex(e=>e.kind==='building'),'some residents must be drawn before houses, not in a final overlay pass');
});
