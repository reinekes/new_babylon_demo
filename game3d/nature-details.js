import {WIDTH,HEIGHT,terrain} from '../world.js';
import {TILE,shoreDistance} from '../district3d/terrain.js';
import {visualSurfaceElevation} from './lake-shore.js';
import {sceneryClear} from './nature.js';

const random=(x,y)=>{const n=Math.sin(x*127.1+y*311.7+73129)*43758.5453;return n-Math.floor(n);};
export const NATURE_BUDGETS=Object.freeze({low:Object.freeze({debris:55,puddles:14,tumbleweeds:1,snakes:1}),balanced:Object.freeze({debris:110,puddles:26,tumbleweeds:3,snakes:2}),high:Object.freeze({debris:170,puddles:38,tumbleweeds:4,snakes:3})});
const segmentDistance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);};
// All coordinates below are disposable display plans, independent of the resource
// ledger and saved animal population. Reserve the entire small movement envelope.
export function natureDetailPlan(s,roads=[],tier='balanced'){
 const budget=NATURE_BUDGETS[tier]||NATURE_BUDGETS.balanced,result={debris:[],puddles:[],tumbleweeds:[],snakes:[]};
 const clear=(x,y,r=.12)=>x>r&&y>r&&x<WIDTH-1-r&&y<HEIGHT-1-r&&terrain(Math.round(x),Math.round(y),s)!=='water'&&shoreDistance(x,y,s)>.65+r&&sceneryClear(s,{x,y},r)&&roads.every(e=>segmentDistance({x,y},e.a,e.b)>.24+r);
 // A relatively prime walk distributes details throughout the map rather than
 // exhausting a quota along its first row. Seeds are stable across quality tiers.
 for(let i=0;i<WIDTH*HEIGHT;i++){
  const cell=(i*137)%(WIDTH*HEIGHT),x=cell%WIDTH+(random(cell,7)-.5)*.5,y=Math.floor(cell/WIDTH)+(random(cell,8)-.5)*.5;
  if(!clear(x,y))continue;const n=random(cell,12);
  if(result.debris.length<budget.debris&&n<.46)result.debris.push({x,y,angle:random(cell,1)*Math.PI*2,kind:n<.16?'shard':n<.31?'reed':'dust',size:.09+random(cell,2)*.13});
  const puddleSize=.95+random(cell,4)*1.35;if(result.puddles.length<budget.puddles&&n>.80&&clear(x,y,puddleSize*1.12/6))result.puddles.push({x,y,angle:random(cell,3)*Math.PI*2,size:puddleSize,seed:cell});
  if(n>.56&&n<.62&&clear(x,y,.44)){
   if(result.tumbleweeds.length<budget.tumbleweeds&&shoreDistance(x,y,s)>2.5)result.tumbleweeds.push({x,y,phase:random(cell,6)*Math.PI*2});
   else if(result.snakes.length<budget.snakes)result.snakes.push({x,y,phase:random(cell,9)*Math.PI*2});
  }
 }return result;
}
export function resourceDisplayLayout(deposit){
 const items=[],{kind,x,y}=deposit,angle=random(x+11,y+19)*Math.PI*2;
 const add=(u,v,i)=>{const jitter=.09,px=u+(random(x+i,y+29)-.5)*jitter,py=v+(random(x+41,y+i)-.5)*jitter;items.push({x:x+px,y:y+py,angle:angle+i*2.399,size:.75+random(x+i,y+71)*.48});};
 if(kind==='reed'){for(let row=0;row<3;row++)for(let col=0;col<5;col++)add((col-2)*.105,(row-1)*.14,row*5+col);}
 else if(kind==='clay'||kind==='stone'){for(let i=0;i<7;i++)add((i%3-1)*.16,(Math.floor(i/3)-1)*.15,i);}
 else if(kind==='forest'||kind==='dates'){for(const [i,p]of [[-.21,-.12],[.19,-.14],[.04,.21]].entries())add(p[0],p[1],i);}
 return items;
}
export function advanceWetness(wetness,rain,delta){const dt=Math.max(0,Math.min(1,Number.isFinite(delta)?delta:0));return Math.max(0,Math.min(1,wetness+(rain?.14:-.025)*dt));}

