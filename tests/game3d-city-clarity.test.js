import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createConstructionSite,siteLayout} from '../game3d/construction-sites.js';
import {buildingReach,nearbySimilar,createBuildingReach} from '../game3d/building-reach.js';
import {BUILDINGS} from '../definitions.js';
import {createOrder} from '../construction.js';
import {createGame} from '../engine.js';
const sandbox={console,setTimeout,clearTimeout,performance,self:{}};vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);const B=sandbox.BABYLON;
test('every building has a true-size timber site, rising masonry and shared disposable surfaces',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),m={};for(const k of ['raw','fired','wood','soil','brick'])m[k]=new B.StandardMaterial(k,scene);
 for(const type of Object.keys(BUILDINGS).filter(t=>t!=='canal')){
  const b={type,x:10,y:8,level:1,...(type==='ziggurat'?{footprint:2}:{}),construction:createOrder(BUILDINGS[type])},before=JSON.stringify(b),early=createConstructionSite(B,scene,b,m);assert.equal(JSON.stringify(b),before);assert.ok(early.length<=4);const height=meshes=>{let h=0;for(const mesh of meshes){mesh.computeWorldMatrix(true);h=Math.max(h,mesh.getBoundingInfo().boundingBox.maximumWorld.y);}return h;};const initial=height(early);for(const mesh of early)mesh.dispose();b.construction.work=10;Object.assign(b.construction.delivered,b.construction.required);const late=createConstructionSite(B,scene,b,m);assert.ok(Math.abs(height(late)-initial)<.15,`${type} scaffold must not stretch upwards`);assert.ok(late.every(v=>v.metadata.constructionSite));for(const mesh of late)mesh.dispose();
 }
 assert.equal(scene.meshes.length,0);scene.dispose();engine.dispose();
});
test('site has no finished roof mass and progress does not scale its vertices',()=>{const b={type:'house',x:1,y:1,construction:createOrder(BUILDINGS.house)},a=siteLayout(b);b.construction.work=12;Object.assign(b.construction.delivered,b.construction.required);const z=siteLayout(b);assert.equal(a.height,z.height);assert.ok(z.p>a.p);assert.equal(siteLayout({type:'ziggurat',footprint:2,construction:b.construction}).width,11.2);});
test('similar building selection is nearby, bounded and never changes the city',()=>{const s=createGame();for(let x=0;x<30;x++)s.buildings.push({type:'house',x,y:5});const before=JSON.stringify(s),keys=nearbySimilar(s,{type:'house',x:3,y:5});assert.ok(keys.length<=12);assert.ok(!keys.includes('29,5'));assert.equal(JSON.stringify(s),before);});
test('radius uses true hunting search and connected road envelope, caches frames and cleans itself',()=>{
 const s=createGame(),before=JSON.stringify(s);assert.equal(buildingReach(s,{type:'hunting',x:3,y:4}).radius,6);assert.equal(buildingReach(s,{type:'house',x:3,y:4}),null);const info=buildingReach(s,s.buildings.find(b=>b.type==='shrine'));assert.equal(info.kind,'network');assert.match(info.text,/не дальность/);assert.equal(JSON.stringify(s),before);
 const engine=new B.NullEngine(),scene=new B.Scene(engine),view=createBuildingReach(B,scene),b={type:'logging',x:7,y:7};view.update(s,b);const original=view.meshes[0];for(let n=0;n<20;n++)view.update(s,b);assert.equal(view.meshes[0],original);assert.equal(scene.meshes.length,1);view.clear();assert.equal(scene.meshes.length,0);view.dispose();scene.dispose();engine.dispose();
});
