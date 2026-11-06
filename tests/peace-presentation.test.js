import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

test('peace scenes are skippable and only resting recipients show the relief marker',async()=>{
 const {createPeacePresentation}=await import('../peace-presentation.js');
 const root=new JSDOM('<main></main>').window.document.querySelector('main');
 const s={simTime:15,peaceDiscovery:{lastCast:{at:10,ids:[1,2]}},citizens:[
  {id:1,x:4,y:4,phase:'resting'},{id:2,x:5,y:4,phase:'toStore'},{id:3,x:6,y:4,phase:'resting'}
 ]};
 let opened=0;
 const scene=createPeacePresentation(root,{ready:()=>true,onOpening:()=>opened++,project:p=>p});
 scene.tick(s,16);
 assert.equal(opened,1);
 assert.equal(root.querySelectorAll('.peace-relief').length,1);
 assert.equal(root.querySelector('.peace-relief').dataset.resident,'1');
 scene.cast();scene.tick(s,16);
 root.querySelector('.peace-scene button').click();
 scene.tick(s,16);
 assert.equal(opened,1);
 assert.equal(s.citizens[1].phase,'toStore');
 s.simTime=80;scene.tick(s,16);
 assert.equal(root.querySelectorAll('.peace-relief').length,0);
});

test('resting recipients have a distinct idle pose, while cargo keeps its normal pose',async()=>{
 const {actorAnimation}=await import('../game3d/actors.js');
 assert.deepEqual(actorAnimation({kind:'person',peaceRelief:true}),{clip:'Idle_Loop',pose:'peaceRelief'});
 assert.notEqual(actorAnimation({kind:'person',peaceRelief:true,carrying:true}).pose,'peaceRelief');
});
