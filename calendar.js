// Presentation calendar over the existing seasonal clock: no save conversion.
// Four equal seasons/12 numbered months are a game simplification of local lunar calendars.
export const BASE_TIME_RATE=.25,MONTH_SECONDS=15;
export const MONTH_NUMERALS=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
const seasons=['Весна','Лето','Осень','Зима'];
export function simulationSeconds(realSeconds,speed=1){return Math.max(0,Math.min(.25,Number.isFinite(realSeconds)?realSeconds:0))*BASE_TIME_RATE*([1,2,4].includes(speed)?speed:1);}
export function calendarAt(s){const elapsed=Math.max(0,Math.min(44.999999,s.seasonElapsed||0)),within=Math.floor(elapsed/MONTH_SECONDS),progress=(elapsed%MONTH_SECONDS)/MONTH_SECONDS,month=s.season*3+within;return {year:s.year,season:s.season,month,number:month+1,numeral:MONTH_NUMERALS[month],day:Math.min(30,1+Math.floor(progress*30)),progress,seasonName:seasons[s.season]};}
export function secondsToNextMonth(s){return MONTH_SECONDS-((s.seasonElapsed||0)%MONTH_SECONDS);}
export function monthTrackHTML(s){const c=calendarAt(s);return MONTH_NUMERALS.map((name,i)=>`<span class="calendar-month ${i===c.month?'current':''} ${i<c.month?'past':''} season-${Math.floor(i/3)}" data-month="${i+1}" title="${seasons[Math.floor(i/3)]} · месяц ${i+1}" ${i===c.month?'aria-current="date"':''}><b>${name}</b><i style="--month-progress:${i===c.month?c.progress:0}"></i></span>`).join('');}
