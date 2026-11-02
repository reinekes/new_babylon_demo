import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {GameRenderer3D,worldCell,valleyFogDensity} from '../game3d/renderer.js';
import {createGame} from '../engine.js';
import {resourcePlacementSites,landscapeSignature} from '../game3d/landscape.js';
const world={width:64,height:64,generationVersion:2,seed:17,river:{axis:'x',flowSign:-1,offset:44,slope:0,amplitude:0,frequency:.1,phase:0},lakes:[]};
test('large valley overview fits all corners including portrait and remains zoomable',()=>{
 for(const [w,h]of [[1400,900],[390,844]]){
 const r=Object.create(GameRenderer3D.prototype);Object.assign(r,{state:{world},w,h,B:{Vector3:class{constructor(x,y,z){Object.assign(this,{x,y,z});}}},camera:{fov:.8,setTarget(v){this.target=v;}}});
 r.overview();assert.equal(r.camera.target.x,189);assert.equal(r.camera.target.z,189);
 const half=Math.min(.4,Math.atan(Math.tan(.4)*w/h));assert.ok(r.camera.radius*Math.sin(half)>=Math.hypot(64*3,64*3));
 assert.ok(Math.exp(-Math.pow(r.camera.radius*valleyFogDensity(r.camera.radius),2))>.8,'overview stays visible through the fog on portrait');
 const radius=r.camera.radius;r.layout();assert.equal(r.camera.radius,radius);r.zoomBy(-.01);assert.ok(r.camera.radius>radius);
 assert.deepEqual(worldCell({x:63*6,z:63*6},r.state),{x:63,y:63});
 }
});
test('fishing placement follows horizontal river into the distant half of new map',()=>{
 const s=createGame({start:'established'});s.world={...world,deposits:[]};s.buildings=[];s.resources.faith=1e5;
 const sites=resourcePlacementSites(s,'fishing');assert.ok(sites.some(p=>p.x>55&&Math.abs(p.y-44)<=3));assert.ok(sites.every(p=>Math.abs(p.y-44)<=3));
 assert.notEqual(landscapeSignature(s),landscapeSignature({...s,world:{...s.world,width:40,height:32}}));
});
test('saved city replacement refreshes actual Babylon camera limits in both directions',()=>{
 const box={console,setTimeout,clearTimeout,performance,window:{addEventListener(){},removeEventListener(){}},navigator:{userAgent:'node'}};
 vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),box);
 const B=box.BABYLON,engine=new B.NullEngine(),scene=new B.Scene(engine);
 try{
  for(const [width,height]of [[1400,900],[390,844]]){
   const camera=new B.ArcRotateCamera('saved-city-camera',Math.PI/3,.96,62,new B.Vector3(53,0,55),scene),r=Object.create(GameRenderer3D.prototype);
   Object.assign(r,{B,camera,state:{buildings:[]},effectViews:[],engine:{resize(){}},canvas:{getBoundingClientRect:()=>({width,height})}});
   scene.activeCamera=camera;r.resize();assert.equal(camera.upperRadiusLimit,360);
   // app.replaceCity assigns renderer.state before resetPresentation and draw.
   r.state={world,buildings:[]};r.resetPresentation();r.home();r.overview();const desired=camera.radius;
   scene.render();assert.equal(camera.radius,desired,'Babylon must not clamp the enlarged overview to the old world limit');assert.ok(camera.maxZ>camera.radius+Math.hypot(64*3,64*3));
   r.state={buildings:[]};r.resetPresentation();r.home();r.overview();scene.render();assert.equal(camera.radius,240);assert.equal(camera.upperRadiusLimit,360);
   camera.dispose();
  }
 }finally{scene.dispose();engine.dispose();}
});
