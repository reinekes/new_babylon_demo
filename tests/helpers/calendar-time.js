import {advanceTime} from '../../engine.js';

// Calendar-oriented tests explicitly wait through the automatic cat scene.
// Small steps expose a scene that begins partway through a requested interval;
// only its frozen calendar time is compensated. Events still stop advancement,
// and existing funeral/festival time consumption keeps its production meaning.
export function advanceCalendar(s,seconds){
 let remaining=seconds,advanced=0;
 while(remaining>1e-7&&!s.event&&(!s.lost||s.funeral)){
  if(s.miracleCelebration){
   const spent=advanceTime(s,s.miracleCelebration.duration-s.miracleCelebration.elapsed);
   if(spent<=0)break;
   continue;
  }
  const step=Math.min(1,remaining),before=s.simTime,spent=advanceTime(s,step);
  if(spent<=0)break;
  const consumed=s.miracleCelebration?Math.max(0,s.simTime-before):spent;
  remaining-=consumed;advanced+=consumed;
 }
 return advanced;
}
export function advanceCalendarSeason(s){
 const tick=s.tick;
 advanceCalendar(s,45-s.seasonElapsed);
 return s.tick!==tick;
}
