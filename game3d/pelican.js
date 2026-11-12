// Adult winter plumage, with the broad black flight feathers tucked under pale coverts.
export function createPelican(c,{node,ball,tube,material,skin,black}){
 const root=node('wildlife-'+c.id);
 const body=node(c.id+'-body',root,0,.13,0);
 const white=material('pelican-ivory','#e7dfd1');
 const pale=material('pelican-coverts','#f1e9dc');
 const dark=material('pelican-remiges','#302c2d');
 const face=material('pelican-bare-skin','#c78876');
 const bill=material('pelican-upper-bill','#b48d63');
 const pouch=material('pelican-pouch','#cba46c');
 skin('pelican-body',body,white,[[-.52,.035,.002,.004],[-.38,.024,.14,.116],[-.22,0,.218,.206],[.04,0,.24,.234],[.28,.015,.202,.205],[.44,.048,.115,.141],[.49,.076,.004,.005]]);
 skin('pelican-tail',body,pale,[[-.68,.11,.034,.008],[-.54,.091,.138,.034],[-.37,.072,.105,.051],[-.24,.061,.004,.005]]);
 const neck=node(c.id+'-neck',body,0,.10,.31);
 skin('pelican-s-neck',neck,white,[[-.28,.19,.03,.045],[-.20,.217,.091,.135],[-.096,.205,.106,.197],[.035,.176,.111,.175],[.144,.183,.096,.121],[.243,.236,.081,.068],[.29,.255,.004,.005]]);
 const head=node(c.id+'-head',neck,0,.27,.186);
 skin('pelican-head',head,pale,[[-.15,.006,.003,.005],[-.093,.025,.083,.088],[.015,.011,.098,.09],[.10,-.016,.066,.057],[.15,-.025,.004,.004]]);
 skin('pelican-maxilla',head,bill,[[.073,-.03,.038,.028],[.167,-.035,.05,.019],[.41,-.039,.047,.014],[.592,-.048,.025,.013],[.63,-.069,.004,.006]]);
 const jaw=node(c.id+'-jaw',head,0,-.052,.09);
 skin('pelican-gular-pouch',jaw,pouch,[[0,-.017,.039,.016],[.081,-.033,.053,.031],[.22,-.044,.061,.043],[.40,-.030,.039,.028],[.525,-.007,.006,.005]]);
 const wings=[],feet=[];
 for(const side of [-1,1]){
  ball('pelican-eye-patch',head,face,side*.074,.009,.077,.019,.056,.086).rotation.x=.3;
  ball('pelican-eye',head,black,side*.083,.024,.077,.017,.021,.020);
  const shoulder=node(c.id+'-shoulder-'+side,body,side*.15,.078,.13);
  const inner=skin('pelican-inner-wing',shoulder,pale,[[0,0,.14,.079],[.15,.017,.236,.066],[.38,.012,.229,.044],[.62,-.01,.161,.018],[.69,-.019,.069,.010]]);
  inner.rotation.y=side*Math.PI/2;
  inner.position.z=-.16;
  const wrist=node(c.id+'-wrist-'+side,shoulder,side*.54,-.008,-.13);
  const cover=skin('pelican-outer-wing',wrist,white,[[0,0,.147,.032],[.16,.014,.175,.034],[.39,.019,.137,.026],[.61,.016,.083,.015],[.77,.021,.006,.006]]);
  cover.rotation.y=side*Math.PI/2;
  for(let i=0;i<6;i++){
   const feather=skin('pelican-primary',wrist,dark,[[-.245,0,.004,.004],[-.15,0,.045,.012],[0,.005,.057,.014],[.145,.013,.038,.012],[.20,.018,.003,.003]]);
   feather.position.set(side*(.14+i*.095),-.022,-.205+i*.030);
   feather.rotation.y=side*(.42+i*.12);
  }
  wings.push({shoulder,wrist,side});
  const foot=node(c.id+'-paddle-'+side,body,side*.103,-.12,-.28);
  tube('pelican-shank',foot,face,[[0,0,0],[0,-.07,-.025],[0,-.11,-.083]],.035,.66);
  ball('pelican-webbed-foot',foot,face,0,-.116,-.144,.125,.029,.165).rotation.x=.16;
  feet.push({foot,side});
 }
 return {root,body,neck,head,jaw,wings,feet,d:{pelican:true,stride:1},lastX:c.x,lastY:c.y,gait:0,move:0,yaw:null,idPhase:0};
}

export function posePelican(a,c,time){
 const flight=c.flight??0,scoop=c.scoop??0;
 const takeoff=c.behavior==='taking-off';
 const stroke=time*(takeoff?10:6.8);
 const spread=Math.min(1,flight*5);
 const power=(.32+Number(takeoff)*.32)*Math.max(0,Math.sin(time*1.5)*.45+.55);
 a.body.position.y=.13+Math.sin(time*4.1)*.014*(1-spread);
 a.body.rotation.x=(c.pitch??0)+scoop*.12;
 a.body.rotation.z=Math.sin(time*2.05)*.026*(1-spread);
 a.neck.rotation.x=scoop*.53-spread*.31;
 a.head.rotation.x=scoop*.10+spread*.30;
 a.head.rotation.y=Math.sin(time*.71)*.11*(1-scoop)*(1-spread);
 a.jaw.rotation.x=scoop*.23;
 a.jaw.scaling.y=1+scoop*.58;
 for(const {shoulder,wrist,side} of a.wings){
  shoulder.rotation.y=side*(1-spread)*1.18;
  shoulder.rotation.z=side*(.37*(1-spread)+spread*(.07+Math.sin(stroke)*power));
  shoulder.scaling.x=.54+.46*spread;
  wrist.rotation.y=side*((1-spread)*.98+spread*.15);
  wrist.rotation.z=side*spread*Math.sin(stroke-.55)*power*.48;
  wrist.scaling.x=.55+.45*spread;
 }
 for(const {foot,side} of a.feet){
  const paddle=Math.sin(time*6.5+side*Math.PI/2);
  foot.rotation.x=(1-spread)*(.18+paddle*.48)-spread*.83;
  foot.rotation.y=side*(1-spread)*(.12+paddle*.09);
 }
}
