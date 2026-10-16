import {drawConstruction,drawConstructionLabel} from './construction-art.js';
import {canBuild} from './engine.js';
import {generateStreets,sortScene,lightingAt} from './city-life.js';
import {WIDTH,HEIGHT,terrain,river,bridgeSpan,onBridge} from './world.js';
import {visibleCitizens} from './workforce.js';
import {drawBuilding} from './architecture.js';
const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
export class Renderer{
 constructor(canvas,onSelect){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.zoom=1.45;this.pan={x:0,y:0};this.ambient=0;this.visualLast=null;this.lightMode='auto';this.lights=[];this.hover=null;this.selected=null;this.effects=[];this.reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;canvas.addEventListener('pointermove',e=>{if(this.dragOrigin){this.pan.x=this.dragOrigin.panX+e.clientX-this.dragOrigin.x;this.pan.y=this.dragOrigin.panY+e.clientY-this.dragOrigin.y;this.hover=null;}else this.hover=this.pick(e.clientX,e.clientY);});canvas.addEventListener('pointerleave',()=>this.hover=null);canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointerup',()=>this.dragOrigin=null);canvas.addEventListener('pointercancel',()=>this.dragOrigin=null);canvas.addEventListener('pointerdown',e=>{if(e.button===1||e.button===2||e.shiftKey){e.preventDefault();this.dragOrigin={x:e.clientX,y:e.clientY,panX:this.pan.x,panY:this.pan.y};canvas.setPointerCapture(e.pointerId);return;}if(e.button===0){this.hover=this.pick(e.clientX,e.clientY);if(this.hover)onSelect(this.hover);}});canvas.addEventListener('keydown',e=>{const moves={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};if(moves[e.key]){e.preventDefault();const current=this.hover||{x:10,y:9};const [dx,dy]=moves[e.key];this.hover={x:Math.max(0,Math.min(WIDTH-1,current.x+dx)),y:Math.max(0,Math.min(HEIGHT-1,current.y+dy))};}if(e.key==='Enter'){e.preventDefault();this.hover ||= {x:10,y:9};onSelect(this.hover);}});this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.resize();}
 resize(){const r=this.canvas.getBoundingClientRect();this.w=r.width;this.h=r.height;const d=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(r.width*d);this.canvas.height=Math.round(r.height*d);this.ctx.setTransform(d,0,0,d,0,0);this.layout();}
 layout(){const scale=Math.min((this.w-22)/1200,(this.h-165)/670)*this.zoom;this.s=this.mapOverview?Math.max(.1,Math.min((this.w-30)/((WIDTH+HEIGHT)*30),(this.h-60)/((WIDTH+HEIGHT)*15))):Math.max(.22,scale);this.tw=60*this.s;this.th=30*this.s;const focus=this.mapOverview?{x:(WIDTH-1)/2,y:(HEIGHT-1)/2}:{x:10,y:9};this.ox=this.w*.49-(focus.x-focus.y)*this.tw/2+(this.pan?.x||0);this.oy=this.h*.52-(focus.x+focus.y)*this.th/2+(this.pan?.y||0);}
 home(){this.mapOverview=false;this.zoom=1.45;this.pan={x:0,y:0};this.layout();}
 overview(){this.mapOverview=true;this.zoom=.72;this.pan={x:0,y:0};this.layout();}
 inView(x,y,padding=100){const p=this.point(x,y);return p.x>-padding*this.s&&p.x<this.w+padding*this.s&&p.y>-30*this.s&&p.y<this.h+padding*this.s;}
 point(x,y,z=0){return {x:this.ox+(x-y)*this.tw/2,y:this.oy+(x+y)*this.th/2-z*this.s};}
 pick(clientX,clientY){const r=this.canvas.getBoundingClientRect();const dx=(clientX-r.left-this.ox)/(this.tw/2),dy=(clientY-r.top-this.oy)/(this.th/2);const x=Math.floor((dx+dy)/2+.5),y=Math.floor((dy-dx)/2+.5);return terrain(x,y)==='void'?null:{x,y};}
 polygon(points,fill,stroke){const c=this.ctx;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x??p[0],p.y??p[1]):c.moveTo(p.x??p[0],p.y??p[1]));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=.7;c.stroke();}}
 line(points,color,width=1){const c=this.ctx;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x??p[0],p.y??p[1]):c.moveTo(p.x??p[0],p.y??p[1]));c.strokeStyle=color;c.lineWidth=width;c.stroke();}
 tile(x,y,color,stroke){this.polygon([this.point(x-.5,y-.5),this.point(x+.5,y-.5),this.point(x+.5,y+.5),this.point(x-.5,y+.5)],color,stroke);}
 box(x,y,w,d,h,top='#d9bd81',left='#b99460',right='#c5a36b'){this.polygon([[x-w,y-h],[x,y+d-h],[x,y+d],[x-w,y]],left);this.polygon([[x,y+d-h],[x+w,y-h],[x+w,y],[x,y+d]],right);this.polygon([[x,y-d-h],[x+w,y-h],[x,y+d-h],[x-w,y-h]],top);}
 palm(x,y,size=1,t=0){const c=this.ctx;const s=this.s*size;const sway=this.reduce?0:Math.sin(t*.5+x)*1.5*s;c.strokeStyle='#8c7950';c.lineWidth=3*s;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x-4*s,y-17*s,x+sway,y-32*s);c.stroke();const tx=x+sway,ty=y-32*s;for(let k=0;k<7;k++){const a=k*Math.PI*2/7;const len=(14+(k%2)*4)*s;c.beginPath();c.moveTo(tx,ty);c.quadraticCurveTo(tx+Math.cos(a)*len*.75,ty+Math.sin(a)*len*.5-6*s,tx+Math.cos(a)*len,ty+Math.sin(a)*len*.5+5*s);c.quadraticCurveTo(tx+Math.cos(a+.2)*len*.5,ty+Math.sin(a)*len*.3+2*s,tx,ty);c.fillStyle=k%2?'#6c8a54':'#7e995f';c.fill();}c.fillStyle='#b29a51';c.beginPath();c.arc(tx,ty+3*s,3*s,0,7);c.fill();}
 building(b,s,t){drawBuilding(this,b,s,t);}
 refreshCity(state) {
  const signature=[...state.buildings,...state.roadAnchors||[]].map(b=>`${b.type}:${b.x},${b.y}:${b.construction?.kind||'ready'}`).join('|');
  if(signature!==this.citySignature){
   this.citySignature=signature;this.streets=generateStreets([...state.buildings,...state.roadAnchors||[]]);
   const occupied=new Set(state.buildings.map(b=>`${b.x},${b.y}`));
   this.scenery=[];
   for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
    if(occupied.has(`${x},${y}`))continue;
    const k=hash(x+20,y+19);
    if(terrain(x,y)==='fertile'&&k>.83)this.scenery.push({x,y,kind:'palm'});
    else if(terrain(x,y)==='sand'&&k>.96)this.scenery.push({x,y,kind:'rock'});
   }
  }
 }
 person(person) {
  const c=this.ctx,q=this.s,p=this.point(person.x,person.y,person.onBridge?5:0);
  const stride=person.walking&&!this.reduce?Math.sin((person.step||0)+(Number(person.id)||0))*1.45:0;
  c.save();
  c.fillStyle='#4e543b40';c.beginPath();c.ellipse(p.x+q,p.y+q,3.8*q,1.7*q,0,0,7);c.fill();
  this.line([[p.x-1.1*q,p.y-3*q],[p.x+stride*q,p.y]],'#665841',1.25*q);
  this.line([[p.x+1.1*q,p.y-3*q],[p.x-stride*q,p.y]],'#665841',1.25*q);
  this.polygon([[p.x-1.7*q,p.y-9*q],[p.x+1.7*q,p.y-9*q],[p.x+2.5*q,p.y-2.6*q],[p.x-2.5*q,p.y-2.6*q]],person.robe||'#e0c28f');
  this.line([[p.x-2*q,p.y-7*q],[p.x-3*q,p.y-(4+stride*.4)*q]],'#a3835e',1.2*q);
  this.line([[p.x+2*q,p.y-7*q],[p.x+3*q,p.y-(4-stride*.4)*q]],'#a3835e',1.2*q);
  c.fillStyle='#a68259';c.beginPath();c.arc(p.x,p.y-10.5*q,1.9*q,0,7);c.fill();
  this.line([[p.x-1.6*q,p.y-11.7*q],[p.x+1.7*q,p.y-11.7*q]],person.id%2?'#eee0b7':'#5c5140',1.7*q);
  if(['working','constructing'].includes(person.phase)){const swing=this.reduce?0:Math.sin(person.step||0)*2;this.line([[p.x+3*q,p.y-5*q],[p.x+(7+swing)*q,p.y-11*q]],'#7b6548',1.2*q);this.line([[p.x+(5+swing)*q,p.y-12*q],[p.x+(10+swing)*q,p.y-10*q]],'#aaa17c',1.8*q);}
  if(person.carrying){const cargo=typeof person.cargo==='string'?person.cargo:Object.keys(person.cargo||{})[0];const color={grain:'#dfbf62',clay:'#bd8059',reed:'#8eaa6a',faith:'#7bb6b3',prestige:'#dec47b'}[cargo]||'#d4b77d';this.box(p.x+3*q,p.y-3*q,2.6*q,1.3*q,3.5*q,color,'#9b7f51','#b99b65');this.line([[p.x+1.5*q,p.y-7*q],[p.x+4*q,p.y-8*q]],'#c5b085',.8*q);}
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
  for(const [a,b] of this.streets.edges){const path=[this.point(a.x,a.y),this.point(b.x,b.y)];this.line(path,'#af9c73',7.6*this.s);this.line(path,'#dbc79c',5.4*this.s);this.line(path,'#ead9b4',1.2*this.s);}
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
 addEffect(id){this.effects.push({id,start:performance.now()});}
 draw(s,selection,time=performance.now()){this.layout();
 if(this.visualLast!==null&&!(typeof document!=='undefined'&&document.hidden))this.ambient+=Math.min(.25,Math.max(0,(time-this.visualLast)/1000));
 this.visualLast=time;
 const c=this.ctx,w=this.w,h=this.h,t=this.reduce?0:this.ambient;
 const modeSeconds={day:10,sunset:26.25,night:37.5};
 this.lighting=lightingAt(this.lightMode==='auto'?(s.simTime||0):(modeSeconds[this.lightMode]??s.simTime??0));
 this.refreshCity(s);this.lights=[];c.clearRect(0,0,w,h);c.save();const ground=this.point(10,9);const glow=c.createRadialGradient(ground.x,ground.y,10,ground.x,ground.y,w*.7);glow.addColorStop(0,'#f0ecd9');glow.addColorStop(1,'#e2e6d8');c.fillStyle=glow;c.fillRect(0,0,w,h);
 if(this.lighting.night){c.fillStyle=`rgba(239,232,207,${this.lighting.night*.65})`;for(let k=0;k<55;k++){const px=hash(k,34)*w,py=hash(k,56)*(h-80);c.beginPath();c.arc(px,py,(k%5===0?1.2:.6)*this.s,0,7);c.fill();}}
 // A raised alluvial plain, its strata visible along the southern edge.
 const a=this.point(-.5,HEIGHT-.5),b=this.point(WIDTH-.5,HEIGHT-.5),d=this.point(WIDTH-.5,-.5);this.polygon([a,b,{x:b.x,y:b.y+12*this.s},{x:a.x,y:a.y+12*this.s}],'#c4b68d');this.polygon([b,d,{x:d.x,y:d.y+12*this.s},{x:b.x,y:b.y+12*this.s}],'#b2ab83');
 for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){if(!this.inView(x,y,40))continue;const k=hash(x,y),type=terrain(x,y),dist=Math.abs(x-river(y));let color=dist<2.4?['#b7bf8b','#bdc591','#b4c18a'][Math.floor(k*3)]:type==='fertile'?['#c3c797','#c7ca9b','#bfc492'][Math.floor(k*3)]:['#d6c99f','#d9cca4','#d3c79d','#d5cba4'][Math.floor(k*4)];if(s.drought&&type==='fertile')color=['#c6bc89','#ccbf8f','#c1b884'][Math.floor(k*3)];this.tile(x,y,color);if(k>.88&&type==='sand'){const p=this.point(x,y);this.line([[p.x-5*this.s,p.y],[p.x+3*this.s,p.y+2*this.s]],'#bdb58b',this.s);}}
 const riverPoints=[];for(let y=-.5;y<=HEIGHT-.5;y+=.25)riverPoints.push(this.point(river(y)-1.12,y));for(let y=HEIGHT-.5;y>=-.5;y-=.25)riverPoints.push(this.point(river(y)+1.12,y));this.polygon(riverPoints,s.drought?'#74a9a1':'#6aaba7');const inner=[];for(let y=-.5;y<=HEIGHT-.5;y+=.25)inner.push(this.point(river(y)-.7,y));for(let y=HEIGHT-.5;y>=-.5;y-=.25)inner.push(this.point(river(y)+.6,y));this.polygon(inner,'#5e9f9e');for(let k=0;k<42;k++){const yy=((k*.47+t*.13)%(HEIGHT-.3))-.4;const xx=river(yy)+(hash(k,9)-.5)*1.45;const p=this.point(xx,yy),p2=this.point(xx+.13+hash(k,8)*.4,yy+.06);this.line([p,p2],'#c3d9bd70',this.s);}
 this.streetsLayer();
 for(const b of s.buildings)if(b.type==='bridge'&&!b.construction)this.bridge(b,false);
 const entities=[...s.buildings.filter(b=>b.type!=='bridge'||b.construction).map(b=>({...b,kind:'building'})),...this.scenery,...visibleCitizens(s).map(person=>({...person,kind:'person',onBridge:onBridge(s.buildings,person.x,person.y)}))];
 for(const b of s.buildings)if(b.type==='bridge'&&b.construction?.kind!=='new'){const span=bridgeSpan(b.y);for(let x=span.left;x<span.right;x+=.5)entities.push({x:x+.25,y:span.y+.13,kind:'bridgeRail',end:Math.min(x+.5,span.right)});}
 const lamps=[...this.streets.nodes.values()].filter((p,i)=>i%4===0||this.streets.graph.get(p.key).size>=3).map(p=>({...p,kind:'lamp'}));
 entities.push(...lamps);
 for(const e of sortScene(entities)){
  if(!this.inView(e.x,e.y,150))continue;
  const p=this.point(e.x,e.y);
  if(e.kind==='bridgeRail')this.bridgeRail(e.x-.25,e.end,e.y);
  else if(e.kind==='building'){if(e.construction)drawConstruction(this,e,s,t);else this.building(e,s,t);}
  else if(e.kind==='person')this.person(e);
  else if(e.kind==='palm')this.palm(p.x,p.y,.7+hash(e.x,e.y)*.5,t);
  else if(e.kind==='lamp')this.streetLamp(e,t);
  else this.box(p.x,p.y,5*this.s,3*this.s,4*this.s,'#c6bf9d','#aea98b','#b6b293');
 }
 for(const b of s.buildings)if(b.construction&&this.inView(b.x,b.y,150))drawConstructionLabel(this,b);
 // The landing and a slow reed boat.
 const dock=this.point(river(10)-1.4,10);for(let i=0;i<5;i++)this.box(dock.x+i*3*this.s,dock.y+i*1.5*this.s,11*this.s,2*this.s,3*this.s,'#b7a473','#988b63','#a99b71');const by=6+Math.sin(t*.12)*2,bx=river(by)+.1;const boat=this.point(bx,by);c.save();c.translate(boat.x,boat.y);c.rotate(-.4);this.polygon([[-19*this.s,0],[-8*this.s,-5*this.s],[15*this.s,-3*this.s],[20*this.s,0],[6*this.s,5*this.s],[-11*this.s,4*this.s]],'#a39062');this.line([[-15*this.s,0],[14*this.s,0]],'#cfbb86',3*this.s);this.line([[0,0],[0,-21*this.s]],'#796c4c',this.s);this.polygon([[1*this.s,-21*this.s],[1*this.s,-4*this.s],[15*this.s,-7*this.s]],'#eadcc0');c.restore();
 const p=this.point(8.5,4.7);c.textAlign='center';c.fillStyle='#5e7057';c.font=`${Math.max(9,13*this.s)}px Georgia`;c.fillText('Э Р И Д У',p.x,p.y-12*this.s);c.fillStyle='#7c8b70';c.font=`${Math.max(7,9*this.s)}px Arial`;c.fillText(`${s.population} жителей · ${s.name}`,p.x,p.y+3*this.s);
 if(this.hover){const {x,y}=this.hover;const reason=selection?canBuild(s,selection,x,y):'';this.tile(x,y,selection?(reason?'#bd65433b':'#edf0b86b'):'#fff7cf38',selection?(reason?'#a8573e':'#79905c'):'#f6edd1');if(selection&&!reason){c.globalAlpha=.55;this.building({x,y,type:selection},s,t);c.globalAlpha=1;}}
 this.effects=this.effects.filter(e=>time-e.start<4000);for(const e of this.effects){const actualAge=(time-e.start)/1000,age=this.reduce?.6:actualAge,alpha=Math.max(0,1-actualAge/4);if(e.id==='rain'){c.strokeStyle=`rgba(210,233,220,${alpha*.8})`;c.lineWidth=1;for(let k=0;k<100;k++){const xx=hash(k,1)*w,yy=(hash(k,2)*h+age*180)%h;c.beginPath();c.moveTo(xx,yy);c.lineTo(xx-6,yy+15);c.stroke();}}else{const pos=this.point(9,8);for(let k=0;k<24;k++){const theta=k*2.4;const r=age*35*this.s*(.6+hash(k,7));const xx=pos.x+Math.cos(theta)*r,yy=pos.y+Math.sin(theta)*r*.5-age*18*this.s;c.fillStyle=`rgba(227,190,91,${alpha})`;c.beginPath();c.arc(xx,yy,2*this.s,0,7);c.fill();}}}
 const vignette=c.createRadialGradient(w/2,h/2,w*.25,w/2,h/2,w*.75);vignette.addColorStop(0,'#f0edd900');vignette.addColorStop(1,'#e3e7d777');c.fillStyle=vignette;c.fillRect(0,0,w,h);this.nightLayer(this.lighting,t);c.restore();
 }
}
