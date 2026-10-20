import {visibleCitizens} from '../workforce.js';
import {animalsFor} from '../fauna.js';
import {residentAppearance} from '../resident-appearance.js';
import {onBridge} from '../world.js';
import {surfaceElevation} from './terrain.js';

/** Articulated procedural figures. All visible parts instance shared geometry;
 * transforms are presentation only and never write into the simulation. */
export function createDistrictActors(B,scene,materials){
 const meshes=[],sources=new Map(),ownMaterials=new Map(),people=new Map(),animals=new Map();
 let serial=0,frustumPlanes=null,hasCamera=false,lastTime=null,frameDelta=1/60;
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
  const m=new B.PBRMaterial(`actor-${key}`,scene);m.albedoColor=B.Color3.FromHexString(color).toLinearSpace();m.roughness=.96;m.metallic=0;
  ownMaterials.set(key,m);return m;
 }
 const skin=['#a8734f','#bc8961','#8e5e43','#cb9c74'].map((c,i)=>material(`skin-${i}`,c));
 const cloth=['#d9c6a1','#a87658','#667e7a','#b8a074','#aa9990','#d7d0b6'].map((c,i)=>material(`cloth-${i}`,c));
 for(const m of cloth)if(materials.linen?.albedoTexture)m.albedoTexture=materials.linen.albedoTexture;
 const hair=material('hair','#30271f'),grey=material('grey','#a99e8d'),eye=material('eye','#302820'),hoof=material('hoof','#4c4034');
 const wool=material('wool','#d6c8ad'),tan=material('tan','#a17c54'),cream=material('cream','#c3af8b'),birdmat=material('bird','#8a8776');
 const clay=materials.terracotta||material('clay','#ad6748'),wood=materials.wood||tan,linen=materials.linen||cloth[0],reed=materials.reed||cream;
 function node(name,parent,x=0,y=0,z=0){const n=new B.TransformNode(name,scene);n.parent=parent;n.position=vec(x,y,z);return n;}
 function part(shape,parent,mat,x,y,z,sx,sy,sz,rotation){
  const key=`${shape}:${mat.uniqueId??mat.name}`;let source=sources.get(key);
  if(!source){
   if(shape==='wrap'||shape==='hem'){
    const positions=[],indices=[],normals=[],uvs=[],segments=32,levels=shape==='hem'?1:6;
    for(let j=0;j<=levels;j++)for(let i=0;i<=segments;i++){
      const angle=i/segments*Math.PI*2,t=j/levels;
      const r=.5-(shape==='hem'?0:t*.12)+Math.cos(angle*12)*.022*(1-t*.75);
      positions.push(Math.sin(angle)*r,t-.5,Math.cos(angle)*r);uvs.push(i/segments,t);
      if(i<segments&&j<levels){const k=j*(segments+1)+i;indices.push(k,k+segments+1,k+1,k+1,k+segments+1,k+segments+2);}
    }
    B.VertexData.ComputeNormals(positions,indices,normals);
    source=new B.Mesh(`actor-source-${key}`,scene);const data=new B.VertexData();
    data.positions=positions;data.indices=indices;data.normals=normals;data.uvs=uvs;data.applyToMesh(source);
   }else if(shape==='fleece'){
    source=B.MeshBuilder.CreateSphere(`actor-source-${key}`,{diameter:1,segments:16},scene);
    const positions=source.getVerticesData(B.VertexBuffer.PositionKind),indices=source.getIndices(),normals=[];
    for(let i=0;i<positions.length;i+=3){
     const x=positions[i],y=positions[i+1],z=positions[i+2];
     const curl=1+.035*Math.sin(x*49+y*21)*Math.sin(z*43-y*27);
     positions[i]*=curl;positions[i+1]*=curl;positions[i+2]*=curl;
    }
    B.VertexData.ComputeNormals(positions,indices,normals);
    source.setVerticesData(B.VertexBuffer.PositionKind,positions);source.setVerticesData(B.VertexBuffer.NormalKind,normals);
   }else source=shape==='sphere'?B.MeshBuilder.CreateSphere(`actor-source-${key}`,{diameter:1,segments:12},scene):shape==='cone'?B.MeshBuilder.CreateCylinder(`actor-source-${key}`,{height:1,diameterTop:.04,diameterBottom:1,tessellation:16},scene):B.MeshBuilder.CreateCylinder(`actor-source-${key}`,{height:1,diameter:1,tessellation:12},scene);
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
  ball(body,complexion,0,.30,0,.35,.46,.235);
  const skirt=part('wrap',body,fabric,0,-.075,0,.45,.54,.32);
  // Cloth overlap and hem share instanced geometry; no flat rigid cone silhouette.
  const seam=ball(body,linen,.14,-.10,.135,.018,.43,.018);
  const hem=part('hem',body,linen,0,-.326,0,.455,.032,.326);
  hem.scaling.y=.024;
  // Wrapped shoulder cloth, woven belt and small overlapping hem.
  ball(body,fabric,c.sex==='f'?-.07:.065,.36,-.005,.30,.40,.255);
  part('cylinder',body,cloth[3],0,.12,0,.37,.035,.26);
  ball(body,complexion,0,.56,0,.10,.16,.10);
  const head=node('head',body,0,.66,0);
  ball(head,complexion,0,.02,0,.20,.25,.195);
  ball(head,complexion,0,-.064,.035,.148,.115,.15);
  ball(head,locks,0,.105,-.025,.21,.12,.20);
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
   ball(elbow,complexion,0,-.125,0,.083,.265,.083);ball(elbow,complexion,0,-.264,.012,.074,.105,.045);
   arms.push({shoulder,elbow});
   const hip=node('hip',root,side*.105,.72,0);
   ball(hip,complexion,0,-.17,0,.115,.36,.115);
   const knee=node('knee',hip,0,-.34,0);
   ball(knee,complexion,0,-.14,-.006,.091,.29,.092);const foot=ball(knee,complexion,0,-.315,.045,.10,.07,.20);
   legs.push({hip,knee,foot});
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
  return {root,body,head,arms,legs,load,tool,cargoKey:null,lastX:c.x,lastY:c.y,kind:'person',gait:id*.83,move:0,snap:true};
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
  part(sheep?'fleece':'sphere',body,fur,0,0,0,bird?.26:sheep?.44:.34,bird?.31:sheep?.43:.36,bird?.46:sheep?.76:.72);
  if(!bird)ball(body,fur,0,.03,.19,sheep?.35:.29,.35,.35);
  if(sheep){for(let i=0;i<6;i++){const angle=i*Math.PI/4;part('fleece',body,wool,Math.cos(angle)*.11,.06+Math.sin(angle)*.08,(i%3-1)*.21,.27,.25,.28);}}
  const neck=node('animal-neck',body,0,.12,.28),ears=[];
  ball(neck,fur,0,.08,.05,.19,bird?.30:.33,.20);
  ball(neck,fur,0,.25,.12,bird?.17:.21,bird?.18:.24,bird?.23:.32);
  ball(neck,bird?hoof:cream,0,.22,.28,bird?.065:.14,.085,bird?.15:.18);
  if(!bird){ball(neck,hoof,0,.233,.365,.085,.045,.04);ball(neck,fur,0,.177,.30,.115,.042,.13);if(c.kind==='goat')ball(neck,tan,0,.107,.28,.055,.13,.07);}
  for(const side of [-1,1]){
   ball(neck,eye,side*(bird?.07:.097),.28,.20,.026,.027,.025);
   if(!bird){const ear=ball(neck,fur,side*.13,.34,.07,.09,.18,.055);ear.rotation.z=side*(sheep?-1.15:-.65);ears.push({mesh:ear,base:ear.rotation.z,side});}
   if(['goat','gazelle'].includes(c.kind)){
    const horn=part('cone',neck,hoof,side*.075,.50,.025,.045,c.kind==='gazelle'?.37:.24,.045);horn.rotation.x=-.32;horn.rotation.z=-side*.13;
   }
  }
  const legs=[];
  for(const side of [-1,1])for(const end of bird?[0]:[-1,1]){
   const hip=node('animal-hip',body,side*(bird?.08:.12),-.09,end*.22);
   ball(hip,bird?hoof:fur,0,-.105,0,bird?.026:.085,.255,bird?.026:.085);
   const knee=node('animal-knee',hip,0,-.235,0);ball(knee,bird?hoof:fur,0,-.075,0,bird?.022:.047,.19,bird?.022:.047);ball(knee,hoof,0,-.17,.025,.065,.045,.095);
   legs.push({hip,knee,side,end});
  }
  const tail=node('animal-tail',body,0,.04,-.32);ball(tail,fur,0,cat||jackal?-.08:0,-.13,.065,cat||jackal?.09:.11,cat||jackal?.35:.17);tail.rotation.x=-.2;
  if(bird)for(const side of [-1,1])ball(body,birdmat,side*.12,.02,-.04,.075,.24,.34);
  return {root,body,neck,tail,legs,ears,lastX:c.x,lastY:c.y,kind:c.kind,gait:0,move:0,snap:true};
 }
 const ease=(from,to,rate=12)=>from+(to-from)*(1-Math.exp(-frameDelta*rate));
 function position(a,c,s){
  const dx=c.x-a.lastX,dz=c.y-a.lastY,distance=Math.hypot(dx,dz)*6;
  if(distance>.00001){
   const target=Math.atan2(dx,dz),angle=Math.atan2(Math.sin(target-a.root.rotation.y),Math.cos(target-a.root.rotation.y));
   a.targetYaw=target;
   a.root.rotation.y=a.snap?target:a.root.rotation.y+angle*(1-Math.exp(-frameDelta*10));
  }else if(a.targetYaw!==undefined){
   const angle=Math.atan2(Math.sin(a.targetYaw-a.root.rotation.y),Math.cos(a.targetYaw-a.root.rotation.y));
   a.root.rotation.y+=angle*(1-Math.exp(-frameDelta*10));
  }
  const moving=distance>.00001&&!a.snap&&distance<3;
  a.move=ease(a.move,moving?1:0,14);
  if(moving)a.gait+=Math.min(distance*2.4,frameDelta*15);
  a.snap=false;a.lastX=c.x;a.lastY=c.y;
  a.root.position.x=c.x*6;a.root.position.z=c.y*6;
  a.root.position.y=onBridge(s.buildings,c.x,c.y)?.22:surfaceElevation(c.x,c.y,s);
 }
 function poseHuman(a,c,time,look,s){
  position(a,c,s);setCargo(a,c);
  const child=c.age<16,scale=child?.55+Math.min(c.age,15)*.022:1;
  a.root.scaling.set(scale,scale,scale);
  const working=['working','constructing'].includes(c.phase);
  a.tool.setEnabled(!c.carrying&&working&&['field','clay','wood','stone'].includes(look.work));
  const elder=c.age>=55,phase=a.gait,stride=Math.sin(phase)*a.move*(elder?.29:c.playing?.64:c.carrying?.37:.47);
  const id=Number(c.id)||0,breath=Math.sin(time*1.6+id*.7);
  a.body.position.y=ease(a.body.position.y,.83+Math.cos(phase*2)*.017*a.move+breath*.004);
  a.body.rotation.x=ease(a.body.rotation.x,elder?.11:c.carrying?.075:working?.10:a.move*.035);
  a.body.rotation.z=ease(a.body.rotation.z,Math.sin(phase)*.027*a.move);
  a.body.rotation.y=ease(a.body.rotation.y,Math.sin(phase)*.045*a.move);
  a.head.rotation.y=ease(a.head.rotation.y,(1-a.move)*Math.sin(time*.53+id)*.18);
  a.head.rotation.x=ease(a.head.rotation.x,(working?.15:0)+breath*.014);
  for(let i=0;i<2;i++){
   const sign=i===0?1:-1,{hip,knee,foot}=a.legs[i],{shoulder,elbow}=a.arms[i],step=stride*sign;
   hip.rotation.x=ease(hip.rotation.x,step,22);
   knee.rotation.x=ease(knee.rotation.x,Math.max(0,-Math.sin(phase+(i?Math.PI:0)))*.72*a.move,22);
   foot.rotation.x=ease(foot.rotation.x,-hip.rotation.x-knee.rotation.x+Math.max(0,-step)*.3,22);
   shoulder.rotation.z=ease(shoulder.rotation.z,sign*(.055+(1-a.move)*breath*.008));
   const workBeat=Math.sin(time*3.2+id+i*.8);
   shoulder.rotation.x=ease(shoulder.rotation.x,c.carrying?-.65:working?-.6+workBeat*.2:-step*.65,16);
   elbow.rotation.x=ease(elbow.rotation.x,c.carrying?-1.05:working?-.75+workBeat*.17:-.17-Math.abs(step)*.16,16);
  }
 }
 function poseAnimal(a,c,time,s){
  position(a,c,s);
  const phase=a.gait,rest=c.behavior==='resting',bird=a.kind==='bird',grazing=['grazing','drinking'].includes(c.behavior);
  a.body.position.y=ease(a.body.position.y,rest?.30:.49+Math.cos(phase*2)*.012*a.move,6);
  a.body.scaling.y=1+Math.sin(time*1.8)*.008;
  a.body.rotation.z=ease(a.body.rotation.z,Math.sin(phase)*.018*a.move);
  a.neck.position.y=ease(a.neck.position.y,grazing?-.12:rest?.08:.12,5);
  a.neck.rotation.x=ease(a.neck.rotation.x,grazing?1.12+Math.sin(time*2.3)*.045:rest?.35:Math.sin(time*.7)*.055,5);
  a.neck.rotation.y=ease(a.neck.rotation.y,c.headTurn||0,5);
  a.tail.rotation.y=ease(a.tail.rotation.y,Math.sin(time*(a.kind==='sheep'?1.6:2.3))*.18,7);
  for(const ear of a.ears){const flick=Math.sin(time*2.1+ear.side*1.3);ear.mesh.rotation.z=ease(ear.mesh.rotation.z,ear.base+Math.max(0,flick-.88)*1.5,14);}
  for(const {hip,knee,side,end}of a.legs){
   // Birds alternate two legs. Quadrupeds use a four-beat walk, not synchronised hopping.
   const offset=bird?(side>0?Math.PI:0):end>0?(side>0?0:Math.PI):(side>0?Math.PI*.6:Math.PI*1.6);
   const step=Math.sin(phase+offset)*.43*a.move;
   hip.rotation.x=ease(hip.rotation.x,rest?-1.05:step,rest?6:20);
   knee.rotation.x=ease(knee.rotation.x,rest?1.8:Math.max(0,-Math.sin(phase+offset))*.62*a.move,rest?6:20);
  }
 }
 function update(s,t=s.simTime||0,dt,focus){
  frameDelta=Math.max(0,Math.min(.1,dt??(lastTime===null?1/60:Math.max(1/60,t-lastTime))));lastTime=t;
  refreshFrustum();
  const visible=visibleCitizens(s),fauna=animalsFor(s).filter(a=>a.kind!=='fish'),seen=new Set(),seenAnimals=new Set();
  const professions=new Map((s.buildings||[]).map(b=>[b.id||`${b.x},${b.y}`,b.type]));
  for(const c of visible){
   seen.add(c.id);let a=people.get(c.id);
   if(focus?.citizenId!==c.id&&!inView(c)){if(a){a.root.setEnabled(false);a.snap=true;}continue;}
   const look=residentAppearance(c,professions);
   if(!a){a=human(c,look);people.set(c.id,a);}a.root.setEnabled(true);poseHuman(a,c,t,look,s);
  }
  for(const [id,a]of people)if(!seen.has(id)){a.root.setEnabled(false);a.snap=true;}
  for(const c of fauna){
   seenAnimals.add(c.id);let a=animals.get(c.id);
   if(focus?.animalId!==c.id&&!inView(c)){if(a){a.root.setEnabled(false);a.snap=true;}continue;}
   if(!a){a=animal(c);animals.set(c.id,a);}a.root.setEnabled(true);poseAnimal(a,c,t,s);
  }
  for(const [id,a]of animals)if(!seenAnimals.has(id)){a.root.setEnabled(false);a.snap=true;}
  // Residents at home keep their pooled meshes; departed citizens release theirs.
  const living=new Set((s.citizens||[]).map(c=>c.id));
  for(const [id,a]of people)if(!living.has(id)){remove(a);people.delete(id);}
  for(const [id,a]of animals)if(!seenAnimals.has(id)){remove(a);animals.delete(id);}
 }
 function remove(a){for(const m of a.root.getChildMeshes()){const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);}a.root.dispose();}
 function dispose(){for(const a of people.values())a.root.dispose();for(const a of animals.values())a.root.dispose();for(const m of sources.values())m.dispose();for(const m of ownMaterials.values())m.dispose();people.clear();animals.clear();meshes.length=0;}
 return {update,dispose,meshes,rootFor(selection){return selection.citizenId!==undefined?people.get(selection.citizenId)?.root:animals.get(selection.animalId)?.root;}};
}
