import test from 'node:test';import assert from 'node:assert/strict';
import {panelPreferences,panelHotkey,createPanelControls} from '../ui-panels.js';
test('view preferences survive partial/malformed storage without entering city saves',()=>{assert.deepEqual(panelPreferences('bad'),{top:true,bottom:true,sides:true});assert.deepEqual(panelPreferences('{"top":false,"bottom":0,"sides":false}'),{top:false,bottom:true,sides:false});});
test('H respects text editing, dialogs and photograph mode',()=>{const doc={querySelector:()=>null,body:{classList:{contains:()=>false}}},event={key:'h',target:{closest:()=>null}};assert.equal(panelHotkey(event,doc),true);assert.equal(panelHotkey({...event,ctrlKey:true},doc),false);assert.equal(panelHotkey({...event,target:{closest:()=>({})}},doc),false);assert.equal(panelHotkey(event,{...doc,querySelector:()=>({})}),false);});
test('blocked browser storage does not abort controls; map-only and restore still work',()=>{
 const saved=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),nodes=new Map(),classes=new Set();
 const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{hidden:true,setAttribute(){},focus(){},querySelector:node});return nodes.get(selector);};
 const root={querySelector:node,querySelectorAll:()=>[],remove(){}},document={createElement:()=>root,body:{append(){},classList:{toggle:(k,on)=>on?classes.add(k):classes.delete(k)}},addEventListener(){},removeEventListener(){}};
 Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('Browser storage is blocked');}});
 try{const view=createPanelControls({document});node('[data-map-only]').onclick();assert.deepEqual(view.preferences,{top:false,bottom:false,sides:false});assert.ok(classes.has('map-only'));node('[data-restore]').onclick();assert.deepEqual(view.preferences,{top:true,bottom:true,sides:true});assert.equal(classes.has('map-only'),false);view.dispose();}
 finally{if(saved)Object.defineProperty(globalThis,'localStorage',saved);else delete globalThis.localStorage;}
});
