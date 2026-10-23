import {MODEL_VERSIONS} from './model-versions.js';
// Optional detail loading never owns or advances the simulation.
export function createBackgroundQueue(limit=2,{onError=()=>{}}={}){
 const waiting=[],errors=[],listeners=[];let active=0,disposed=false,scheduled=false;
 const settle=()=>{if(!active&&!waiting.length)for(const resolve of listeners.splice(0))resolve();};
 function pump(){scheduled=false;if(disposed){settle();return;}while(active<limit&&waiting.length){const job=waiting.shift();active++;Promise.resolve().then(job.load).then(value=>{if(disposed)value?.dispose?.();else job.replace(value);}).catch(error=>{errors.push(error);onError(error);}).finally(()=>{active--;pump();settle();});}settle();}
 return {errors,add(load,replace){if(disposed)return;waiting.push({load,replace});if(!scheduled){scheduled=true;setTimeout(pump,0);}},idle(){return !active&&!waiting.length?Promise.resolve():new Promise(r=>listeners.push(r));},dispose(){disposed=true;waiting.length=0;settle();}};
}
export function createLazyFeature(load,{required=()=>true,onError=()=>{}}={}){
 let feature=null,promise=null,disposed=false,lastUpdate=null,shows=[];
 function start(){if(promise||disposed)return;promise=Promise.resolve().then(load).then(value=>{if(disposed){value?.dispose?.();return;}feature=value;if(lastUpdate)feature.update?.(...lastUpdate);for(const args of shows)feature.show?.(...args);shows=[];}).catch(onError);}
 return {get meshes(){return feature?.meshes||[];},get ready(){return promise;},update(...args){lastUpdate=args;if(feature)feature.update?.(...args);else if(required(...args))start();},show(...args){if(feature)return feature.show?.(...args);shows.push(args);start();},clear(){shows=[];feature?.clear?.();},setQuality(...args){feature?.setQuality?.(...args);},light(...args){feature?.light?.(...args);},dispose(){disposed=true;shows=[];feature?.dispose?.();feature=null;}};
}
const modelQueues=new WeakMap();
// Embedded GLBs are bounded independently of the number of scene layers requesting them.
export function loadModel(B,scene,...args){const path=String(args[1]||'').split('?')[0],hash=MODEL_VERSIONS[path.split('/').pop()];if(hash)args[1]=path+'?v='+hash;let q=modelQueues.get(scene);if(!q){q={active:0,pending:[]};modelQueues.set(scene,q);}const loader=B.SceneLoader.LoadAssetContainerAsync.bind(B.SceneLoader);
 return new Promise((resolve,reject)=>{q.pending.push({resolve,reject,args,loader});pump();});
 function pump(){while(q.active<3&&q.pending.length){const job=q.pending.shift();if(scene.isDisposed===true){job.reject(Error('Scene disposed'));continue;}q.active++;Promise.resolve().then(()=>job.loader(...job.args)).then(job.resolve,job.reject).finally(()=>{q.active--;pump();});}}
}