function polygon(g,s,x,y,r,angle,color,seed=0,stretch=1,wet=false){
 const offset=g.positions.length/3,n=9;
 g.positions.push(x*TILE,visualSurfaceElevation(x,y,s)+.028,y*TILE);g.colors.push(...color);g.uvs.push(.5,.5);
 for(let k=0;k<=n;k++){const a=k/n*Math.PI*2,rr=r*(.78+random(k,seed)*.22),u=Math.cos(a)*rr,v=Math.sin(a)*rr*stretch,dx=u*Math.cos(angle)-v*Math.sin(angle),dz=u*Math.sin(angle)+v*Math.cos(angle),px=x+dx/TILE,py=y+dz/TILE;g.positions.push(px*TILE,visualSurfaceElevation(px,py,s)+.028,py*TILE);g.colors.push(...color.slice(0,3),color[3]*(wet?.92:.25));g.uvs.push(.5+Math.cos(a)*.5,.5+Math.sin(a)*.5);if(k<n)g.indices.push(offset,offset+k+1,offset+k+2);}
 if(wet){const outer=g.positions.length/3;for(let k=0;k<=n;k++){const i=(offset+k+1)*3,px=x+(g.positions[i]/TILE-x)*1.12,py=y+(g.positions[i+2]/TILE-y)*1.12;g.positions.push(px*TILE,visualSurfaceElevation(px,py,s)+.028,py*TILE);g.colors.push(...color.slice(0,3),0);g.uvs.push(.5,.5);if(k<n){const a=offset+k+1,b=outer+k;g.indices.push(a,b,b+1,a,b+1,a+1);}}}
}
export function natureGroundGeometry(s,plan){
 const debris={positions:[],indices:[],colors:[],uvs:[]},puddles={positions:[],indices:[],colors:[],uvs:[]};
 for(const p of plan.debris){if(p.kind==='dust')polygon(debris,s,p.x,p.y,p.size*2.2,p.angle,[.76,.66,.45,.17],p.x,.65);else{
  const o=debris.positions.length/3,c=p.kind==='shard'?[.53,.29,.15,1]:[.52,.45,.25,1],w=p.kind==='reed'?.018:p.size*.6;
  for(const [u,v]of [[-p.size,-w],[p.size,-w],[p.size*.62,w],[-p.size*.6,w]]){const dx=u*Math.cos(p.angle)-v*Math.sin(p.angle),dz=u*Math.sin(p.angle)+v*Math.cos(p.angle),x=p.x+dx/TILE,y=p.y+dz/TILE;debris.positions.push(x*TILE,visualSurfaceElevation(x,y,s)+.035,y*TILE);debris.colors.push(...c);debris.uvs.push(u,v);}debris.indices.push(o,o+1,o+2,o,o+2,o+3);
 }}
 for(const p of plan.puddles)polygon(puddles,s,p.x,p.y,p.size,p.angle,[.73,.79,.77,.92],p.seed,.55,true);
 return {debris,puddles};
}

