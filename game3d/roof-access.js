import {houseVisualKind} from './house-architecture.js';
import {workstationLayout} from './workstations.js';
// One side access per flat roof; shade awnings, ovens and starter domes are not
// walkable roof decks. Dimensions follow the actual authored room, in metres.
const ROOFS={pottery:[-2.39,-1.55,2.11,-1],brewery:[2.29,-1.55,2.31,1],granary:[2.22,-.6,2.91,1],depot:[-2.39,-.75,2.56,-1],shrine:[-1.74,-.8,3.41,-1],brickyard:[-2.49,-1.7,1.76,-1],weaver:[-2.34,-.4,2.11,-1],tailor:[2.14,-1.55,2.46,1],clay:[-2.49,-1.6,1.56,-1],logging:[-2.44,-1.45,2.01,-1],hunting:[-2.39,-1.4,1.81,-1],fishing:[-2.34,-1.65,1.91,-1],healer:[-2.39,-.5,2.21,-1]};
const OTHER_SIDE={pottery:[-.21,-1.55,2.11,1],brewery:[-2.29,-1.55,2.31,-1],tailor:[-2.14,-1.55,2.46,-1],brickyard:[-.71,-1.7,1.76,1],clay:[-.81,-1.6,1.56,1]};
export function roofAccessLayout(b){
 if(b.construction?.kind==='new')return null;
 let p=ROOFS[b.type];if(b.type==='house'){const kind=houseVisualKind(b);if(kind==='hut')return null;p=kind==='courtyard-3'?[-2.22,-1.45,4.055,-1]:kind==='courtyard-2'?[2.365,-1.55,2.175,1]:[1.815,-1.18,1.865,1];}
 if(!p)return null;const bay=workstationLayout(b)[0];if(bay&&Math.abs(p[0]-bay.x)<.84&&Math.abs(p[1]-bay.z)<1.05&&OTHER_SIDE[b.type])p=OTHER_SIDE[b.type];const [x,z,height,side]=p;return {x,z,height,side,width:.40,lean:.30,ground:.06};
}
const cache=new WeakMap();
export function createRoofAccess(B,scene,b,materials){
 const a=roofAccessLayout(b);if(!a)return [];
 let geometries=cache.get(scene);if(!geometries){geometries=new Map();cache.set(scene,geometries);scene.onDisposeObservable.add(()=>cache.delete(scene));}
 const key=a.height.toFixed(3),mesh=new B.Mesh(`roof-access-${b.type}`,scene);let geometry=geometries.get(key);
 if(geometry&&!geometry.isDisposed())geometry.applyToMesh(mesh);else{
  const parts=[],height=a.height+.17,base=a.ground,lean=a.lean,beam=(start,end,r)=>{const from=new B.Vector3(...start),to=new B.Vector3(...end),v=to.subtract(from),m=B.MeshBuilder.CreateCylinder('ladder-piece',{height:v.length(),diameter:r*2,tessellation:6},scene);m.position=from.add(to).scale(.5);m.rotationQuaternion=B.Quaternion.FromUnitVectorsToRef(B.Axis.Y,v.normalize(),new B.Quaternion());parts.push(m);};
  for(const z of [-a.width/2,a.width/2])beam([lean,base,z],[0,height,z],.028);
  const count=Math.max(5,Math.round(a.height/.26));for(let i=1;i<=count;i++){const y=base+(a.height-base)*i/count,x=lean*(1-(y-base)/(height-base));beam([x,y,-a.width/2-.025],[x,y,a.width/2+.025],.023);}
  const merged=B.Mesh.MergeMeshes(parts,true,true,undefined,false,false);B.VertexData.ExtractFromMesh(merged).applyToMesh(mesh);merged.dispose();geometry=mesh.geometry;geometries.set(key,geometry);
 }
 mesh.position.set(a.x,0,a.z);mesh.scaling.x=a.side;mesh.material=materials.wood;mesh.receiveShadows=true;mesh.metadata={roofAccess:true,roofHeight:a.height,side:a.side};return [mesh];
}
