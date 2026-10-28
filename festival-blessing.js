// A short divine sign, not seasonal snow. The saved ceremony clock is the only
// input to its motion: pausing, speeding up and restoring a feast stay exact.
export const FESTIVAL_BLESSING_COUNT=72;
const smooth=value=>{const x=Math.max(0,Math.min(1,value));return x*x*(3-2*x);};
const hash=(i,k)=>{const n=Math.sin(i*127.1+k*311.7)*43758.5453;return n-Math.floor(n);};
const seeds=Array.from({length:FESTIVAL_BLESSING_COUNT},(_,i)=>({angle:hash(i,1)*Math.PI*2,radius:Math.sqrt(hash(i,2))*2.45,phase:hash(i,3),life:9+hash(i,4)*5,size:.085+hash(i,5)*.065}));

export function festivalBlessingFrame(view){
 const t=view?.elapsed,center=view?.court;
 if(view?.stage!=='celebrating'||(view.occasion||'nightLights')!=='nightLights'||!Number.isFinite(t)||t<=30||t>=65||!Number.isFinite(center?.x)||!Number.isFinite(center?.y))return null;
 return {x:center.x,y:center.y,time:t-30,alpha:smooth((t-30)/4)*smooth((65-t)/5)};
}

export function festivalBlessingParticle(frame,index,out={}){
 const seed=seeds[index],phase=(frame.time/seed.life+seed.phase)%1,drift=Math.sin(frame.time*.38+seed.angle)*.13;
 out.x=frame.x+Math.cos(seed.angle)*seed.radius+drift;
 out.y=frame.y+Math.sin(seed.angle)*seed.radius+Math.cos(frame.time*.3+seed.angle)*.11;
 out.height=.45+(1-phase)*10;
 out.size=seed.size;
 out.alpha=frame.alpha*smooth(phase/.08)*smooth((1-phase)/.15)*(.78+.22*Math.sin(frame.time*1.7+seed.angle)**2);
 out.rotation=seed.angle+frame.time*.21;
 return out;
}
