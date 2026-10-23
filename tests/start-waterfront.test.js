import test from 'node:test';import assert from 'node:assert/strict';
import {Renderer} from '../renderer.js';import {createGame} from '../engine.js';import {river} from '../world.js';
test('new city has no unbuilt brown landing drawn at the fixed river bend',()=>{
 const s=createGame({start:'established'}),r=Object.create(Renderer.prototype),gradient={addColorStop(){}};
 const ctx=new Proxy({}, {get(t,k){if(k==='createRadialGradient')return()=>gradient;return t[k]??(()=>{});},set(t,k,v){t[k]=v;return true;}});
 Object.assign(r,{ctx,canvas:{getBoundingClientRect:()=>({left:0,top:0})},w:1000,h:700,zoom:1.75,pan:{x:0,y:0},ambient:0,visualLast:null,lightMode:'day',reduce:true,lights:[],effects:[],hover:null});
 r.layout();const dock=r.point(river(10)-1.4,10),boxes=[];r.box=(...args)=>boxes.push(args);r.draw(s,null,1000);
 const ghosts=boxes.filter(([x,y,w,d,h])=>Math.abs(w-11*r.s)<1e-7&&Math.abs(d-2*r.s)<1e-7&&Math.abs(h-3*r.s)<1e-7&&Array.from({length:5},(_,i)=>i).some(i=>Math.abs(x-dock.x-i*3*r.s)<1e-7&&Math.abs(y-dock.y-i*1.5*r.s)<1e-7));
 assert.equal(ghosts.length,0,'a landing must belong to an actual built harbor');
});
