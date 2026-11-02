import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createGame} from '../engine.js';
import {manualGatheringHTML,bindManualGathering} from '../ui-manual-gathering.js';
const view={resource:'clay',active:false,status:'inactive',reason:'',workers:[],progress:0,workSeconds:18,batchSize:1,maxWorkers:2};
const render=v=>new JSDOM(`<main>${manualGatheringHTML(createGame(),v)}</main>`).window.document.querySelector('main');
test('resource inspector explains actual delivery, slow rate and free basic work',()=>{const el=render(view);assert.match(el.textContent,/18/);assert.match(el.textContent,/склад/);assert.match(el.textContent,/веры/);assert.equal(el.querySelector('[data-manual-order]').disabled,false);assert.equal(el.querySelectorAll('svg').length>0,true);});
test('active orders show linked workers, progress and stop command',()=>{const el=render({...view,active:true,status:'working',progress:.5,workers:[{id:0,phase:'manualGathering',progress:.5}]});assert.ok(el.querySelector('[data-resident-id="0"]'));assert.equal(el.querySelector('progress').value,.5);assert.ok(el.querySelector('[data-manual-cancel]'));});
test('blocked commands are disabled and their reason is escaped',()=>{const el=render({...view,reason:'<script>blocked</script>'});assert.equal(el.querySelector('[data-manual-order]').disabled,true);assert.equal(el.querySelector('script'),null);assert.match(el.textContent,/<script>blocked/);});
test('delegated commands act once and close remains separate',()=>{const el=render(view),calls=[];bindManualGathering(el,{onOrder:()=>calls.push('order'),onCancel:()=>calls.push('cancel'),onClose:()=>calls.push('close')});el.querySelector('[data-manual-order]').click();el.querySelector('.detail-close').click();assert.deepEqual(calls,['order','close']);const active=render({...view,active:true});bindManualGathering(active,{onCancel:()=>calls.push('cancel')});active.querySelector('[data-manual-cancel]').click();assert.equal(calls.at(-1),'cancel');});

test('manual workers have a readable 2D work pose and count as busy in the city overview',async()=>{const {residentPose}=await import('../actor-art.js'),{cityDiagnostics}=await import('../city-diagnostics.js');assert.equal(residentPose({phase:'manualGathering',age:30},'clay',1).kind,'mould');assert.equal(residentPose({phase:'manualGathering',age:30},'reed',1).kind,'harvest');const s=createGame({mode:'awakening'}),before=cityDiagnostics(s).totals.workers,c=s.citizens.find(c=>c.age>=16);c.manualGathering={key:'3,3',progress:0,stand:{x:2.5,y:2.5}};assert.equal(cityDiagnostics(s).totals.workers,before+1);});

test('live map click dispatch gives explicit people/buildings priority, then the exact deposit before nearby people',async()=>{
 const {readFileSync}=await import('node:fs'),vm=await import('node:vm');
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8'),body=source.split("const renderer=await createGameRenderer($('city'),tile=>{")[1].split('},{initialState:state});')[0],calls=[];
 const person={id:7,x:3,y:4},context={dialog:{open:false},photo:null,testMapUpgrade:false,relicControlActive:()=>false,selection:null,placementRotation:0,state:{citizens:[person]},buildingAt:()=>null,visibleCitizens:()=>[person],manualGatheringView:(_s,x,y)=>x===3&&y===4?view:null,depositDetail:(x,y)=>calls.push(['deposit',x,y]),personDetail:p=>calls.push(['person',p.id]),detail:type=>calls.push(['building',type]),toast:()=>{},terrain:()=> 'sand',$:()=>({hidden:false}),build:()=>({ok:false,reason:'blocked'})};
 const click=vm.runInNewContext(`tile=>{${body}}`,context);
 click({x:3,y:4});assert.deepEqual(calls.pop(),['deposit',3,4]);
 click({x:3,y:4,citizenId:7});assert.deepEqual(calls.pop(),['person',7]);
 context.buildingAt=()=>({x:3,y:4,type:'clay'});click({x:3,y:4});assert.deepEqual(calls.pop(),['building','clay']);
 context.buildingAt=()=>null;context.selection='house';click({x:3,y:4});assert.equal(calls.length,0,'build placement never starts gathering');
});
test('an obsolete occupied deposit order can be cancelled without restarting collection after demolition',()=>{const el=render({...view,active:true,status:'blocked',reason:'На залежи уже есть здание',cancelReason:''});assert.equal(el.querySelector('[data-manual-cancel]').disabled,false);const locked=render({...view,active:true,cancelReason:'Заверши событие'});assert.equal(locked.querySelector('[data-manual-cancel]').disabled,true);});
