import {referenceYardLadder} from './reference-yards.js';
import {isReferenceWorkshop,workshopAngle} from './reference-workshops.js';
import {houseVisualKind} from './house-architecture.js';
import {isReedShrine} from '../building-presentation.js';
// One side access per flat roof; shade awnings, ovens and starter domes are not
// walkable roof decks. Dimensions follow the actual authored room, in metres.
const ROOFS={pottery:[-2.35,-1.53,2.13,-1],brewery:[2.25,-1.61,2.35,1],granary:[2.22,-.86,2.86,1],depot:[-2.34,-1.54,2.55,-1],shrine:[-1.74,-.8,3.41,-1],brickyard:[-2.38,-1.69,1.67,-1],weaver:[-2.31,-1.51,2.13,-1],tailor:[2.17,-1.53,2.46,1],healer:[-2.21,-1.20,2.52,-1]};
const HOUSE_ROOFS={
 'courtyard-1':[1.78,-.78,2.17,1],
 'courtyard-2':[2.21,-1.52,2.42,1],
 'courtyard-3':[-.24,-1.81,3.98,1],
};
const PROCEDURAL_HOUSE_ROOFS={
 'courtyard-1':[1.815,-1.18,1.865,1],
 'courtyard-2':[2.365,-1.55,2.175,1],
 'courtyard-3':[-2.22,-1.45,4.055,-1],
};
export function roofAccessLayout(b,state,{procedural=false}={}){
 if(b.construction?.kind==='new'||isReedShrine(state,b))return null;
 const yardLadder=referenceYardLadder(b,state);if(yardLadder)return yardLadder;
 let p=ROOFS[b.type];
 if(b.type==='house')p=(procedural?PROCEDURAL_HOUSE_ROOFS:HOUSE_ROOFS)[houseVisualKind(b,state)];
 if(!p)return null;
 if(isReferenceWorkshop(b.type)){
  const [x,z,height,side]=p,angle=workshopAngle(b.workCorner),c=Math.cos(angle),s=Math.sin(angle);
  return {x:x*c+z*s,z:-x*s+z*c,height,side,angle,width:.40,lean:.30,ground:.06};
 }
 const [x,z,height,side]=p;return {x,z,height,side,width:.40,lean:.30,ground:.06};
}
const cache=new WeakMap();
export function createRoofAccess(B,scene,b,materials,state){
 const a=roofAccessLayout(b,state,{procedural:true});if(!a)return [];
 let geometries=cache.get(scene);if(!geometries){geometries=new Map();cache.set(scene,geometries);scene.onDisposeObservable.add(()=>cache.delete(scene));}
 const key=a.height.toFixed(3),mesh=new B.Mesh(`roof-access-${b.type}`,scene);let geometry=geometries.get(key);
 if(geometry&&!geometry.isDisposed())geometry.applyToMesh(mesh);else{
  const parts=[],height=a.height+.17,base=a.ground,lean=a.lean,beam=(start,end,r)=>{const from=new B.Vector3(...start),to=new B.Vector3(...end),v=to.subtract(from),m=B.MeshBuilder.CreateCylinder('ladder-piece',{height:v.length(),diameter:r*2,tessellation:6},scene);m.position=from.add(to).scale(.5);m.rotationQuaternion=B.Quaternion.FromUnitVectorsToRef(B.Axis.Y,v.normalize(),new B.Quaternion());parts.push(m);};
  for(const z of [-a.width/2,a.width/2])beam([lean,base,z],[0,height,z],.028);
  const count=Math.max(5,Math.round(a.height/.26));for(let i=1;i<=count;i++){const y=base+(a.height-base)*i/count,x=lean*(1-(y-base)/(height-base));beam([x,y,-a.width/2-.025],[x,y,a.width/2+.025],.023);}
  const merged=B.Mesh.MergeMeshes(parts,true,true,undefined,false,false);B.VertexData.ExtractFromMesh(merged).applyToMesh(mesh);merged.dispose();geometry=mesh.geometry;geometries.set(key,geometry);
 }
 mesh.position.set(a.x,0,a.z);mesh.scaling.x=a.side;mesh.rotation.y=a.angle||0;mesh.material=materials.wood;mesh.receiveShadows=true;mesh.metadata={roofAccess:true,roofHeight:a.height,side:a.side};return [mesh];
}
