import {createLyreVoice,playStoneNote} from './music-audio.js';
import {buildingKey,isOperational} from './definitions.js';

const sounds={
 water:{radius:2.5,volume:.14,duration:.65},
 reeds:{radius:2.5,volume:.075,duration:2.8},
 pottery:{radius:2.5,volume:.13,duration:1.6},
 market:{radius:2.8,volume:.13,duration:2.2}
};

export function workSoundSource(state,listener){
 if(!listener||![listener.x,listener.y].every(Number.isFinite))return null;
 const proximity=listener.proximity??1;
 if(!Number.isFinite(proximity)||proximity<=0)return null;
 let source=null;
 function consider(kind,token,position,id){
  const {radius,volume}=sounds[kind],distance=(position.x-listener.x)**2+(position.y-listener.y)**2;
  if(!(distance<radius**2))return;
  const gain=volume*Math.min(1,proximity)*(1-Math.sqrt(distance)/radius)**2;
  if(!source||gain>source.gain)source={kind,token,id,gain};
 }
 const workshops=[];
 for(const b of state.buildings||[]){
  if(b.type==='pottery'&&b.artisan?.stage==='forming'&&isOperational(b)&&Math.abs(b.x-listener.x)<4&&Math.abs(b.y-listener.y)<4)workshops.push(b);
 }
 for(const c of state.citizens||[]){
  if(c.waterTrip?.phase==='fill')consider('water',c.waterTrip,c,c.id);
  if(c.phase!=='working'||!c.work)continue;
  const shop=workshops.find(b=>buildingKey(b)===c.work);
  if(shop&&Math.hypot(c.x-shop.x,c.y-shop.y)<=1.5)consider('pottery',shop,c,c.id);
 }
 const caravan=state.trade?.caravan;
 if(caravan?.phase==='unloading'||caravan?.phase==='trading'){
  const market=(state.buildings||[]).find(b=>['market','harbor'].includes(b.type)&&buildingKey(b)===caravan.market&&isOperational(b));
  if(market)consider('market',caravan,market,caravan.id);
 }
 for(const reed of state.world?.deposits||[])if(reed.kind==='reed')consider('reeds',reed,reed);
 return source;
}

function workBuffer(context,kind){
 const frames=Math.ceil(context.sampleRate*sounds[kind].duration),buffer=context.createBuffer(1,frames,context.sampleRate),samples=buffer.getChannelData(0);
 let random=1873,previous=0;
 for(let i=0;i<frames;i++){
  random=(Math.imul(random,1664525)+1013904223)>>>0;
  const noise=random/2147483648-1,t=i/context.sampleRate;
  previous+=.24*(noise-previous);
  if(kind==='water'){
   const envelope=Math.min(1,t*120)*Math.exp(-t*7)*(.65+.35*Math.sin(t*91)**2);
   samples[i]=envelope*(.65*previous+.16*(noise-previous)+.08*Math.sin(t*780-t*t*320));
  }else if(kind==='reeds'){
   samples[i]=(noise-previous)*.65*Math.sin(Math.PI*i/frames)**2*(.35+.65*Math.sin(t*4.1)**2);
  }else{
   const beat=kind==='pottery'?t%.53:t%.73,decay=Math.exp(-beat*(kind==='pottery'?22:14));
   const tone=kind==='pottery'?Math.sin(t*1060):Math.sin(t*420)+.3*Math.sin(t*870);
   samples[i]=Math.min(1,beat*240)*Math.min(1,(frames-i)/240)*decay*(.48*previous+.2*tone);
  }
 }
 return buffer;
}

