import {musicPerformance} from './music.js';
export const STONE_NOTES=[196,220.5,245,294,326.67,392,441,490];
const clamp=v=>Math.max(0,Math.min(1,v));
/** Listen at the visible ground focus; zoom out turns the courtyard inaudible. */
export function cityAudioListener(renderer){
 const camera=renderer?.camera;
 if(camera?.target&&[camera.target.x,camera.target.z,camera.radius].every(Number.isFinite))return {x:camera.target.x/6,y:camera.target.z/6,proximity:renderer.mapOverview?0:clamp((36-camera.radius)/18)};
 if(renderer?.ctx&&[renderer.w,renderer.h,renderer.ox,renderer.oy,renderer.tw,renderer.th,renderer.zoom].every(Number.isFinite)&&renderer.tw>0&&renderer.th>0){
  const dx=(renderer.w/2-renderer.ox)/(renderer.tw/2),dy=(renderer.h/2-renderer.oy)/(renderer.th/2);
  return {x:(dx+dy)/2,y:(dy-dx)/2,proximity:renderer.mapOverview?0:clamp(renderer.zoom-2.5)};
 }
 return null;
}
/** Only beside a playing courtyard: full within .6 cells, silent at 1.5. */
export function musicSoundSources(s,listener){
 if(!listener||![listener.x,listener.y].every(Number.isFinite))return [];
 const proximity=listener.proximity===undefined?1:clamp(listener.proximity);
 if(!Number.isFinite(proximity)||proximity<=0)return [];
 return (s.buildings||[]).filter(b=>b.type==='musicHouse').map(b=>({b,performance:musicPerformance(s,b),distance:Math.hypot(b.x-listener.x,b.y-listener.y)})).filter(v=>v.performance.playing&&v.distance<1.5).sort((a,b)=>a.distance-b.distance).slice(0,2).map(({b,distance,performance})=>({id:b.id||`${b.x},${b.y}`,x:b.x,y:b.y,lyrist:performance.lyrist?.id??null,gain:.012*clamp((1.5-distance)/.9)**2*proximity}));
}
export function playStoneNote(context,frequency,gainValue,delay=0){
 const now=context.currentTime+delay,voices=[];
 for(const [ratio,volume,decay] of [[1,1,1.4],[2.76,.22,.65],[5.4,.055,.24]]){const osc=context.createOscillator(),gain=context.createGain();osc.type='sine';osc.frequency.value=frequency*ratio;gain.gain.setValueAtTime(.00001,now);gain.gain.exponentialRampToValueAtTime(Math.max(.00002,gainValue*volume),now+.008);gain.gain.exponentialRampToValueAtTime(.00001,now+decay);osc.connect(gain);gain.connect(context.destination);osc.start(now);osc.stop(now+decay+.03);osc.onended=()=>{osc.disconnect?.();gain.disconnect?.();};voices.push(osc);}
 return voices;
}

const LYRE_PHRASE=[196,0,294,245,0,220.5,294,0];
export function createLyreVoice(){
 let notes=[],lastBeat=null,lastPlayer=null;
 function silence(){
  for(const note of notes)try{note.stop();}catch{}
  notes=[];lastBeat=null;lastPlayer=null;
 }
 function tick(context,source){
  if(!context||source?.lyrist==null){silence();return;}
  if(lastPlayer!==source.lyrist){silence();lastPlayer=source.lyrist;}
  const beat=Math.floor(context.currentTime*2);
  if(beat===lastBeat)return;
  lastBeat=beat;
  const frequency=LYRE_PHRASE[beat%LYRE_PHRASE.length];
  if(!frequency)return;
  const now=context.currentTime;
  try{
   for(const [harmonic,volume,decay] of [[1,.85,.48],[2,.25,.19],[3,.1,.12]]){
    const note=context.createOscillator(),gain=context.createGain();
    note.type='triangle';note.frequency.value=frequency*harmonic;
    gain.gain.setValueAtTime(Math.max(.00002,source.gain*volume),now);
    gain.gain.exponentialRampToValueAtTime(.00001,now+decay);
    note.connect(gain);gain.connect(context.destination);
    notes.push(note);
    note.onended=()=>{notes=notes.filter(active=>active!==note);note.disconnect?.();gain.disconnect?.();};
    note.start(now);note.stop(now+decay+.01);
   }
  }catch{silence();lastBeat=beat;lastPlayer=source.lyrist;}
 }
 return {tick,silence};
}
