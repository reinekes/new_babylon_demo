import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGameRenderer} from '../game3d/renderer.js';
const turn=()=>new Promise(resolve=>setTimeout(resolve,0));
function fixture(){
 const scripts=[],events=[],globalObject={},document={body:{dataset:{}},querySelector(){return null;},createElement(tag){return {tagName:tag,dataset:{},removed:false,setAttribute(){},remove(){this.removed=true;}};},head:{append(script){events.push('script');scripts.push(script);}}};
 let plugin=false;const B={Engine:{IsSupported:false},SceneLoader:{IsPluginForExtensionAvailable(extension){return extension==='.glb'&&plugin;}}};
 return {scripts,events,globalObject,document,B,engineReady(){globalObject.BABYLON=B;},pluginsReady(){plugin=true;}};
}
async function loader(){return (await import('../game3d/vendor-loading.js')).loadBabylonVendors;}
function globals(document,location){const saved={document:globalThis.document,location:globalThis.location,BABYLON:globalThis.BABYLON};globalThis.document=document;globalThis.location=location;delete globalThis.BABYLON;return ()=>{for(const [key,value]of Object.entries(saved))if(value===undefined)delete globalThis[key];else globalThis[key]=value;};}
test('main HTML leaves 3D vendors to the mode-specific loader',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.doesNotMatch(html,/<script\b[^>]*src=["']assets\/vendor\/babylon/i);
});
test('concurrent callers load the engine once before the GLB plugins and reuse the result',async()=>{
 const load=await loader(),f=fixture(),a=load(f),b=load(f);assert.equal(f.scripts.length,1);assert.match(f.scripts[0].src,/babylon-9\.31\.0\.js$/);
 f.engineReady();f.scripts[0].onload();await turn();assert.equal(f.scripts.length,2);assert.match(f.scripts[1].src,/babylonjs-loaders-9\.31\.0\.min\.js$/);
 f.pluginsReady();f.scripts[1].onload();assert.equal(await a,f.B);assert.equal(await b,f.B);assert.equal(await load(f),f.B);assert.equal(f.scripts.length,2);
});
test('failed plugin script is removed and a later call retries without downloading the engine again',async()=>{
 const load=await loader(),f=fixture(),a=load(f);f.engineReady();f.scripts[0].onload();await turn();const rejected=assert.rejects(a,/babylonjs-loaders/);f.scripts[1].onerror();await rejected;assert.equal(f.scripts[1].removed,true);
 const retry=load(f);assert.equal(f.scripts.length,3);assert.match(f.scripts[2].src,/babylonjs-loaders/);f.pluginsReady();f.scripts[2].onload();assert.equal(await retry,f.B);
});
test('an already available Babylon engine and GLB plugin append no script',async()=>{
 const load=await loader(),f=fixture();f.engineReady();f.pluginsReady();assert.equal(await load(f),f.B);assert.equal(f.scripts.length,0);
});
test('explicit 2D mode and injected Babylon fixtures never request a vendor',async()=>{
 for(const [search,options]of [['?view=2d',{}],['',{BABYLON:null}]]){const f=fixture(),restore=globals(f.document,{search});try{const renderer=await createGameRenderer({},()=>{},{...options,legacyFactory:()=>({mode:'2d'})});assert.equal(renderer.mode,'2d');assert.equal(f.scripts.length,0);assert.equal(f.document.body.dataset.renderer,'2d');}finally{restore();}}
});
test('a Node renderer fixture without a document retains its existing Canvas fallback',async()=>{
 const saved=globalThis.document;delete globalThis.document;
 try{const renderer=await createGameRenderer({},()=>{},{legacyFactory:()=>({mode:'2d'})});assert.equal(renderer.mode,'2d');}finally{if(saved!==undefined)globalThis.document=saved;}
});
test('3D loading status exists before its first vendor request and script failure returns a usable 2D renderer',async(t)=>{
 const f=fixture(),restore=globals(f.document,{search:''}),children=[],canvas={parentNode:{append(node){f.events.push('status');children.push(node);}}};t.mock.method(console,'error',()=>{});
 try{const pending=createGameRenderer(canvas,()=>{},{legacyFactory:()=>({mode:'2d'})});assert.equal(children[0].className,'game3d-loading');assert.deepEqual(f.events.slice(0,2),['status','script']);f.scripts[0].onerror();const renderer=await pending;assert.equal(renderer.mode,'2d');assert.equal(f.document.body.dataset.renderer,'2d');assert.equal(children[0].removed,true);assert.ok(children.some(node=>node.className==='game3d-fallback'));}finally{restore();}
});