export function createNatureDetails(B,scene,materials,{tier='balanced'}={}){
 let currentTier=tier,signature='',plan=null,wetness=0,lastTime=null,disposed=false;const meshes=[],batches=[],moving=[],owned=[];
 const material=(name,hex,roughness)=>{const m=new B.PBRMaterial(name,scene);m.albedoColor=B.Color3.FromHexString(hex).toLinearSpace();m.roughness=roughness;m.metallic=0;owned.push(m);return m;};
 const earth=material('nature-reed-shards-and-dust','#ffffff',1),water=material('nature-shallow-rain-puddles','#b7c7c2',.09),dry=material('nature-dry-tumbleweed','#8e7951',1),snake=material('nature-small-sand-snake','#81704d',.86);
 for(const m of [earth,water]){m.backFaceCulling=false;m.transparencyMode=B.Material.MATERIAL_ALPHABLEND;m.forceDepthWrite=false;}water.alpha=0;water.environmentIntensity=.7;
 const own=m=>{m.isPickable=false;m.receiveShadows=false;meshes.push(m);return m;};
 const source=(name,paths,radius,mat)=>{const parts=paths.map(path=>B.MeshBuilder.CreateTube(name,{path:path.map(p=>new B.Vector3(...p)),radius,radiusFunction:name.includes('snake')?(i=>radius*(i<2?1.15:Math.max(.12,1-(i-2)/20))):undefined,tessellation:5,cap:2},scene)),m=B.Mesh.MergeMeshes(parts,true,true);m.name=name;m.material=mat;m.setEnabled(false);return own(m);};
 const twigs=[];for(let j=0;j<11;j++){const path=[];for(let i=0;i<=9;i++){const a=i/9*Math.PI*1.65+j*1.19,r=.22+random(i+j*13,51)*.075;path.push([Math.cos(a)*r,Math.sin(a)*r*Math.cos(j*1.37),Math.sin(a)*r*Math.sin(j*1.37)]);}twigs.push(path);const p=path[5],q=path[6];twigs.push([p,[(p[0]+q[0])*.58,p[1]*1.19,p[2]*1.16],[p[0]*1.34,p[1]*1.28+.025,p[2]*1.3]]);}
 const tumbleSource=source('nature-tumbleweed-shared-source',twigs,.0065,dry),snakeSource=source('nature-snake-shared-source',[Array.from({length:22},(_,i)=>{const t=i/21;return [(t-.5)*1.08,.035+Math.sin(t*Math.PI)*.025,Math.sin(t*Math.PI*3)*.095];})],.035,snake);
 function remove(list){for(const m of list){const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);m.dispose();}list.length=0;}
 function batch(name,g,mat){if(!g.indices.length)return;const m=own(new B.Mesh(name,scene)),d=new B.VertexData();d.positions=g.positions;d.indices=g.indices;d.colors=g.colors;d.uvs=g.uvs;d.normals=[];B.VertexData.ComputeNormals(d.positions,d.indices,d.normals);d.applyToMesh(m);m.material=mat;m.useVertexColors=true;m.hasVertexAlpha=true;m.freezeWorldMatrix();batches.push(m);return m;}
 function rebuild(s,roads,key){if(signature===key)return;signature=key;remove(batches);remove(moving);plan=natureDetailPlan(s,roads,currentTier);const geometry=natureGroundGeometry(s,plan);batch('nature-ground-reeds-shards-dust',geometry.debris,earth);batch('nature-rain-puddles',geometry.puddles,water);
  for(const kind of ['tumbleweeds','snakes'])for(const p of plan[kind]){const m=own((kind==='snakes'?snakeSource:tumbleSource).createInstance(`nature-${kind}`));m.setEnabled(true);m.metadata={natureDetail:{kind,...p}};moving.push(m);}
 }
 return {meshes,get plan(){return plan;},get wetness(){return wetness;},get materialCount(){return owned.length;},setQuality(next){if(NATURE_BUDGETS[next]&&next!==currentTier){currentTier=next;signature='';}},update(s,time,weather,roads,key){if(disposed)return;rebuild(s,roads,`${key}|${currentTier}`);const dt=lastTime===null?0:Math.max(0,time-lastTime);if(lastTime===null)wetness=weather.type==='rain'?.3:0;lastTime=time;wetness=advanceWetness(wetness,weather.type==='rain',dt);water.alpha=wetness*.83;
  const puddles=batches.find(m=>m.name==='nature-rain-puddles');if(puddles)puddles.setEnabled(wetness>.005);
  for(const m of moving){const p=m.metadata.natureDetail,wind=weather.type==='wind',phase=time*(p.kind==='snakes'?.14:wind?.6:.025)+p.phase,reach=p.kind==='snakes'?.42:wind?.80:.10,x=p.x+Math.cos(phase)*reach/TILE,y=p.y+Math.sin(phase)*reach*.45/TILE;m.position.set(x*TILE,visualSurfaceElevation(x,y,s)+(p.kind==='snakes'?.035:.29),y*TILE);m.rotation.y=phase+Math.PI/2;if(p.kind==='tumbleweeds')m.rotation.z=wind?time*.8+p.phase:p.phase;}
 },dispose(){if(disposed)return;disposed=true;for(const m of meshes)m.dispose();meshes.length=0;batches.length=0;moving.length=0;for(const m of owned)m.dispose(false,false);}};
}
