import {catDiscoveryView} from '../miracle-discovery.js';

export function createCatDiscoveryScenery(B,scene,{tileSize=6,groundHeight=()=>0}={}){
 const meshes=[],materials=[];let bowl,content,eyes,tracks,trackKey='',disposed=false;
 const material=(name,hex)=>{const m=new B.PBRMaterial(name,scene);m.albedoColor=B.Color3.FromHexString(hex).toLinearSpace();m.roughness=.95;m.metallic=0;materials.push(m);return m;};
 let clay,water,food,mud,eyeMaterial;
 const own=m=>{m.isPickable=false;m.receiveShadows=true;meshes.push(m);return m;};
 function prepare(){
  if(bowl)return;clay=material('cat-offering-clay','#a57352');water=material('cat-offering-water','#65786e');water.roughness=.25;food=material('cat-offering-food','#9c7860');mud=material('cat-paw-mud','#685240');eyeMaterial=material('cat-eyes-amber','#ad9358');eyeMaterial.emissiveColor=B.Color3.FromHexString('#b4a06c').toLinearSpace();
  const profile=[[0,0],[.19,0],[.35,.12],[.34,.17],[.29,.14],[.18,.045],[0,.045]].map(([x,y])=>new B.Vector3(x,y,0));
  bowl=own(B.MeshBuilder.CreateLathe('cat-discovery-bowl',{shape:profile,tessellation:20,sideOrientation:B.Mesh.DOUBLESIDE},scene));bowl.material=clay;
  content=own(B.MeshBuilder.CreateCylinder('cat-discovery-offering',{diameter:.43,height:.012,tessellation:16},scene));
  const pair=[-.08,.08].map(x=>{const m=B.MeshBuilder.CreateSphere('cat-eye',{diameter:.065,segments:6},scene);m.position.x=x;return m;});
  eyes=own(B.Mesh.MergeMeshes(pair,true,true));eyes.name='cat-discovery-eyes';eyes.material=eyeMaterial;
 }
 return {meshes,update(s){
  if(disposed)return;const v=catDiscoveryView(s);if(!v){for(const m of meshes)m.setEnabled(false);return;}prepare();const h=groundHeight(v.x,v.y,s);
  bowl.setEnabled(true);bowl.position.set(v.x*tileSize,h+.008,v.y*tileSize);
  content.setEnabled(true);content.material=v.bowl==='water'?water:food;content.position.set(v.x*tileSize,h+.07,v.y*tileSize);
  eyes.setEnabled(v.eyes);eyes.position.set(v.x*tileSize+.29,h+.30,v.y*tileSize-.28);
  const key=JSON.stringify(v.tracks.map(p=>({...p,height:groundHeight(p.x,p.y,s)})));
  if(key!==trackKey){trackKey=key;if(tracks){meshes.splice(meshes.indexOf(tracks),1);tracks.dispose();tracks=null;}
   const pads=[];for(const p of v.tracks){const c=Math.cos(p.angle),t=Math.sin(p.angle),height=groundHeight(p.x,p.y,s)+.012;
    for(const [dx,dz,r]of [[0,0,.065],[-.063,-.078,.027],[-.023,-.11,.028],[.025,-.11,.028],[.064,-.078,.027]]){const m=B.MeshBuilder.CreateCylinder('paw-pad',{diameter:r*2,height:.004,tessellation:10},scene);m.position.set(p.x*tileSize+dx*c-dz*t,height,p.y*tileSize+dx*t+dz*c);pads.push(m);}
   }
   if(pads.length){tracks=own(B.Mesh.MergeMeshes(pads,true,true));tracks.name='cat-discovery-tracks';tracks.material=mud;}
  }
  tracks?.setEnabled(!!v.tracks.length);
 },dispose(){if(disposed)return;disposed=true;for(const m of meshes)m.dispose();meshes.length=0;for(const m of materials)m.dispose();materials.length=0;}};
}

// A clay road can sit above the analytic terrain. Sample its visible surface
// once per topology, rather than burying a paw decal below the road mesh.
export function catDiscoverySurfaceHeight(B,scene,x,y,fallback,tileSize=6){
 const ray=new B.Ray(new B.Vector3(x*tileSize,8,y*tileSize),new B.Vector3(0,-1,0),16);
 const hit=scene.pickWithRay(ray,m=>m.isEnabled()&&(m.name==='alluvial-valley'||!!m.metadata?.road));
 return hit?.hit&&hit.pickedPoint?hit.pickedPoint.y:fallback(x,y);
}
