import {visibleCitizens} from '../workforce.js';
import {createHomeVisits} from '../game3d/home-visits.js';
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
 const state=createGame({start:'established'});advanceTime(state,1);r.draw(state,null,1000);
 const drawn=order.filter(e=>e.kind==='person'),street=visibleCitizens(state);
 const expected=createHomeVisits()(state,street);
 assert.deepEqual(drawn.map(c=>c.id).sort((a,b)=>a-b),expected.map(c=>c.id).sort((a,b)=>a-b));
 assert.ok(drawn.some(c=>c.homeVisit?.morning&&!street.some(p=>p.id===c.id)),'a neighbour at their door joins the same depth queue as workers');
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
 const state=createGame({start:'established'});state.rain=15;state.buildings.push(...['fishing','hunting','logging','quarry','market'].map((type,i)=>({type,x:6+i,y:12,level:2})));
 state.buildings.push({type:'harbor',x:11,y:9,level:1});
 state.buildings.push({type:'house',x:4,y:8,level:2},{type:'house',x:5,y:8,level:3},{type:'ziggurat',x:4,y:10,level:3});
 state.buildings.push({type:'kiln',x:6,y:11,level:1,firing:{brick:0,reed:0,hot:4,time:5,ready:0}});
 state.trade.caravan={x:8.5,y:8.5,phase:'unloading',route:[{x:8.5,y:8.5}],routeIndex:0};state.trade.deliveries=[{id:'sample',market:'10,12',resource:'wood',remaining:12}];
 r.draw(state,'fishing',1000);state.trade.caravan.transport='river';state.trade.caravan.market='11,9';r.draw(state,null,1100);
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
 const state=createGame({start:'established'});state.trade.caravan={x:10.5,y:8.5,phase:'arriving',route:[{x:10.5,y:8.5},{x:10.5,y:9.5}],routeIndex:1};
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
 const {createGame}=await import('../engine.js');const s=createGame({start:'established'});s.resources.clay=0;s.resources.reed=0;
 const r=Object.create(Renderer.prototype),drawn=[];
 Object.assign(r,{s:1,reduce:true,ctx:{save(){},restore(){}},inView:()=>true,point:(x,y)=>({x,y}),polygon:points=>drawn.push(points),line(){}});
 for(const type of ['house','shrine','granary','market','ziggurat','field','bridge']){r.placementLayer(s,type);assert.equal(drawn.length,0,`${type} must not highlight the whole map`);}
 drawn.length=0;r.placementLayer(s,'clay');assert.ok(drawn.length>0);assert.ok(drawn.length<20);
});

test('open depot stocks reflect actual resources and disappear once a granary operates',async()=>{
 const {createGame}=await import('../engine.js');const s=createGame({start:'established'}),r=Object.create(Renderer.prototype);r.streets={ports:[]};
 const piles=r.groundStocks(s);assert.equal(piles.length,1);assert.deepEqual(piles[0].stock,s.resources);
 s.buildings.push({type:'granary',x:3,y:3,level:1,construction:{kind:'new'}});assert.equal(r.groundStocks(s).length,1);
 delete s.buildings.at(-1).construction;assert.equal(r.groundStocks(s).length,0);
});

