import test from 'node:test';
import assert from 'node:assert/strict';
import {footpathId,footpathRibbonPoint} from '../footpaths.js';
import {obstacleIndex} from '../navigation.js';
import {streetCrossSections,streetEndFade,streetSurfaceLayout,streetTrafficAt,streetCoverAt,streetWidthAt} from '../street-surfaces.js';

const point=(x,y)=>({x,y});
const road=(a,b)=>({a,b,id:footpathId(a,b),level:1,built:true});
const state={buildings:[],world:{lakes:[],seed:31},simTime:0};
const a=point(1.5,2.5),b=point(2.5,2.5),c=point(2.5,3.5),d=point(3.5,2.5);
const rows=p=>streetCrossSections(state,p.a,p.b,p,p.control,obstacleIndex([]),32);

test('two arms of a bend share the same rounded cross-section and tangent in either saved direction',()=>{
 for(const downstream of [road(b,c),road(c,b)]){
  const up=road(a,b),layout=streetSurfaceLayout(state,[up,downstream]);
  const first=layout.get(up.id),second=layout.get(downstream.id),reversed=downstream.a===c;
  const left=rows(first).at(-1),right=rows(second).at(reversed?-1:0),sign=reversed?-1:1;
  assert.ok(Math.hypot(left.x-right.x,left.z-right.z)<1e-8,'the corner has one centre');
  assert.ok(Math.hypot(left.nx-right.nx*sign,left.nz-right.nz*sign)<1e-8,'there is no hard angular seam');
  const old=footpathRibbonPoint(a,b,first.control,1);
  assert.ok(Math.hypot(left.p.x-old.x,left.p.y-old.y)*6>.12,'walkers cut a small rounded corner');
  assert.ok(Math.hypot(left.p.x-old.x,left.p.y-old.y)*6<left.half,'the original route stays within the worn ground');
  assert.equal(streetEndFade(first,1),1);assert.equal(streetEndFade(second,reversed?1:0),1);
 }
});

test('a side lane fades into the through street and gains a new shape when a junction appears',()=>{
 const up=road(a,b),through=road(b,d),spur=road(b,c);
 const turn=streetSurfaceLayout(state,[up,spur]);
 const junction=streetSurfaceLayout(state,[up,through,spur]);
 const branch=junction.get(spur.id);
 assert.notEqual(branch.shapeKey,turn.get(spur.id).shapeKey);
 assert.equal(streetEndFade(junction.get(up.id),1),1);
 assert.equal(streetEndFade(junction.get(through.id),0),1);
 assert.equal(streetEndFade(branch,0),0);
 assert.ok(streetEndFade(branch,.09)>0 && streetEndFade(branch,.09)<1);
 assert.equal(streetEndFade(branch,.4),1);
 assert.ok(streetWidthAt(branch,.96)<streetWidthAt(branch,.5));
 assert.equal(streetEndFade(branch,1),0);
});

test('a busy, sharply folded lane has no inverted shoulder triangles',()=>{
 const tip=point(1.5,3.5),paved=[road(a,b),road(b,tip)];
 const worn={...state,footpaths:paved.map(r=>({a:r.a,b:r.b,wear:32,at:0}))};
 const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 for(const profile of streetSurfaceLayout(worn,paved).values()){
  const bands=streetCrossSections(worn,profile.a,profile.b,profile,profile.control,obstacleIndex([]),14);
  const edge=(r,side)=>{const d=side<0?-r.reach*r.left*r.trimLeft:r.reach*r.right*r.trimRight;return {x:r.p.x+r.nx*d,y:r.p.y+r.nz*d};};
  for(let j=1;j<bands.length;j++){
   const l0=edge(bands[j-1],-1),r0=edge(bands[j-1],1),l1=edge(bands[j],-1),r1=edge(bands[j],1);
   assert.ok(cross(l0,l1,r0)>0&&cross(l1,r1,r0)>0);
  }
 }
});

test('opposing diagonals merge at the actual crossing without adding a walking junction',()=>{
 const up=road(a,c),down=road(point(1.5,3.5),b);
 const worn={...state,footpaths:[{a:up.a,b:up.b,wear:32,at:0}]};
 const layout=streetSurfaceLayout(worn,[up,down]);
 assert.equal(layout.size,2);
 const minor=layout.get(down.id),main=layout.get(up.id);
 assert.ok(minor.crossing.t>.3&&minor.crossing.t<.7);assert.equal(main.crossing,undefined);
 assert.ok(streetEndFade(minor,minor.crossing.t)<.25);assert.ok(streetEndFade(minor,.25)>.9);
 assert.equal(streetEndFade(main,.5),1);
});

test('compaction and opacity fade continuously from busy bare ground onto a quieter laid lane',()=>{
 const laid=road(b,d),trail=road(a,b);
 const town={...state,footpaths:[{a,b,wear:32,at:0},{a:b,b:d,wear:3,at:0}]};
 const layout=streetSurfaceLayout(town,[laid]),enter=layout.get(trail.id),leave=layout.get(laid.id);
 for(const sample of [streetTrafficAt,streetCoverAt,streetWidthAt]){
  assert.equal(sample(enter,1),sample(leave,0));
  assert.ok(Math.abs(sample(enter,.999)-sample(leave,.001))<.002);
 }
 assert.ok(streetTrafficAt(enter,.5)>streetTrafficAt(leave,.5)*6);
 assert.ok(streetCoverAt(leave,.5)>streetCoverAt(enter,.5));
});
