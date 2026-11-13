import {constructionProgress} from '../construction.js';
import {bridgeSpanAt,riverLocal,riverAxis} from '../world.js';
import {footprintSize} from '../footprints.js';
// Deliveries and masonry have separate visual stages.
export function siteLayout(b){
 const n=footprintSize(b),progress=constructionProgress(b),p=progress.work,low=['field','garden','bridge','canal'].includes(b.type);
 return {n,center:(n-1)*3,width:n*6-.8,height:low?.65:b.type==='ziggurat'?8.8:b.type==='shrine'?3.5:2.8,p,materials:progress.materials,upgrade:!!b.construction&&b.construction.kind!=='new',low};
}
export function createConstructionSite(B,scene,b,m,s){
 const a=siteLayout(b),groups=new Map();let serial=0;
 function add(mesh,mat){mesh.material=mat;mesh.isPickable=false;const parts=groups.get(mat)||[];parts.push(mesh);groups.set(mat,parts);return mesh;}
 function box(x,y,z,w,h,d,mat){const mesh=B.MeshBuilder.CreateBox(`site-${serial++}`,{width:w,height:h,depth:d},scene);mesh.position.set(x,y,z);return add(mesh,mat);}
 function beam(from,to,width=.07){const start=B.Vector3.FromArray(from),end=B.Vector3.FromArray(to),v=end.subtract(start),mesh=B.MeshBuilder.CreateCylinder(`site-timber-${serial++}`,{height:v.length(),diameter:width,tessellation:6},scene);mesh.position.copyFrom(start.add(end).scale(.5));mesh.rotationQuaternion=B.Quaternion.FromUnitVectorsToRef(B.Axis.Y,v.normalize(),new B.Quaternion());return add(mesh,m.wood);}
 if(b.type==='bridge'){
  const span=bridgeSpanAt(b,s),origin=riverLocal(b.x,b.y,s),left=(span.left-origin.across)*6,right=(span.right-origin.across)*6,z=(span.y-origin.along)*6,horizontal=riverAxis(s)==='x',point=(x,y,z)=>horizontal?[z,y,x]:[x,y,z];
  box(...point(left-.34,.035,z),horizontal?1.7:.68,.07,horizontal?.68:1.7,m.soil||m.wood);
  for(let i=0;i<Math.floor(a.materials*(1-a.p)*5);i++)box(...point(left-.34,.13+i*.10,z+.35),.3,.10,.3,m.wood);
  if(a.p>0)for(let x=left;x<left+(right-left)*a.p;x+=1.3)for(const side of [-1,1])beam(point(x,-.4,z+side*.86),point(x,1,z+side*.86),.10);

  for(let x=left;x<left+(right-left)*a.p;x+=.34)box(...point(x,.17,z),horizontal?1.7:.30,.14,horizontal?.30:1.7,m.wood);
  const result=[];for(const [mat,parts]of groups){for(const mesh of parts)mesh.computeWorldMatrix(true);const mesh=B.Mesh.MergeMeshes(parts,true,true,undefined,false,false);mesh.name='construction-bridge-timber';mesh.material=mat;mesh.metadata={constructionSite:true};result.push(mesh);}return result;
 }

 const c=a.center,r=a.width/2,ground=m.raw||m.brick,finish=b.level>=2?(m.fired||ground):ground;
 if(!a.upgrade){
  box(c,.025,c,a.width,.05,a.width,m.soil);
  if(!a.low){
   const rows=Math.floor(a.p*a.height/.22);
   for(let j=0;j<rows;j++){
    // Open doorway and irregular brick ends read as unfinished masonry.
    const y=.22+j*.22;
    box(c,y,c-r+.16,a.width-.12,.20,.3,finish);
    for(const s of [-1,1]){box(c+s*(r-.16),y,c,.3,.20,a.width-.3,finish);box(c+s*(r*.57),y,c+r-.16,r-.65,.20,.3,finish);}
   }
  }else for(let i=0;i<Math.floor(a.p*9);i++)box(c-r+.3+i*(a.width-.6)/9,.2,c,a.width/12,.12,a.width-.5,m.wood);
 }
 const stock=Math.floor(a.materials*(1-a.p)*9+.000001);
 for(let i=0;i<stock;i++)box(c-r+.42+(i%3)*.43,.13+Math.floor(i/6)*.22,c+r-.55-Math.floor(i%6/3)*.43,.39,.20,.37,ground);
 const result=[];
 for(const [mat,parts] of groups){for(const mesh of parts)mesh.computeWorldMatrix(true);const mesh=B.Mesh.MergeMeshes(parts,true,true,undefined,false,false);if(mesh){mesh.name=`construction-${b.type}-${mat.name}`;mesh.material=mat;mesh.metadata={constructionSite:true};result.push(mesh);}}
 return result;
}
