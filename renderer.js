import {residentAppearance,drawResidentClothes} from './resident-appearance.js';
import {drawCanal,irrigationFor} from './irrigation.js';
import {drawGroundTexture} from './terrain-texture.js';
import {houseLightCount} from './households.js';
import {drawConstruction,drawConstructionLabel} from './construction-art.js';
import {canBuild,canPlace} from './engine.js';
import {generateStreets,sortScene,lightingAt} from './city-life.js';
import {WIDTH,HEIGHT,terrain,river,bridgeSpan,onBridge,depositAt,isShore,nearDeposit} from './world.js';
import {visibleCitizens} from './workforce.js';
import {drawBuilding} from './architecture.js';
import {weatherAt,vegetationFor} from './environment.js';
import {animalsFor} from './fauna.js';
import {funeralView} from './funerals.js';
const spriteTypes=new Set(['house','sheepfold','weaver','tailor','healer','depot','granary','clay','reed','market','fishing','hunting','logging','quarry']);
const spriteBudget=24*1024*1024;
const placementTypes=new Set(['clay','reed','garden','quarry','logging','hunting','fishing']);
const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
export class Renderer{
 constructor(canvas,onSelect,onRoadSelect){this.onRoadSelect=onRoadSelect;this.canvas=canvas;this.ctx=canvas.getContext('2d');this.zoom=1.45;this.pan={x:0,y:0};this.ambient=0;this.visualLast=null;this.lightMode='auto';this.lights=[];this.hover=null;this.selected=null;this.effects=[];this.reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;canvas.addEventListener('pointermove',e=>{if(this.dragOrigin){this.pan.x=this.dragOrigin.panX+e.clientX-this.dragOrigin.x;this.pan.y=this.dragOrigin.panY+e.clientY-this.dragOrigin.y;this.hover=null;}else this.hover=this.pick(e.clientX,e.clientY);});canvas.addEventListener('pointerleave',()=>this.hover=null);canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointerup',()=>this.dragOrigin=null);canvas.addEventListener('pointercancel',()=>this.dragOrigin=null);canvas.addEventListener('pointerdown',e=>{if(e.button===1||e.button===2||e.shiftKey){e.preventDefault();this.dragOrigin={x:e.clientX,y:e.clientY,panX:this.pan.x,panY:this.pan.y};canvas.setPointerCapture(e.pointerId);return;}if(e.button===0){this.hover=this.pick(e.clientX,e.clientY);if(this.hover)this.selectPoint(this.hover,onSelect);}});canvas.addEventListener('keydown',e=>{const moves={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};if(moves[e.key]){e.preventDefault();const current=this.hover||{x:10,y:9};const [dx,dy]=moves[e.key];this.hover={x:Math.max(0,Math.min(WIDTH-1,current.x+dx)),y:Math.max(0,Math.min(HEIGHT-1,current.y+dy))};}if(e.key==='Enter'){e.preventDefault();this.hover ||= {x:10,y:9};this.selectPoint(this.hover,onSelect);}if(this.hover)canvas.setAttribute('aria-description',`Выбрана клетка ${this.hover.x}, ${this.hover.y}`);});this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.resize();}
 setRoadMode(enabled){this.roadMode=!!enabled;}
 selectPoint(point,onSelect){if(!this.roadMode){onSelect(point);return;}const road=this.roadNear(point);if(road)this.onRoadSelect?.(road);}
 roadNear(point){let best=null,distance=Infinity;for(const road of this.state?.roads||[]){const a=road.a,b=road.b;if(!a||!b)continue;const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy);if(d<distance){best=road;distance=d;}}return distance<.85?best:null;}
 resize(){const r=this.canvas.getBoundingClientRect();this.w=r.width;this.h=r.height;const d=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(r.width*d);this.canvas.height=Math.round(r.height*d);this.ctx.setTransform(d,0,0,d,0,0);this.layout();}
 layout(){const scale=Math.min((this.w-22)/1200,(this.h-165)/670)*this.zoom;this.s=this.mapOverview?Math.max(.1,Math.min((this.w-30)/((WIDTH+HEIGHT)*30),(this.h-60)/((WIDTH+HEIGHT)*15))):Math.max(.22,scale);this.tw=60*this.s;this.th=30*this.s;const focus=this.mapOverview?{x:(WIDTH-1)/2,y:(HEIGHT-1)/2}:{x:10,y:9};this.ox=this.w*.49-(focus.x-focus.y)*this.tw/2+(this.pan?.x||0);this.oy=this.h*.52-(focus.x+focus.y)*this.th/2+(this.pan?.y||0);}
 home(){this.mapOverview=false;this.zoom=1.45;this.pan={x:0,y:0};this.layout();}
 focusOn(x,y){this.home();const p=this.point(x+.5,y+.5);this.pan={x:this.w*(this.w>=600?.67:.88)-p.x,y:this.h*.48-p.y};this.layout();this.hover={x,y};}
 overview(){this.mapOverview=true;this.zoom=.72;this.pan={x:0,y:0};this.layout();}
 inView(x,y,padding=100){const p=this.point(x,y);return p.x>-padding*this.s&&p.x<this.w+padding*this.s&&p.y>-30*this.s&&p.y<this.h+padding*this.s;}
 point(x,y,z=0){return {x:this.ox+(x-y)*this.tw/2,y:this.oy+(x+y)*this.th/2-z*this.s};}
 pick(clientX,clientY){const r=this.canvas.getBoundingClientRect();const dx=(clientX-r.left-this.ox)/(this.tw/2),dy=(clientY-r.top-this.oy)/(this.th/2);const x=Math.floor((dx+dy)/2+.5),y=Math.floor((dy-dx)/2+.5);return terrain(x,y,this.state)==='void'?null:{x,y};}
 polygon(points,fill,stroke){const c=this.ctx;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x??p[0],p.y??p[1]):c.moveTo(p.x??p[0],p.y??p[1]));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=.7;c.stroke();}}
 line(points,color,width=1){const c=this.ctx;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x??p[0],p.y??p[1]):c.moveTo(p.x??p[0],p.y??p[1]));c.strokeStyle=color;c.lineWidth=width;c.stroke();}
 tile(x,y,color,stroke){this.polygon([this.point(x-.5,y-.5),this.point(x+.5,y-.5),this.point(x+.5,y+.5),this.point(x-.5,y+.5)],color,stroke);}
 box(x,y,w,d,h,top='#d9bd81',left='#b99460',right='#c5a36b'){this.polygon([[x-w,y-h],[x,y+d-h],[x,y+d],[x-w,y]],left);this.polygon([[x,y+d-h],[x+w,y-h],[x+w,y],[x,y+d]],right);this.polygon([[x,y-d-h],[x+w,y-h],[x,y+d-h],[x-w,y-h]],top);}
 palm(x,y,size=1,t=0){const c=this.ctx;const s=this.s*size;const sway=this.reduce?0:Math.sin(t*.5+x)*1.5*s;c.strokeStyle='#8c7950';c.lineWidth=3*s;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x-4*s,y-17*s,x+sway,y-32*s);c.stroke();const tx=x+sway,ty=y-32*s;for(let k=0;k<7;k++){const a=k*Math.PI*2/7;const len=(14+(k%2)*4)*s;c.beginPath();c.moveTo(tx,ty);c.quadraticCurveTo(tx+Math.cos(a)*len*.75,ty+Math.sin(a)*len*.5-6*s,tx+Math.cos(a)*len,ty+Math.sin(a)*len*.5+5*s);c.quadraticCurveTo(tx+Math.cos(a+.2)*len*.5,ty+Math.sin(a)*len*.3+2*s,tx,ty);c.fillStyle=k%2?'#6c8a54':'#7e995f';c.fill();}c.fillStyle='#b29a51';c.beginPath();c.arc(tx,ty+3*s,3*s,0,7);c.fill();}
 building(b,state,t){
  if(!spriteTypes.has(b.type)||b.construction){drawBuilding(this,b,state,t);return;}
  const dx=(this.canvas?.width/this.w)||1,dy=(this.canvas?.height/this.h)||dx,q=this.s,scale=`${q}/${dx}/${dy}`;
  if(this.spriteScale!==scale){this.spriteScale=scale;this.buildingSprites=new Map();this.spriteBytes=0;}
  const variant=b.type==='house'?`${hash(b.x,b.y)>.64}/${hash(b.x,7)>.5}`:['clay','quarry'].includes(b.type)?`${b.x}/${b.y}`:'';
  const key=`${b.type}/${variant}/${b.level||1}/${(this.lighting?.night||0)>.12}/${b.type==='house'?houseLightCount(b,this.houseOccupancy?.get(`${b.x},${b.y}`)??state.citizens?.filter(c=>c.home===`${b.x},${b.y}`).length??0):''}`;
  let entry=this.buildingSprites.get(key);
  if(!entry){
   const canvas=this.createLayerCanvas?.()||(typeof document!=='undefined'?document.createElement('canvas'):null);
   if(!canvas){drawBuilding(this,b,state,t);return;}
   const width=84*q,height=152*q,origin={x:42*q,y:120*q},center=this.point(b.x,b.y);
   canvas.width=Math.ceil(width*dx);canvas.height=Math.ceil(height*dy);
   const ctx=canvas.getContext('2d');if(!ctx){drawBuilding(this,b,state,t);return;}
   ctx.setTransform(dx,0,0,dy,0,0);
   const painter=Object.create(this);painter.ctx=ctx;painter.lights=[];painter.marketCargo=()=>{};
   painter.point=(x,y,z=0)=>{const p=this.point(x,y,z);return {x:p.x-center.x+origin.x,y:p.y-center.y+origin.y};};
   drawBuilding(painter,b,state,t);
   entry={canvas,width:canvas.width/dx,height:canvas.height/dy,origin,lights:painter.lights,bytes:canvas.width*canvas.height*4};
   while(this.buildingSprites.size&&(this.spriteBytes+entry.bytes>spriteBudget||this.buildingSprites.size>=128)){const oldest=this.buildingSprites.keys().next().value;this.spriteBytes-=this.buildingSprites.get(oldest).bytes;this.buildingSprites.delete(oldest);}
   if(entry.bytes<=spriteBudget){this.buildingSprites.set(key,entry);this.spriteBytes+=entry.bytes;}
  }else{this.buildingSprites.delete(key);this.buildingSprites.set(key,entry);}
  const p=this.point(b.x,b.y),x=p.x-entry.origin.x,y=p.y-entry.origin.y;
  this.ctx.drawImage(entry.canvas,x,y,entry.width,entry.height);
  for(const light of entry.lights)this.lights.push({x:x+light.x,y:y+light.y,size:light.size});
  if(b.type==='market')this.marketCargo(b,state);
 }
 refreshCity(state) {
  this.state=state;this.professionByWork=new Map(state.buildings.map(b=>[b.id||`${b.x},${b.y}`,b.type]));this.houseOccupancy=new Map();for(const c of state.citizens||[])this.houseOccupancy.set(c.home,(this.houseOccupancy.get(c.home)||0)+1);
  const signature=[...state.buildings,...state.roadAnchors||[]].map(b=>`${b.type}:${b.x},${b.y}:${b.construction?.kind||'ready'}`).join('|');
  if(signature!==this.citySignature){this.citySignature=signature;this.streets=generateStreets([...state.buildings,...state.roadAnchors||[]],state);}
  const vegetationKey=signature+'|'+state.season+'|'+!!state.drought+'|'+weatherAt(state).type+'|'+Math.floor((state.simTime||0)/10);
  if(this.vegetationKey!==vegetationKey){this.vegetationKey=vegetationKey;this.scenery=vegetationFor(state,this.streets);for(const d of state.world?.deposits||[])if(['forest','dates'].includes(d.kind)&&!state.buildings.some(b=>b.x===d.x&&b.y===d.y))for(let k=0;k<3;k++)this.scenery.push({x:d.x+(k-1)*.17,y:d.y+(k%2)*.14,kind:'palm',size:.44});}
 }
 caravan(e){
  const p=this.point(e.x,e.y,onBridge(this.state.buildings,e.x,e.y)?5:0),q=this.s,c=this.ctx;
  const next=e.route?.[e.routeIndex||0],previous=e.route?.[Math.max(0,(e.routeIndex||0)-1)];
  const direction=next&&Math.hypot(next.x-e.x,next.y-e.y)>.001?next:previous;
  const facing=direction?((next===direction?1:-1)*((direction.x-e.x)-(direction.y-e.y))>=0?1:-1):1;
  const moving=['arriving','departing'].includes(e.phase),step=this.reduce||!moving?0:Math.sin((this.state.simTime||0)*6),bob=Math.abs(step)*q;
  c.save();c.translate(p.x,p.y);c.scale(facing,1);
  c.fillStyle='#5d614632';c.beginPath();c.ellipse(-2*q,5*q,15*q,4*q,0,0,7);c.fill();
  for(const [x,offset]of [[-10,1],[0,-1]]){this.line([[x*q,-3*q],[(x+step*offset*2)*q,8*q]],'#8a7353',2*q);this.line([[(x+4)*q,-2*q],[(x+4-step*offset*2)*q,9*q]],'#a58b63',1.8*q);}
  c.fillStyle='#b59b71';c.beginPath();c.ellipse(-4*q,-5*q-bob,12*q,6*q,0,0,7);c.fill();
  this.line([[5*q,-6*q-bob],[9*q,-20*q-bob],[16*q,-20*q-bob]],'#b59b71',5*q);
  this.line([[12*q,-22*q-bob],[11*q,-26*q-bob]],'#92794f',1.4*q);
  c.fillStyle='#655a40';c.beginPath();c.arc(16*q,-21*q-bob,.8*q,0,7);c.fill();
  this.line([[-15*q,-6*q-bob],[-19*q,-3*q-bob]],'#8d7754',1.2*q);
  this.polygon([[-13*q,-9*q-bob],[2*q,-9*q-bob],[3*q,-1*q-bob],[-12*q,-1*q-bob]],'#ab705c');
  this.line([[-11*q,-8*q-bob],[1*q,-8*q-bob]],'#e4cea1',1.3*q);
  for(const [x,color]of [[-10,'#a4aa79'],[-3,'#d2b284']]){this.box(x*q,-9*q-bob,4*q,2*q,6*q,color,'#8d7953','#b8a074');this.line([[x*q,-14*q-bob],[x*q,-7*q-bob]],'#e7d6a6',.8*q);}
  this.line([[17*q,-20*q-bob],[24*q,-3*q]],'#917e57',.7*q);
  c.restore();
  // The merchant and the animal share the same depth entry and simulation clock.
  const mx=p.x+facing*23*q,my=p.y+2*q;
  this.line([[mx-q,my-3*q],[mx-step*q,my+3*q],[mx+q,my-3*q],[mx+step*q,my+3*q]],'#6f6249',1.2*q);
  this.polygon([[mx-3*q,my-10*q],[mx+2*q,my-10*q],[mx+4*q,my-2*q],[mx-3*q,my-2*q]],'#687f79');
  c.fillStyle='#a88b62';c.beginPath();c.arc(mx,my-12*q,2*q,0,7);c.fill();
  this.line([[mx-2*q,my-14*q],[mx+3*q,my-14*q]],'#ead7ad',2*q);
  if(['unloading','loading'].includes(e.phase)){const lift=this.reduce?0:(Math.sin((this.state.simTime||0)*3)+1)*2*q;this.box(mx-facing*5*q,my-3*q-lift,3*q,1.5*q,4*q,'#ceb184','#977b54','#b89b6c');}
 }
 marketCargo(b,state){
  const queue=state.trade?.deliveries||[],loads=queue.filter(item=>item.market===`${b.x},${b.y}`);
  let amount=loads.reduce((n,item)=>n+(item.remaining||0),0);
  const outgoing=(state.trade?.sales||[]).filter(item=>item.market===`${b.x},${b.y}`&&item.caravanId===state.trade?.caravan?.id).reduce((n,item)=>n+(item.loaded||0),0);
  if(!amount&&!outgoing)return;
  const p=this.point(b.x,b.y),q=this.s;
  for(let k=0;k<Math.min(8,Math.ceil(amount/6));k++){const x=p.x+(15+(k%3)*4)*q,y=p.y+(-6+Math.floor(k/3)*3)*q;this.box(x,y,3*q,1.5*q,(4+Math.floor(k/6)*4)*q,'#d0b081','#99764e','#b69362');this.line([[x,y-4*q],[x,y+q]],'#e6d09b',.7*q);}
  for(let k=0;k<Math.min(4,Math.ceil(outgoing/6));k++){const x=p.x+(-21+k*4)*q,y=p.y+9*q;this.box(x,y,3*q,1.5*q,4*q,'#8fa498','#657f72','#7e9585');this.line([[x,y-4*q],[x,y+q]],'#d9d9aa',.7*q);}
 }
 placementSites(s,selection){
  if(!placementTypes.has(selection))return [];
  const key=JSON.stringify([selection,s.buildings.map(b=>[b.type,b.x,b.y]),s.world]);
  if(this.placementCache?.state===s&&this.placementCache.key===key)return this.placementCache.tiles;
  const tiles=[];for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++)if(!canPlace(s,selection,x,y))tiles.push({x,y});
  this.placementCache={state:s,key,tiles};return tiles;
 }
 placementLayer(s,selection){
  if(!placementTypes.has(selection))return;
  const pulse=this.reduce?1:.82+Math.sin((s.simTime||0)*2)*.18,special=['clay','reed','garden','quarry','logging','hunting','fishing'].includes(selection),c=this.ctx;
  c.save();c.lineJoin='round';c.shadowColor='#efff96';c.shadowBlur=5*this.s;
  for(const {x,y}of this.placementSites(s,selection)){
   if(!this.inView(x,y,40))continue;
   const points=[this.point(x-.45,y-.45),this.point(x+.45,y-.45),this.point(x+.45,y+.45),this.point(x-.45,y+.45)];
   c.globalAlpha=pulse;
   this.polygon(points,special?'#d0ec9650':'#fff8d223');
   this.line([...points,points[0]],special?'#c7ff82':'#fff5b0',Math.max(1,(special?2.6:1.15)*this.s));
   if(special){const inner=[this.point(x-.39,y-.39),this.point(x+.39,y-.39),this.point(x+.39,y+.39),this.point(x-.39,y+.39)];this.line([...inner,inner[0]],'#f7e78b',1.1*this.s);}
  }
  c.restore();
 }
 groundStocks(s){
  if(s.buildings.some(b=>b.type==='granary'&&b.construction?.kind!=='new'))return [];
  const depot=s.buildings.find(b=>b.type==='shrine'&&b.construction?.kind!=='new')||s.buildings.find(b=>b.type==='house'&&b.construction?.kind!=='new');
  if(!depot)return [];
  const port=this.streets.ports.find(p=>p.building.x===depot.x&&p.building.y===depot.y);
  const stock={...s.resources};for(const order of s.trade?.sales||[])stock[order.resource]=(stock[order.resource]||0)+order.remaining;for(const b of [...s.buildings,...s.roads||[]])for(const [k,n]of Object.entries(b.construction?.remaining||{}))stock[k]=(stock[k]||0)+n;
  return [{kind:'groundStocks',x:port?.x??depot.x+.5,y:port?.y??depot.y+.5,stock}];
 }
 stockPile(e){
  const p=this.point(e.x,e.y),q=this.s,c=this.ctx,materials=['food','clay','reed','wood','stone','hides','wool','cloth'];
  for(const [i,kind]of materials.entries()){
   const amount=e.stock[kind]||0;if(amount<=0)continue;
   const x=p.x+((i%3)-1)*12*q,y=p.y+Math.floor(i/3)*9*q;
   const n=Math.min(3,Math.max(1,Math.ceil(amount/50)));
   for(let k=0;k<n;k++){
    const a=x+(k-1)*3*q,z=y-k*2*q;
    if(kind==='reed'){for(let j=0;j<4;j++)this.line([[a+(j-2)*q,z],[a+(j+3)*q,z-8*q]],'#8e9c66',1.4*q);this.line([[a-q,z-3*q],[a+4*q,z-5*q]],'#e0ce93',q);}
    else if(kind==='wood'){this.line([[a-5*q,z],[a+5*q,z-5*q]],'#9b7951',4*q);c.fillStyle='#d1b77e';c.beginPath();c.ellipse(a-5*q,z,2*q,1.7*q,0,0,7);c.fill();}
    else if(kind==='wool'){c.fillStyle='#e7dec0';c.beginPath();c.arc(a,z-3*q,4*q,0,7);c.fill();this.line([[a-2*q,z-5*q],[a+2*q,z-q]],'#b5a989',.8*q);}
    else if(kind==='cloth')this.box(a,z,4*q,2*q,2*q,'#a0b198','#6e8876','#8c9e85');
    else if(kind==='hides'){this.polygon([[a-4*q,z],[a-2*q,z-4*q],[a+4*q,z-5*q],[a+5*q,z-2*q],[a+2*q,z+q]],'#b78e62');this.line([[a-2*q,z-2*q],[a+3*q,z-3*q]],'#ddc69c',.7*q);}
    else this.box(a,z,(kind==='food'?3.5:4)*q,2*q,(kind==='stone'?4:3)*q,{food:'#d1bb76',clay:'#bd8b65',stone:'#b7bba9'}[kind],kind==='stone'?'#8c968c':'#9a7952',kind==='stone'?'#a3ad9f':'#b89a68');
   }
   if(kind==='food'){c.strokeStyle='#8a7750';c.lineWidth=q;c.beginPath();c.ellipse(x,y-3*q,4*q,2*q,0,0,7);c.stroke();}
  }
 }
 animal(e){
  const p=this.point(e.x,e.y),q=this.s,c=this.ctx,t=this.reduce?0:(this.state.simTime||0),step=this.reduce||e.walking===false?0:Math.sin(e.step??t*4),color={goat:'#c4bb96',gazelle:'#b99b6f',jackal:'#a39270'}[e.kind]||'#b99b6f';
  c.save();
  if(e.kind==='sheep'){
   c.translate(p.x,p.y);c.scale((e.heading||1)*.62,.62);
   for(const a of [-4,3])this.line([[a*q,-2*q],[(a+step*.7)*q,4*q]],'#786e54',1.3*q);
   c.fillStyle='#eee5c9';for(const [a,z,r]of [[-5,-5,4],[0,-7,4.5],[5,-5,3.7],[-1,-3,5]]){c.beginPath();c.arc(a*q,z*q,r*q,0,7);c.fill();}
   const head=e.behavior==='grazing'?0:-5;c.fillStyle='#8d8060';c.beginPath();c.ellipse(7*q,head*q,2.8*q,2.4*q,.3,0,7);c.fill();this.line([[6*q,(head-1)*q],[4*q,(head-3)*q]],'#a99b77',1.7*q);c.fillStyle='#514f3c';c.fillRect(8*q,(head-.7)*q,.8*q,.8*q);c.restore();return;
  }
  if(e.kind==='cat'||e.kind==='mouse'){
   const cat=e.kind==='cat',z=cat?1:.42,face=e.heading||1,asleep=e.behavior==='sleeping';c.translate(p.x,p.y);c.scale(face*z,z);
   c.fillStyle=cat?'#9c8d70':'#827866';c.beginPath();c.ellipse(0,-2*q,(asleep?5:4.5)*q,(asleep?2.8:2.3)*q,0,0,7);c.fill();
   if(cat){this.line([[-4*q,-2*q],[-7*q,-4*q],[-6*q,-7*q]],'#8b7d64',1.3*q);if(!asleep){for(const a of [-2,2])this.line([[a*q,-q],[(a+step)*q,2*q]],'#756b55',q);this.polygon([[2*q,-3*q],[3*q,-7*q],[5*q,-4*q],[6*q,-6*q],[7*q,-2*q]],'#a5987c');this.line([[-2*q,-4*q],[-q,-q]],'#746b56',.8*q);this.line([[q,-4*q],[2*q,-q]],'#746b56',.8*q);}}else this.line([[-4*q,-2*q],[-9*q,-q]],'#9a8e78',q);
   c.restore();return;
  }
  if(e.kind==='bird'){const flap=this.reduce?2:Math.sin(t*5+(Number(e.id)||0))*3;this.line([[p.x-5*q,p.y-(3+flap)*q],[p.x,p.y],[p.x+5*q,p.y-(3+flap)*q]],'#758473',1.2*q);c.restore();return;}
  const facing=e.heading||e.facing||(String(e.id).startsWith('funeral-')?(this.state.funeral?.boundary.x<WIDTH/2?-1:1):1),x=p.x,y=p.y;
  c.translate(x,y);c.scale(facing,1);if(e.behavior==='grazing'){c.translate(0,2*q);c.rotate(.13);}
  c.fillStyle='#59634424';c.beginPath();c.ellipse(0,2*q,8*q,2.5*q,0,0,7);c.fill();
  for(const a of [-4,3]){this.line([[a*q,-2*q],[(a+step*.6)*q,4*q]],'#81704f',q);this.line([[(a+2)*q,-2*q],[(a+2-step*.6)*q,4*q]],'#97835d',q);}
  c.fillStyle=color;c.beginPath();c.ellipse(-q,-4*q,7*q,3.5*q,0,0,7);c.fill();
  this.line([[4*q,-4*q],[6*q,-10*q],[10*q,-10*q]],color,e.kind==='jackal'?2*q:2.8*q);
  this.line([[-7*q,-4*q],[-11*q,(e.kind==='jackal'?-2:-7)*q]],color,e.kind==='jackal'?2*q:q);
  if(e.kind==='jackal'){this.polygon([[5*q,-10*q],[6*q,-15*q],[8*q,-10*q]],'#8a7b5e');this.polygon([[8*q,-10*q],[10*q,-14*q],[11*q,-9*q]],'#a39270');}
  else{this.line([[7*q,-11*q],[6*q,-16*q]],'#786c4e',q);this.line([[9*q,-11*q],[10*q,-16*q]],'#786c4e',q);if(e.kind==='gazelle')this.line([[6*q,-16*q],[7*q,-19*q]],'#786c4e',.7*q);}
  c.fillStyle='#4f513b';c.beginPath();c.arc(10*q,-10*q,.6*q,0,7);c.fill();c.restore();
 }
 bier(e){
  const p=this.point(e.x,e.y,onBridge(this.state?.buildings||[],e.x,e.y)?5:0),q=this.s;
  this.line([[p.x-13*q,p.y+q],[p.x+14*q,p.y+q]],'#8b7957',2*q);
  this.box(p.x,p.y,10*q,4*q,3*q,'#c7b78d','#9e8b62','#b6a477');
  this.polygon([[p.x-9*q,p.y-4*q],[p.x-3*q,p.y-9*q],[p.x+7*q,p.y-6*q],[p.x+10*q,p.y-2*q],[p.x,p.y+2*q]],'#ece0bd');
  this.line([[p.x-6*q,p.y-3*q],[p.x+6*q,p.y-3*q]],'#c8b996',.8*q);
 }
 vegetation(e,t,state){
  const p=this.point(e.x,e.y),q=this.s*(e.growth||1),c=this.ctx,dry=state.drought||e.vigor<.5,color=dry?'#a49c64':state.season===3?'#8c9a69':e.vigor>.9?'#668b56':'#78935f';
  if(e.kind==='palm'){this.palm(p.x,p.y,e.size||.8,t*(this.weather?.type==='wind'?3:1));return;}
  if(e.kind==='rock'){this.box(p.x,p.y,5*q,3*q,4*q,'#c6bf9d','#aea98b','#b6b293');return;}
  const sway=this.reduce?0:Math.sin(t*(this.weather?.type==='wind'?3:1.2)+e.x)*1.6;
  if(e.kind==='shrub'){for(let k=0;k<4;k++){c.fillStyle=color;c.beginPath();c.ellipse(p.x+(k-1.5)*3*q,p.y-(3+k%2*2)*q,4*q,3*q,0,0,7);c.fill();}return;}
  for(let k=0;k<5;k++){const x=p.x+(k-2)*2*q,height=(e.kind==='reed'?13:4)+(k%3)*2;this.line([[x,p.y],[x+(sway+k%2)*q,p.y-height*q]],color,q);if(e.kind==='reed')this.line([[x+sway*q,p.y-height*q],[x+sway*q,p.y-(height+3)*q]],'#9b8057',2*q);}
 }
 weatherLayer(s){
  const c=this.ctx,weather=this.weather,{w,h}=this,t=this.reduce?0:(s.simTime||0),weight=type=>(weather.type===type?weather.blend:0)+(weather.previous===type?1-weather.blend:0);
  const cloud=weight('cloudy')+weight('rain')*.65;
  if(cloud){c.fillStyle=`rgba(73,94,101,${cloud*.11})`;c.fillRect(0,0,w,h);}
  const rain=weight('rain');if(rain){c.save();c.globalAlpha=rain;c.strokeStyle='#c7e2dc88';c.lineWidth=.8;for(let k=0;k<(this.reduce?28:120);k++){const x=hash(k,31)*w,y=(hash(k,76)*h+t*190)%h;this.line([[x,y],[x-4,y+11]],'#c7e2dc88',.8);}for(let k=0;k<20;k++){const y=hash(k,8)*(HEIGHT-1),p=this.point(river(y)+(hash(k,9)-.5),y);c.beginPath();c.ellipse(p.x,p.y,(2+(t*2+k)%4)*this.s,this.s,0,0,7);c.stroke();}c.restore();}
  if(weight('wind')&&!this.reduce){c.save();c.globalAlpha=weight('wind')*.5;for(let k=0;k<16;k++){const x=(hash(k,63)*w+t*27)%w,y=hash(k,28)*h;this.line([[x,y],[x+5,y-2]],'#b0ad76',1);}c.restore();}
 }
 person(person) {
  const c=this.ctx,q=this.s*(person.age<16?.75:1.2),p=this.point(person.x,person.y,person.onBridge?5:0);
  const playTime=this.state?.simTime||0;
  const stride=person.walking&&!this.reduce?Math.sin((person.step||0)+(Number(person.id)||0))*1.45:0;
  c.save();
  if(person.playing&&person.id%2===0){c.fillStyle='#b4804f';c.beginPath();c.arc(p.x+6*q,p.y-Math.abs(Math.sin(playTime*3))*3*q,1.8*q,0,7);c.fill();}
  c.fillStyle='#4e543b40';c.beginPath();c.ellipse(p.x+q,p.y+q,3.8*q,1.7*q,0,0,7);c.fill();
  this.line([[p.x-1.1*q,p.y-3*q],[p.x+stride*q,p.y]],'#665841',1.25*q);
  this.line([[p.x+1.1*q,p.y-3*q],[p.x-stride*q,p.y]],'#665841',1.25*q);
  const look=residentAppearance(person,this.professionByWork||[]);drawResidentClothes(this,p,q,look);
  this.line([[p.x-2*q,p.y-7*q],[p.x-3*q,p.y-(4+stride*.4)*q]],'#a3835e',1.2*q);
  this.line([[p.x+2*q,p.y-7*q],[p.x+3*q,p.y-(4-stride*.4)*q]],'#a3835e',1.2*q);
  c.fillStyle='#a68259';c.beginPath();c.arc(p.x,p.y-10.5*q,1.9*q,0,7);c.fill();
  this.line([[p.x-1.6*q,p.y-11.7*q],[p.x+1.7*q,p.y-11.7*q]],person.age>=55?'#deddd3':person.id%2?'#eee0b7':'#5c5140',1.7*q);
  if(person.mourningTorch){const x=p.x+5*q,y=p.y-12*q,flicker=this.reduce?0:Math.sin((this.state?.simTime||0)*9+(person.id||0))*q;
   this.line([[p.x+2*q,p.y-6*q],[x,p.y-8*q],[x,y]],'#936746',1.4*q);
   this.polygon([[x-2*q,y],[x+flicker,y-6*q],[x+2*q,y]],'#ee983f');this.polygon([[x-q,y],[x,y-4*q],[x+q,y]],'#ffe19a');
   if((person.id||0)%4===0)this.lights.push({x,y:y-2*q,size:17*q});
  }
  if(person.guarding){const swing=this.reduce?0:Math.sin(person.step||0);this.line([[p.x+2*q,p.y-5*q],[p.x+(7+swing)*q,p.y-10*q]],'#92764f',1.4*q);for(let i=0;i<4;i++)this.line([[p.x+(6+swing)*q,p.y-10*q],[p.x+(6+i+swing)*q,p.y-14*q]],'#b5a36c',q);}
  else if(look.craft&&person.phase==='working'){const swing=this.reduce?0:Math.sin(person.step||0);this.line([[p.x+2*q,p.y-6*q],[p.x+(4+swing)*q,p.y-7*q]],'#a3835e',q);}
  else if(['working','constructing'].includes(person.phase)){const swing=this.reduce?0:Math.sin(person.step||0)*2;this.line([[p.x+3*q,p.y-5*q],[p.x+(7+swing)*q,p.y-11*q]],'#7b6548',1.2*q);this.line([[p.x+(5+swing)*q,p.y-12*q],[p.x+(10+swing)*q,p.y-10*q]],'#aaa17c',1.8*q);}
  if(person.carrying){const cargo=typeof person.cargo==='string'?person.cargo:Object.keys(person.cargo||{})[0];const color={food:'#dfbf62',wood:'#9b7850',stone:'#aeb5a6',hides:'#b38a61',wool:'#e7dec0',cloth:'#91a58b',grain:'#dfbf62',clay:'#bd8059',reed:'#8eaa6a',faith:'#7bb6b3',prestige:'#dec47b'}[cargo]||'#d4b77d';this.box(p.x+3*q,p.y-3*q,2.6*q,1.3*q,3.5*q,color,'#9b7f51','#b99b65');this.line([[p.x+1.5*q,p.y-7*q],[p.x+4*q,p.y-8*q]],'#c5b085',.8*q);}
  c.restore();
 }
 bridge(b,rails=true){const span=bridgeSpan(b.y),{left,right,y}=span;this.polygon([this.point(left,y-.13,5),this.point(right,y-.13,5),this.point(right,y+.13,5),this.point(left,y+.13,5)],'#c7ad7c','#8e7853');this.line([this.point(left,y+.13,5),this.point(right,y+.13,5)],'#92784d',3*this.s);for(let x=left;x<right;x+=.18)this.line([this.point(x,y-.13,5),this.point(x,y+.13,5)],'#8b754e',this.s*.65);this.bridgeRail(left,right,y-.13);if(rails)this.bridgeRail(left,right,y+.13);}
 bridgeRail(left,right,y){this.line([this.point(left,y,13),this.point(right,y,13)],'#ac8e5e',1.7*this.s);for(let x=left;x<=right+.01;x+=.5)this.line([this.point(x,y,3),this.point(x,y,14)],'#8e754e',2*this.s);}
 streetLamp(lamp,t) {
  const p=this.point(lamp.x,lamp.y),q=this.s;
  this.line([[p.x,p.y],[p.x,p.y-16*q]],'#80704f',1.5*q);
  this.box(p.x,p.y-15*q,2.5*q,1.25*q,2*q,'#a58b58','#7d6946','#8e794d');
  this.polygon([[p.x-1.8*q,p.y-18*q],[p.x,p.y-(24+Math.sin(t*5+lamp.x)*1.2)*q],[p.x+1.8*q,p.y-18*q]],'#f6c878');
  this.lights.push({x:p.x,y:p.y-20*q,size:30*q});
 }
 streetsLayer() {
  const c=this.ctx;c.save();c.lineCap='round';c.lineJoin='round';
  const edgeKey=(a,b)=>[a.key,b.key].sort().join('|'),edges=[...this.streets.edges],seen=new Set(edges.map(([a,b])=>edgeKey(a,b))),roads=new Map();
 for(const road of this.state?.roads||[]){const key=edgeKey(road.a,road.b);if(!roads.has(key))roads.set(key,road);if(!seen.has(key)){edges.push([road.a,road.b]);seen.add(key);}}
 const hovered=this.roadMode?this.roadNear(this.hover||{})?.id:null;
  for(const [color,width] of [['#af9c73',7.6],['#dbc79c',5.4]])for(const [a,b] of edges)this.line([this.point(a.x,a.y),this.point(b.x,b.y)],color,width*this.s);
  for(const [a,b] of edges){const road=roads.get(edgeKey(a,b)),level=road?.level||1;const path=[this.point(a.x,a.y),this.point(b.x,b.y)];this.line(path,level===3?'#ad7956':level===2?'#b5af94':'#ead9b4',(level>1?4:1.2)*this.s);if(level===3)for(let k=1;k<5;k++){const f=k/5,p=this.point(a.x+(b.x-a.x)*f,a.y+(b.y-a.y)*f);this.line([[p.x-2*this.s,p.y-2*this.s],[p.x+2*this.s,p.y+2*this.s]],'#dfbd91',.65*this.s);}if(road?.construction){const p=this.point(road.x,road.y);this.box(p.x,p.y,4*this.s,2*this.s,3*this.s,'#e4ba77','#aa8054','#c69b62');this.line([[p.x-5*this.s,p.y-6*this.s],[p.x+5*this.s,p.y-2*this.s]],'#977b4b',2*this.s);}if(road&&(this.routeRoads?.has(road.id)||this.selectedRoad===road.id||this.selectedRoad?.id===road.id||this.roadMode&&hovered===road.id))this.line(path,'#fff0ae',2*this.s);}
  for(const port of this.streets.ports){const p=this.point(port.x,port.y);this.box(p.x,p.y,4*this.s,2*this.s,.6*this.s,'#e6d5ac','#bfac81','#cdbc91');}
  c.restore();
 }
 nightLayer(light,t) {
  const c=this.ctx;
  if(light.warm){c.fillStyle=`rgba(223,133,63,${light.warm*.18})`;c.fillRect(0,0,this.w,this.h);}
  if(!light.night)return;
  c.fillStyle=`rgba(17,31,65,${light.night*.67})`;c.fillRect(0,0,this.w,this.h);
  c.save();c.globalCompositeOperation='screen';
  for(const p of this.lights){const alpha=light.night*(this.reduce?.3:.28+Math.sin(t*3+p.x)*.025);const glow=c.createRadialGradient(p.x,p.y,0,p.x,p.y,p.size);glow.addColorStop(0,`rgba(255,181,67,${alpha*1.2})`);glow.addColorStop(.25,`rgba(245,154,45,${alpha*.6})`);glow.addColorStop(1,'rgba(240,138,44,0)');c.fillStyle=glow;c.fillRect(p.x-p.size,p.y-p.size,p.size*2,p.size*2);}
  c.restore();
 }
 terrainLayer(s){
  const key=JSON.stringify([this.w,this.h,this.canvas.width,this.canvas.height,this.s,this.ox,this.oy,!!s.drought,s.season,s.world]);
  let cache=this.terrainCache;
  if(!cache||cache.key!==key){
   const canvas=cache?.canvas||this.createLayerCanvas?.()||(typeof document!=='undefined'?document.createElement('canvas'):null);
   if(!canvas){this.drawTerrain(s);return;}
   canvas.width=this.canvas.width||Math.ceil(this.w);canvas.height=this.canvas.height||Math.ceil(this.h);
   const layer=canvas.getContext('2d');if(!layer){this.drawTerrain(s);return;}
   layer.setTransform(canvas.width/this.w,0,0,canvas.height/this.h,0,0);
   const destination=this.ctx;this.ctx=layer;try{this.drawTerrain(s);}finally{this.ctx=destination;}
   this.terrainCache=cache={key,canvas};
  }
  this.ctx.drawImage(cache.canvas,0,0,this.w,this.h);
 }
 drawTerrain(s){
  const c=this.ctx;
 // A raised alluvial plain, its strata visible along the southern edge.
 const a=this.point(-.5,HEIGHT-.5),b=this.point(WIDTH-.5,HEIGHT-.5),d=this.point(WIDTH-.5,-.5);this.polygon([a,b,{x:b.x,y:b.y+12*this.s},{x:a.x,y:a.y+12*this.s}],'#c4b68d');this.polygon([b,d,{x:d.x,y:d.y+12*this.s},{x:b.x,y:b.y+12*this.s}],'#b2ab83');
 for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){if(!this.inView(x,y,40))continue;const k=hash(x,y),type=terrain(x,y,s),dist=Math.abs(x-river(y));let color=dist<2.4?['#b7bf8b','#bdc591','#b4c18a'][Math.floor(k*3)]:type==='fertile'?['#c3c797','#c7ca9b','#bfc492'][Math.floor(k*3)]:['#d6c99f','#d9cca4','#d3c79d','#d5cba4'][Math.floor(k*4)];if(s.drought&&type==='fertile')color=['#c6bc89','#ccbf8f','#c1b884'][Math.floor(k*3)];this.tile(x,y,color);drawGroundTexture(this,s,x,y,type);if(k>.88&&type==='sand'){const p=this.point(x,y);this.line([[p.x-5*this.s,p.y],[p.x+3*this.s,p.y+2*this.s]],'#bdb58b',this.s);}}
 const riverPoints=[];for(let y=-.5;y<=HEIGHT-.5;y+=.25)riverPoints.push(this.point(river(y)-1.12,y));for(let y=HEIGHT-.5;y>=-.5;y-=.25)riverPoints.push(this.point(river(y)+1.12,y));this.polygon(riverPoints,s.drought?'#74a9a1':'#6aaba7');const inner=[];for(let y=-.5;y<=HEIGHT-.5;y+=.25)inner.push(this.point(river(y)-.7,y));for(let y=HEIGHT-.5;y>=-.5;y-=.25)inner.push(this.point(river(y)+.6,y));this.polygon(inner,'#5e9f9e');
 for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){if(!this.inView(x,y,40))continue;if(terrain(x,y,s)==='water'&&Math.abs(x-river(y))>1.2){this.tile(x,y,'#70aaa2');for(const [dx,dy,a,b]of [[0,-1,[x-.5,y-.5],[x+.5,y-.5]],[1,0,[x+.5,y-.5],[x+.5,y+.5]],[0,1,[x+.5,y+.5],[x-.5,y+.5]],[-1,0,[x-.5,y+.5],[x-.5,y-.5]]])if(terrain(x+dx,y+dy,s)!=='water')this.line([this.point(...a),this.point(...b)],'#a5bb8a',3*this.s);const p=this.point(x,y);this.line([[p.x-8*this.s,p.y],[p.x+5*this.s,p.y+2*this.s]],'#b1d1be77',this.s);}const deposit=depositAt(s,x,y);if(deposit&&terrain(x,y,s)!=='water'){const kind=typeof deposit==='string'?deposit:deposit.kind,colors={clay:'#b88764',reed:'#8ca16a',stone:'#a8ae9b',forest:'#719064',wildlife:'#b69c72',dates:'#bba161'};this.tile(x,y,(colors[kind]||'#a8ad7a')+'77');const p=this.point(x,y);if(kind==='stone'||kind==='clay')for(let k=0;k<3;k++)this.box(p.x+(k-1)*7*this.s,p.y+(k%2)*3*this.s,4*this.s,2*this.s,(3+k)*this.s,colors[kind],'#999276','#b1a282');}}
 }
 addEffect(id){this.effects.push({id,start:performance.now()});}
 draw(s,selection,time=performance.now()){this.layout();
 if(this.visualLast!==null&&!(typeof document!=='undefined'&&document.hidden))this.ambient+=Math.min(.25,Math.max(0,(time-this.visualLast)/1000));
 this.visualLast=time;
 const c=this.ctx,w=this.w,h=this.h,t=this.reduce?0:this.ambient;
 const modeSeconds={day:10,sunset:26.25,night:37.5};
 this.lighting=lightingAt(this.lightMode==='auto'?(s.simTime||0):(modeSeconds[this.lightMode]??s.simTime??0));
 this.refreshCity(s);this.weather=weatherAt(s);this.lights=[];c.clearRect(0,0,w,h);c.save();const ground=this.point(10,9);const glow=c.createRadialGradient(ground.x,ground.y,10,ground.x,ground.y,w*.7);glow.addColorStop(0,'#f0ecd9');glow.addColorStop(1,'#e2e6d8');c.fillStyle=glow;c.fillRect(0,0,w,h);
 if(this.lighting.night){c.fillStyle=`rgba(239,232,207,${this.lighting.night*.65})`;for(let k=0;k<55;k++){const px=hash(k,34)*w,py=hash(k,56)*(h-80);c.beginPath();c.arc(px,py,(k%5===0?1.2:.6)*this.s,0,7);c.fill();}}
 this.terrainLayer(s);
 for(let k=0;k<42;k++){const yy=((k*.47+t*.13)%(HEIGHT-.3))-.4;const xx=river(yy)+(hash(k,9)-.5)*1.45;const p=this.point(xx,yy),p2=this.point(xx+.13+hash(k,8)*.4,yy+.06);this.line([p,p2],'#c3d9bd70',this.s);}
 const irrigation=irrigationFor(s);
 for(const b of s.buildings)if(b.type==='canal'&&!b.construction)drawCanal(this,b,s,{network:irrigation});
 this.streetsLayer();
 for(const b of s.buildings)if(b.type==='canal'&&!b.construction)drawCanal(this,b,s,{crossings:true,network:irrigation});
 for(const b of s.buildings)if(b.type==='bridge'&&!b.construction)this.bridge(b,false);
 const entities=[...s.buildings.filter(b=>!['bridge','canal'].includes(b.type)||b.construction).map(b=>({...b,kind:'building'})),...this.scenery,...visibleCitizens(s).map(person=>({...person,kind:'person',onBridge:onBridge(s.buildings,person.x,person.y)}))];
 const funeral=funeralView(s);entities.push(...animalsFor(s),...this.groundStocks(s));if(funeral){if(funeral.coffin)entities.push({...funeral.coffin,kind:'bier'});entities.push(...funeral.jackals);for(const id of funeral.mourners||[]){const existing=entities.find(e=>e.kind==='person'&&e.id===id);if(existing){existing.robe='#c7c9ae';existing.mourningTorch=!!funeral.torches;existing.carrying=false;existing.walking=true;existing.phase='mourning';}else{const citizen=s.citizens.find(c=>c.id===id);if(citizen)entities.push({...citizen,kind:'person',robe:'#c7c9ae',mourningTorch:!!funeral.torches,phase:'mourning',walking:true,step:(s.simTime||0)*4});}}}
 for(const b of s.buildings)if(b.type==='bridge'&&b.construction?.kind!=='new'){const span=bridgeSpan(b.y);for(let x=span.left;x<span.right;x+=.5)entities.push({x:x+.25,y:span.y+.13,kind:'bridgeRail',end:Math.min(x+.5,span.right)});}
 const lamps=[...this.streets.nodes.values()].filter((p,i)=>i%4===0||this.streets.graph.get(p.key).size>=3).map(p=>({...p,kind:'lamp'}));
 entities.push(...lamps);if(s.trade?.caravan&&Number.isFinite(s.trade.caravan.x)&&Number.isFinite(s.trade.caravan.y))entities.push({...s.trade.caravan,kind:'caravan'});
 for(const e of sortScene(entities)){
  if(!this.inView(e.x,e.y,150))continue;
  if(e.kind==='person'&&s.funeral?.actors.some(a=>a.id===e.id)&&funeral?.gather&&funeral.stage==='gathering'&&Math.abs(e.x-funeral.gather.x)+Math.abs(e.y-funeral.gather.y)<.05)continue;
  const p=this.point(e.x,e.y);
  if(e.kind==='bridgeRail')this.bridgeRail(e.x-.25,e.end,e.y);
  else if(e.kind==='building'){if(e.construction)drawConstruction(this,e,s,t);else this.building(e,s,t);}
  else if(e.kind==='person')this.person(e);
  else if(e.kind==='caravan')this.caravan(e);
  else if(e.kind==='groundStocks')this.stockPile(e);
  else if(e.kind==='bier')this.bier(e);
  else if(e.kind==='pestCatch'){const p=this.point(e.x,e.y);c.save();c.globalAlpha=1-e.progress;c.font=`${Math.max(9,11*this.s)}px Arial`;c.fillStyle='#427c67';c.textAlign='center';c.fillText(e.by==='cat'?'Поймала!':'Прогнал!',p.x,p.y-(12+e.progress*12)*this.s);c.restore();}
  else if(['goat','gazelle','bird','jackal','cat','mouse','sheep'].includes(e.kind))this.animal(e);
  else if(['palm','shrub','grass','reed','rock'].includes(e.kind))this.vegetation(e,this.reduce?0:s.simTime||0,s);
  else if(e.kind==='lamp')this.streetLamp(e,t);
  else this.box(p.x,p.y,5*this.s,3*this.s,4*this.s,'#c6bf9d','#aea98b','#b6b293');
 }
 for(const b of [...s.buildings,...s.roads||[]])if(b.construction&&this.inView(b.x,b.y,150))drawConstructionLabel(this,b);
 // The landing and a slow reed boat.
 const dock=this.point(river(10)-1.4,10);for(let i=0;i<5;i++)this.box(dock.x+i*3*this.s,dock.y+i*1.5*this.s,11*this.s,2*this.s,3*this.s,'#b7a473','#988b63','#a99b71');const by=6+Math.sin(t*.12)*2,bx=river(by)+.1;const boat=this.point(bx,by);c.save();c.translate(boat.x,boat.y);c.rotate(-.4);this.polygon([[-19*this.s,0],[-8*this.s,-5*this.s],[15*this.s,-3*this.s],[20*this.s,0],[6*this.s,5*this.s],[-11*this.s,4*this.s]],'#a39062');this.line([[-15*this.s,0],[14*this.s,0]],'#cfbb86',3*this.s);this.line([[0,0],[0,-21*this.s]],'#796c4c',this.s);this.polygon([[1*this.s,-21*this.s],[1*this.s,-4*this.s],[15*this.s,-7*this.s]],'#eadcc0');c.restore();
 const p=this.point(8.5,4.7);c.textAlign='center';c.fillStyle='#5e7057';c.font=`${Math.max(9,13*this.s)}px Georgia`;c.fillText('Э Р И Д У',p.x,p.y-12*this.s);c.fillStyle='#7c8b70';c.font=`${Math.max(7,9*this.s)}px Arial`;c.fillText(`${s.population} жителей · ${s.name}`,p.x,p.y+3*this.s);
 if(this.hover){const {x,y}=this.hover;const reason=selection?canBuild(s,selection,x,y):'';this.tile(x,y,selection?(reason?'#bd65433b':'#edf0b86b'):'#fff7cf38',selection?(reason?'#a8573e':'#79905c'):'#f6edd1');if(selection&&!reason){c.globalAlpha=.55;this.building({x,y,type:selection},s,t);c.globalAlpha=1;}}
 this.effects=this.effects.filter(e=>time-e.start<4000);for(const e of this.effects){const actualAge=(time-e.start)/1000,age=this.reduce?.6:actualAge,alpha=Math.max(0,1-actualAge/4);if(e.id==='rain'){c.strokeStyle=`rgba(210,233,220,${alpha*.8})`;c.lineWidth=1;for(let k=0;k<100;k++){const xx=hash(k,1)*w,yy=(hash(k,2)*h+age*180)%h;c.beginPath();c.moveTo(xx,yy);c.lineTo(xx-6,yy+15);c.stroke();}}else{const pos=this.point(9,8);for(let k=0;k<24;k++){const theta=k*2.4;const r=age*35*this.s*(.6+hash(k,7));const xx=pos.x+Math.cos(theta)*r,yy=pos.y+Math.sin(theta)*r*.5-age*18*this.s;c.fillStyle=`rgba(227,190,91,${alpha})`;c.beginPath();c.arc(xx,yy,2*this.s,0,7);c.fill();}}}
 const vignette=c.createRadialGradient(w/2,h/2,w*.25,w/2,h/2,w*.75);vignette.addColorStop(0,'#f0edd900');vignette.addColorStop(1,'#e3e7d777');c.fillStyle=vignette;c.fillRect(0,0,w,h);this.nightLayer(this.lighting,t);this.weatherLayer(s);this.placementLayer(s,selection);c.restore();
 }
}
