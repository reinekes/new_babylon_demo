import {surfaceElevation} from '../district3d/terrain.js';
import {ploughTeams,PLOUGH_OX_SCALE,PLOUGH_OX_OFFSET,PLOUGH_YOKE_HEIGHT,PLOUGH_HANDLE_FORWARD,PLOUGH_HANDLE_HEIGHT,PLOUGH_HANDLE_SPREAD} from '../plough-team.js';

export function createPloughTeams(B,scene,source,meshes){
 const teams=new Map();
 const timber=new B.StandardMaterial('plough-timber',scene);
 timber.diffuseColor=new B.Color3(.38,.24,.12);
 timber.specularColor.setAll(0);
 const lash=new B.StandardMaterial('plough-reed-bindings',scene);
 lash.diffuseColor=new B.Color3(.67,.49,.25);
 lash.specularColor.setAll(0);

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
   for(const n of model.rootNodes)n.parent=pivot;
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
   rod.material=material;
  };
  const yoke=PLOUGH_YOKE_HEIGHT;
  rod('plough-yoke',[-1.01,yoke,1.02],[1.01,yoke,1.02],.055);
  for(const x of [-PLOUGH_OX_OFFSET,PLOUGH_OX_OFFSET]){
   for(const side of [-1,1])rod('plough-yoke-pin',[x+side*.20,yoke+.04,1.02],[x+side*.18,yoke-.26,1.04],.034);
   rod('plough-yoke-lashing',[x-.19,yoke-.20,1.04],[x+.19,yoke-.20,1.04],.024,lash);
  }
  rod('plough-draught-pole',[0,yoke,1.02],[0,.13,-1.27],.046);
  rod('plough-share',[0,.16,-1.40],[0,.035,-.93],.075);
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
    team.root.position.set(pose.x*6,elevation,pose.y*6);
    team.root.rotation.y=pose.yaw;
    for(const [index,{pivot,walk}] of team.oxen.entries()){
     const ox=pose.oxen[index];
     pivot.position.set(index===0?-PLOUGH_OX_OFFSET:PLOUGH_OX_OFFSET,surfaceElevation(ox.x,ox.y,state)-elevation,.55);
     if(walk){
      const stride=1.23*PLOUGH_OX_SCALE;
      const phase=(pose.progress*1.5/stride+index*.07)%1;
      walk.goToFrame(walk.from+phase*(walk.to-walk.from));
     }
    }
   }
  },
  dispose(){
   for(const team of teams.values())remove(team);
   teams.clear();timber.dispose();lash.dispose();
  }
 };
}
