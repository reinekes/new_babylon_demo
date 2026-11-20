import test from 'node:test';
import assert from 'node:assert/strict';
import {bridgeSpan,river} from '../world.js';
import {navigationSegmentClear,obstacleIndex} from '../navigation.js';
import {shoreDistance,surfaceElevation} from '../district3d/terrain.js';
import {streetCurveLookup,footpathRibbonPoint} from '../footpaths.js';
import {waterDepth,waterSurfaceGeometry,canalArm, wornRoadGeometry,submergedPebbles,canalSection} from '../game3d/water.js';

const state={buildings:[],world:{lakes:[{cells:[{x:26,y:7},{x:27,y:7}]}]}};
test('transparent surface depth follows canonical river bed and saved lake boundary',()=>{
 const before=JSON.stringify(state),middle=waterDepth(river(8),8,state),edge=waterDepth(river(8)+1.13,8,state);
 assert.ok(middle>.65);assert.ok(edge>0&&edge<middle*.15);assert.equal(waterDepth(2,2,state),0);
 const g=waterSurfaceGeometry(state);assert.ok(g.river.indices.length);assert.ok(g.lakes.indices.length);
 for(const p of g.river.points)assert.ok(shoreDistance(p.x,p.y,state)<.046);
 assert.ok(g.river.depths.some(d=>d<.08));assert.ok(g.river.depths.some(d=>d>.65));
 for(const p of g.lakes.points)assert.ok(state.world.lakes[0].cells.some(c=>Math.abs(c.x-p.x)<=.5001&&Math.abs(c.y-p.y)<=.5001));
 assert.equal(JSON.stringify(state),before);
});
test('wet inlet continues from real canal through the bank into river water and stays continuous in height',()=>{
 let x=0;while(Math.abs(x-river(8))<1.1||Math.abs(x+1-river(8))>=1.1)x++;
 const canal={x,y:8,wet:true,progress:1};const arm=canalArm(state,canal,1,0);
 assert.ok(arm.mouth);assert.ok(arm.b.x>x+.5);assert.ok(shoreDistance(arm.b.x,arm.b.y,state)<-.06);assert.ok(arm.endHeight<0);
 assert.equal(arm.a.x,x);assert.ok(Math.abs(arm.startHeight-arm.endHeight)<.5);
 const dry=canalArm(state,{...canal,wet:false,progress:.2},1,0);assert.equal(dry.mouth,false);assert.equal(dry.b.x,x+.1);
});
test('built streets keep their route centre, shared shoulders and fading edges in either direction',()=>{
 const a={x:2.5,y:4.5},b={x:3.5,y:4.5},before=JSON.stringify([a,b,state]),g=wornRoadGeometry(state,a,b,1.2,.045,1);
 assert.deepEqual(g.centers[0],{x:15,y:27});assert.deepEqual(g.centers.at(-1),{x:21,y:27});
 assert.ok(g.centers.every(p=>p.y===27));assert.ok(g.colors.some((v,i)=>i%4===3&&v===0));assert.ok(g.colors.some((v,i)=>i%4===3&&v>.6));
 assert.ok(new Set(g.widths.map(v=>v.toFixed(3))).size>3);assert.ok(g.positions.length>12);assert.equal(g.indices.length%3,0);
 const next=wornRoadGeometry(state,{x:4.5,y:4.5},b,1.2,.045,1);assert.deepEqual(g.centers.at(-1),next.centers.at(-1));
 const joint=road=>Array.from({length:7},(_,i)=>{const j=road.positions.length-21+i*3;return [road.positions[j]+road.origin.x,road.positions[j+1],road.positions[j+2]+road.origin.z];});
 assert.deepEqual(joint(g),joint(next).reverse());
 assert.equal(JSON.stringify([a,b,state]),before);
});

test('curved paving keeps both verges joined, and upgrades cover the same centre as the resident route',()=>{
 const a={x:2.5,y:4.5},b={x:3.5,y:4.5},c={x:4.5,y:4.5},lookup=streetCurveLookup(state);
 const street=(p,q,progress=1)=>wornRoadGeometry(state,p,q,1.22,.038,1,2,lookup(p,q),undefined,progress);
 const first=street(a,b),next=street(c,b),partial=street(a,b,.42);
 for(let i=0;i<7;i++){
  const p=first.positions.length-21+i*3,q=next.positions.length-3-i*3;
  assert.ok(Math.hypot(first.positions[p]+first.origin.x-next.positions[q]-next.origin.x,first.positions[p+2]+first.origin.z-next.positions[q+2]-next.origin.z)<1e-7);
 }
 const stop=footpathRibbonPoint(a,b,lookup(a,b),.42);
 assert.ok(Math.hypot(stop.x*6-partial.centers.at(-1).x,stop.y*6-partial.centers.at(-1).y)<1e-8);
});

test('shoulders narrow at buildings and lakes, and bridge decks keep their own surface',()=>{
 const a={x:1.5,y:2.46},b={x:2.5,y:2.46};
 for(const s of [
  {buildings:[{type:'house',x:2,y:3}],world:{lakes:[]}},
  {buildings:[],world:{lakes:[{cells:[{x:2,y:3}]}]}},
 ]){
  const index=obstacleIndex(s.buildings),g=wornRoadGeometry(s,a,b,1.22,.04,1,.85,null,index);
  assert.ok(g.indices.length);
  const point=i=>({x:(g.positions[i*3]+g.origin.x)/6,y:(g.positions[i*3+2]+g.origin.z)/6});
  for(let i=0;i<g.indices.length;i+=3)for(let j=0;j<3;j++){
   assert.ok(navigationSegmentClear(s,point(g.indices[i+j]),point(g.indices[i+(j+1)%3]),index),'the whole ribbon stays on clear ground');
  }
 }
 const row=8,span=bridgeSpan(row),s={world:{lakes:[]},buildings:[{type:'bridge',x:Math.round(river(row)),y:row}]};
 const from={x:span.left,y:span.y},to={x:span.right,y:span.y};
 assert.ok(navigationSegmentClear(s,from,to));
 assert.equal(wornRoadGeometry(s,from,to).indices.length,0);
});

test('canal banks taper below the water surface at the river and pebbles form irregular groups',()=>{
 const mouth={a:{x:river(8)-1.8,y:8},b:{x:river(8)-.8,y:8},mouth:true,startHeight:.095,endHeight:-.168};const section=canalSection(state,mouth,1);assert.ok(section.halfWidth<.85);assert.ok(section.banks.every(p=>p.height<-.18));
 const before=JSON.stringify(state),a=submergedPebbles(state),b=submergedPebbles(state);assert.deepEqual(a,b);assert.ok(a.length>20);
 assert.ok(new Set(a.map(p=>p.size.toFixed(3))).size>12);assert.ok(new Set(a.map(p=>p.tone)).size===3);
 const riverStones=a.filter(p=>p.river).sort((a,b)=>a.y-b.y);assert.ok(new Set(riverStones.slice(1).map((p,i)=>(p.y-riverStones[i].y).toFixed(2))).size>15,'spacing is irregular rather than two necklaces');
 for(const p of a)assert.ok(waterDepth(p.x,p.y,state)>.14);
 assert.equal(JSON.stringify(state),before);
});
