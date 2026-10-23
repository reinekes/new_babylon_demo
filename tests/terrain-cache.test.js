import test from 'node:test';
import assert from 'node:assert/strict';
import {Renderer} from '../renderer.js';
import {createGame} from '../engine.js';
test('terrain raster is reused while time advances and refreshed for camera, weather and world changes',()=>{
 const s=createGame({start:'established'}),r=Object.create(Renderer.prototype);let paints=0,blits=0;
 const destination={drawImage(){blits++;}},layer={setTransform(){}};
 Object.assign(r,{ctx:destination,canvas:{width:1600,height:1200},w:800,h:600,s:1,ox:0,oy:0,createLayerCanvas:()=>({getContext:()=>layer}),drawTerrain(){paints++;assert.equal(this.ctx,layer);}});
 r.terrainLayer(s);s.simTime+=1;r.terrainLayer(s);assert.equal(paints,1);assert.equal(blits,2);assert.equal(r.ctx,destination);
 r.ox+=10;r.terrainLayer(s);s.drought=1;r.terrainLayer(s);s.world.deposits.push({kind:'clay',x:1,y:1});r.terrainLayer(s);r.canvas.width=800;r.terrainLayer(s);assert.equal(paints,5);s.season=1;r.terrainLayer(s);assert.equal(paints,6);
});
