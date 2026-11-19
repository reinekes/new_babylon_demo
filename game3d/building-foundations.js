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

const workingWaterfront=new Set(['fishing','waterpoint','harbor']);
const outdoorYards=new Set(['cowshed','sheepfold','garden','logging','hunting','clay','quarry','reed']);

// Timber bents carry the occupied floor above high water. Dry treads at one
// end connect the landing to its bank; the timber frame stays open underneath.
function raisedLanding(B,scene,b,materials,center,width,heightAt,wetDirection){
 const parts=[],waterfront=workingWaterfront.has(b.type),lift=waterfront?.80:.55;
 const top=lift+.055,half=width/2,span=width-.48,rows=Math.max(3,Math.ceil(span/2.85)+1);
 const piers=[],tints=[[1.50,1.30,1.02],[1.27,1.10,.87],[1.56,1.37,1.12],[1.37,1.18,.94]];
 let boards=0,braces=0;
 function finish(part,tint,waterStain=false){
  const colors=[],pos=part.getVerticesData(B.VertexBuffer.PositionKind);
  for(let i=0;i<pos.length;i+=3){
   const dry=waterStain?.57+.43*Math.max(0,Math.min(1,.53+pos[i+1]/Math.max(.01,part.getBoundingInfo().boundingBox.extendSize.y*2))):1;
   colors.push(tint[0]*dry,tint[1]*dry,tint[2]*dry,1);
  }
  part.setVerticesData(B.VertexBuffer.ColorKind,colors);part.computeWorldMatrix(true);parts.push(part);
 }
 function box(name,x,y,z,w,h,d,tint){
  const mesh=B.MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);
  const pos=mesh.getVerticesData(B.VertexBuffer.PositionKind),normals=mesh.getVerticesData(B.VertexBuffer.NormalKind),uv=[];
  for(let i=0;i<pos.length;i+=3){
   const across=Math.abs(normals[i+1])>.5?(w>=d?pos[i+2]:pos[i]):pos[i+1];
   uv.push(across*1.65+z*.37,(w>=d?pos[i]:pos[i+2])*.60+x*.25);
  }
  mesh.setVerticesData(B.VertexBuffer.UVKind,uv);mesh.position.set(center+x,y,center+z);finish(mesh,tint);
 }
 function timber(name,a,b,diameter,tint,taper=1){
  const start=new B.Vector3(center+a[0],a[1],center+a[2]),end=new B.Vector3(center+b[0],b[1],center+b[2]),delta=end.subtract(start);
  const mesh=B.MeshBuilder.CreateCylinder(name,{height:delta.length(),diameterTop:diameter*taper,diameterBottom:diameter,tessellation:6,cap:name==='mooring-peg'?B.Mesh.CAP_END:B.Mesh.NO_CAP},scene);
  mesh.rotationQuaternion=B.Quaternion.FromUnitVectorsToRef(B.Axis.Y,delta.normalize(),new B.Quaternion());mesh.position=start.add(end).scale(.5);finish(mesh,tint,name==='driven-bank-pile');
 }
 const boardRows=Math.ceil(width/.29),pitch=width/boardRows;
 for(let i=0;i<boardRows;i++){
  box('split-timber-plank',0,top-.067,-half+(i+.5)*pitch,width,.134,pitch-.015,tints[i%4]);boards++;
 }
 for(let j=0;j<rows;j++){
  const z=(j/(rows-1)-.5)*span;
  box('timber-bearer',0,top-.22,z,width-.05,.22,.23,tints[1]);
  const bent=[];piers.push(bent);
  for(let i=0;i<rows;i++){
   const x=(i/(rows-1)-.5)*span,r=.16;
   const bottom=Math.min(...[-r,r].flatMap(dx=>[-r,r].map(dz=>heightAt(center+x+dx,center+z+dz))))-.11;
   const postTop=top-.15;
   timber('driven-bank-pile',[x,bottom,z],[x,postTop,z],.275,tints[(i+2*j)%4],.86);
   bent.push([x,postTop,z]);
   if(i===0||i===rows-1||j===0||j===rows-1){
    // Two wraps sit just below the joint, above the normal waterline.
    for(const d of [.075,.114])timber('reed-lashing',[x,postTop-d-.024,z],[x,postTop-d,z],.272,[2.48,2.01,1.36]);
   }
  }
 }
 for(const x of [-span/2,span/2])box('longitudinal-timber',x,top-.19,0,.17,.20,width-.06,tints[2]);
 for(let i=1;i<rows;i++)for(const [a,b] of [[piers[0][i-1],piers[0][i]],[piers.at(-1)[i-1],piers.at(-1)[i]],
    [piers[i-1][0],piers[i][0]],[piers[i-1].at(-1),piers[i].at(-1)]]){
  const ground=heightAt(center+a[0],center+a[2]);
  if(ground>-.025)continue;
  const foot=Math.max(.018,ground+.10);
  timber('bank-knee-brace',[a[0],foot,a[2]],[(a[0]+b[0])*.5,b[1]-.10,(a[2]+b[2])*.5],.122,tints[1],.86);braces++;
 }
 const [dx,dz]=wetDirection,steps=waterfront?5:4,run=.22,stairWidth=1.12;
 if(b.type==='fishing')for(const side of [-1,1]){
  const x=dx*(half-.32)+side*dz*(half-.55),z=dz*(half-.32)+side*dx*(half-.55);
  timber('mooring-peg',[x,top-.05,z],[x+dx*.035,top+.44,z+dz*.035],.16,tints[1],.83);
  for(const y of [.22,.255,.29])timber('mooring-line',[x+dx*.022,top+y,z+dz*.022],[x+dx*.022,top+y+.031,z+dz*.022],.168,[2.72,2.28,1.76]);
 }

 for(let i=0;i<steps;i++){
  const d=half+(i+.5)*run, y=top*(1-i/steps),x=-dx*d,z=-dz*d;
  box('bank-access-tread',x,y-.065,z,dx?run+.018:stairWidth,.13,dz?run+.018:stairWidth,tints[(i+1)%4]);
 }
 for(const side of [-1,1]){
  const xl=-dx*(half-.1)+side*dz*.42,zl=-dz*(half-.1)+side*dx*.42;
  timber('bank-stair-stringer',[xl,top-.16,zl],[xl-dx*(steps*run+.1),-.01,zl-dz*(steps*run+.1)],.13,tints[1]);
 }
 const mesh=B.Mesh.MergeMeshes(parts,true,true,undefined,false,false);
 mesh.name='game-shore-timber-foundation';mesh.material=materials.bankWood||materials.wood;mesh.receiveShadows=true;
 mesh.metadata={shoreFoundation:true,timber:true,lift,pileCount:rows*rows,boardCount:boards,braceCount:braces,stairSteps:steps,wetDirection,half,run:steps*run,stairWidth};
 return mesh;
}

