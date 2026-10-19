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
 assert.equal(order.filter(e=>e.kind==='person').length,10);
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

test('placement outlines remain visible for valid terrain even without money',async()=>{
 const {createGame}=await import('../engine.js');const s=createGame();s.resources.clay=0;s.resources.reed=0;
 const r=Object.create(Renderer.prototype),drawn=[];
 Object.assign(r,{s:1,reduce:true,ctx:{save(){},restore(){}},inView:()=>true,point:(x,y)=>({x,y}),polygon:points=>drawn.push(points),line(){}});
 for(const type of ['house','shrine','granary','market','ziggurat','field','bridge']){r.placementLayer(s,type);assert.equal(drawn.length,0,`${type} must not highlight the whole map`);}
 drawn.length=0;r.placementLayer(s,'clay');assert.ok(drawn.length>0);assert.ok(drawn.length<20);
});

test('open depot stocks reflect actual resources and disappear once a granary operates',async()=>{
 const {createGame}=await import('../engine.js');const s=createGame(),r=Object.create(Renderer.prototype);r.streets={ports:[]};
 const piles=r.groundStocks(s);assert.equal(piles.length,1);assert.deepEqual(piles[0].stock,s.resources);
 s.buildings.push({type:'granary',x:3,y:3,level:1,construction:{kind:'new'}});assert.equal(r.groundStocks(s).length,1);
 delete s.buildings.at(-1).construction;assert.equal(r.groundStocks(s).length,0);
});

test('funeral renders covered bier, jackals and at-home mourners at actual scene positions',async()=>{
 const {createGame}=await import('../engine.js'),{sceneDepth}=await import('../city-life.js');
 const r=Object.create(Renderer.prototype),gradient={addColorStop(){}},ctx=new Proxy({}, {get(target,key){if(key==='createRadialGradient')return ()=>gradient;return target[key]??(()=>{});},set(target,key,value){target[key]=value;return true;}});
 Object.assign(r,{ctx,canvas:{getBoundingClientRect:()=>({left:0,top:0})},w:945,h:715,zoom:1.25,pan:{x:0,y:0},ambient:12,visualLast:null,lightMode:'day',reduce:true,lights:[],effects:[],hover:null});
 const s=createGame();s.citizens[0].x=7.5;s.citizens[0].y=7.5;s.citizens[0].phase='home';s.funeral={stage:'jackals',boundary:{x:5.5,y:7.5},coffin:{x:5.5,y:7.5},deceased:[{id:100}],actors:[{id:0}],timer:1};
 const order=[];r.person=e=>order.push({...e,kind:'person'});r.building=e=>order.push({...e,kind:'building'});r.bier=e=>order.push(e);r.animal=e=>order.push(e);
 r.draw(s,null,1000);const mourner=order.find(e=>e.kind==='person'&&e.id===0);assert.ok(mourner);assert.equal(mourner.x,7.5);assert.equal(mourner.y,7.5);
 assert.equal(order.find(e=>e.kind==='bier').x,5.5);assert.equal(order.filter(e=>String(e.id).startsWith('funeral-jackal')).length,3);
 for(let i=1;i<order.length;i++)assert.ok(sceneDepth(order[i])>=sceneDepth(order[i-1])-1e-8);
});
test('placement highlights remain above night and weather shading',async()=>{
 const{createGame}=await import('../engine.js'),r=Object.create(Renderer.prototype),gradient={addColorStop(){}},calls=[];
 const ctx=new Proxy({},{get(t,k){if(k==='createRadialGradient')return()=>gradient;return t[k]??(()=>{});},set(t,k,v){t[k]=v;return true;}});
 Object.assign(r,{ctx,canvas:{getBoundingClientRect:()=>({left:0,top:0})},w:945,h:715,zoom:1.25,pan:{x:0,y:0},ambient:0,visualLast:null,lightMode:'night',reduce:true,lights:[],effects:[],hover:null});
 r.nightLayer=()=>calls.push('night');r.weatherLayer=()=>calls.push('weather');r.placementLayer=()=>calls.push('highlight');r.draw(createGame(),'reed',1000);assert.deepEqual(calls,['night','weather','highlight']);
});
test('reserved warehouse goods stay visible on the ground until porters take them',async()=>{
 const{createGame}=await import('../engine.js'),s=createGame(),r=Object.create(Renderer.prototype);r.refreshCity(s);s.resources.clay=0;s.trade.sales=[{resource:'clay',remaining:5}];assert.equal(r.groundStocks(s)[0].stock.clay,5);s.trade.sales[0].remaining=2;assert.equal(r.groundStocks(s)[0].stock.clay,2);s.trade.sales[0].remaining=0;assert.equal(r.groundStocks(s)[0].stock.clay,0);
});
test('placement sites reuse terrain checks until buildings or deposits change',async()=>{
 const {createGame}=await import('../engine.js'),s=createGame(),r=Object.create(Renderer.prototype);
 const first=r.placementSites(s,'clay');assert.ok(first.length>0);s.resources.clay=0;s.simTime+=1;
 assert.equal(r.placementSites(s,'clay'),first);
 const tile=first[0];s.buildings.push({type:'house',...tile});assert.ok(!r.placementSites(s,'clay').some(p=>p.x===tile.x&&p.y===tile.y));
 s.buildings.pop();s.world.deposits=s.world.deposits.filter(d=>d.x!==tile.x||d.y!==tile.y);assert.ok(!r.placementSites(s,'clay').some(p=>p.x===tile.x&&p.y===tile.y));
 assert.deepEqual(r.placementSites(s,'house'),[]);
});
