import {advanceTime} from './engine.js';
import {skipFestival} from './festival.js';
import {advanceMiracleCelebration} from './miracle-celebration.js';
import {relicCommandReason} from './city-command-lock.js';

export function seasonJumpReason(s){
 const lock=relicCommandReason(s);if(lock)return lock;
 if(s.event)return 'Сначала реши судьбу события';
 if(s.funeral)return 'Дождись возвращения траурной процессии';
 if(s.lost)return 'Поселение покинуто';
 return '';
}

/** Advance the calendar, never spend the requested season on a frozen ceremony. */
export function advanceToNextSeason(s){
 const reason=seasonJumpReason(s);if(reason)return {ok:false,reason,skipped:[]};
 const target=s.tick+1,skipped=[];
 const finishCelebrations=()=>{
  if(s.festival){const kind=s.festival.occasion||'nightLights';if(skipFestival(s).ok)skipped.push(kind);}
  // A first cup can be waiting behind another scene or still waiting for its
  // porter. Skipping it is recorded explicitly, with no attendance rewards.
  if(s.firstBeerFeast?.status==='pending'){s.firstBeerFeast.status='skipped';skipped.push('firstBeer');}
  if(s.miracleCelebration){skipped.push(s.miracleCelebration.kind);advanceMiracleCelebration(s,60);}
 };
 while(s.tick<target){
  finishCelebrations();
  const blocked=seasonJumpReason(s);if(blocked)return {ok:false,reason:blocked,skipped};
  const before=s.simTime,advanced=advanceTime(s,45-s.seasonElapsed);
  if(s.tick>=target)break;
  // Automatic cat arrival can start halfway through the interval. Its scene
  // consumes no calendar time, so clear it and spend only the remaining season.
  if(s.festival||s.miracleCelebration)continue;
  if(advanced<=0||s.simTime<=before)return {ok:false,reason:seasonJumpReason(s)||'Переход сезона остановлен',skipped};
 }
 finishCelebrations();
 return {ok:true,skipped:[...new Set(skipped)],year:s.year,season:s.season};
}
