// Fictional stone instrument from the user's reference, not a historical claim.
export function musicCourtyardLayout(b){const [sx,sz]=b.workCorner||[1,1];return {kind:'lithophone',x:sx*1.9,z:sz*1.9,height:.16,sx,sz};}
export function createMusicCourtyard(B,scene,b,m){
 const a=musicCourtyardLayout(b),parts=[],add=(mesh,mat)=>{mesh.material=mat;parts.push(mesh);return mesh;};
 const box=(name,x,y,z,w,h,d,mat)=>{const a=add(B.MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene),mat);a.position.set(x,y,z);return a;};
 box('music-earth-floor',0,.035,0,5.4,.07,5.4,m.raw);box('music-low-rear-wall',0,.57,-2.4,5,.95,.18,m.plaster||m.raw);
 for(const x of [-2.35,2.35])for(const z of [-2.35,2.35])box('music-palm-post',x,1.45,x===a.sx*2.35&&z===a.sz*2.35?-a.sz*.75:z,.11,2.9,.11,m.wood);
 box('music-reed-canopy',0,2.92,0,5.15,.07,4.8,m.reed);for(const x of [-2.35,0,2.35])box('music-canopy-beam',x,2.83,0,.09,.12,5.05,m.wood);
 box('music-woven-mat',-.8,.095,.45,1.8,.025,2.2,m.linen);
 for(let i=0;i<8;i++){const angle=i*Math.PI/4,x=a.x+Math.sin(angle)*.65,z=a.z+Math.cos(angle)*.65,stone=add(B.MeshBuilder.CreateCylinder('lithophone-petal-'+i,{height:.13,diameter:1,tessellation:7},scene),m.stone);stone.position.set(x,.15,z);stone.scaling.set(.30,1,.68);stone.rotation.y=angle;}
 // A low central cushion leaves a clear ring of resonant stone slabs.
 const cushion=add(B.MeshBuilder.CreateCylinder('musician-seat-mat',{height:.07,diameter:.44,tessellation:12},scene),m.linen);cushion.position.set(a.x,.12,a.z);
 box('music-storage-bench',-1.6,.38,-1.65,1.25,.12,.45,m.wood);for(const x of [-2.04,-1.16])box('music-bench-leg',x,.20,-1.65,.075,.4,.32,m.wood);
 const groups=new Map();for(const mesh of parts){mesh.computeWorldMatrix(true);if(!groups.has(mesh.material))groups.set(mesh.material,[]);groups.get(mesh.material).push(mesh);}
 return [...groups].map(([mat,items])=>{const mesh=B.Mesh.MergeMeshes(items,true,true,undefined,false,false);mesh.name='music-courtyard-'+mat.name;mesh.material=mat;return mesh;});
}
