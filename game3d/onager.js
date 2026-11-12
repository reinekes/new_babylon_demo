import {animalFootPose} from './animal-anatomy.js';

const coat=['#ba8859','#e0bd94','#eee0c4','#584035'];
const gait={reach:.341,lift:.115};

export function createOnager(c,{node,ball,tube,material,skin,black,hoof}){
 const root=node('wildlife-'+c.id);
 const body=node(c.id+'-body',root,0,.98,0);
 const plain=material('onager-coat',coat[0]);
 const mane=material('onager-mane','#52392c');
 const cream=material('onager-cream',coat[2]);
 const inner=material('onager-ear','#936c58');
 const lower=material('onager-lower-leg','#a07654');
 const hoofMat=material('onager-hoof','#494037');
 const tint=material('onager-skin','#ffffff');
 skin('onager-body',body,tint,[[-.89,.095,.008,.013],[-.80,.094,.130,.178],[-.65,.092,.228,.244],[-.43,.058,.255,.273],[-.11,.025,.249,.302],[.14,.032,.217,.278],[.36,.062,.221,.289],[.54,.074,.175,.238],[.65,.076,.069,.141],[.70,.082,.009,.014]],
  ([x,y,z])=>y>.25&&Math.abs(x)<.031?coat[3]:y<-.11||z<-.66&&y<.15?coat[2]:y<.02?coat[1]:coat[0]);
 const neck=node(c.id+'-neck',body,0,.015,.36);
 skin('onager-neck',neck,plain,[[-.16,.035,.005,.008],[-.10,.093,.135,.214],[.01,.19,.146,.252],[.12,.245,.124,.241],[.26,.307,.095,.192],[.40,.362,.074,.131],[.50,.398,.047,.068],[.57,.418,.004,.009]]);
 tube('onager-mane',neck,mane,[[0,.295,-.12],[0,.453,.025],[0,.504,.16],[0,.519,.29],[0,.509,.42],[0,.473,.52]],.043,.48);
 const head=node(c.id+'-head',neck,0,.406,.45);
 skin('onager-face',head,tint,[[-.138,.004,.004,.007],[-.095,.026,.072,.097],[-.01,.014,.102,.113],[.079,-.026,.085,.109],[.163,-.067,.062,.082],[.247,-.104,.064,.064],[.309,-.114,.069,.057],[.343,-.117,.050,.040],[.354,-.115,.006,.007]],
  ([,y,z])=>z>.245||y<-.097?coat[2]:z>.18?coat[1]:coat[0]);
 const ears=[];
 for(const side of [-1,1]){
  ball('onager-eye',head,black,side*.096,.031,.041,.024,.029,.034);
  ball('onager-nostril',head,mane,side*.058,-.093,.317,.017,.021,.029).rotation.x=.4;
  const ear=node(c.id+'-ear-'+side,head,side*.06,.08,-.063);
  const outer=ball('onager-ear',ear,plain,0,.090,-.014,.054,.216,.052);
  outer.rotation.x=-.14;
  ball('onager-ear-inner',ear,inner,0,.097,.008,.030,.156,.021).rotation.x=-.14;
  ears.push({ear,side});
 }
 const tail=node(c.id+'-tail',body,0,.255,-.70);
 tube('onager-tail',tail,plain,[[0,0,0],[0,-.13,-.123],[0,-.34,-.149],[0,-.49,-.131]],.027,.55);
 tube('onager-tail-tuft',tail,mane,[[0,-.39,-.139],[0,-.49,-.139],[0,-.63,-.113]],.032,.22);
 const legs=[];
 for(const end of [-1,1])for(const side of [-1,1]){
  const front=end===1,upper=front?.45:.48,lowerLength=front?.48:.46;
  const hip=node(c.id+'-hip-'+end+'-'+side,body,side*.125,-.055,front?.47:-.58);
  const upperLeg=skin('onager-upper-'+end,hip,plain,[
   [-.19,0,.018,.029],[-.10,0,.085,.127],[0,0,front?.094:.125,front?.117:.150],
   [.14,front?.025:.057,front?.063:.081,.083],[upper-.05,.014,.038,.042],[upper+.018,0,.029,.030]
  ]);
  upperLeg.rotation.x=Math.PI/2;
  const knee=node(c.id+'-knee-'+end+'-'+side,hip,0,-upper,0);
  tube('onager-cannon-'+end,knee,lower,[[0,0,0],[0,-lowerLength*.48,0],[0,-lowerLength,.014]],.035,.72);
  const foot=node(c.id+'-foot-'+end+'-'+side,knee,0,-lowerLength,0);
  ball('onager-pastern',foot,cream,0,.026,.004,.063,.082,.077).rotation.x=-.26;
  hoof('onager-hoof',foot,hoofMat);
  legs.push({hip,knee,foot,upper,lowerLength,phase:(front?3:0)*Math.PI/2+(side===1?Math.PI:0),end});
 }
 return {root,body,neck,head,ears,tail,legs,d:{onager:true,stride:1.1},lastX:c.x,lastY:c.y,gait:0,move:0,yaw:null,idPhase:0};
}

