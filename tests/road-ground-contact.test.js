import test from 'node:test';
import assert from 'node:assert/strict';
import {alluvialTerrainGeometry} from '../district3d/terrain.js';
import {createRoadGround} from '../district3d/road-ground.js';
import {wornRoadGeometry} from '../game3d/water.js';

const state={
 world:{generationVersion:2,width:64,height:64,seed:137,lakes:[],river:{axis:'y',offset:15.757,slope:-.167,amplitude:.751,frequency:.239,phase:.884}},
 buildings:[{type:'watchHouse',x:29,y:18}]
};

// Read the actual valley triangles independently of the road's ground sampler.
function terrainFaces(ground){
 const faces=[];
 for(let i=0;i<ground.indices.length;i+=3){
  const points=ground.indices.slice(i,i+3).map(index=>ground.positions.slice(index*3,index*3+3));
  if(points.every(([x,,z])=>x>=26*6&&x<=33*6&&z>=15*6&&z<=19*6))faces.push(points);
 }
 return (x,z)=>{
  for(const [[ax,ay,az],[bx,by,bz],[cx,cy,cz]] of faces){
   const d=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz),u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/d,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/d;
   if(u>=-1e-8&&v>=-1e-8&&u+v<=1+1e-8)return ay*u+by*v+cy*(1-u-v);
  }
  throw new Error('Sample outside the test valley');
 };
}

test('pedestrian, freight and paved ribbons follow the rendered hillside through each triangle interior',()=>{
 const grid=alluvialTerrainGeometry(state),support=createRoadGround(grid),ground=terrainFaces(grid);
 for(const [x,level,cartTraffic,progress] of [[27.5,1,0,1],[30.5,1,1,1],[29.5,3,0,.7]]){
  const a={x,y:16.5},b={x:x+1,y:17.5},profile={a,b,start:2.1,width:2.1,end:2.1,traffic:1,cartTraffic,startCart:cartTraffic,endCart:cartTraffic};
  const road=wornRoadGeometry(state,a,b,profile,.029,level,.85,null,undefined,progress,support);
  assert.ok(road.indices.length>0);
  let low=Infinity,high=-Infinity;
  for(let i=0;i<road.indices.length;i+=3){
   const [a,b,c]=road.indices.slice(i,i+3).map(k=>road.positions.slice(3*k,3*k+3));
   for(const [u,v] of [[0,0],[1,0],[0,1],[.5,.5],[0,.5],[.5,0],[1/3,1/3]]){
    const at=k=>a[k]*u+b[k]*v+c[k]*(1-u-v);
    const clearance=at(1)-ground(at(0)+road.origin.x,at(2)+road.origin.z);
    low=Math.min(low,clearance); high=Math.max(high,clearance);
   }
  }
  assert.ok(low>.008&&high<.058,`level ${level}, cart ${cartTraffic}: ${low}.. ${high} metres above the rendered slope`);
 }
});

test('a ribbon keeps its whole footprint across the last raised bin and the playable rim',()=>{
 const positions=[],indices=[];
 for(let z=0;z<=12;z+=6)for(let x=0;x<=24;x+=3)positions.push(x,x===3?1.3:0,z);
 for(let z=0;z<2;z++)for(let x=0;x<8;x++){
  const i=z*9+x;
  indices.push(i,i+9,i+1,i+1,i+9,i+10);
 }
 const ground=createRoadGround({positions,indices});
 const areaXZ=g=>{
  let sum=0;
  for(let i=0;i<g.indices.length;i+=3){
   const [a,b,c]=g.indices.slice(i,i+3).map(k=>g.positions.slice(k*3,k*3+3));
   sum+=Math.abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))/2;
  }
  return sum;
 };
 for(const [from,to,z] of [[2,23,3],[.1,17,11.8],[0,14,-.23]]){
  const shape={positions:[from,.04,z,to,.04,z,from,.04,z+.8,to,.04,z+.8],indices:[0,1,2,1,3,2]};
  const area=areaXZ(shape);
  ground.fit(shape);
  assert.ok(Math.abs(areaXZ(shape)-area)<1e-7,`Lost road area along ${from}, ${to}, ${z}`);
 }
});
