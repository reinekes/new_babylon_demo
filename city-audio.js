// A quiet stylisation, not a reconstruction of an ancient score. User opt-in only.
export function createCityAudio(onMessage){let context=null,enabled=false,lastNote=null;
 async function toggle(){try{if(!context){const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(!C)throw Error('unavailable');context=new C();}enabled=!enabled;if(enabled)await context.resume();else await context.suspend();return enabled;}catch{enabled=false;onMessage?.('Звук недоступен в этом браузере');return false;}}
 function tick(s,paused){if(!enabled||!context||paused||s.festival?.stage!=='celebrating'){lastNote=null;return;}const beat=Math.floor(s.simTime*2);if(lastNote===beat)return;lastNote=beat;const notes=[62,65,69,67,65,72,69,67],note=notes[beat%notes.length],osc=context.createOscillator(),gain=context.createGain(),now=context.currentTime;osc.type='triangle';osc.frequency.value=440*2**((note-69)/12);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.026,now+.012);gain.gain.exponentialRampToValueAtTime(.0001,now+.65);osc.connect(gain);gain.connect(context.destination);osc.start(now);osc.stop(now+.7);}
 return {toggle,tick,get enabled(){return enabled;}};
}
