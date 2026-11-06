import {buildingKey,isOperational} from './definitions.js';

const timings={
 opening:[[0,'field-one'],[5,'field-two'],[10,'field-three'],[15,'sheaf'],[21,'bow'],[27,'garden'],[35,null]],
 cast:[[0,'breath'],[3,'furrows'],[8,'leaves'],[12,null]]
};
const captions={
 'field-one':'Первое поле отдало ячмень. Склад принял зерно.',
 'field-two':'Со второго поля принесли ещё часть урожая.',
 'field-three':'Третье поле завершило общий труд.',
 sheaf:'Земледелец связал сноп. Последний колос он оставил на семена.',
 bow:'Колос наклонился, хотя воздух над полем был неподвижен.',
 garden:'На влажной земле проступили листья будущего сада. Дыхание земли открыто.',
 breath:'Земля словно делает вдох.',
 furrows:'По бороздам пробегает волна ростков.',
 leaves:'Листья раскрываются. Пыль опускается на землю.'
};

export function earthSceneFrame(kind,seconds){
 return timings[kind]?.findLast(([at])=>at<=seconds)?.[1]??null;
}

export function earthSceneFields(s){
 const q=s.earthDiscovery;
 if(q?.qualifiedAt==null)return [];
 const live=new Map(s.buildings.filter(b=>b.type==='field'&&isOperational(b)).map(b=>[b.grainFieldId,b]));
 const facts=q.receipts.filter(r=>r.time<=q.qualifiedAt&&live.has(r.fieldId)&&buildingKey(live.get(r.fieldId))===r.field);
 const inspired=facts.find(r=>r.inspired);
 if(!inspired)return [];
 return [...facts.filter(r=>r!==inspired).slice(0,2),inspired].map(r=>{
  const {x,y}=live.get(r.fieldId);
  return {x,y};
 });
}

export function createEarthPresentation(root,{focus,cue}={}){
 const panel=root.ownerDocument.createElement('section');
 panel.className='earth-scene';panel.hidden=true;
 panel.setAttribute('aria-label','Сцена Дыхания земли');
 panel.innerHTML=`<div class="earth-scene-light" aria-hidden="true"></div>
 <div class="earth-scene-card">
  <svg viewBox="0 0 146 100" aria-hidden="true">
   <path class="earth-scene-soil" d="M9 84Q70 64 137 84M16 91Q72 76 129 91M30 97Q72 86 116 97"/>
   <g class="earth-scene-sheaf"><path d="M47 85L39 41m9 44 8-53m-8 53 19-41M39 45l-8-6m9 12-8-4m7-5 2-9m14 10 7-7m-6 3-3-10m12 22 9-4M41 71q10 5 18 0"/></g>
   <g class="earth-scene-ear"><path d="M80 86Q81 56 92 31M88 45q-15-7-14-16 12 1 14 16m1-5q14-8 17-18-13 4-17 18m3-8q-10-8-8-15 7 0 8 15m1-4 6-16"/><path d="m83 18-2-6m20 10 5-7m-31 15-5-7"/></g>
   <g class="earth-scene-seeds"><ellipse cx="93" cy="53" rx="2" ry="3"/><ellipse cx="99" cy="47" rx="2" ry="3"/></g>
   <g class="earth-scene-leaves"><path d="M73 85Q66 57 55 59 54 76 73 85Zm0 0Q75 50 104 49 101 72 73 85Zm8-10 13-17M97 84q7-16 20-14-4 10-20 14Z"/></g>
  </svg>
  <div><small class="earth-scene-step"></small><h2></h2><p role="status"></p></div>
  <button type="button">Пропустить</button>
 </div>`;
 root.append(panel);
 const title=panel.querySelector('h2'),step=panel.querySelector('small'),caption=panel.querySelector('p');
 let seen=null,pending=null,active=null,cast=null,stopCue=null;

 function skip(){
  stopCue?.();stopCue=null;active=null;panel.hidden=true;
 }
 panel.querySelector('button').addEventListener('click',skip);

 function paint(seconds){
  const phase=earthSceneFrame(active.kind,seconds);
  if(!phase){skip();return;}
  panel.hidden=false;
  if(phase===active.phase)return;
  active.phase=phase;panel.dataset.phase=phase;
  const index=['field-one','field-two','field-three'].indexOf(phase);
  if(index>=0&&active.fields[index]&&!root.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches)focus?.(active.fields[index]);
  step.textContent=index>=0?`Урожай · ${index+1} из 3`:active.kind==='cast'?'Применение':'Открытие дара';
  caption.textContent=captions[phase];
  stopCue?.();stopCue=null;
  if(['sheaf','bow','garden','breath','furrows'].includes(phase))stopCue=cue?.(phase);
 }

 return {
  reset(s){skip();seen=s.earthDiscovery?.qualifiedAt??null;pending=null;cast=s.miracleCelebration;},
  tick(s,dt,{allowOpening=true,visible=true}={}){
   const unlocked=s.earthDiscovery?.qualifiedAt??null,q=s.miracleCelebration;
   if(unlocked!==null&&unlocked!==seen){
    seen=unlocked;pending=earthSceneFields(s);
   }
   if(q!==cast){
    cast=q;
    if(q?.kind==='fertility'&&s.earthDiscovery&&q.elapsed<12){
     skip();pending=null;
     active={kind:'cast',phase:null};
     title.textContent='Дыхание земли';panel.dataset.kind='cast';
    }
   }
   if(!visible){
    panel.hidden=true;stopCue?.();stopCue=null;
    return;
   }
   if(active?.kind==='cast'){
    if(q?.kind==='fertility')paint(q.elapsed);
    else skip();
    return;
   }
   if(!allowOpening){panel.hidden=true;return;}
   if(!active&&pending){
    active={kind:'opening',fields:pending,seconds:0,phase:null};pending=null;
    title.textContent='Колос, который склонился последним';panel.dataset.kind='opening';
    paint(0);
   }else if(active){
    active.seconds+=dt/1000;paint(active.seconds);
   }
  },
  get active(){return !!active;},
  skip
 };
}
