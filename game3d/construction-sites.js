import {constructionProgress} from '../construction.js';
import {bridgeSpan} from '../world.js';
import {footprintSize} from '../footprints.js';
// A site has its own full-size scaffold and rising brick courses, never a squashed model.
export function siteLayout(b){
 const n=footprintSize(b),p=Math.max(0,Math.min(1,constructionProgress(b).ratio)),low=['field','garden','bridge','canal'].includes(b.type);
 return {n,center:(n-1)*3,width:n*6-.8,height:low?.65:b.type==='ziggurat'?8.8:b.type==='shrine'?3.5:2.8,p,upgrade:b.construction?.kind==='upgrade',low};
}
export function createConstructionSite(B,scene,b,m){
 const a=siteLayout(b),groups=new Map();let serial=0;
 function add(mesh,mat){mesh.material=mat;mesh.isPickable=false;const parts=groups.get(mat)||[];parts.push(mesh);groups.set(mat,parts);return mesh;}
 function box(x,y,z,w,h,d,mat){const mesh=B.MeshBuilder.CreateBox(`site-${serial++}`,{width:w,height:h,depth:d},scene);mesh.position.set(x,y,z);return add(mesh,mat);}
 function beam(from,to,width=.07){const start=B.Vector3.FromArray(from),end=B.Vector3.FromArray(to),v=end.subtract(start),mesh=B.MeshBuilder.CreateCylinder(`site-timber-${serial++}`,{height:v.length(),diameter:width,tessellation:6},scene);mesh.position.copyFrom(start.add(end).scale(.5));mesh.rotationQuaternion=B.Quaternion.FromUnitVectorsToRef(B.Axis.Y,v.normalize(),new B.Quaternion());return add(mesh,m.wood);}
 if(b.type==='bridge'){const span=bridgeSpan(b.y),left=(span.left-b.x)*6,right=(span.right-b.x)*6;for(let x=left;x<=right;x+=1.3)for(const side of [-1,1])beam([x,-.4,side*.86],[x,1,side*.86],.10);for(const side of [-1,1])beam([left,.4,side*.86],[right,.4,side*.86],.07);for(let x=left;x<left+(right-left)*a.p;x+=.34)box(x,.17,0,.30,.14,1.7,m.wood);const result=[];for(const [mat,parts]of groups){for(const mesh of parts)mesh.computeWorldMatrix(true);const mesh=B.Mesh.MergeMeshes(parts,true,true,undefined,false,false);mesh.name='construction-bridge-timber';mesh.material=mat;mesh.metadata={constructionSite:true};result.push(mesh);}return result;}
 const c=a.center,r=a.width/2,ground=m.raw||m.brick,finish=b.level>=2?(m.fired||ground):ground;
 if(!a.upgrade){
  box(c,.025,c,a.width,.05,a.width,m.soil);
  for(const s of [-1,1]){box(c,.11,c+s*(r-.14),a.width,.22,.28,ground);box(c+s*(r-.14),.11,c,.28,.22,a.width,ground);}
  if(!a.low){
   const rows=Math.floor(a.p*a.height/.22);
   for(let j=0;j<rows;j++){
    // Open doorway and irregular brick ends read as unfinished masonry.
    const y=.22+j*.22;
    box(c,y,c-r+.16,a.width-.12,.20,.3,finish);
    for(const s of [-1,1]){box(c+s*(r-.16),y,c,.3,.20,a.width-.3,finish);box(c+s*(r*.57),y,c+r-.16,r-.65,.20,.3,finish);}
   }
  }else for(let i=0;i<2+Math.floor(a.p*7);i++)box(c-r+.3+i*(a.width-.6)/9,.2,c,a.width/12,.12,a.width-.5,m.wood);
 }
 // Scaffold stays at true dimensions even on the first day. Simple timber/reed
 // poles are an artistic reconstruction, not a claim of a specific excavated kit.
 const h=a.height+.4;
 for(const s of [-1,1])for(const t of [-1,1])beam([c+s*(r+.12),.05,c+t*(r+.12)],[c+s*(r+.12)+s*.035,h,c+t*(r+.12)],.10);
 if(!a.low)for(let floor=.9;floor<h;floor+=1.05){
  for(const s of [-1,1]){
   beam([c-r-.12,floor,c+s*(r+.12)],[c+r+.12,floor,c+s*(r+.12)]);
   beam([c+s*(r+.12),floor,c-r-.12],[c+s*(r+.12),floor,c+r+.12]);
   box(c,floor-.08,c+s*(r+.08),a.width+.4,.055,.42,m.wood);
  }
 }
 if(!a.low){
  for(const s of [-1,1])beam([c-r-.12,.18,c+s*(r+.12)],[c+r+.12,Math.min(h,2.1),c+s*(r+.12)],.055);
  const x=c+r+.42,z=c-r+.7,ladder=Math.min(h,3.1);
  for(const s of [-1,1])beam([x+s*.19,.05,z+.6],[x+s*.19,ladder,z],.065);
  for(let j=1;j<=Math.floor(ladder/.28);j++)beam([x-.2,j*.28,z+.6*(1-j*.28/ladder)],[x+.2,j*.28,z+.6*(1-j*.28/ladder)],.045);
 }
 for(let i=0;i<3+Math.floor((1-a.p)*8);i++)box(c-r+.42+(i%3)*.43,.13+Math.floor(i/6)*.22,c+r-.55-Math.floor(i%6/3)*.43,.39,.20,.37,ground);
 const result=[];
 for(const [mat,parts] of groups){for(const mesh of parts)mesh.computeWorldMatrix(true);const mesh=B.Mesh.MergeMeshes(parts,true,true,undefined,false,false);if(mesh){mesh.name=`construction-${b.type}-${mat.name}`;mesh.material=mat;mesh.metadata={constructionSite:true};result.push(mesh);}}
 return result;
}
