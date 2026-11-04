import {advanceTime} from './engine.js';
import {DAY_SECONDS} from './city-life.js';
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

/** One real working day, exactly one calendar season. Ceremonies spend neither. */
export function createSeasonJump(s){
 const target=s.tick+1,start=s.simTime,skipped=[];
 let result=null,first=true;
 const finishCelebrations=(force=false)=>{
  if(s.festival&&(force||s.festival.stage==='celebrating')){const kind=s.festival.occasion||'nightLights';if(skipFestival(s).ok)skipped.push(kind);}
  if(force&&s.firstBeerFeast?.status==='pending'){s.firstBeerFeast.status='skipped';skipped.push('firstBeer');}
  if(s.miracleCelebration){skipped.push(s.miracleCelebration.kind);advanceMiracleCelebration(s,s.miracleCelebration.duration);}
 };
 const snapshot=()=>({done:!!result,progress:Math.min(1,Math.max(0,(s.simTime-start)/DAY_SECONDS)),result});
 const fail=reason=>{result={ok:false,reason,skipped:[...new Set(skipped)]};return snapshot();};
 return {step(seconds=1){
  if(result)return snapshot();
  if(!Number.isFinite(seconds)||seconds<=0)throw new RangeError('Invalid season step');
  const reason=seasonJumpReason(s);if(reason)return fail(reason);
  finishCelebrations(first);first=false;
  const before=s.simTime;
  const remaining=start+DAY_SECONDS-s.simTime,calendarRate=(45-s.seasonElapsed)/remaining;
  advanceTime(s,Math.min(seconds,remaining),{calendarRate});
  if(s.tick>=target){finishCelebrations(true);result={ok:true,skipped:[...new Set(skipped)],year:s.year,season:s.season};return snapshot();}
  const blocked=seasonJumpReason(s);if(blocked)return fail(blocked);
  if(s.simTime<=before&&!s.festival&&!s.miracleCelebration)return fail('Переход сезона остановлен');
  return snapshot();
 }};
}

export function advanceToNextSeason(s){
 const jump=createSeasonJump(s);let frame;
 do{frame=jump.step();}while(!frame.done);
 return frame.result;
}

/** Yield between small batches so rendering, progress and input remain responsive. */
export async function runSeasonJump(s,{yieldFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve)),onProgress=()=>{}}={}){
 const jump=createSeasonJump(s);
 await yieldFrame();
 let frame;
 do{
  const started=performance.now();let steps=0;
  do{frame=jump.step(.25);steps++;}while(!frame.done&&steps<8&&performance.now()-started<8);
  onProgress(frame.done&&frame.result.ok?1:frame.progress);
  if(!frame.done)await yieldFrame();
 }while(!frame.done);
 return frame.result;
}