export function poseOnager(a,c,time,ease){
 if(c.resetPose)ease=(_,value)=>value;
 const walking=c.behavior==='walking';
 const step=c.previewGait??a.gait;
 const turning=c.turn??0;
 const moving=walking?Math.max(c.previewGait==null?a.move:1,turning*.56):0;
 const phase=step+time*5*turning;
 const graze=c.behavior==='grazing'?1:0;
 const standingHeight=.914-.049*moving;
 a.body.position.y=standingHeight+.115;
 a.neck.rotation.x=ease(a.neck.rotation.x,graze*(1.43+Math.sin(time*2.3)*.024)+Math.sin(phase*2)*.055*moving);
 a.head.position.z=ease(a.head.position.z,.45+.11*graze);
 a.head.rotation.x=ease(a.head.rotation.x,graze*.28+Math.sin(time*5.8)*graze*.045);
 a.head.rotation.y=Math.sin(time*.87)*(.11-.07*moving);
 a.tail.rotation.z=Math.sin(time*1.48)*.16+Math.sin(time*5)*Math.max(0,Math.sin(time*.79)-.91)*2;
 for(const {ear,side} of a.ears)ear.rotation.z=side*(-.20-Math.max(0,Math.sin(time*2.6+side)-.84)*1.6);
 const footProfile={...gait,standingHeight};
 for(const leg of a.legs){
  const pose=animalFootPose(phase+leg.phase,leg.upper,leg.lowerLength,moving,leg.end,footProfile);
  leg.hip.rotation.x=pose.hip;
  leg.knee.rotation.x=pose.knee;
  leg.foot.rotation.x=-pose.hip-pose.knee;
 }
}

// One vertex-coloured instance per distant animal. At this scale the outline
// and group motion are visible, but the individual joints are sub-pixel.
export function onagerDistanceGeometry(B){
 const data=[];
 const sphere=(color,x,y,z,sx,sy,sz,angle=0)=>{
  const shape=B.VertexData.CreateSphere({diameter:1,segments:4});
  const matrix=B.Matrix.Compose(new B.Vector3(sx,sy,sz),B.Quaternion.RotationAxis(B.Axis.X,angle),new B.Vector3(x,y,z));
  shape.transform(matrix);
  const {r,g,b}=B.Color3.FromHexString(color).toLinearSpace();
  shape.colors=Array.from({length:shape.positions.length/3},()=>[r,g,b,1]).flat();
  data.push(shape);
 };
 sphere(coat[0],0,1.06,-.08,.47,.56,1.54);
 sphere(coat[1],0,.92,-.07,.40,.31,1.26);
 sphere(coat[0],0,1.29,.48,.31,.72,.32,.50);
 sphere(coat[0],0,1.49,.75,.19,.25,.40,.38);
 sphere(coat[2],0,1.38,.93,.14,.14,.23);
 sphere(coat[3],0,1.42,-.78,.07,.52,.085,-.14);
 for(const side of [-1,1]){
  sphere(coat[0],side*.068,1.67,.64,.055,.22,.065,-.19);
  for(const end of [-1,1]){
   const z=end*.47,x=side*.14;
   sphere(coat[0],x,.69,z,.105,.68,.15,end*.14);
   sphere(coat[1],x,.28,z+end*.015,.065,.51,.078);
   sphere(coat[3],x,.055,z+.025,.10,.11,.12);
  }
 }
 return data[0].merge(data.slice(1));
}
