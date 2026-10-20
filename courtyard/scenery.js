// Original outdoor dressing. Imported hero models are separate licensed GLB assets.
export function createScenery(B,scene){
 const color=s=>B.Color3.FromHexString(s).toLinearSpace(),meshes=[];
 const mat=(name,hex,texture,normal)=>{const m=new B.PBRMaterial(name,scene);m.albedoColor=color(hex);m.metallic=0;m.roughness=.98;if(texture){m.albedoTexture=new B.Texture(`assets/3d/textures/${texture}_color.jpg`,scene);if(normal){m.bumpTexture=new B.Texture(`assets/3d/textures/${texture}_normal.jpg`,scene);m.bumpTexture.level=normal;}}return m;};
 const soil=mat('fine-alluvial-earth','#ddcba9','dry_ground_01',.32),path=mat('trodden-earth','#ddceb1','clay_plaster',.2),grass=mat('living-bank-grass','#718146'),reed=mat('dry-reed','#a79762'),wood=mat('palm-footbridge','#b6a17e','wood_table_worn',.4),stone=mat('bank-pebbles','#a89d86','dry_ground_01',.4);
 const noise=(x,z)=>{const v=Math.sin(x*127.1+z*311.7)*43758.5453;return v-Math.floor(v);};
 function terrain(){const positions=[],indices=[],uvs=[],colors=[],N=90,size=180;
  for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){const x=(i/N-.5)*size,z=(j/N-.5)*size,far=Math.max(0,Math.hypot(x,z)-18),height=x<-11.5&&x>-15?-.6:Math.min(.7,far*.013)*(1+Math.sin(x*.16+z*.17));positions.push(x,height-.025,z);uvs.push(x/1.8,z/1.8);const bank=Math.max(0,1-Math.abs(x+11.5)/3.7),v=.91+noise(x,z)*.09;colors.push(v*(1-bank*.2),v*(1-bank*.1),v*(1-bank*.34),1);if(i<N&&j<N){const k=j*(N+1)+i;indices.push(k,k+1,k+N+1,k+1,k+N+2,k+N+1);}}
  const mesh=new B.Mesh('continuous-earth',scene),data=new B.VertexData();data.positions=positions;data.indices=indices;data.uvs=uvs;data.colors=colors;data.normals=[];B.VertexData.ComputeNormals(positions,indices,data.normals);data.applyToMesh(mesh);mesh.material=soil;mesh.receiveShadows=true;mesh.freezeWorldMatrix();meshes.push(mesh);
 }terrain();
 // Soft irregular wear patch with physical UV scale, no hard oval boundary.
 const pp=[0,.009,0],pu=[0,0],pc=[1,1,1,.82],pi=[],pn=[],N=64;
 for(const r of [.66,1])for(let i=0;i<N;i++){
  const a=i/N*Math.PI*2,v=1+Math.sin(a*5)*.04+Math.cos(a*9)*.025,x=Math.cos(a)*11*r*v,z=Math.sin(a)*8*r*v;
  pp.push(x,.009,z);pu.push(x/1.7,z/1.7);pc.push(1,1,1,r===1?0:.82);
 }
 for(let i=0;i<N;i++){const n=(i+1)%N;pi.push(0,1+n,1+i,1+i,1+n,1+N+i,1+n,1+N+n,1+N+i);}
 B.VertexData.ComputeNormals(pp,pi,pn);const court=new B.Mesh('soft-worn-courtyard-ground',scene),cd=new B.VertexData();cd.positions=pp;cd.indices=pi;cd.normals=pn;cd.uvs=pu;cd.colors=pc;cd.applyToMesh(court);path.transparencyMode=B.Material.MATERIAL_ALPHABLEND;path.forceDepthWrite=false;court.hasVertexAlpha=true;court.material=path;court.receiveShadows=true;court.freezeWorldMatrix();meshes.push(court);
 const water=new B.PBRMaterial('quiet-irrigation-channel',scene);water.albedoColor=color('#28594f');water.metallic=.15;water.roughness=.14;water.environmentIntensity=1;
 const ripple=new B.DynamicTexture('original-water-normal',128,scene,false),ctx=ripple.getContext(),pixels=ctx.createImageData(128,128);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){const k=(y*128+x)*4;pixels.data[k]=128+16*Math.cos(y*.4+x*.14);pixels.data[k+1]=128+20*Math.sin(x*.4+y*.1);pixels.data[k+2]=252;pixels.data[k+3]=255;}ctx.putImageData(pixels,0,0);ripple.update();ripple.uScale=2;ripple.vScale=24;ripple.level=.25;water.bumpTexture=ripple;
 const stream=B.MeshBuilder.CreateGround('narrow-water-channel',{width:2.6,height:180},scene);stream.position.set(-13.25,-.11,0);stream.material=water;stream.freezeWorldMatrix();meshes.push(stream);
 const parts=[];function box(pos,size,material){const m=B.MeshBuilder.CreateBox('courtyard-prop',{width:size[0],height:size[1],depth:size[2]},scene);m.position.set(...pos);m.material=material;parts.push(m);return m;}
 for(let i=0;i<12;i++)box([-13.25,.13,-.85+i*.16],[3.5,.12,.145],wood);
 for(const z of [-.75,.75])box([-13.25,-.12,z],[3.4,.16,.14],wood);
 // Fine grass geometry kept in one mesh; varying height/lean prevents a carpet of identical cards.
 const p=[],ix=[],ns=[],uv=[];for(let i=0;i<620;i++){
  const x=-11.1+noise(i,6)*2.4,z=(noise(i,9)-.5)*32;if(Math.abs(z)<1.6)continue;
  for(let k=0;k<6;k++){const a=k*2.4+noise(i,k),h=.15+noise(i+k,3)*.38,w=.014+noise(k,i)*.015,dx=Math.cos(a),dz=Math.sin(a),offset=p.length/3;
   p.push(x-dz*w,0,z+dx*w,x+dz*w,0,z-dx*w,x+dx*.16+dz*w,h*.65,z+dz*.16-dx*w,x+dx*.27,h,z+dz*.27);
   uv.push(0,0,1,0,1,.65,.5,1);ix.push(offset,offset+1,offset+2,offset,offset+2,offset+3);
  }
 }
 B.VertexData.ComputeNormals(p,ix,ns);const foliage=new B.Mesh('fine-riverbank-grass',scene),d=new B.VertexData();d.positions=p;d.indices=ix;d.normals=ns;d.uvs=uv;d.applyToMesh(foliage);grass.backFaceCulling=false;foliage.material=grass;foliage.receiveShadows=true;foliage.freezeWorldMatrix();meshes.push(foliage);
 for(let i=0;i<65;i++){const x=(noise(i,20)-.5)*25,z=(noise(i,12)-.5)*25;if(Math.abs(x+13)<1.7||Math.hypot(x,z)<5)continue;const m=B.MeshBuilder.CreateIcoSphere('scattered-pebble',{radius:.06+noise(i,2)*.12,subdivisions:1},scene);m.scaling.set(1.6,.55,1);m.position.set(x,.015,z);m.material=stone;parts.push(m);}
 const stalk=mat('barley-stalk','#9c9c50'),ears=mat('barley-ears','#c3ab66');
 for(let row=0;row<17;row++)for(let j=0;j<16;j++){
  const x=-7.6+row*.19+(noise(row,j)-.5)*.09,z=3.0+j*.22+(noise(j,row)-.5)*.09,h=.65+noise(row+22,j)*.23;
  const stem=B.MeshBuilder.CreateCylinder('barley-stem',{height:h,diameter:.018,tessellation:4},scene);stem.position.set(x,h/2,z);stem.material=stalk;parts.push(stem);
  const ear=B.MeshBuilder.CreateCylinder('barley-ear',{height:.14,diameterBottom:.045,diameterTop:.022,tessellation:5},scene);ear.position.set(x+.015,h,z);ear.rotation.z=.14;ear.material=ears;parts.push(ear);
 }
 for(const material of [wood,stone,stalk,ears]){const group=parts.filter(m=>m.material===material);if(group.length){const m=B.Mesh.MergeMeshes(group,true,true);m.material=material;m.receiveShadows=true;m.freezeWorldMatrix();meshes.push(m);}}
 return {meshes,update(t){ripple.uOffset=t*.007;ripple.vOffset=t*.003;}};
}
