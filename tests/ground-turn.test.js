import test from 'node:test';
import assert from 'node:assert/strict';
import {groundHeading,groundStep} from '../game3d/ground-turn.js';

const difference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

test('stopped feet keep their heading and moving feet take the short turn across the angle seam',()=>{
 assert.equal(groundHeading(.7,-2,0,.4),.7);
 const initial=Math.PI-.06,goal=-Math.PI+.12;
 assert.ok(Math.abs(groundHeading(initial,goal,.02,.4)-initial-.05)<1e-10);
 const point={x:3,y:4};
 assert.deepEqual(groundStep(point,{x:-2,y:8},.7,0,.35),{...point,yaw:.7,arrived:false});
});

test('a reversing grazing animal follows the tangent on the ground until it reaches its goal',()=>{
 const radius=.40,step=.03,goal={x:0,y:-2};
 let point={x:0,y:0,yaw:0},turningSteps=0;
 for(let i=0;i<240&&!point.arrived;i++){
  const next=groundStep(point,goal,point.yaw,step,radius);
  const distance=Math.hypot(next.x-point.x,next.y-point.y);
  const angle=difference(next.yaw,point.yaw);
  if(Math.abs(angle)>.00001){
   turningSteps++;
   assert.ok(distance>0 && Math.abs(angle)<=step/radius+1e-9);
   const tangent=Math.atan2(next.x-point.x,next.y-point.y);
   assert.ok(Math.abs(difference(tangent,point.yaw+angle/2))<1e-8);
  }
  point=next;
 }
 assert.ok(turningSteps>25 && point.arrived);
 assert.ok(Math.hypot(point.x-goal.x,point.y-goal.y)<radius);
});

test('a waypoint alongside the animal within its turning radius cannot cause circling',()=>{
 const current={x:0,y:0},result=groundStep(current,{x:.03,y:-.01},0,.005,.1);
 assert.deepEqual(result,{...current,yaw:0,arrived:true});
});
