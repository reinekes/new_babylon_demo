import {footprintSize} from '../footprints.js';
import {lakeContours} from './lake-shore.js';
import {renderedShoreDistance,visualSurfaceElevation} from './shore-profile.js';
import {WATER_HEIGHT} from './water.js';

const excluded=new Set(['bridge','field','canal']);
const rotationOf=b=>((Math.trunc(Number(b.rotation)||0)%4)+4)%4;
// Same pivot and handedness as placeRoot, including the 2×2 monument's offset.
export function foundationWorldPoint(b,x,z){
 const a=rotationOf(b)*Math.PI/2,c=Math.cos(a),s=Math.sin(a),offset=(footprintSize(b)-1)*3;
 return {x:b.x+(offset+c*(x-offset)+s*(z-offset))/6,y:b.y+(offset-s*(x-offset)+c*(z-offset))/6};
}
export function foundationContext(state={}){
 return {state,contours:lakeContours(state),signature:JSON.stringify(state.world?.lakes||[])};
}
function nearShore(b,context){
 if(excluded.has(b.type))return false;
 const n=footprintSize(b),c=(n-1)*.5;
 // Conservative envelope: no grid generation for inland templates. The main
 // river is continuous and lakes use their saved, rounded outer contours.
 return renderedShoreDistance(b.x+c,b.y+c,context.state,context.contours)<n*.9+.4;
}
export function foundationSignature(b,state,context=foundationContext(state)){
 return nearShore(b,context)?`${b.x},${b.y}:${rotationOf(b)}:${context.signature}`:'';
}

// Rendering support, not a change to land, water, routes or saved construction.
// Earthen/brick retaining foundations are an artistic shoreline adaptation;
// only fishing yards and timber landing stages use piles.
export function createBuildingFoundations(B,scene,b,materials,state,context=foundationContext(state)){
 if(!nearShore(b,context))return [];
 const n=footprintSize(b),center=(n-1)*3,width=n*6-.7,lo=center-width/2;
 const heightAt=(x,z)=>{const p=foundationWorldPoint(b,x,z);return visualSurfaceElevation(p.x,p.y,context.state,context.contours);};
 const timber=b.type==='harbor'||b.type==='fishing',material=timber?materials.wood:(materials.raw||materials.brick||materials.soil);
 const parts=[];
 if(timber){
  const count=4*n,span=width-.3;
  for(let j=0;j<count;j++)for(let i=0;i<count;i++){
   const x=center-span/2+i*span/(count-1),z=center-span/2+j*span/(count-1),ground=heightAt(x,z),top=b.type==='harbor'?.31:.015;
   if(ground>=-.035)continue;
   // Continue below the drawn sheet to the actual bed, never stop at water.
   const bottom=Math.min(ground-.09,WATER_HEIGHT-.09),mesh=B.MeshBuilder.CreateCylinder('shore-timber-pile',{height:top-bottom,diameter:.24,tessellation:8},scene);
   mesh.position.set(x,(top+bottom)/2,z);mesh.material=material;parts.push(mesh);
  }
 }else{
  const count=8*n,step=width/count,bed=Array.from({length:count+1},(_,j)=>Array.from({length:count+1},(_,i)=>heightAt(lo+i*step,lo+j*step)));
  // Each prism follows its four bed probes, so every outside corner is buried
  // and the solid support reaches the underside of the existing platform.
  for(let j=0;j<count;j++)for(let i=0;i<count;i++){
   const x=lo+i*step,z=lo+j*step,corners=[[x,z],[x+step,z],[x+step,z+step],[x,z+step]],bottoms=[bed[j][i],bed[j][i+1],bed[j+1][i+1],bed[j+1][i]];
   if(Math.min(...bottoms)>=-.035)continue;
   const positions=[],indices=[],uvs=[];
   const quad=(vertices,cap=false)=>{const base=positions.length/3;for(const [X,Y,Z]of vertices){positions.push(X,Y,Z);uvs.push(cap?X/2:(X+Z)/2,cap?Z/2:Y/2);}indices.push(base,base+2,base+1,base,base+3,base+2);};
   const low=corners.map(([X,Z],k)=>[X,Math.min(-.04,bottoms[k]-.06),Z]),high=corners.map(([X,Z])=>[X,.012,Z]);
   for(let k=0;k<4;k++){const next=(k+1)%4;quad([low[k],high[k],high[next],low[next]]);}
   quad([high[0],high[3],high[2],high[1]],true);quad(low,true);
   const data=new B.VertexData(),normals=[];B.VertexData.ComputeNormals(positions,indices,normals);Object.assign(data,{positions,indices,uvs,normals});
   const mesh=new B.Mesh('shore-retaining-course',scene);data.applyToMesh(mesh);mesh.material=material;parts.push(mesh);
  }
 }
 if(!parts.length)return [];
 for(const part of parts)part.computeWorldMatrix(true);
 const mesh=B.Mesh.MergeMeshes(parts,true,true,undefined,false,false);
 mesh.name=timber?'game-shore-timber-foundation':'game-shore-brick-foundation';mesh.material=material;mesh.metadata={shoreFoundation:true,timber};
 return [mesh];
}
