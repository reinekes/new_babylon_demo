import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGame} from '../engine.js';
import {createGameLandscape} from '../game3d/landscape.js';
import {createBootstrapLandscape} from '../game3d/bootstrap-landscape.js';
import {worldWidth,worldHeight} from '../world.js';
import {TILE} from '../district3d/terrain.js';

const sandbox={console,setTimeout,clearTimeout,performance,window:{addEventListener(){},removeEventListener(){}},navigator:{userAgent:'node'}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.BABYLON;
function rim(view,s){
 const ground=view.meshes.find(m=>m.name==='alluvial-valley'),background=view.meshes.find(m=>m.name==='distant-alluvial-plain');
 const p=ground.getVerticesData(B.VertexBuffer.PositionKind),n=ground.getVerticesData(B.VertexBuffer.NormalKind),vertices=new Map();
 for(let i=0;i<p.length;i+=3)if(p[i]===-.5*TILE||p[i]===(worldWidth(s)-.5)*TILE||p[i+2]===-.5*TILE||p[i+2]===(worldHeight(s)-.5)*TILE)vertices.set(`${p[i]},${p[i+2]}`,{height:p[i+1],normal:n.slice(i,i+3)});
 const q=background.getVerticesData(B.VertexBuffer.PositionKind),m=background.getVerticesData(B.VertexBuffer.NormalKind);let matched=0;
 for(let i=0;i<q.length;i+=3){const v=vertices.get(`${q[i]},${q[i+2]}`);if(!v)continue;matched++;assert.ok(Math.abs(q[i+1]-v.height)<1e-6,'shared terrain edge height');assert.ok(Math.hypot(...m.slice(i,i+3).map((x,k)=>x-v.normal[k]))<1e-6,`lighting splits at map edge ${q[i]},${q[i+2]}`);}
 assert.ok(matched>500);
}

for(const detail of [false,true])test(`${detail?'detailed':'startup'} terrain retains shared rim lighting after canal updates and demolition`,async()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),materials=Object.fromEntries(['soil','grass','wood','stone','terracotta','reed','linen'].map(k=>[k,new B.PBRMaterial(k,scene)]));
 const originalLoader=B.SceneLoader.LoadAssetContainerAsync;
 // Optional downloaded models do not affect the real ground meshes under test.
 B.SceneLoader.LoadAssetContainerAsync=async()=>new B.AssetContainer(scene);
 let view;
 try{
  const s=createGame({start:'established',seed:96}),before=JSON.stringify(s);
  view=detail?await createGameLandscape(B,scene,s,materials):createBootstrapLandscape(B,scene,s,materials);
  rim(view,s);assert.equal(JSON.stringify(s),before);
  s.buildings.push({type:'canal',x:4,y:4,level:1},{type:'canal',x:5,y:4,level:1});
  view.update(s,0);rim(view,s);
  for(const [x,y]of [[0,4],[worldWidth(s)-1,4],[4,0],[4,worldHeight(s)-1]])s.buildings.push({type:'canal',x,y,level:1});
  view.update(s,0);rim(view,s);
  s.buildings=s.buildings.filter(b=>b.type!=='canal');view.update(s,0);rim(view,s);
 }finally{B.SceneLoader.LoadAssetContainerAsync=originalLoader;view?.dispose();scene.dispose();engine.dispose();}
});