export function createWorkAudio(createContext=()=>{
 const Context=globalThis.AudioContext||globalThis.webkitAudioContext;
 return Context?new Context():null;
}){
 let context=null,active=null,rainVoices=[],earthVoice=null,earthNotes=[],catNotes=[],cueId=0;
 const lyre=createLyreVoice(),buffers=new Map();
 const heard=new WeakSet();
 function release(voice){voice.node.disconnect();voice.gain.disconnect();}
 function silence(){
  if(!active)return;
  const voice=active;active=null;
  voice.node.onended=null;
  try{voice.node.stop();}catch{}
  release(voice);
 }
 function enable(resume=true){
  try{
   context??=createContext();
   if(resume)Promise.resolve(context?.resume()).catch(()=>{});
  }catch{}
 }
 function tick(state,paused,listener){
  if(!context||context.state==='suspended'||context.state==='closed')return;
  const source=paused||state.lost?null:workSoundSource(state,listener);
  if(active&&active.token!==source?.token)silence();
  if(!source)return;
  if(active){active.gain.gain.value=source.gain;return;}
  if(source.kind==='water'&&heard.has(source.token))return;
  try{
   if(!buffers.has(source.kind))buffers.set(source.kind,workBuffer(context,source.kind));
   const node=context.createBufferSource(),gain=context.createGain(),voice={node,gain,token:source.token};
   node.buffer=buffers.get(source.kind);node.loop=source.kind!=='water';gain.gain.value=source.gain;
   node.connect(gain);gain.connect(context.destination);
   active=voice;
   node.onended=()=>{if(active===voice)active=null;release(voice);};
   node.start();
   if(source.kind==='water')heard.add(source.token);
  }catch{silence();}
 }
 function stopRain(){
  for(const osc of rainVoices){try{osc.stop();}catch{}}
  rainVoices=[];
 }
 function beginCue(){
  stopRain();stopEarth();stopCat();
  return ++cueId;
 }
 function cueRain(phase){
  if(!context||context.state!=='running')return;
  const id=beginCue();
  try{rainVoices=playStoneNote(context,phase==='drop'?660:245,phase==='drop'?.075:.043);}catch{return;}
  return ()=>{if(id===cueId)stopRain();};
 }
 function stopEarth(){
  for(const osc of earthNotes){try{osc.stop();}catch{}}
  earthNotes=[];
  if(!earthVoice)return;
  const voice=earthVoice;earthVoice=null;voice.node.onended=null;
  try{voice.node.stop();}catch{}
  release(voice);
 }
 function cueEarth(phase){
  if(!context||context.state!=='running')return;
  const id=beginCue();
  try{
   if(phase==='sheaf'||phase==='furrows'||phase==='breath'){
    if(!buffers.has('reeds'))buffers.set('reeds',workBuffer(context,'reeds'));
    const node=context.createBufferSource(),gain=context.createGain(),voice={node,gain};
    node.buffer=buffers.get('reeds');node.playbackRate.value=phase==='breath'?.62:.94;gain.gain.value=.10;
    node.connect(gain);gain.connect(context.destination);earthVoice=voice;
    node.onended=()=>{if(earthVoice===voice)earthVoice=null;release(voice);};node.start();
   }else if(phase==='blessing'){
    earthNotes=playStoneNote(context,294,.041);
    earthNotes.push(...playStoneNote(context,392,.032,.16));
   }else earthNotes=playStoneNote(context,phase==='bow'?220:330,.045);
  }catch{stopEarth();}
  return ()=>{if(id===cueId)stopEarth();};
 }
 function stopCat(){
  for(const osc of catNotes){try{osc.stop();}catch{}}
  catNotes=[];
 }
 function cueCat(kind){
  if(context?.state!=='running')return;
  beginCue();
  const notes=kind==='opening'?[294,392,490]:[392,294,245];
  try{
   notes.forEach((frequency,i)=>catNotes.push(...playStoneNote(context,frequency,.034-i*.006,i*.16)));
  }catch{stopCat();}
 }
 function dispose(){lyre.silence();silence();stopRain();stopEarth();stopCat();try{Promise.resolve(context?.close?.()).catch(()=>{});}catch{}context=null;buffers.clear();}
 return {enable,tick,tickLyre:source=>{if(context?.state==='running')lyre.tick(context,source);},stopLyre:lyre.silence,silence,cueRain,stopRain,cueEarth,stopEarth,cueCat,stopCat,dispose};
}
