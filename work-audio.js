const radius=2.5;

export function waterWorkSource(state,listener){
 if(!listener||![listener.x,listener.y].every(Number.isFinite))return null;
 const proximity=listener.proximity??1;
 if(!Number.isFinite(proximity)||proximity<=0)return null;
 let nearest=null,best=radius**2;
 for(const c of state.citizens||[]){
  if(c.waterTrip?.phase!=='fill')continue;
  const distance=(c.x-listener.x)**2+(c.y-listener.y)**2;
  if(distance<best){nearest=c;best=distance;}
 }
 if(!nearest)return null;
 return {id:nearest.id,trip:nearest.waterTrip,gain:.14*Math.min(1,proximity)*(1-Math.sqrt(best)/radius)**2};
}

function splashBuffer(context){
 const frames=Math.ceil(context.sampleRate*.65),buffer=context.createBuffer(1,frames,context.sampleRate),samples=buffer.getChannelData(0);
 let random=1873,previous=0;
 for(let i=0;i<frames;i++){
  random=(Math.imul(random,1664525)+1013904223)>>>0;
  const noise=random/2147483648-1,t=i/context.sampleRate;
  previous+=.24*(noise-previous);
  const envelope=Math.min(1,t*120)*Math.exp(-t*7)*(0.65+0.35*Math.sin(t*91)**2);
  samples[i]=envelope*(.65*previous+.16*(noise-previous)+.08*Math.sin(t*780-t*t*320));
 }
 return buffer;
}

export function createWorkAudio(createContext=()=>{
 const Context=globalThis.AudioContext||globalThis.webkitAudioContext;
 return Context?new Context():null;
}){
 let context=null,buffer=null,active=null;
 const heard=new WeakSet();
 function release(voice){voice.node.disconnect();voice.gain.disconnect();}
 function silence(){
  if(!active)return;
  const voice=active;active=null;
  voice.node.onended=null;
  try{voice.node.stop();}catch{}
  release(voice);
 }
 function enable(){
  try{
   context??=createContext();
   Promise.resolve(context?.resume()).catch(()=>{});
  }catch{}
 }
 function tick(state,paused,listener){
  if(!context||context.state==='suspended'||context.state==='closed')return;
  const source=paused||state.lost?null:waterWorkSource(state,listener);
  if(active&&active.trip!==source?.trip)silence();
  if(!source)return;
  if(active){active.gain.gain.value=source.gain;return;}
  if(heard.has(source.trip))return;
  heard.add(source.trip);
  try{
   buffer??=splashBuffer(context);
   const node=context.createBufferSource(),gain=context.createGain(),voice={node,gain,trip:source.trip};
   node.buffer=buffer;gain.gain.value=source.gain;
   node.connect(gain);gain.connect(context.destination);
   active=voice;
   node.onended=()=>{if(active===voice)active=null;release(voice);};
   node.start();
  }catch{silence();}
 }
 function dispose(){silence();try{Promise.resolve(context?.close?.()).catch(()=>{});}catch{}context=null;buffer=null;}
 return {enable,tick,silence,dispose};
}
