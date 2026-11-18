import test from 'node:test';
import assert from 'node:assert/strict';
import {gameBuildingSignature} from '../game3d/buildings.js';
import {ploughTeams} from '../plough-team.js';
import {strictScenario} from '../scenario-profiles.js';
import {fieldPatches} from '../field-patches.js';
import {fieldPatchBedGeometry,fieldWorldPoint} from '../game3d/field-shore.js';

const field=(x,y,rotation=0)=>({type:'field',x,y,rotation,level:1,crop:{year:1,sown:.2,seedStock:3,sheaves:0}});
const worker=(id,b)=>({id,age:28,phase:'working',work:`${b.x},${b.y}`,x:b.x,y:b.y,cargo:{}});

test('joining and splitting adjacent plots invalidates the field view without editing saved crop data',()=>{
 const a=field(5,5),b=field(6,5),diagonal=field(7,6),s={buildings:[a,diagonal],citizens:[]};
 const alone=gameBuildingSignature(a,s);
 s.buildings.push(b);
 const before=structuredClone(s);
 assert.notEqual(gameBuildingSignature(a,s),alone);
 assert.deepEqual(s,before);
 s.buildings.pop();
 assert.equal(gameBuildingSignature(a,s),alone);
});

test('one joined plough run progresses across both plots with the attached pair',()=>{
 const a=field(5,5),b=field(6,5,2),s={buildings:[a,b],citizens:[worker(1,a),worker(2,b)],scenario:strictScenario(),simTime:1,year:1,season:0};
 const before=structuredClone(s);
 const start=ploughTeams(s);
 assert.equal(start.length,1);
 assert.equal(start[0].yaw,Math.PI/2);
 assert.equal(start[0].oxen.length,2);
 assert.deepEqual(s,before);
 for(const plot of [a,b])plot.crop.sown=.49;
 const end=ploughTeams(s);
 assert.equal(end.length,1);
 assert.ok(start[0].x<5.5&&end[0].x>5.5);
 for(const plot of [a,b])plot.crop.sown=.98;
 const [back]=ploughTeams(s);assert.ok(back.yaw>end[0].yaw&&back.x<5.5);
});

test('joined furrows share the exact terrain contour and the area retains two work slots per plot',()=>{
 const a=field(5,5),b=field(6,5,3),building=field(7,5),diagonal=field(7,6);
 building.construction={kind:'new'};
 const patches=fieldPatches([a,b,building,diagonal]),first=patches.get(a),second=patches.get(b);
 assert.equal(first.group,second.group);
 assert.equal(first.group.slots,4);
 assert.deepEqual(first.joins,[false,false,true,false]);
 assert.deepEqual(second.joins,[true,false,false,false]);
 assert.equal(patches.has(building),false);
 assert.equal(patches.get(diagonal).group.slots,2);
 const edge=(plot,patch,z)=>{
  const view={...plot,fieldPatch:patch,rotation:patch.group.rotation},p=fieldPatchBedGeometry(view).positions,result=[];
  for(let i=0;i<p.length;i+=3)if(p[i+2]===z)result.push({...fieldWorldPoint(view,p[i],p[i+2]),height:p[i+1]});
  return result;
 };
 const seam=edge(a,first,3);
 assert.equal(seam.length,33);
 assert.deepEqual(seam,edge(b,second,-3));
 assert.ok(Math.max(...seam.map(p=>p.height))>.1,'furrows continue with their full height across the join');
 assert.equal(edge(a,first,-3).length,0,'the outer rim stops short of the hard tile boundary');
});