// A light timber platform follows the wet edge. Dry yards keep their earthen
// surface, and a harbor already has its own plank deck.
export function createBuildingFoundations(B,scene,b,materials,state,context=foundationContext(state)){
 if(!nearShore(b,context))return [];
 const n=footprintSize(b),center=(n-1)*3,court=isExtractionCourt(b),area=court?extractionWorkArea(b,state):{x:center,z:center};
 const width=court?extractionWorkspaceWidth(b):n*6-.7,depth=court?2.4:width,left=area.x-width/2,near=area.z-depth/2,wetHeight=-.035;
 const heightAt=(x,z)=>{const p=foundationWorldPoint(b,x,z);return visualSurfaceElevation(p.x,p.y,context.state,context.contours);};
 const dock=b.type==='harbor'&&b.construction?.kind!=='new',top=dock?.31:.012;
 if(!court&&!outdoorYards.has(b.type)&&b.construction?.kind!=='new'){
  const half=width/2,axes=[[1,0],[-1,0],[0,1],[0,-1]];
  const sideDepth=([x,z])=>[-.85,0,.85].reduce((depth,t)=>depth+Math.max(0,-heightAt(center+half*(x+z*t),center+half*(z+x*t))),0);
  const sides=axes.map(dir=>({dir,depth:sideDepth(dir)})).sort((a,b)=>b.depth-a.depth);
  if(sides[0].depth>.36)return [raisedLanding(B,scene,b,materials,center,b.type==='house'?n*6-.10:width,heightAt,sides[0].dir)];
 }
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

// Register once per placed landing. Most streets never enter one, so a walking
// resident needs one tile lookup instead of scanning the city's buildings.
export function shoreWalkways(){
 const cells=new Map();
 function add(b,platform){
  if(!platform?.lift)return;
  const n=footprintSize(b),cx=b.x+(n-1)*.5,cy=b.y+(n-1)*.5,angle=rotationOf(b)*Math.PI/2;
  const c=Math.cos(angle),s=Math.sin(angle),r=(platform.half+platform.run)/6;
  const record={cx,cy,c,s,platform},entries=[];
  for(let x=Math.floor(cx-r+.5);x<=Math.floor(cx+r+.5);x++)for(let y=Math.floor(cy-r+.5);y<=Math.floor(cy+r+.5);y++){
   const key=`${x},${y}`,layers=cells.get(key)||[];layers.push(record);cells.set(key,layers);entries.push(key);
  }
  return ()=>{for(const key of entries){const layers=cells.get(key);layers.splice(layers.indexOf(record),1);if(!layers.length)cells.delete(key);}};
 }
 function heightAt(x,y,ground){
  if(!cells.size)return ground;
  const layers=cells.get(`${Math.floor(x+.5)},${Math.floor(y+.5)}`);if(!layers)return ground;
  for(const {cx,cy,c,s,platform:p} of layers){
   const a=(x-cx)*6,b=(y-cy)*6,lx=a*c-b*s,lz=a*s+b*c,top=p.lift+.055;
   if(Math.max(Math.abs(lx),Math.abs(lz))<=p.half){ground=Math.max(ground,top);continue;}
   const [dx,dz]=p.wetDirection,d=-lx*dx-lz*dz-p.half;
   if(d>=0&&d<p.run&&Math.abs(lx*dz-lz*dx)<=p.stairWidth/2){
    ground=Math.max(ground,top*(1-Math.floor(d*p.stairSteps/p.run)/p.stairSteps));
   }
  }
  return ground;
 }
 return {add,heightAt};
}
