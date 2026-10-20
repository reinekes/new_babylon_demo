import {visibleCitizens} from '../workforce.js';
import {animalsFor} from '../fauna.js';
import {residentAppearance} from '../resident-appearance.js';
import {onBridge} from '../world.js';
import {surfaceElevation} from './terrain.js';

/** Articulated procedural figures. All visible parts instance shared geometry;
 * transforms are presentation only and never write into the simulation. */
export function createDistrictActors(B,scene,materials){
 const meshes=[],sources=new Map(),ownMaterials=new Map(),people=new Map(),animals=new Map();
 let serial=0,frustumPlanes=null,hasCamera=false;
 const frustumPoint=new B.Vector3();
 function refreshFrustum(){
  const camera=scene.activeCamera;hasCamera=!!camera;if(!camera)return;
  camera.getViewMatrix();camera.getProjectionMatrix();
  const matrix=camera.getTransformationMatrix();
  if(frustumPlanes)B.Frustum.GetPlanesToRef(matrix,frustumPlanes);
  else frustumPlanes=B.Frustum.GetPlanes(matrix);
 }
 function inView(c){
  if(!hasCamera)return true;
  // A conservative two-metre sphere includes limbs, dunes and bridge decks.
  // Culling deliberately avoids querying terrain/buildings for offscreen actors.
  frustumPoint.set(c.x*6,.85,c.y*6);
  for(let i=0;i<6;i++)if(frustumPlanes[i].dotCoordinate(frustumPoint)<-2)return false;
  return true;
 }
 const vec=(x=0,y=0,z=0)=>new B.Vector3(x,y,z);
 function material(key,color){
  if(ownMaterials.has(key))return ownMaterials.get(key);
  const m=new B.PBRMaterial(`actor-${key}`,scene);m.albedoColor=B.Color3.FromHexString(color);m.roughness=.96;m.metallic=0;
  ownMaterials.set(key,m);return m;
 }
 const skin=['#a8734f','#bc8961','#8e5e43','#cb9c74'].map((c,i)=>material(`skin-${i}`,c));
 const cloth=['#d9c6a1','#a87658','#667e7a','#b8a074','#aa9990','#d7d0b6'].map((c,i)=>material(`cloth-${i}`,c));
 const hair=material('hair','#30271f'),grey=material('grey','#a99e8d'),eye=material('eye','#302820'),hoof=material('hoof','#4c4034');
 const wool=material('wool','#d6c8ad'),tan=material('tan','#a17c54'),cream=material('cream','#c3af8b'),birdmat=material('bird','#8a8776');
 const clay=materials.terracotta||material('clay','#ad6748'),wood=materials.wood||tan,linen=materials.linen||cloth[0],reed=materials.reed||cream;
 function node(name,parent,x=0,y=0,z=0){const n=new B.TransformNode(name,scene);n.parent=parent;n.position=vec(x,y,z);return n;}
 function part(shape,parent,mat,x,y,z,sx,sy,sz,rotation){
  const key=`${shape}:${mat.uniqueId??mat.name}`;let source=sources.get(key);
  if(!source){
   source=shape==='sphere'?B.MeshBuilder.CreateSphere(`actor-source-${key}`,{diameter:1,segments:8},scene):shape==='cone'?B.MeshBuilder.CreateCylinder(`actor-source-${key}`,{height:1,diameterTop:.72,diameterBottom:1,tessellation:10},scene):B.MeshBuilder.CreateCylinder(`actor-source-${key}`,{height:1,diameter:1,tessellation:8},scene);
   source.material=mat;source.isVisible=false;source.isPickable=false;sources.set(key,source);
  }
  const m=source.createInstance(`actor-part-${serial++}`);m.parent=parent;m.position=vec(x,y,z);m.scaling=vec(sx,sy,sz);m.isVisible=true;m.isPickable=true;if(rotation)m.rotation=vec(...rotation);meshes.push(m);return m;
 }
 const ball=(p,m,x,y,z,sx,sy,sz)=>part('sphere',p,m,x,y,z,sx,sy,sz);
 function human(c,look){
  const id=Number(c.id)||0,root=node(`citizen-${c.id}`);root.metadata={citizenId:c.id};
  const child=c.age<16,scale=child?.55+Math.min(c.age,15)*.022:1;
  root.scaling=vec(scale,scale,scale);
  const complexion=skin[id%skin.length],fabric=cloth[c.role==='healer'||look.craft==='watercarrier'?2:look.craft==='tailor'?1:look.craft==='weaver'?3:id%cloth.length],locks=c.age>=55?grey:hair;
  const body=node('body',root,0,.83,0);
  ball(body,complexion,0,.30,0,.36,.48,.23);
  part('cone',body,fabric,0,-.075,0,.43,.54,.30);
  // Wrapped shoulder cloth, woven belt and small overlapping hem.
  ball(body,fabric,c.sex==='f'?-.07:.065,.36,-.005,.29,.42,.255);
  part('cylinder',body,wood,0,.12,0,.37,.035,.26);
  ball(body,complexion,0,.56,0,.10,.16,.10);
  const head=node('head',body,0,.66,0);
  ball(head,complexion,0,.02,0,.225,.285,.215);
  ball(head,locks,0,.115,-.025,.235,.14,.216);
  ball(head,complexion,0,.015,.112,.054,.063,.071);
  ball(head,eye,-.048,.057,.097,.019,.014,.014);ball(head,eye,.048,.057,.097,.019,.014,.014);
  for(const side of [-1,1])ball(head,complexion,side*.116,.025,0,.032,.060,.045);
  if(c.sex==='f')ball(head,locks,0,.02,-.108,.17,.25,.075);
  else if(!child&&id%3!==0)ball(head,locks,0,-.062,.055,.17,.12,.14);
  const arms=[],legs=[];
  for(const side of [-1,1]){
   const shoulder=node('shoulder',body,side*.205,.46,0);
   ball(shoulder,complexion,0,-.135,0,.105,.30,.105);
   const elbow=node('elbow',shoulder,0,-.27,0);
   ball(elbow,complexion,0,-.125,0,.083,.265,.083);ball(elbow,complexion,0,-.265,0,.085,.11,.065);
   arms.push({shoulder,elbow});
   const hip=node('hip',root,side*.105,.72,0);
   ball(hip,complexion,0,-.17,0,.115,.36,.115);
   const knee=node('knee',hip,0,-.34,0);
   ball(knee,complexion,0,-.16,0,.085,.33,.085);ball(knee,complexion,0,-.315,.045,.10,.07,.20);
   legs.push({hip,knee});
  }
  const tool=node('work-tool',arms[1].elbow,0,-.27,0);
  part('cylinder',tool,wood,0,0,.09,.024,.36,.024,[Math.PI/2,0,0]);
  ball(tool,cream,.04,0,.24,.15,.045,.07);
  tool.setEnabled(false);
  if(look.craft==='weaver'||look.craft==='tailor'){
   ball(body,linen,-.15,.16,.15,.075,.13,.07);
   part('cylinder',body,wood,-.15,.16,.15,.018,.20,.018);
  }
  const load=node('carried-goods',body,0,.22,.37);
  return {root,body,head,arms,legs,load,tool,cargoKey:null,lastX:c.x,lastY:c.y,kind:'person'};
 }
 function setCargo(a,c){
  const cargo=Object.entries(c.cargo||{}).filter(([,n])=>n>0),key=c.carrying?cargo.map(([k])=>k).sort().join('|'):'';
  if(a.cargoKey===key)return;a.cargoKey=key;
  for(const m of a.load.getChildMeshes()){const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);m.dispose();}
  if(!key)return;
  const kind=cargo[0]?.[0];
  if(['water','beer','pottery','oil'].includes(kind)){
   ball(a.load,clay,0,0,0,.30,.34,.30);part('cylinder',a.load,clay,0,.19,0,.13,.12,.13);part('cylinder',a.load,hoof,0,.253,0,.095,.006,.095);
  }else if(['wood','reed'].includes(kind)){
   for(let i=0;i<4;i++)part('cylinder',a.load,kind==='reed'?reed:wood,(i%2-.5)*.075,Math.floor(i/2)*.06,0,.06,.60,.06,[0,0,Math.PI/2]);
  }else if(['clay','brick','stone'].includes(kind)){
   for(let i=0;i<3;i++)ball(a.load,kind==='clay'||kind==='brick'?clay:cream,(i%2-.5)*.12,Math.floor(i/2)*.08,0,.19,.14,.19);
  }else{
   ball(a.load,['cloth','clothing','wool'].includes(kind)?linen:reed,0,0,0,.38,.26,.29);part('cylinder',a.load,wood,0,.06,0,.39,.022,.30);
  }
 }
 function animal(c){
  const root=node(`animal-${c.id}`);root.metadata={animalId:c.id,animalKind:c.kind};
  const bird=c.kind==='bird',small=c.kind==='mouse',cat=c.kind==='cat',jackal=c.kind==='jackal',sheep=c.kind==='sheep';
  const scale=small?.22:cat?.47:bird?.45:sheep?.82:c.kind==='gazelle'?1.15:1;root.scaling=vec(scale,scale,scale);
  const fur=sheep?wool:bird?birdmat:cat?cream:tan,body=node('animal-body',root,0,.49,0);
  ball(body,fur,0,0,0,bird?.26:.36,bird?.31:.39,bird?.46:.67);
  if(sheep){for(let i=0;i<8;i++){const angle=i*Math.PI/4;ball(body,wool,Math.cos(angle)*.12,.05+Math.sin(angle)*.10,(i%3-1)*.20,.25,.24,.27);}}
  const neck=node('animal-neck',body,0,.12,.28);
  ball(neck,fur,0,.08,.05,.19,bird?.30:.33,.20);
  ball(neck,fur,0,.25,.12,bird?.17:.21,bird?.18:.24,bird?.23:.32);
  ball(neck,bird?hoof:cream,0,.22,bird?.28:.28,bird?.08:.16,.09,bird?.14:.15);
  for(const side of [-1,1]){
   ball(neck,eye,side*(bird?.07:.097),.28,.20,.026,.027,.025);
   if(!bird){const ear=ball(neck,fur,side*.13,.34,.07,.09,.18,.055);ear.rotation.z=side*-.65;}
   if(['goat','gazelle'].includes(c.kind)){
    const horn=part('cone',neck,hoof,side*.075,.50,.025,.045,c.kind==='gazelle'?.37:.24,.045);horn.rotation.x=-.32;horn.rotation.z=-side*.13;
   }
  }
  const legs=[];
  for(const side of [-1,1])for(const end of bird?[0]:[-1,1]){
   const hip=node('animal-hip',body,side*(bird?.08:.12),-.09,end*.22);
   part('cylinder',hip,bird?hoof:fur,0,-.115,0,bird?.026:.065,.25,bird?.026:.065);
   const knee=node('animal-knee',hip,0,-.235,0);part('cylinder',knee,hoof,0,-.085,0,bird?.022:.042,.18,bird?.022:.042);ball(knee,hoof,0,-.17,.025,.065,.045,.095);
   legs.push({hip,knee,side,end});
  }
  const tail=node('animal-tail',body,0,.04,-.32);ball(tail,fur,0,cat||jackal?-.08:0,-.13,.065,cat||jackal?.09:.11,cat||jackal?.35:.17);tail.rotation.x=-.2;
  if(bird)for(const side of [-1,1])ball(body,birdmat,side*.12,.02,-.04,.075,.24,.34);
  return {root,body,neck,tail,legs,lastX:c.x,lastY:c.y,kind:c.kind};
 }
 function position(a,c,s){
  const dx=c.x-a.lastX,dz=c.y-a.lastY;
  if(Math.hypot(dx,dz)>.00001)a.root.rotation.y=Math.atan2(dx,dz);
  a.lastX=c.x;a.lastY=c.y;a.root.position.x=c.x*6;a.root.position.z=c.y*6;
  a.root.position.y=onBridge(s.buildings,c.x,c.y)?.22:surfaceElevation(c.x,c.y,s);
 }
 function poseHuman(a,c,time,look,s){
  position(a,c,s);setCargo(a,c);
  const child=c.age<16,scale=child?.55+Math.min(c.age,15)*.022:1;
  a.root.scaling.set(scale,scale,scale);
  a.tool.setEnabled(!c.carrying&&['working','constructing'].includes(c.phase)&&['field','clay','wood','stone'].includes(look.work));
  const walk=!!c.walking,elder=c.age>=55,phase=(c.step??time*4)+(Number(c.id)||0)*.83;
  const stride=walk?Math.sin(phase)*(elder?.28:c.playing?.65:.48):0;
  a.body.position.y=.83+(walk?Math.abs(Math.cos(phase))*.023:Math.sin(time*1.5)*.005);
  a.body.rotation.x=elder?.09:c.phase==='working'?.10:0;
  a.head.rotation.y=walk?0:Math.sin(time*.65+(Number(c.id)||0))*.11;
  for(let i=0;i<2;i++){
   const sign=i===0?1:-1,{hip,knee}=a.legs[i],{shoulder,elbow}=a.arms[i];
   hip.rotation.x=stride*sign;knee.rotation.x=Math.max(0,-stride*sign)*.7;
   shoulder.rotation.z=sign*.06;
   shoulder.rotation.x=c.carrying?-.65:c.phase==='working'?-.6+Math.sin(phase*1.7+i)*.25:-stride*sign*.7;
   elbow.rotation.x=c.carrying?-1.05:c.phase==='working'?-.75+Math.sin(phase*1.7+i+.9)*.25:-.13;
  }
 }
 function poseAnimal(a,c,time,s){
  position(a,c,s);const walking=!!c.walking||c.behavior==='walking',phase=c.step??time*5,rest=c.behavior==='resting';
  a.body.position.y=rest?.30:.49;a.body.scaling.y=1+Math.sin(time*2)*.012;
  a.neck.rotation.x=['grazing','drinking'].includes(c.behavior)?1.03:rest?.35:Math.sin(time*.7)*.07;
  a.neck.rotation.y=c.headTurn||0;a.tail.rotation.y=Math.sin(time*2)*.2;
  for(const {hip,knee,side,end}of a.legs){hip.rotation.x=rest?-1.05:walking?Math.sin(phase+(side*end>0?Math.PI:0))*.5:0;knee.rotation.x=rest?1.8:Math.max(0,-hip.rotation.x)*.6;}
 }
 function update(s,t=s.simTime||0){
  refreshFrustum();
  const visible=visibleCitizens(s),fauna=animalsFor(s),seen=new Set(),seenAnimals=new Set();
  const professions=new Map((s.buildings||[]).map(b=>[b.id||`${b.x},${b.y}`,b.type]));
  for(const c of visible){
   seen.add(c.id);let a=people.get(c.id);
   if(!inView(c)){if(a)a.root.setEnabled(false);continue;}
   const look=residentAppearance(c,professions);
   if(!a){a=human(c,look);people.set(c.id,a);}a.root.setEnabled(true);poseHuman(a,c,t,look,s);
  }
  for(const [id,a]of people)if(!seen.has(id))a.root.setEnabled(false);
  for(const c of fauna){
   seenAnimals.add(c.id);let a=animals.get(c.id);
   if(!inView(c)){if(a)a.root.setEnabled(false);continue;}
   if(!a){a=animal(c);animals.set(c.id,a);}a.root.setEnabled(true);poseAnimal(a,c,t,s);
  }
  for(const [id,a]of animals)if(!seenAnimals.has(id))a.root.setEnabled(false);
  // Residents at home keep their pooled meshes; departed citizens release theirs.
  const living=new Set((s.citizens||[]).map(c=>c.id));
  for(const [id,a]of people)if(!living.has(id)){remove(a);people.delete(id);}
  for(const [id,a]of animals)if(!seenAnimals.has(id)){remove(a);animals.delete(id);}
 }
 function remove(a){for(const m of a.root.getChildMeshes()){const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);}a.root.dispose();}
 function dispose(){for(const a of people.values())a.root.dispose();for(const a of animals.values())a.root.dispose();for(const m of sources.values())m.dispose();for(const m of ownMaterials.values())m.dispose();people.clear();animals.clear();meshes.length=0;}
 return {update,dispose,meshes};
}
