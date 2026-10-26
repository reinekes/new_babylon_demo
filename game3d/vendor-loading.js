// The 2D route never needs the WebGL engine or its GLB import plugins.
const pending=new WeakMap();
const engineURL=new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url).href;
const loadersURL=new URL('../assets/vendor/babylonjs-loaders-9.31.0.min.js',import.meta.url).href;
const hasPlugins=B=>!!B?.SceneLoader?.IsPluginForExtensionAvailable?.('.glb');
function script(document,src){
 return new Promise((resolve,reject)=>{
  const element=document.createElement('script');element.src=src;element.async=true;
  element.onload=()=>resolve();
  element.onerror=()=>{element.remove();reject(Error('Unable to load 3D vendor: '+src));};
  document.head.append(element);
 });
}
export function loadBabylonVendors({document=globalThis.document,globalObject=globalThis}={}){
 const current=globalObject.BABYLON;if(current?.Engine&&hasPlugins(current))return Promise.resolve(current);
 if(!document?.createElement||!document.head?.append)return Promise.reject(Error('3D vendor loading requires a document'));
 if(pending.has(document))return pending.get(document);
 const ready=(async()=>{
  if(!globalObject.BABYLON?.Engine)await script(document,engineURL);
  if(!globalObject.BABYLON?.Engine)throw Error('Babylon engine did not initialize');
  if(!hasPlugins(globalObject.BABYLON))await script(document,loadersURL);
  if(!hasPlugins(globalObject.BABYLON))throw Error('Babylon GLB plugins did not initialize');
  return globalObject.BABYLON;
 })().catch(error=>{pending.delete(document);throw error;});
 pending.set(document,ready);return ready;
}
