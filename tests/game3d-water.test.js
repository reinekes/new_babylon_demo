import test from 'node:test';
import assert from 'node:assert/strict';
import {river} from '../world.js';
import {shoreDistance,surfaceElevation} from '../district3d/terrain.js';
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
test('worn path preserves endpoints and junctions with nonuniform width, shallow bends and fading fringes',()=>{
 const a={x:2.5,y:4.5},b={x:3.5,y:4.5},before=JSON.stringify([a,b,state]),g=wornRoadGeometry(state,a,b,1.2,.045,1);
 assert.deepEqual(g.centers[0],{x:15,y:27});assert.deepEqual(g.centers.at(-1),{x:21,y:27});
 assert.ok(g.centers.some(p=>Math.abs(p.y-27)>.01));assert.ok(g.colors.some((v,i)=>i%4===3&&v===0));assert.ok(g.colors.some((v,i)=>i%4===3&&v>.6));
 assert.ok(new Set(g.widths.map(v=>v.toFixed(3))).size>3);assert.ok(g.positions.length>12);assert.equal(g.indices.length%3,0);
 const next=wornRoadGeometry(state,b,{x:4.5,y:4.5},1.2,.045,1);assert.deepEqual(g.centers.at(-1),next.centers[0]);
 assert.equal(JSON.stringify([a,b,state]),before);
});

test('canal banks taper below the water surface at the river and pebbles form irregular groups',()=>{
 const mouth={a:{x:river(8)-1.8,y:8},b:{x:river(8)-.8,y:8},mouth:true,startHeight:.095,endHeight:-.168};const section=canalSection(state,mouth,1);assert.ok(section.halfWidth<.85);assert.ok(section.banks.every(p=>p.height<-.18));
 const before=JSON.stringify(state),a=submergedPebbles(state),b=submergedPebbles(state);assert.deepEqual(a,b);assert.ok(a.length>20);
 assert.ok(new Set(a.map(p=>p.size.toFixed(3))).size>12);assert.ok(new Set(a.map(p=>p.tone)).size===3);
 const riverStones=a.filter(p=>p.river).sort((a,b)=>a.y-b.y);assert.ok(new Set(riverStones.slice(1).map((p,i)=>(p.y-riverStones[i].y).toFixed(2))).size>15,'spacing is irregular rather than two necklaces');
 for(const p of a)assert.ok(waterDepth(p.x,p.y,state)>.14);
 assert.equal(JSON.stringify(state),before);
});
