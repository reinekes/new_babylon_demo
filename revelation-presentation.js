import {displayName} from './citizen-epithets.js';
import {revelationAdviceView} from './revelation-advice.js';

const timelines={
 opening:[[0,'first'],[6,'second'],[12,'third'],[18,'shadow'],[24,'separate'],[30,null]],
 cast:[[0,'tablet'],[2,'grooves'],[4,'work'],[7,null]]
};
const storyLines=[
 'У очага осталась чаша. Семья помнит помощь, которая дошла до дома.',
 'Мастер кладёт кусок глины. Он помнит руки, завершившие стройку.',
 'Последний свидетель приносит образ добытой еды. Так он запомнил этот день.'
];
const craftLines=[
 'Мастер показывает, как начиналась работа.',
 'Первый ученик вспоминает свой труд рядом с мастером.',
 'Второй ученик рассказывает о другой смене на той же стройке.'
];
const objects=['M21 48q9 4 18 0l-4 10q-5 4-10 0Z','M51 41h24v15H51Zm0 7h24m-12 0v8','M87 54q10-13 20 0-10 10-20 0Zm20 0 7-5v10Z'];
const craftObjects=['M20 46h22v11H20Zm3-5h16v5','M52 54l22-12 4 6-22 13Z','M87 48h23v8H87Zm5-6v6m8-6v6m7-6v6'];
const workPaths={
 rain:'M37 64h51m-44-6 12-12m7 12 12-12m7 12 12-12M51 32q5-8 10 0m9 1q5-8 10 0',
 fertility:'M42 65h46m-23 0V37m0 13-9-9m9 5 9-9m-9 19-12-7m12 5 13-8',
 cat:'M48 62v-17l5-10 10 8 10-8 6 10v17q-15 9-31 0Zm11-10h1m9 0h1',
 richCatch:'M40 54q19-19 37 0-18 18-37 0Zm37 0 12-9v18Zm-27 0h1',
 inspiration:'M43 58h42v13H43Zm5-10h32v10M58 48V37m10 11V34m8 14V38',
 haste:'M39 46h43l-9-8m9 8-9 8M49 61h36m-23 9h28',
 abundance:'M42 48q22-8 44 0l-7 19q-15 5-30 0Zm6 7q17 5 32 0m-27 7h22',
 sunlight:'M43 67V49h43v18m-48 0h53M65 34v10m-13-5 6 6m15 0 7-6'
};

export function createRevelationPresentation(root,{focus,cue,onAdvice}={}){
 const doc=root.ownerDocument,panel=doc.createElement('section');
 panel.className='revelation-scene';panel.hidden=true;panel.setAttribute('aria-label','Сцена Откровения');
 panel.innerHTML=`<div class="earth-scene-card revelation-scene-card">
  <svg viewBox="0 0 128 94" aria-hidden="true">
   <path class="revelation-clay" d="M26 16q40-9 76 0l6 62q-43 8-88 0Z"/>
   <g class="revelation-shadows">
    <use class="revelation-shadow revelation-shadow-first" href="#revelation-bowl"/>
    <use class="revelation-shadow" href="#revelation-brick"/>
    <use class="revelation-shadow revelation-shadow-third" href="#revelation-fish"/>
   </g>
   <g class="revelation-object revelation-first"><path id="revelation-bowl" d="M21 48q9 4 18 0l-4 10q-5 4-10 0Z"/></g>
   <g class="revelation-object revelation-second"><path id="revelation-brick" d="M51 41h24v15H51Zm0 7h24m-12 0v8"/></g>
   <g class="revelation-object revelation-third"><path id="revelation-fish" d="M87 54q10-13 20 0-10 10-20 0Zm20 0 7-5v10Z"/></g>
   <path class="revelation-grooves" d="M42 36l9 5m-1-8v9m10 0 9-6m0 0v8m9-4h8m-4 0-4 8"/>
   <path class="revelation-work"/>
  </svg><div><small class="earth-scene-step"></small><h2></h2><p role="status"></p></div><button type="button">Пропустить</button></div>`;
 root.append(panel);
 const caption=panel.querySelector('p'),title=panel.querySelector('h2'),step=panel.querySelector('small'),work=panel.querySelector('.revelation-work');
 let seen=false,pending=false,active=null,stopCue=null;
 const silence=()=>{stopCue?.();stopCue=null;};
 function clear(){silence();active=null;panel.hidden=true;caption.textContent='';}
 function finish(){
  const note=active?.note;
  clear();
  if(note)onAdvice?.();
 }
 panel.querySelector('button').addEventListener('click',finish);
 function start(s,kind,note=null){
  clear();
  const e=s.revelationEvidence,craft=e.apprenticeship&&e.apprenticeship.time<=e.opening.time;
  active={kind,note,seconds:0,phase:null,points:craft?Array(3).fill(e.apprenticeship):[e.family,e.building,e.food],lines:craft?craftLines:storyLines};
  panel.dataset.kind=kind;panel.dataset.craft=String(!!craft);
  panel.querySelectorAll('.revelation-object path').forEach((path,i)=>path.setAttribute('d',(craft?craftObjects:objects)[i]));
  work.setAttribute('d',workPaths[note?.branch]||'M47 61h35m-17-23v33m-11-20h22');
  title.textContent=kind==='opening'?'Три правдивых рассказа':'Откровение';
  step.textContent=kind==='opening'?'Открытие дара':'Применение';
 }
 function paint(s){
  const {kind,seconds,note}=active,phase=timelines[kind].findLast(([at])=>seconds>=at)?.[1];
  if(!phase){finish();return;}
  panel.hidden=false;
  if(phase===active.phase)return;
  active.phase=phase;panel.dataset.phase=phase;
  const i=['first','second','third'].indexOf(phase);
  const keeper=s.citizens.find(c=>c.id===s.revelationEvidence.opening.citizenId);
  const point=i>=0?active.points[i]:phase==='tablet'?keeper:phase==='work'?note:null;
  if(point&&!doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)focus?.(point);
  if(i>=0)caption.textContent=active.lines[i];
  else if(phase==='shadow')caption.textContent='Три разные тени на миг сходятся на влажной глине.';
  else if(phase==='separate')caption.textContent='Хранитель называет бога Слышащим три рассказа. Каждый уносит свою вещь.';
  else if(phase==='tablet')caption.textContent='Хранитель кладёт перед собой влажную табличку.';
  else if(phase==='grooves')caption.textContent='Свет на мгновение проступает в бороздах.';
  else{
   const view=note&&revelationAdviceView(s);
   caption.textContent=view?.person?`${displayName(s,view.person)} · ${view.action}`:note?'Условия изменились. Запись осталась в обзоре города.':'Табличка сохранена в памяти города. Получено 12 престижа.';
  }
  silence();
  if(i>=0||phase==='shadow'||phase==='grooves')stopCue=cue?.(phase);
 }
 return {
  reset(s){clear();seen=!!s.revelationEvidence?.opening;pending=false;},
  cast(s,note){start(s,'cast',note);},
  tick(s,dt,{allowOpening=true,visible=true}={}){
   if(!seen&&s.revelationEvidence?.opening){seen=true;pending=true;}
   if(!visible||active?.kind==='opening'&&!allowOpening){panel.hidden=true;silence();return;}
   if(!active&&pending&&allowOpening){start(s,'opening');pending=false;}
   if(active){paint(s);if(active)active.seconds+=dt/1000;}
  },
  get active(){return !!active;},
  skip:clear
 };
}
