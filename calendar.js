import {DAY_SECONDS,lightingAt} from './city-life.js';
import {scheduleEmptyFisheries} from './fishery-stock.js';
// Saved season progress retains its original units; calendarOffset accounts
// for the difference between lived seconds and calendar progress.
// Four equal seasons/12 numbered months are a game simplification of local lunar calendars.
export const MONTH_SECONDS=15,DAYS_PER_MONTH=1;
// A full day of city activity takes 100 real seconds at normal speed.
export const BASE_TIME_RATE=DAY_SECONDS/100;
// Keep travel at the original normal-speed pace while the city clock advances faster.
const TRAVEL_SECONDS_PER_REAL_SECOND=1/8;
export const motionRateFor=s=>s?.calendarDaysPerMonth===DAYS_PER_MONTH?TRAVEL_SECONDS_PER_REAL_SECOND/BASE_TIME_RATE:1;
export function motionTimeFor(s,simTime=s?.simTime??0){
 const origin=s?.motionTimeOrigin??0;
 return origin+(simTime-origin)*motionRateFor(s);
}
export function useOneDayCalendar(s){
 // Start at the saved phase on first open and retain that anchor on subsequent loads.
 s.motionTimeOrigin??=s.simTime??0;
 s.calendarDaysPerMonth=DAYS_PER_MONTH;
 scheduleEmptyFisheries(s);
 return s;
}
export function useThreeDayCalendar(s){s.calendarDaysPerMonth=3;return s;}
export const calendarRateFor=s=>s.calendarDaysPerMonth===undefined?1:MONTH_SECONDS/(s.calendarDaysPerMonth*DAY_SECONDS);
export const MONTH_NUMERALS=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
// Nippur, Ur III: https://cdli.earth/postings/26. Cyrillic readings are display adaptations.
export const MONTH_NAMES=['Бара-заг-гар','Гу-си-су','Сиг-га','Шу-нумун','Не-не-гар','Кин-Инанна','Ду-ку','Апин-ду-а','Ган-ган-э','Аб-э','Зиз-а','Ше-саг-ку'];
const seasons=['Весна','Лето','Осень','Зима'];
export function simulationRate(speed=1){return BASE_TIME_RATE*([1,2,4,10,25].includes(speed)?speed:1);}
const MAX_FRAME_SECONDS=.25;
export function simulationSeconds(realSeconds,speed=1){return Math.max(0,Math.min(MAX_FRAME_SECONDS,Number.isFinite(realSeconds)?realSeconds:0))*simulationRate(speed);}

// Spread short foreground stalls over subsequent frames so work and sunrise
// still advance at the selected rate. A suspended tab must never fast-forward.
export function createFrameClock(){
 let pending=0;
 return {
  reset(){pending=0;},
  next(seconds){
   pending=Math.min(5,pending+Math.max(0,seconds));
   const step=Math.min(MAX_FRAME_SECONDS,pending);
   pending-=step;
   return step;
  },
 };
}
export function calendarAt(s){const elapsed=Math.max(0,Math.min(44.999999,s.seasonElapsed||0)),within=Math.floor((elapsed+1e-8)/MONTH_SECONDS),progress=Math.max(0,(elapsed-within*MONTH_SECONDS)/MONTH_SECONDS),month=s.season*3+within,days=s.calendarDaysPerMonth||30;return {year:s.year,season:s.season,month,number:month+1,numeral:MONTH_NUMERALS[month],monthName:MONTH_NAMES[month],day:Math.min(days,1+Math.floor(progress*days+1e-8)),progress,seasonName:seasons[s.season]};}
export function secondsToNextMonth(s){return MONTH_SECONDS*(1-calendarAt(s).progress)/calendarRateFor(s);}
export function monthTrackHTML(s){const c=calendarAt(s);return MONTH_NUMERALS.map((name,i)=>`<span class="calendar-month ${i===c.month?'current':''} ${i<c.month?'past':''} season-${Math.floor(i/3)}" data-month="${i+1}" title="${MONTH_NAMES[i]} · ${seasons[Math.floor(i/3)]} · месяц ${i+1} · Игровой календарь на основе названий месяцев Ниппура эпохи III династии Ура" ${i===c.month?'aria-current="date"':''}><b>${name}</b><i style="--month-progress:${i===c.month?c.progress:0}"></i></span>`).join('');}

export function clockText(seconds){const minutes=Math.floor(lightingAt(seconds).hour*60+1e-7)%1440;return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;}
