export const regionalBirds = {
 'pied-kingfisher': {size:.48,back:'#202622',chest:'#eeeee1',wing:'#292d28',bill:'#252927',neck:.08,beak:.19,span:.34,tail:.10,crest:true},
 'glossy-ibis': {size:.86,back:'#48282a',chest:'#5a3433',wing:'#263a31',bill:'#75625e',neck:.23,beak:.19,span:.51,tail:.13,curve:.17,legs:.27},
 'white-pelican': {size:1.55,back:'#ede8da',chest:'#f2e4d9',wing:'#ded8cd',bill:'#c78c58',neck:.16,beak:.30,span:.70,tail:.11,pouch:true},
 'pygmy-cormorant': {size:.74,back:'#251e1a',chest:'#403026',wing:'#2d3030',bill:'#63594a',neck:.28,beak:.095,span:.50,tail:.23,curve:.033},
 'marsh-harrier': {size:1,back:'#513925',chest:'#694b32',wing:'#483726',bill:'#393633',neck:.05,beak:.06,span:.78,tail:.26,curve:.05,crown:'#c1a87f'}
};

export function createRegionalBird(c, style, {node,ball,tube,material,black}){
 const {size,neck,beak,span,tail,legs=0,curve=0}=style, kind=c.kind;
 const root=node('wildlife-'+c.id);
 root.scaling.setAll(size);
 const body=node(c.id+'-body',root,0,.087+legs,0);
 const feather=material(kind+'-back',style.back), breast=material(kind+'-chest',style.chest);
 const wing=material(kind+'-wing',style.wing), bill=material(kind+'-bill',style.bill);
 const headColor=style.crown?material(kind+'-crown',style.crown):feather;
 ball(kind+'-body',body,feather,0,0,0,.21,.19,.43);
 ball(kind+'-breast',body,breast,0,-.035,.087,.185,.15,.28);
 const tailMesh=ball(kind+'-tail',body,wing,0,.008,-.192-tail*.30,.125,.04,tail);
 tailMesh.rotation.x=-.13;
 const head=node(c.id+'-head',body,0,.05,.105);
 tube(kind+'-neck',head,breast,[[0,0,-.026],[0,neck*.46,.042],[0,neck,.10]],style.pouch?.082:.055,.67);
 ball(kind+'-head',head,headColor,0,neck,.11,.118,.114,.151);
 if(style.crest)ball(kind+'-crest',head,feather,0,neck+.042,.062,.062,.057,.15).rotation.x=.28;
 tube(kind+'-bill',head,bill,[[0,neck-.015,.17],[0,neck-.015-curve*.3,.17+beak*.56],[0,neck-.023-curve,.17+beak]],style.pouch?.033:.022);
 if(style.pouch)ball(kind+'-pouch',head,material(kind+'-pouch','#d3a26e'),0,neck-.052,.288,.062,.098,.27);
 const wings=[], feet=[];
 for(const side of [-1,1]){
  ball(kind+'-eye',head,black,side*.048,neck+.016,.15,.018,.018,.018);
  if(style.crest)ball(kind+'-cheek',head,breast,side*.049,neck-.014,.112,.023,.04,.073);
  const pivot=node(c.id+'-wing-'+side,body,side*.077,.024,.066);
  const cover=ball(kind+'-wing',pivot,wing,side*span*.21,0,-.071,span*.49,.065,.23);
  cover.rotation.y=side*.27;
  for(let i=0;i<4;i++){
   const tip=ball(kind+'-primary',pivot,style.pouch?black:wing,side*span*(.38+i*.13),-.008,-.129+i*.013,span*.40,.023,.093-i*.006);
   tip.rotation.y=side*(.32+i*.12);
  }
  wings.push({pivot,side});
  if(legs){
   const foot=node(c.id+'-leg-'+side,body,side*.051,-.049,-.015);
   tube(kind+'-leg',foot,bill,[[0,0,0],[0,-legs*.47,-.034],[0,-legs-.022,.008]],.010,.65);
   tube(kind+'-toe',foot,bill,[[0,-legs-.021,.003],[0,-legs-.022,.068]],.007,.28);
   feet.push(foot);
  }
 }
 return {root,body,head,wings,feet,d:{regional:true,stride:.29},lastX:c.x,lastY:c.y,gait:0,move:0,yaw:null,idPhase:0};
}

export function createRegionalFrog(c,{node,ball,material,black}){
 const root=node('wildlife-'+c.id), body=node(c.id+'-body',root);
 const green=material('savigny-green','#708746'), cream=material('savigny-throat','#c1bc82'), stripe=material('savigny-flank','#5c5a3e');
 ball('frog-body',body,green,0,.040,-.015,.067,.067,.112);
 ball('frog-head',body,green,0,.050,.029,.073,.047,.062);
 ball('frog-throat',body,cream,0,.025,.033,.059,.029,.047);
 for(const side of [-1,1]){
  ball('frog-folded-thigh',body,green,side*.039,.023,-.038,.039,.034,.069).rotation.y=side*.51;
  ball('frog-toe-pads',body,cream,side*.042,.008,.028,.025,.012,.025);
  ball('frog-flank',body,stripe,side*.031,.042,.001,.014,.012,.076);
  ball('frog-iris',body,material('savigny-iris','#b79852'),side*.028,.071,.039,.023,.021,.022);
  ball('frog-pupil',body,black,side*.031,.073,.048,.014,.007,.008);
 }
 return {root,body,d:{frog:true,stride:.10},lastX:c.x,lastY:c.y,gait:0,move:0,yaw:null,idPhase:0};
}

export function poseRegionalBird(a,c,t){
 const flying=c.behavior==='flying'||c.behavior==='hovering'||c.behavior==='diving';
 const hovering=c.behavior==='hovering', gliding=c.kind==='marsh-harrier';
 const flap=gliding?.09:hovering?.66:.39;
 for(const {pivot,side} of a.wings){
  pivot.scaling.x=flying?1:.49;
  pivot.rotation.y=side*(flying?.06:1.12);
  pivot.rotation.z=side*(flying?.14+Math.sin(t*(hovering?28:11))*flap:.38);
 }
 a.head.rotation.x=c.behavior==='probing'?.64+Math.sin(t*8)*.22:Math.sin(t*2)*.04;
 a.head.rotation.y=Math.sin(t*.85)*.12;
 a.body.rotation.x=c.pitch??0;
 a.body.rotation.z=flying?Math.sin(t*.9)*.09:0;
 for(let i=0;i<a.feet.length;i++)a.feet[i].rotation.x=Math.sin(a.gait+i*Math.PI)*a.move*.38;
}
