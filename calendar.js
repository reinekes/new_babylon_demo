import {DAY_SECONDS,lightingAt} from './city-life.js';
// Saved season progress retains its original units; calendarOffset accounts
// for the difference between lived seconds and calendar progress.
// Four equal seasons/12 numbered months are a game simplification of local lunar calendars.
export const BASE_TIME_RATE=.125,MONTH_SECONDS=15;
export const DAYS_PER_MONTH=3;
export function useThreeDayCalendar(s){s.calendarDaysPerMonth=DAYS_PER_MONTH;return s;}
export const calendarRateFor=s=>s.calendarDaysPerMonth===DAYS_PER_MONTH?MONTH_SECONDS/(DAYS_PER_MONTH*DAY_SECONDS):1;
export const MONTH_NUMERALS=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
// Nippur, Ur III: https://cdli.earth/postings/26. Cyrillic readings are display adaptations.
export const MONTH_NAMES=['Бара-заг-гар','Гу-си-су','Сиг-га','Шу-нумун','Не-не-гар','Кин-Инанна','Ду-ку','Апин-ду-а','Ган-ган-э','Аб-э','Зиз-а','Ше-саг-ку'];
const seasons=['Весна','Лето','Осень','Зима'];
export function simulationSeconds(realSeconds,speed=1){return Math.max(0,Math.min(.25,Number.isFinite(realSeconds)?realSeconds:0))*BASE_TIME_RATE*([1,2,4,10].includes(speed)?speed:1);}
export function calendarAt(s){const elapsed=Math.max(0,Math.min(44.999999,s.seasonElapsed||0)),within=Math.floor((elapsed+1e-8)/MONTH_SECONDS),progress=Math.max(0,(elapsed-within*MONTH_SECONDS)/MONTH_SECONDS),month=s.season*3+within,days=s.calendarDaysPerMonth||30;return {year:s.year,season:s.season,month,number:month+1,numeral:MONTH_NUMERALS[month],monthName:MONTH_NAMES[month],day:Math.min(days,1+Math.floor(progress*days+1e-8)),progress,seasonName:seasons[s.season]};}
export function secondsToNextMonth(s){return MONTH_SECONDS*(1-calendarAt(s).progress)/calendarRateFor(s);}
export function monthTrackHTML(s){const c=calendarAt(s);return MONTH_NUMERALS.map((name,i)=>`<span class="calendar-month ${i===c.month?'current':''} ${i<c.month?'past':''} season-${Math.floor(i/3)}" data-month="${i+1}" title="${MONTH_NAMES[i]} · ${seasons[Math.floor(i/3)]} · месяц ${i+1} · Игровой календарь на основе названий месяцев Ниппура эпохи III династии Ура" ${i===c.month?'aria-current="date"':''}><b>${name}</b><i style="--month-progress:${i===c.month?c.progress:0}"></i></span>`).join('');}

export function clockText(seconds){const minutes=Math.floor(lightingAt(seconds).hour*60+1e-7)%1440;return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;}
