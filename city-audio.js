import {musicSoundSources,playStoneNote,STONE_NOTES} from './music-audio.js';
import {cityEventDefinition} from './city-events.js';
// Quiet original phrases, not reconstructed ancient scores. User opt-in only.
function createSyntheticCityAudio(onMessage){
 let context=null,enabled=false;const beats=new Map(),voices=new Map();
 function stopVoice(osc){try{osc.stop(context.currentTime);}catch{}osc.disconnect?.();}
 function stopSource(id){for(const osc of voices.get(id)||[])stopVoice(osc);voices.delete(id);beats.delete(id);}
 function silence(){for(const id of voices.keys())stopSource(id);beats.clear();}
 function track(id,nodes){if(!voices.has(id))voices.set(id,new Set());const active=voices.get(id);for(const osc of nodes){const ended=osc.onended;osc.onended=()=>{active.delete(osc);ended?.();};active.add(osc);}while(active.size>12){const first=active.values().next().value;stopVoice(first);active.delete(first);}}
 async function toggle(){try{if(!context){const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(!C)throw Error('unavailable');context=new C();}enabled=!enabled;if(enabled)await context.resume();else{silence();await context.suspend();}return enabled;}catch{silence();enabled=false;onMessage?.('Звук недоступен в этом браузере');return false;}}
 function tick(s,paused,listener){
  if(!enabled||!context||globalThis.document?.hidden){silence();return;}
  const sources=musicSoundSources(s,listener),festival=activeFestival(s),active=new Set(sources.map(source=>`music:${source.id}`));if(festival)active.add('festival');for(const id of voices.keys())if(!active.has(id))stopSource(id);
  const beat=Math.floor(context.currentTime*2),pattern=[0,2,4,3,2,5,4,1];
  for(const source of sources){const id=`music:${source.id}`;if(beats.get(id)===beat)continue;beats.set(id,beat);track(id,playStoneNote(context,STONE_NOTES[pattern[((beat%pattern.length)+pattern.length)%pattern.length]],source.gain));}
  if(festival&&beats.get('festival')!==beat){beats.set('festival',beat);const notes=[62,65,69,67,65,72,69,67],note=notes[((beat%notes.length)+notes.length)%notes.length],osc=context.createOscillator(),gain=context.createGain(),now=context.currentTime;osc.type='triangle';osc.frequency.value=440*2**((note-69)/12);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.026,now+.012);gain.gain.exponentialRampToValueAtTime(.0001,now+.65);osc.connect(gain);gain.connect(context.destination);osc.start(now);osc.stop(now+.7);osc.onended=()=>{osc.disconnect?.();gain.disconnect?.();};track('festival',[osc]);}
 }
 return {toggle,tick,get enabled(){return enabled;},dispose(){silence();enabled=false;context?.close?.();}};
}


// Recordings are user-provided artistic music, not reconstructed ancient scores.
export const EVENT_MUSIC_TRACKS=Object.freeze({
 main:'main-theme.mp3',grown:'growing-city.mp3',night:'night-theme.mp3',
 funeral1:'funeral-1.mp3',funeral2:'funeral-2.mp3',lithophone:'lithophone.mp3',
 firstBeer:'first-beer-feast.mp3',nightLights:'night-lights-feast.mp3'
});
export const GROWN_CITY_MUSIC_POPULATION=24;
const activeFuneral=s=>s.funeral&&s.funeral.stage!=='returning';
const activeFestival=s=>s.festival?.stage==='celebrating'&&s.festival.consumed&&s.festival.actors?.some(a=>a.kind==='guest'&&a.stage==='dancing');
export function eventMusicTheme(s,funeralVariant=1){
 if(activeFuneral(s))return funeralVariant===2?'funeral2':'funeral1';
 if(activeFestival(s))return s.festival.occasion==='firstBeer'?'firstBeer':'nightLights';
 const eventTheme=cityEventDefinition(s.event?.id)?.music;
 if(eventTheme&&eventTheme!=='lithophone'&&Object.hasOwn(EVENT_MUSIC_TRACKS,eventTheme))return eventTheme;
 const hour=((8+(s.simTime||0)*.4)%24+24)%24;
 if(hour<6||hour>=19)return 'night';
 return (s.citizens?.length||0)>=GROWN_CITY_MUSIC_POPULATION?'grown':'main';
}
/**
 * Stream only the currently audible recordings. No Audio, src, decode or fetch
 * is created before the user opts in. A crossfade keeps at most two background
 * voices; the nearest courtyard shares one positional lithophone voice.
 * Simulation pauses and dialogs never pause music; visibility and mute do.
 */
