import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGame} from '../engine.js';
import {manualGatheringHTML,bindManualGathering} from '../ui-manual-gathering.js';
import {setHTML} from '../ui-render.js';

function inspector(){
 const dom=new JSDOM('<main id="tile-detail"></main>'),document=dom.window.document,panel=document.querySelector('main');
 let active=false,progress=0;const calls=[],state=createGame(),source=readFileSync(new URL('../app.js',import.meta.url),'utf8'),fn='function depositDetail(x,y){'+source.split('function depositDetail(x,y){')[1].split('\nfunction detail(')[0];
 const context={document,$:id=>document.getElementById(id),state,inspected:null,inspectedPerson:null,inspectedDeposit:null,manualGatheringHTML,bindManualGathering,setHTML,
 manualGatheringView:(_s,x,y)=>({key:`${x},${y}`,resource:'clay',active,status:active?'working':'inactive',reason:'',cancelReason:'',workers:active?[{id:0,phase:'manualGathering',progress}]:[],progress,workSeconds:18,batchSize:1,maxWorkers:2}),
 orderManualGathering:(_s,x,y)=>{calls.push(['order',x,y]);active=true;return {ok:true};},cancelManualGathering:(_s,x,y)=>{calls.push(['cancel',x,y]);active=false;return {ok:true};}};
 const sandbox=vm.createContext(context);vm.runInContext(fn,sandbox);context.mutate=(result)=>{sandbox.depositDetail(sandbox.inspectedDeposit.x,sandbox.inspectedDeposit.y);return result.ok;};
 return {document,panel,calls,open:(x=7,y=7)=>sandbox.depositDetail(x,y),progress:value=>progress=value};
}

test('refresh preserves focused gather/cancel controls, and executing a command still refreshes its state',()=>{
 const ui=inspector();ui.open();const order=ui.panel.querySelector('[data-manual-order]');order.focus();ui.open();assert.equal(ui.document.activeElement,order);
 order.click();const cancel=ui.panel.querySelector('[data-manual-cancel]');assert.ok(cancel,'command blurs before its synchronous refresh');cancel.focus();ui.progress(.5);ui.open();assert.equal(ui.document.activeElement,cancel);assert.equal(ui.panel.querySelector('[data-manual-cancel]'),cancel);
 cancel.click();assert.ok(ui.panel.querySelector('[data-manual-order]'));assert.deepEqual(ui.calls,[['order',7,7],['cancel',7,7]]);
});

test('selecting a different deposit replaces a focused old inspector and binds the new coordinates',()=>{
 const ui=inspector();ui.open(7,7);ui.panel.querySelector('[data-manual-order]').focus();ui.open(11,12);ui.panel.querySelector('[data-manual-order]').click();assert.deepEqual(ui.calls,[['order',11,12]]);
});

test('city analytics count an active manual gatherer as working, without mutating the resident',async()=>{
 const {lifeAnalytics}=await import('../life-analytics.js'),s=createGame(),c=s.citizens.find(c=>c.age>=16);c.phase='manualGathering';c.manualGathering={key:'7,7',progress:3,stand:{x:6.5,y:6.5}};const before=JSON.stringify(s),view=lifeAnalytics(s);assert.equal(view.working,1);assert.equal(view.activity.find(a=>a.key==='working').count,1);assert.equal(JSON.stringify(s),before);
});
