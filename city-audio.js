import {musicSoundSources,playStoneNote,STONE_NOTES} from './music-audio.js';
// Quiet original phrases, not reconstructed ancient scores. User opt-in only.
export function createCityAudio(onMessage){
 let context=null,enabled=false;const beats=new Map(),voices=new Map();
 function stopVoice(osc){try{osc.stop(context.currentTime);}catch{}osc.disconnect?.();}
 function stopSource(id){for(const osc of voices.get(id)||[])stopVoice(osc);voices.delete(id);beats.delete(id);}
 function silence(){for(const id of voices.keys())stopSource(id);beats.clear();}
 function track(id,nodes){if(!voices.has(id))voices.set(id,new Set());const active=voices.get(id);for(const osc of nodes){const ended=osc.onended;osc.onended=()=>{active.delete(osc);ended?.();};active.add(osc);}while(active.size>12){const first=active.values().next().value;stopVoice(first);active.delete(first);}}
 async function toggle(){try{if(!context){const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(!C)throw Error('unavailable');context=new C();}enabled=!enabled;if(enabled)await context.resume();else{silence();await context.suspend();}return enabled;}catch{silence();enabled=false;onMessage?.('Звук недоступен в этом браузере');return false;}}
 function tick(s,paused,listener){
  if(!enabled||!context||paused||globalThis.document?.hidden){silence();return;}
  const sources=musicSoundSources(s,listener),festival=s.festival?.stage==='celebrating',active=new Set(sources.map(source=>`music:${source.id}`));if(festival)active.add('festival');for(const id of voices.keys())if(!active.has(id))stopSource(id);
  const beat=Math.floor((s.simTime||0)*2),pattern=[0,2,4,3,2,5,4,1];
  for(const source of sources){const id=`music:${source.id}`;if(beats.get(id)===beat)continue;beats.set(id,beat);track(id,playStoneNote(context,STONE_NOTES[pattern[((beat%pattern.length)+pattern.length)%pattern.length]],source.gain));}
  if(festival&&beats.get('festival')!==beat){beats.set('festival',beat);const notes=[62,65,69,67,65,72,69,67],note=notes[((beat%notes.length)+notes.length)%notes.length],osc=context.createOscillator(),gain=context.createGain(),now=context.currentTime;osc.type='triangle';osc.frequency.value=440*2**((note-69)/12);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.026,now+.012);gain.gain.exponentialRampToValueAtTime(.0001,now+.65);osc.connect(gain);gain.connect(context.destination);osc.start(now);osc.stop(now+.7);osc.onended=()=>{osc.disconnect?.();gain.disconnect?.();};track('festival',[osc]);}
 }
 return {toggle,tick,get enabled(){return enabled;},dispose(){silence();enabled=false;context?.close?.();}};
}