test('funeral renders covered bier, jackals and at-home mourners at actual scene positions',async()=>{
 const {createGame}=await import('../engine.js'),{sceneDepth}=await import('../city-life.js');
 const r=Object.create(Renderer.prototype),gradient={addColorStop(){}},ctx=new Proxy({}, {get(target,key){if(key==='createRadialGradient')return ()=>gradient;return target[key]??(()=>{});},set(target,key,value){target[key]=value;return true;}});
 Object.assign(r,{ctx,canvas:{getBoundingClientRect:()=>({left:0,top:0})},w:945,h:715,zoom:1.25,pan:{x:0,y:0},ambient:12,visualLast:null,lightMode:'day',reduce:true,lights:[],effects:[],hover:null});
 const s=createGame({start:'established'});s.citizens[0].x=7.5;s.citizens[0].y=7.5;s.citizens[0].phase='home';s.funeral={stage:'jackals',boundary:{x:5.5,y:7.5},coffin:{x:5.5,y:7.5},deceased:[{id:100}],actors:[{id:0}],timer:1};
 const order=[];r.person=e=>order.push({...e,kind:'person'});r.building=e=>order.push({...e,kind:'building'});r.bier=e=>order.push(e);r.animal=e=>order.push(e);
 r.draw(s,null,1000);const mourner=order.find(e=>e.kind==='person'&&e.id===0);assert.ok(mourner);assert.equal(mourner.x,7.5);assert.equal(mourner.y,7.5);
 assert.equal(order.find(e=>e.kind==='bier').x,5.5);assert.equal(order.filter(e=>String(e.id).startsWith('funeral-jackal')).length,3);
 for(let i=1;i<order.length;i++)assert.ok(sceneDepth(order[i])>=sceneDepth(order[i-1])-1e-8);
});
test('placement highlights remain above night and weather shading',async()=>{
 const{createGame}=await import('../engine.js'),r=Object.create(Renderer.prototype),gradient={addColorStop(){}},calls=[];
 const ctx=new Proxy({},{get(t,k){if(k==='createRadialGradient')return()=>gradient;return t[k]??(()=>{});},set(t,k,v){t[k]=v;return true;}});
 Object.assign(r,{ctx,canvas:{getBoundingClientRect:()=>({left:0,top:0})},w:945,h:715,zoom:1.25,pan:{x:0,y:0},ambient:0,visualLast:null,lightMode:'night',reduce:true,lights:[],effects:[],hover:null});
 r.nightLayer=()=>calls.push('night');r.weatherLayer=()=>calls.push('weather');r.placementLayer=()=>calls.push('highlight');r.draw(createGame({start:'established'}),'reed',1000);assert.deepEqual(calls,['night','weather','highlight']);
});
test('reserved warehouse goods stay visible on the ground until porters take them',async()=>{
 const{createGame}=await import('../engine.js'),s=createGame({start:'established'}),r=Object.create(Renderer.prototype);r.refreshCity(s);s.resources.clay=0;s.trade.sales=[{resource:'clay',remaining:5}];assert.equal(r.groundStocks(s)[0].stock.clay,5);s.trade.sales[0].remaining=2;assert.equal(r.groundStocks(s)[0].stock.clay,2);s.trade.sales[0].remaining=0;assert.equal(r.groundStocks(s)[0].stock.clay,0);
});
test('placement sites reuse terrain checks until buildings or deposits change',async()=>{
 const {createGame}=await import('../engine.js'),s=createGame({start:'established'}),r=Object.create(Renderer.prototype);
 const first=r.placementSites(s,'clay');assert.ok(first.length>0);s.resources.clay=0;s.simTime+=1;
 assert.equal(r.placementSites(s,'clay'),first);
 const tile=first[0];s.buildings.push({type:'house',...tile});assert.ok(!r.placementSites(s,'clay').some(p=>p.x===tile.x&&p.y===tile.y));
 s.buildings.pop();s.world.deposits=s.world.deposits.filter(d=>d.x!==tile.x||d.y!==tile.y);assert.ok(!r.placementSites(s,'clay').some(p=>p.x===tile.x&&p.y===tile.y));
 assert.deepEqual(r.placementSites(s,'house'),[]);
});

