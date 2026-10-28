/** Calendar time and ceremony time are separate. No hidden global state. */
export const ceremonyActive=s=>!!s?.miracleCelebration||!!s?.funeral||s?.festival?.stage==='celebrating';
export function ceremonyLabel(s){return s?.miracleCelebration?'Чудо · календарь остановлен':s?.funeral?'Похороны · календарь остановлен':s?.festival?.stage==='celebrating'?'Пир · календарь остановлен':'';}

// The selected UI speed resets on entry, not on every ceremony frame. Keep
// this transient identity out of the save so players can accelerate afterwards.
export function createCeremonySpeedControl(){
 let previous=null;
 return (state,selectedSpeed)=>{
  const current=state?.miracleCelebration||state?.funeral||(state?.festival?.stage==='celebrating'?state.festival:null);
  const started=!!current&&current!==previous;previous=current;
  return started?1:selectedSpeed;
 };
}
