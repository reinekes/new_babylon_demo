import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

test('the opening is acknowledged once and a cast scene can be skipped without moving the group',async()=>{
 const {createArrivalPresentation}=await import('../arrival-presentation.js');
 const root=new JSDOM('<main></main>').window.document.querySelector('main');
 const city={arrivalGroup:{x:1,y:2,count:3},buildings:[{type:'house',x:3,y:4,waterEntityId:7}],arrivalHospitality:{welcomes:[{home:'3,4',homeId:7}]}};
 let opened=0;
 const scene=createArrivalPresentation(root,{opening:()=>true,onOpening:()=>opened++,project:p=>p});
 scene.tick(city,1000,{allowOpening:false});
 assert.equal(opened,0);
 scene.tick(city,1000);
 assert.equal(opened,1);
 assert.equal(root.querySelector('.arrival-scene').dataset.kind,'opening');
 scene.skip();scene.tick(city,1000);
 assert.equal(opened,1);
 const mark=root.querySelector('.arrival-mark');
 assert.equal(mark.hidden,false);
 city.buildings[0]={type:'house',x:3,y:4};
 scene.tick(city,1000);
 assert.equal(mark.hidden,true);
 const before=structuredClone(city);
 scene.cast(city.arrivalGroup);scene.tick(city,1000);
 assert.equal(root.querySelector('.arrival-scene').dataset.kind,'cast');
 root.querySelector('.arrival-scene button').click();
 assert.ok(root.querySelector('.arrival-scene').hidden);
 assert.deepEqual(city,before);
});
