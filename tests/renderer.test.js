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

test('road mode selects an existing segment and returns to tile selection',()=>{
 const road={id:'test',a:{x:3,y:4},b:{x:4,y:4}};
 const r=Object.create(Renderer.prototype),selected=[];
 Object.assign(r,{state:{roads:[road]},onRoadSelect:value=>selected.push(value)});
 r.setRoadMode(true);r.selectPoint({x:3.7,y:4.1},()=>assert.fail('tile callback in road mode'));
 assert.equal(selected[0],road);
 r.selectPoint({x:10,y:12},()=>assert.fail('empty terrain callback in road mode'));
 assert.equal(selected.length,1);
 r.setRoadMode(false);r.selectPoint({x:8,y:8},p=>selected.push(p));
 assert.deepEqual(selected[1],{x:8,y:8});
});

test('expanded production, lakes and rain render with finite drawing coordinates',async()=>{
 const {createGame}=await import('../engine.js');
 const r=Object.create(Renderer.prototype),gradient={addColorStop(){}},positions=[];
 const ctx=new Proxy({}, {get(target,key){if(key==='createRadialGradient')return ()=>gradient;if(['lineTo','moveTo','ellipse','arc','fillRect'].includes(key))return (...args)=>positions.push(args.filter(a=>typeof a==='number'));return target[key]??(()=>{});},set(target,key,value){target[key]=value;return true;}});
 Object.assign(r,{ctx,canvas:{getBoundingClientRect:()=>({left:0,top:0})},w:945,h:715,zoom:1.25,pan:{x:0,y:0},ambient:12,visualLast:null,lightMode:'day',reduce:true,lights:[],effects:[],hover:null});
 const state=createGame();state.rain=15;state.buildings.push(...['fishing','hunting','logging','quarry','market'].map((type,i)=>({type,x:6+i,y:12,level:2})));
 state.trade.caravan={x:8.5,y:8.5,phase:'unloading',route:[{x:8.5,y:8.5}],routeIndex:0};state.trade.deliveries=[{id:'sample',market:'10,12',resource:'wood',remaining:12}];
 r.draw(state,'fishing',1000);
 assert.ok(positions.length>100);
 assert.ok(positions.flat().every(Number.isFinite));
 assert.equal(r.weather.type,'rain');
 assert.ok(r.scenery.every(e=>!state.buildings.some(b=>b.x===e.x&&b.y===e.y)));
});

test('caravan renders at its saved graph position and shares the scene depth queue',async()=>{
 const {createGame}=await import('../engine.js');const {sceneDepth}=await import('../city-life.js');
 const r=Object.create(Renderer.prototype),gradient={addColorStop(){}};
 const ctx=new Proxy({}, {get(target,key){if(key==='createRadialGradient')return ()=>gradient;return target[key]??(()=>{});},set(target,key,value){target[key]=value;return true;}});
 Object.assign(r,{ctx,canvas:{getBoundingClientRect:()=>({left:0,top:0})},w:945,h:715,zoom:1.25,pan:{x:0,y:0},ambient:12,visualLast:null,lightMode:'day',reduce:true,lights:[],effects:[],hover:null});
 const state=createGame();state.trade.caravan={x:10.5,y:8.5,phase:'arriving',route:[{x:10.5,y:8.5},{x:10.5,y:9.5}],routeIndex:1};
 state.buildings.push({type:'market',x:11,y:9,level:2});
 const order=[];r.person=e=>order.push(e);r.building=e=>order.push({...e,kind:'building'});r.caravan=e=>order.push(e);
 r.draw(state,null,1000);const caravan=order.find(e=>e.kind==='caravan');
 assert.equal(caravan.x,10.5);assert.equal(caravan.y,8.5);
 for(let i=1;i<order.length;i++)assert.ok(sceneDepth(order[i])>=sceneDepth(order[i-1])-1e-8);
 state.trade.caravan.x=9.5;r.draw(state,null,2000);assert.equal(order.filter(e=>e.kind==='caravan').at(-1).x,9.5);
});

test('market delivery piles disappear as goods are picked up and ignore other markets',()=>{
 const r=Object.create(Renderer.prototype);let boxes=0;
 Object.assign(r,{s:1,point:()=>({x:0,y:0}),box:()=>boxes++,line:()=>{}});
 const b={x:8,y:9},delivery={market:'8,9',remaining:18};
 const state={trade:{deliveries:[delivery,{market:'30,20',remaining:80}]}};
 r.marketCargo(b,state);const full=boxes;assert.ok(full>0);
 boxes=0;delivery.remaining=6;r.marketCargo(b,state);assert.ok(boxes<full&&boxes>0);
 boxes=0;delivery.remaining=0;r.marketCargo(b,state);assert.equal(boxes,0);
});
