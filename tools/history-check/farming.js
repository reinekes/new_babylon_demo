import {compareSavedState} from './save-check.js';
import {createNewCity} from '../../new-game.js';
import {build,advanceTime,resolveEvent,encode,decode} from '../../engine.js';
import {assignWorkplace} from '../../management.js';
import {fieldWater,irrigationFor} from '../../irrigation.js';
import {calendarAt,clockText} from '../../calendar.js';
import {createGameRenderer} from '../../game3d/renderer.js';

const status=document.querySelector('#status'),proof=document.querySelector('#proof');
const buttons=[...document.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
let state=createNewCity({mode:'mature',seed:137}),busy=false,lastAction='Новая партия';
const records=[],actions=[],reloads=[],skippedEvents=[];
const initial=encode(state),at=(x,y)=>state.buildings.find(b=>b.x===x&&b.y===y),field=()=>at(14,6);
const snapshot=label=>({label,simTime:state.simTime,year:state.year,season:state.season,seasonElapsed:state.seasonElapsed,population:state.population,resources:{...state.resources},wet:[...irrigationFor(state).wet],canals:state.buildings.filter(b=>b.type==='canal').map(b=>structuredClone(b)),field:field()?.type==='field'?structuredClone(field()):null,cargo:state.citizens.filter(c=>Object.values(c.buildCargo||{}).some(n=>n>0)||Object.values(c.cargo||{}).some(n=>n>0)).map(c=>({id:c.id,phase:c.phase,home:c.home,work:c.work,site:c.site,buildCargo:{...c.buildCargo},cargo:{...c.cargo}})),validSave:!!decode(encode(state))});
function renderStatus(){
 const date=calendarAt(state),crop=field()?.type==='field'?field().crop:null;
 status.textContent=`${lastAction}${busy?' · проживаем время…':''}\nГод ${state.year} · ${date.monthName} · день ${date.day} · ${clockText(state.simTime)} · ${state.simTime.toFixed(1)}с симуляции\nВода: ${[...irrigationFor(state).wet].join(' → ')||'нет наполненного канала'}${crop?` · поле: ${fieldWater(state,field()).label}\nПосев ${(crop.sown*100).toFixed(1)}% · рост ${(crop.growth*100).toFixed(1)}% · срезано ${crop.harvested.toFixed(1)} · снопы ${crop.sheaves.toFixed(1)} · обмолочено ${crop.threshed.toFixed(1)}`:''}`;
 proof.textContent=JSON.stringify({initial:JSON.parse(initial),current:snapshot(lastAction),records,actions,reloads,skippedEvents},null,2);
}
function command(label,fn){const result=fn();actions.push({label,time:state.simTime,result});if(!result.ok)throw Error(label+': '+result.reason);}
function step(){
 if(state.event){const id=state.event.id,time=state.simTime;command('Пропустить событие',()=>resolveEvent(state,'skip'));skippedEvents.push({id,time});}
 const before=state.simTime,advanced=advanceTime(state,.1);
 if(!advanced&&state.simTime===before)throw Error('Симуляция остановилась: '+(state.lost?'город потерян':state.event?.id||'причина в состоянии'));
}
async function until(label,condition){
 if(busy)throw Error('Предыдущий шаг ещё выполняется');busy=true;buttons.forEach(b=>b.disabled=true);lastAction=label;
 const start=state.simTime;
 try{
  while(!condition()){
   if(state.simTime-start>720)throw Error('Этап не достигнут за720с симуляции');
   for(let i=0;i<20&&!condition();i++)step();
   renderStatus();await new Promise(requestAnimationFrame);
  }
  records.push(snapshot(label));
 }finally{busy=false;buttons.forEach(b=>b.disabled=false);renderStatus();}
}
function bind(id,fn){document.querySelector('#'+id).onclick=async()=>{try{await fn();}catch(error){lastAction='Ошибка: '+error.message;renderStatus();}};}
const renderer=await createGameRenderer(document.querySelector('#city'),()=>{},{initialState:state});
if(renderer.mode!=='3d')throw Error('Для визуальной приёмки нужен настоящий WebGL');
renderer.lightMode='day';renderer.focusOn(14.7,6);renderer.camera.radius=30;renderer.camera.alpha=.9;renderer.camera.beta=.9;
function frame(now){renderer.draw(state,null,now,{paused:!busy,speed:4});requestAnimationFrame(frame);}requestAnimationFrame(frame);
bind('source',()=>{command('Канал16,6',()=>build(state,'canal',16,6));lastAction='Канал заложен';records.push(snapshot(lastAction));renderStatus();});
bind('cargo',()=>until('Настоящий груз для канала',()=>state.citizens.some(c=>Object.values(c.buildCargo||{}).some(n=>n>0))));
bind('reload',()=>{const before=encode(state),loaded=decode(before);if(!loaded)throw Error('Сохранение не прошло валидацию');state=loaded;const after=encode(state);const comparison=compareSavedState(JSON.parse(before),JSON.parse(after));reloads.push({time:state.simTime,byteExact:before===after,...comparison,before:JSON.parse(before),after:JSON.parse(after)});if(!comparison.equivalent)throw Error('Состояние изменилось при загрузке');lastAction='PASS: город и груз после загрузки совпали'+(comparison.equal?'':' · округление складского остатка записано');records.push(snapshot(lastAction));renderStatus();});
bind('complete',()=>until('Первый канал завершён',()=>!!at(16,6)&&!at(16,6).construction));
bind('second',async()=>{command('Канал15,6',()=>build(state,'canal',15,6));await until('Цепочка каналов наполнена',()=>!!at(15,6)&&!at(15,6).construction);});
bind('field',async()=>{command('Поле14,6',()=>build(state,'field',14,6));await until('Поле построено у канала',()=>field()?.type==='field'&&!field().construction);for(const id of [0,1])command('Закрепить работника'+id,()=>assignWorkplace(state,id,'14,6'));records.push(snapshot('Работники закреплены'));renderStatus();});
bind('sow',()=>until('Посев настоящим работником',()=>field()?.crop?.sown>0));
bind('grow',()=>until('Рост с водой из канала',()=>field()?.crop?.growth>.2));
bind('cut',()=>until('Жатва: снопы на току',()=>field()?.crop?.harvested>0));
bind('thresh',()=>until('Обмолот после жатвы',()=>field()?.crop?.threshed>0));
records.push(snapshot(lastAction));buttons.forEach(b=>b.disabled=false);renderStatus();
