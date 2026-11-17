// Family details share materials and dimensions with the existing city meshes.
export function dressSumerYard(type, {block, beam, cylinder, jar, m}, area) {
 const bundle=(x,z,width=.55,length=.95,y=.06)=>{
  block(x,y+.08,z,width,.16,length,m.reed);
  for(const offset of [-.25,.25])block(x,y+.11,z+length*offset,width+.03,.17,.035,m.wood);
 };
 const basket=(x,z,r=.23,y=.05)=>{
  cylinder(x,y+.13,z,r*.8,.26,m.reed,r);
  for(const offset of [.07,.22])cylinder(x,y+offset,z,r*(offset<.1?.91:1.02),.037,m.wood);
  cylinder(x,y+.26,z,r*.81,.015,m.shade);
 };
 const rack=(x,z,w=1.25)=>{
  for(const side of [-1,1])beam([x+side*w/2,.05,z],[x+side*w/2,1.36,z],.043);
  for(const y of [.28,.78,1.33])beam([x-w/2,y,z],[x+w/2,y,z],.035);
 };
 if(area){
  const {x,z}=area;
  // Keep each gathering prop in its work quadrant. The actual deposit and
  // street openings are supplied by terrain and extraction layout.
  const sx=x>3?-1:1,sz=z>3?-1:1;
  switch(type){
   case 'clay':
    for(const side of [-1,1])block(x+side*.91,.16,z-.22,.21,.32,1.64,m.raw);
    basket(x+sx*1.03,z+sz*.82);jar(x-sx*.93,z-sz*.53,.46);break;
   case 'quarry':
    for(let i=0;i<4;i++)block(x+sx*(.55+i%2*.55),.16,z+sz*(.78+Math.floor(i/2)*.48),.47,.32,.39,m.stone,(i-1)*.11);
    break;
   case 'reed':
    for(let i=0;i<3;i++)bundle(x+sx*(.44+i*.44),z+sz*1.05,.35,1.16);
    rack(x,z-sz*.82);break;
   case 'logging':
    for(let i=0;i<4;i++)beam([x+sx*(.32+i*.26),.21,z+sz*.35],[x+sx*(.32+i*.26),.21,z+sz*1.58],.125,m.wood);
    break;
   case 'hunting':
    rack(x,z-sz*.74);
    block(x,.83,z-sz*.73,.89,.61,.04,m.linen,.03);
    basket(x+sx*.91,z+sz*.82);break;
   case 'garden':
    basket(x+sx*.86,z+sz*.79);basket(x-sx*.85,z-sz*.72,.20);break;
  }
  return;
 }
 switch(type){
  case 'brickyard':bundle(-2.13,.75,.41);basket(-1.92,1.04,.21);break;
  case 'kiln':bundle(1.93,1.49,.49,1.18);bundle(1.93,1.49,.37,1,.22);break;
  case 'pottery':
   for(const x of [-1.86,-1.35,-.86])jar(x,-.12,.49,.05);
   break;
  case 'brewery':basket(-2.02,1.49,.28);basket(-1.58,1.85,.24);break;
  case 'bakery':basket(-1.91,.86,.26);break;
  case 'depot':basket(-.26,1.73,.26);basket(.22,1.92,.22);break;
  case 'granary':basket(-2.07,1.43,.28);basket(-1.52,1.63,.25);break;
  case 'dairyStore':
   for(const x of [-1.31,-.91,-.51])cylinder(x,.88,1.1,.13,.055,m.linen,.15);
   break;
  case 'coppersmith':
   cylinder(1.46,.36,1.37,.47,.72,m.raw,.41);
   cylinder(1.46,.72,1.37,.32,.04,m.shade);
   jar(.86,1.7,.45);break;
  case 'joineryYard':
   for(let i=0;i<3;i++)beam([1.03+i*.16,.15,.59],[1.03+i*.16,.15,1.8],.056,m.wood);
   break;
  case 'basketry':
   basket(1.8,1.57,.27);basket(1.31,1.61,.19);bundle(1.76,.93,.43);break;
  case 'matYard':bundle(1.25,1.67,.39,1.13);bundle(1.68,1.67,.36,1.06);break;
  case 'linenYard':bundle(1.76,1.53,.31,1.05);basket(1.33,1.82,.20);break;
  case 'weaver':basket(1.58,1.67,.25);break;
  case 'tailor':
   for(let i=0;i<4;i++)block(-1.82,.12+i*.063,1.03,.53,.049,.40,i%2?m.reed:m.linen,.08*i);
   break;
  case 'healer':jar(1.69,-.69,.45);jar(1.97,-.71,.33);break;
  case 'waterpoint':jar(-1.45,-1.45,.72);basket(-.97,-1.5,.22);break;
  case 'fishing':basket(-1.77,1.15,.27);jar(-1.4,1.32,.42);break;
  case 'harbor':basket(-1.2,-.88,.24,.45);basket(-.75,-1.3,.26,.45);break;
  case 'cowshed':basket(-1.35,-.87,.23);break;
 }
}
