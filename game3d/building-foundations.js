import {footprintSize} from '../footprints.js';
import {isExtractionCourt,extractionWorkArea,extractionWorkspaceWidth} from '../extraction-courts.js';
import {lakeContours} from './lake-shore.js';
import {renderedShoreDistance,visualSurfaceElevation} from './shore-profile.js';
import {WATER_HEIGHT} from './water.js';

const excluded=new Set(['bridge','field','canal','levee','cityWall','cityGate']);
const rotationOf=b=>((Math.trunc(Number(b.rotation)||0)%4)+4)%4;
// Same pivot and handedness as placeRoot, including the 2×2 monument's offset.
export function foundationWorldPoint(b,x,z){
 const a=rotationOf(b)*Math.PI/2,c=Math.cos(a),s=Math.sin(a),offset=(footprintSize(b)-1)*3;
 return {x:b.x+(offset+c*(x-offset)+s*(z-offset))/6,y:b.y+(offset-s*(x-offset)+c*(z-offset))/6};
}
export function foundationContext(state={}){
 return {state,contours:lakeContours(state),signature:JSON.stringify([state.world?.river,state.world?.lakes||[]])};
}
function nearShore(b,context){
 if(excluded.has(b.type)||isExtractionCourt(b)&&b.construction?.kind==='new')return false;
 const n=footprintSize(b),c=(n-1)*.5;
 // Conservative envelope: no grid generation for inland templates. The main
 // river is continuous and lakes use their saved, rounded outer contours.
 return renderedShoreDistance(b.x+c,b.y+c,context.state,context.contours)<n*.9+.4;
}
export function foundationSignature(b,state,context=foundationContext(state)){
 return nearShore(b,context)?`${b.x},${b.y}:${rotationOf(b)}:${context.signature}`:'';
}

// A light timber platform follows the wet edge. Dry yards keep their earthen
// surface, and a harbor already has its own plank deck.
export function createBuildingFoundations(B,scene,b,materials,state,context=foundationContext(state)){
 if(!nearShore(b,context))return [];
 const n=footprintSize(b),center=(n-1)*3,court=isExtractionCourt(b),area=court?extractionWorkArea(b):{x:center,z:center};
 const width=court?extractionWorkspaceWidth(b):n*6-.7,depth=court?2.4:width,left=area.x-width/2,near=area.z-depth/2,wetHeight=-.035;
 const heightAt=(x,z)=>{const p=foundationWorldPoint(b,x,z);return visualSurfaceElevation(p.x,p.y,context.state,context.contours);};
 const dock=b.type==='harbor'&&b.construction?.kind!=='new',top=dock?.31:.012;
 const parts=[];
 const columns=Math.ceil(width/.34),rows=Math.ceil(depth/.34),stepX=width/columns,stepZ=depth/rows;
 const wet=Array.from({length:rows},(_,j)=>Array.from({length:columns},(_,i)=>heightAt(left+(i+.5)*stepX,near+(j+.5)*stepZ)<wetHeight));
 let pileCount=0,boardCount=0;
 for(let j=0;j<rows;j++){
  const z=near+(j+.5)*stepZ;
  for(let i=0;i<columns;){
   if(!wet[j][i]){i++;continue;}
   const start=i;
   while(i<columns&&wet[j][i])i++;
   if(!dock){
    const board=B.MeshBuilder.CreateBox('shore-timber-deck-board',{width:(i-start)*stepX,height:.11,depth:stepZ-.014},scene);
    board.position.set(left+(start+i)*stepX/2,top-.055,z);
    parts.push(board);boardCount++;
   }
   // One row of supports for every four planks, with open water between posts.
   if(j%4!==1&&j>0&&wet[j-1].slice(start,i).some(Boolean))continue;
   const posts=Math.max(1,Math.ceil((i-start)/4)),diameter=dock?.25:.22,r=diameter/2;
   for(let k=0;k<posts;k++){
    const x=left+(start+(i-start)*(k+.5)/posts)*stepX;
    const bottom=Math.min(WATER_HEIGHT,...[-r,r].flatMap(dx=>[-r,r].map(dz=>heightAt(x+dx,z+dz))))-.09;
    const pile=B.MeshBuilder.CreateCylinder('shore-timber-pile',{height:top-bottom,diameter,tessellation:8},scene);
    pile.position.set(x,(top+bottom)/2,z);
    parts.push(pile);pileCount++;
   }
  }
 }
 if(!parts.length)return [];
 for(const part of parts)part.computeWorldMatrix(true);
 const mesh=B.Mesh.MergeMeshes(parts,true,true,undefined,false,false);
 mesh.name='game-shore-timber-foundation';mesh.material=materials.wood;mesh.metadata={shoreFoundation:true,timber:true,pileCount,boardCount};
 return [mesh];
}
