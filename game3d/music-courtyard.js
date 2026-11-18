
// Fictional stone instrument from the user's reference, not a historical claim.
export function musicCourtyardLayout(b){const [sx,sz]=b.workCorner||[1,1];return {kind:'lithophone',x:sx*1.9,z:sz*1.9,height:.16,sx,sz};}
export function lyreLayout(b){
 const {x,z,sx,sz}=musicCourtyardLayout(b);
 return {x:x-sx*1.3,z:z-sz*.48,sz};
}
export function createMusicCourtyard(B,scene,b,m){
 const a=musicCourtyardLayout(b),parts=[],add=(mesh,mat)=>{mesh.material=mat;parts.push(mesh);return mesh;};
 const box=(name,x,y,z,w,h,d,mat)=>{const a=add(B.MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene),mat);a.position.set(x,y,z);return a;};
 // All fixed furniture sits behind the two actual playing positions. Reflect
 // the room and its shaded benches when the street selects a different corner.
 const sx=a.sx,sz=a.sz;
 const fixed=(name,x,y,z,w,h,d,mat)=>box(name,sx*x,y,sz*z,w,h,d,mat);
 fixed('music-earth-floor',0,.035,0,5.48,.07,5.48,m.raw);
 const wall=m.plaster||m.raw,red=m.fired||m.raw;
 fixed('music-rear-wall',0,.83,-2.38,4.92,1.63,.22,wall);
 for(const side of [-1,1]){
  fixed('music-side-return',side*2.43,.52,-.62,.21,1.00,3.56,wall);
  fixed('music-painted-plinth',side*2.44,.17,-.62,.24,.22,3.56,red);
 }
 fixed('music-store-side',-2.29,1.13,-1.55,.21,2.23,1.60,wall);
 fixed('music-store-side',-.94,1.13,-1.55,.21,2.23,1.60,wall);
 fixed('music-store-interior',-1.60,.87,-1.85,1.18,1.68,.09,m.wood);
 fixed('music-store-lintel',-1.60,1.89,-.78,1.51,.62,.21,wall);
 fixed('music-store-door-jamb',-2.14,.80,-.78,.48,1.60,.21,wall);
 fixed('music-store-roof',-1.60,2.25,-1.55,1.62,.14,1.87,wall);
 // Two adjacent woven mats on a shallow frame. The plaza and the instruments
 // are under open sky when approached from the street.
 for(const x of [-.82,.72,2.22]){
  fixed('music-shade-palm-post',x,.98,-.92,.12,1.96,.13,m.wood);
  fixed('music-rear-roof-support',x,1.16,-2.31,.12,2.32,.13,m.wood);
 }
 for(const z of [-2.31,-.92])fixed('music-shade-lintel',.70,z< -1?2.25:1.92,z,3.27,.12,.14,m.wood);
 const slope=.205*sz;
 for(const x of [-.08,1.46]){
  const mat=fixed('music-bound-woven-mat',x,2.13,-1.63,1.55,.055,1.63,m.reedRoof||m.reed||m.linen);mat.rotation.x=slope;
  for(const dx of [-.64,.64]){const welt=fixed('music-mat-binding',x+dx,2.165,-1.63,.038,.035,1.66,m.wood);welt.rotation.x=slope;}
 }
 for(const x of [-.74,2.13])fixed('music-seat-return',x,.34,-1.34,.36,.54,1.03,m.raw);
 fixed('music-bench-along-wall',.69,.31,-2.06,3.16,.52,.44,m.raw);
 fixed('music-seat-cushion',.69,.59,-2.06,3.04,.08,.46,m.reed||m.linen);
 fixed('music-woven-mat',-.25,.095,.65,2.00,.035,1.85,m.linen);
 for(let i=0;i<5;i++){
  const tile=fixed('music-painted-lozenge',-2.445,.65,-.28+i*.27,.03,.145,.145,red);
  tile.rotation.x=Math.PI/4;
 }
 for(let i=0;i<8;i++){const angle=i*Math.PI/4,x=a.x+Math.sin(angle)*.65,z=a.z+Math.cos(angle)*.65,stone=add(B.MeshBuilder.CreateCylinder('lithophone-petal-'+i,{height:.13,diameter:1,tessellation:7},scene),m.stone);stone.position.set(x,.15,z);stone.scaling.set(.30,1,.68);stone.rotation.y=angle;}
 // A low central cushion leaves a clear ring of resonant stone slabs.
 const cushion=add(B.MeshBuilder.CreateCylinder('musician-seat-mat',{height:.07,diameter:.44,tessellation:12},scene),m.linen);cushion.position.set(a.x,.12,a.z);
 const lyre=lyreLayout(b),x=lyre.x,z=lyre.z;
 for(const dx of [-.26,.26])box('lyre-stand',x+dx,.32,z,.065,.64,.23,m.wood);
 box('lyre-soundbox',x,.72,z,.76,.24,.18,m.wood);
 box('lyre-left-post',x-.32,1.03,z,.064,.60,.07,m.wood);
 box('lyre-right-post',x+.32,1.05,z,.064,.63,.07,m.wood);
 box('lyre-crossbar',x,1.34,z,.74,.066,.08,m.wood);
 for(let i=0;i<6;i++)box('lyre-string-'+i,x+(i-2.5)*.079,1.08,z,.012,.46,.012,m.linen);
 box('lyre-bull-head',x+.43,.81,z,.24,.21,.21,m.fired||m.wood);
 box('lyre-bull-muzzle',x+.55,.76,z,.14,.10,.16,m.raw);
 for(const dz of [-.13,.13]){
  const horn=box('lyre-bull-horn',x+.39,.94,z+dz,.045,.17,.048,m.linen);
  horn.rotation.x=dz*4;
 }
 const groups=new Map();for(const mesh of parts){mesh.computeWorldMatrix(true);if(!groups.has(mesh.material))groups.set(mesh.material,[]);groups.get(mesh.material).push(mesh);}
 return [...groups].map(([mat,items])=>{const mesh=B.Mesh.MergeMeshes(items,true,true,undefined,false,false);mesh.name='music-courtyard-'+mat.name;mesh.material=mat;return mesh;});
}
