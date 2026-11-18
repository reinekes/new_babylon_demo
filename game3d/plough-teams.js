import {surfaceElevation} from '../district3d/terrain.js';
import {workshopSurfaces} from './workshop-surfaces.js';
import {ploughTeams,PLOUGH_OX_SCALE,PLOUGH_OX_OFFSET,PLOUGH_YOKE_HEIGHT,PLOUGH_HANDLE_FORWARD,PLOUGH_HANDLE_HEIGHT,PLOUGH_HANDLE_SPREAD} from '../plough-team.js';

export function createPloughTeams(B,scene,source,meshes,pasture=false){
 const teams=new Map();
 const materials=workshopSurfaces(B,scene);
 const timber=materials.material('wood'),lash=materials.material('reed');

 function create(key){
  const root=new B.TransformNode(`plough-team-${key}`,scene);
  root.metadata={ploughField:key};
  const oxen=[0,1].map(index=>{
   const pivot=new B.TransformNode(`plough-ox-${key}-${index}`,scene);
   pivot.parent=root;
   pivot.scaling.setAll(PLOUGH_OX_SCALE);
   pivot.metadata={ploughOx:true,ploughField:key};
   const prefix=`plough-${key}-${index}-`;
   const model=source.instantiateModelsToScene(name=>prefix+name,false,{doNotInstantiate:true});
   if(pasture){
    const body=new B.TransformNode(prefix+'body',scene);body.parent=pivot;
    for(const node of model.rootNodes)node.parent=body;
    pivot.scaling.setAll(1);
    const {min,max}=body.getHierarchyBoundingVectors(true),scale=1.34/(max.y-min.y);
    body.scaling.setAll(scale);body.position.set(-(min.x+max.x)*scale/2,-min.y*scale,-(min.z+max.z)*scale/2);
    pivot.metadata.modelFile='pasture-bull.glb';
   }else for(const node of model.rootNodes)node.parent=pivot;
   const walk=model.animationGroups.find(g=>g.name===prefix+'Walk');
   for(const g of model.animationGroups)g.stop();
   if(walk){walk.start(true);walk.pause();}
   return {pivot,model,walk};
  });
  const rod=(name,start,end,r,material=timber)=>{
   const a=new B.Vector3(...start),b=new B.Vector3(...end),direction=b.subtract(a);
   const rod=B.MeshBuilder.CreateCylinder(name,{height:direction.length(),diameter:r*2,tessellation:8},scene);
   rod.parent=root;
   rod.position.copyFrom(a.add(b).scale(.5));
   rod.rotationQuaternion=B.Quaternion.FromUnitVectorsToRef(B.Axis.Y,direction.normalize(),new B.Quaternion());
   rod.material=material;return rod;
  };
  const yoke=PLOUGH_YOKE_HEIGHT;
  const yokeLine=[[-1.09,yoke+.07,1.02],[-.82,yoke+.10,1.02],[-.60,yoke+.11,1.02],[-.40,yoke+.035,1.02],[.40,yoke+.035,1.02],[.60,yoke+.11,1.02],[.82,yoke+.10,1.02],[1.09,yoke+.07,1.02]];
  const crossbar=B.MeshBuilder.CreateTube('plough-yoke',{path:yokeLine.map(p=>new B.Vector3(...p)),radius:.067,tessellation:8,cap:B.Mesh.CAP_ALL},scene);
  crossbar.material=timber;crossbar.parent=root;
  for(const x of [-PLOUGH_OX_OFFSET,PLOUGH_OX_OFFSET]){
   for(const side of [-1,1])rod('plough-yoke-pin',[x+side*.20,yoke+.04,1.02],[x+side*.18,yoke-.26,1.04],.034);
   rod('plough-yoke-lashing',[x-.19,yoke-.20,1.04],[x+.19,yoke-.20,1.04],.024,lash);
   for(const side of [-1,1])for(let i=0;i<2;i++){
    const wrap=B.MeshBuilder.CreateTorus('plough-reed-whipping',{diameter:.151,thickness:.023,tessellation:10},scene);
    wrap.parent=root;wrap.material=lash;wrap.rotation.z=Math.PI/2;
    wrap.position.set(x+side*(.21+i*.028),yoke+.064,1.02);
   }
  }
  rod('plough-draught-pole',[0,yoke+.03,1.02],[0,.23,-1.16],.061);
  rod('plough-share-heel',[0,.23,-1.16],[0,.028,-1.27],.069);
  const share=B.MeshBuilder.CreateCylinder('plough-share',{height:.62,diameterTop:.008,diameterBottom:.22,tessellation:4},scene);
  share.parent=root;share.material=timber;share.rotation.x=Math.PI/2+.045;
  share.position.set(0,.045,-1.02);
  for(const x of [-PLOUGH_HANDLE_SPREAD,PLOUGH_HANDLE_SPREAD])rod('plough-handle',[0,.10,-1.30],[x,PLOUGH_HANDLE_HEIGHT,PLOUGH_HANDLE_FORWARD],.036);
  const owned=root.getChildMeshes();
  for(const m of owned){m.isPickable=false;m.receiveShadows=true;meshes.push(m);}
  return {root,oxen,owned};
 }

 function remove(team){
  for(const m of team.owned){const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);}
  for(const {model} of team.oxen){
   for(const group of model.animationGroups)group.dispose();
   for(const skeleton of model.skeletons)skeleton.dispose();
  }
  team.root.dispose();
 }

 return {
  update(state,poses=ploughTeams(state)){
   const keys=new Set(poses.map(p=>p.key));
   for(const [key,team] of teams)if(!keys.has(key)){remove(team);teams.delete(key);}
   for(const pose of poses){
    if(!teams.has(pose.key))teams.set(pose.key,create(pose.key));
    const team=teams.get(pose.key),elevation=surfaceElevation(pose.x,pose.y,state);
    team.root.metadata.operation=pose.operation;team.root.metadata.travelMetres=pose.travelMetres;
    team.root.position.set(pose.x*6,elevation,pose.y*6);
    team.root.rotation.y=pose.yaw;
    for(const [index,{pivot,walk}] of team.oxen.entries()){
     const ox=pose.oxen[index];
     pivot.position.set(index===0?-PLOUGH_OX_OFFSET:PLOUGH_OX_OFFSET,surfaceElevation(ox.x,ox.y,state)-elevation,.55);
     if(walk){
      const stride=pasture?.62*1.34/1.43:1.23*PLOUGH_OX_SCALE;
      const distance=pose.oxTravel?.[index]??pose.travelMetres??pose.progress*1.5;
      const phase=(distance/stride+index*.07)%1;
      walk.goToFrame(walk.from+phase*(walk.to-walk.from));pivot.metadata.gaitPhase=phase;
     }
    }
   }
  },
  dispose(){
   for(const team of teams.values())remove(team);
   teams.clear();
  }
 };
}
