import {musicPerformance} from './music.js';
export const STONE_NOTES=[196,220.5,245,294,326.67,392,441,490];
/** Quiet, original synthetic phrase. At most two audible courtyards, near camera. */
export function musicSoundSources(s,listener){
 const p=listener||{x:9,y:9};return (s.buildings||[]).filter(b=>b.type==='musicHouse').map(b=>({b,performance:musicPerformance(s,b),distance:Math.hypot(b.x-p.x,b.y-p.y)})).filter(v=>v.performance.playing&&v.distance<14).sort((a,b)=>a.distance-b.distance).slice(0,2).map(({b,distance})=>({id:b.id||`${b.x},${b.y}`,x:b.x,y:b.y,gain:.012*(1-distance/14)**2}));
}
export function playStoneNote(context,frequency,gainValue){
 const now=context.currentTime,voices=[];
 for(const [ratio,volume,decay] of [[1,1,1.4],[2.76,.22,.65],[5.4,.055,.24]]){const osc=context.createOscillator(),gain=context.createGain();osc.type='sine';osc.frequency.value=frequency*ratio;gain.gain.setValueAtTime(.00001,now);gain.gain.exponentialRampToValueAtTime(Math.max(.00002,gainValue*volume),now+.008);gain.gain.exponentialRampToValueAtTime(.00001,now+decay);osc.connect(gain);gain.connect(context.destination);osc.start(now);osc.stop(now+decay+.03);osc.onended=()=>{osc.disconnect?.();gain.disconnect?.();};voices.push(osc);}
 return voices;
}
