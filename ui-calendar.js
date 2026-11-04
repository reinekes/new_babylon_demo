import {calendarAt} from './calendar.js';

export function createMonthNotice(container,{schedule=setTimeout,cancel=clearTimeout}={}){
 const element=container.ownerDocument.createElement('div');element.className='calendar-notice';element.hidden=true;element.setAttribute('role','status');element.setAttribute('aria-live','polite');container.append(element);
 let city=null,previous=null,timer=null;
 function hide(){if(timer!==null)cancel(timer);timer=null;element.hidden=true;}
 function show(state){
  if(timer!==null)cancel(timer);
  const c=calendarAt(state);element.textContent=`Наступил месяц ${c.monthName}`;element.hidden=false;
  element.classList.remove('calendar-notice-enter');void element.offsetWidth;element.classList.add('calendar-notice-enter');
  timer=schedule(()=>{element.hidden=true;timer=null;},3200);
 }
 return {element,show,update(state){
  const c=calendarAt(state),key=`${c.year}:${c.month}`;
  if(state!==city){hide();city=state;previous=key;return;}
  if(previous!==key){previous=key;show(state);}
 },dispose(){hide();element.remove();}};
}