export function createCityAudio(onMessage,options={}){
 const createMedia=options.createMedia||(typeof globalThis.Audio==='function'?()=>new globalThis.Audio():null);
 if(!createMedia)return createSyntheticCityAudio(onMessage);
 const now=options.now||(()=>performance.now()/1000),cache=new Map(),doc=globalThis.document;
 let enabled=false,current=null,outgoing=null,lithophone=null,disposed=false,epoch=0,lastFuneral='',funeralCount=0,lastError='',lastFrame=null;
 const clamp=v=>Math.max(0,Math.min(1,v));
 function voice(id){let v=cache.get(id);if(!v){const element=createMedia();element.preload='none';element.loop=true;element.volume=0;element.src=new URL(`./assets/audio/${EVENT_MUSIC_TRACKS[id]}`,import.meta.url).href;v={id,element,playing:false,level:0,target:0,from:0,since:now(),duration:0};element.addEventListener?.('error',()=>{if(v.playing)fail(Error('media load'));});cache.set(id,v);}return v;}
 function stop(v){if(!v)return;v.playing=false;v.level=0;v.target=0;v.element.volume=0;v.element.pause();}
 function silence(){epoch++;for(const v of cache.values())if(v.playing||!v.element.paused)stop(v);current=null;outgoing=null;lithophone=null;}
 function fail(error){if(disposed||!enabled)return;enabled=false;silence();const key=String(error?.name||error?.message||'media');if(lastError!==key){lastError=key;onMessage?.('Музыка не запустилась. Нажми кнопку звука ещё раз, чтобы разрешить воспроизведение.');}}
 function play(v){if(v.playing)return;const ticket=epoch;v.playing=true;try{Promise.resolve(v.element.play()).then(()=>{if(ticket!==epoch||!enabled||disposed||!v.playing)v.element.pause();},error=>{if(ticket===epoch&&v.playing)fail(error);});}catch(error){fail(error);}}
 function target(v,value,duration=1.2){if(!v)return;value=clamp(value);if(Math.abs(v.target-value)<.00001)return;v.from=v.level;v.target=value;v.since=now();v.duration=duration;}
 function fade(v){if(!v)return;const t=v.duration?clamp((now()-v.since)/v.duration):1;v.level=v.from+(v.target-v.from)*t;v.element.volume=clamp(v.level);if(t===1&&v.target===0)stop(v);}
 function select(id){if(current?.id===id)return;stop(outgoing);outgoing=current;if(outgoing)target(outgoing,0);current=voice(id);current.level=0;current.target=0;current.element.volume=0;play(current);}
 async function toggle(){if(disposed)return false;enabled=!enabled;if(!enabled)silence();else if(lastFrame)tick(lastFrame.s,lastFrame.paused,lastFrame.listener);return enabled;}
 function tick(s,paused,listener){
  if(disposed)return;lastFrame={s,paused,listener};
  if(!enabled||doc?.hidden){silence();return;}
  if(activeFuneral(s)){const key=(s.funeral.deceased||[]).map(d=>d.id).join(',')||'ceremony';if(key!==lastFuneral){lastFuneral=key;funeralCount++;}}
  const id=eventMusicTheme(s,funeralCount%2?1:2),source=musicSoundSources(s,listener)[0];select(id);
  if(source){if(!lithophone){lithophone=voice('lithophone');play(lithophone);}target(lithophone,.20*clamp(source.gain/.012),.35);}
  else if(lithophone){stop(lithophone);lithophone=null;}
  target(current,(id.startsWith('funeral')?.17:.16)*(source?.45:1));fade(current);fade(outgoing);fade(lithophone);
  if(outgoing&&!outgoing.playing)outgoing=null;
 }
 const onVisibility=()=>{if(doc?.hidden)silence();};doc?.addEventListener?.('visibilitychange',onVisibility);
 return {toggle,tick,get enabled(){return enabled;},get status(){return {enabled,theme:current?.id||null,lithophone:!!lithophone,playing:[...cache.values()].filter(v=>v.playing).map(v=>v.id),cached:cache.size};},dispose(){if(disposed)return;silence();disposed=true;enabled=false;doc?.removeEventListener?.('visibilitychange',onVisibility);for(const v of cache.values()){v.element.removeAttribute?.('src');v.element.load?.();}cache.clear();}};
}