test('Canvas joins one soil tint before compositing into the ground, caches it and still selects automatic routes',()=>{
 const r=Object.create(Renderer.prototype),images=[],gradients=[],modes=[],lines=[];
 const points=[0,1,2,3,4].map(i=>({x:2.5+i,y:3.5,key:(3+i)+',4'}));
 const roads=points.slice(1).map((b,i)=>({id:'r'+i,a:points[i],b,built:i<3,level:i<3?i+1:1,x:b.x-.5,y:b.y}));
 const ctx={save(){},restore(){},drawImage(){images.push(this.globalCompositeOperation);}};
 const layer={save(){},restore(){},setTransform(){},transform(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fillRect(){},
  createLinearGradient(){const stops=[];gradients.push(stops);return {addColorStop(u,c){stops.push([u,c]);}};},
  fill(){modes.push(this.globalCompositeOperation);}
 };
 Object.assign(r,{ctx,s:1,w:600,h:500,tw:60,th:30,ox:300,oy:40,canvas:{width:600,height:500},state:{roads},
  createLayerCanvas:()=>({getContext:()=>layer}),line:(path)=>lines.push(path),inView:()=>true});
 r.streetsLayer();
 assert.deepEqual([...r.streetPaint.shapes.values()].map(s=>s.level),[1,2,3]);
 assert.deepEqual(new Set(modes),new Set(['source-over']));
 assert.deepEqual(images,['source-over']);
 assert.equal(lines.length,0);
 assert.ok(gradients.every(stops=>stops[0][1].endsWith(',0)')&&stops.at(-1)[1].endsWith(',0)')));
 const count=gradients.length;assert.ok(count>=3*8);
 const tones=[0,1,2].map(i=>gradients[i*count/3+Math.floor(count/6)][3][1].match(/\d+/g).map(Number));
 assert.ok(tones[1][0]-tones[1][1]<tones[0][0]-tones[0][1],'the middle level uses less ochre than the dirt lane');
 assert.ok(tones[2][0]-tones[2][2]>tones[0][0]-tones[0][2],'the brick surface has a distinct fired-clay tint');
 r.roadMode=true;r.streetsLayer();
 assert.equal(gradients.length,count,'a camera-stable selection reuses the existing pixels');
 assert.deepEqual(images,['source-over','source-over']);assert.equal(lines.length,1);
 assert.deepEqual(lines[0].at(-1),r.point(points[4].x,points[4].y));
 r.ox+=40;r.streetsLayer();assert.equal(gradients.length,count*2,'panning repaints with soil grain anchored in the world');
 gradients.length=0;
 r.state={roads:[],footpaths:[{a:points[0],b:points[1],wear:32,at:0}]};
 r.streetsLayer();
 const peak=Math.max(...gradients.flat().map(([,rgba])=>Number(rgba.split(',').at(-1).slice(0,-1))));
 assert.ok(peak>.025&&peak<.21,'even sustained walking leaves the Canvas ground texture visible');
});
test('supply focus puts a distant house visibly to the right of the desktop detail card',()=>{const r=Object.create(Renderer.prototype);Object.assign(r,{w:945,h:715,zoom:1.45,pan:{x:0,y:0}});r.layout();r.focusOn(35,27);const p=r.point(35,27);assert.ok(p.x>400&&p.x<r.w-80);assert.ok(p.y>90&&p.y<r.h-90);});

test('the map lowers each unchanged mineral mesh into its pit and reuses its painted sprite',async()=>{
 const {drawMapMineral}=await import('../mineral-map-art.js');
 const {mineralDepth}=await import('../game3d/mineral-excavation.js');
 const scaleY=Math.sqrt(37.5),images=[];
 function layer(){
  const triangles=[];let path=[];
  const context={setTransform(){},save(){},restore(){},closePath(){},clip(){},beginPath(){path=[];},
   moveTo(x,y){path.push([x,y]);},lineTo(x,y){path.push([x,y]);},fill(){triangles.push({points:path,color:this.fillStyle});}};
  return {getContext:()=>context,triangles};
 }
 const r={state:{world:{}},s:1,point:()=>({x:0,y:0}),createLayerCanvas:layer,ctx:{drawImage:image=>images.push(image)}};
 const fingerprint=(f,offset=0)=>[f.color,...f.points.flatMap(([x,y])=>[x.toFixed(5),(y-offset).toFixed(5)])].join('|');
 for(const kind of ['clay','stone']){
  const deposit={x:3,y:5,kind},pit={...deposit,depth:mineralDepth(kind)};
  drawMapMineral(r,deposit,null,1);const surface=images.at(-1);
  drawMapMineral(r,deposit,pit,1);const cut=images.at(-1);
  assert.ok(surface.triangles.length>200&&cut.triangles.length>surface.triangles.length);
  const lowered=new Set(cut.triangles.map(f=>fingerprint(f,pit.depth*scaleY)));
  assert.ok(surface.triangles.every(f=>lowered.has(fingerprint(f))),kind+' retains its full silhouette and shading');
  drawMapMineral(r,{...deposit},pit,1);assert.equal(images.at(-1),cut);
  drawMapMineral(r,deposit,pit,0);assert.equal(images.at(-1).triangles.length,cut.triangles.length-surface.triangles.length);
  const dryBowl=images.at(-1);
  drawMapMineral(r,deposit,{...pit,bankDistance:1,landX:1,landZ:0},0);
  assert.notDeepEqual(images.at(-1).triangles,dryBowl.triangles);
 }
});
