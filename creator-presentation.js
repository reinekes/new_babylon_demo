import {buildingKey,isOperational} from './definitions.js';
import {creatorReady} from './creator-materials.js';

const timing={
 opening:[[0,'brick'],[7,'hand'],[14,'echo'],[21,'lesson'],[30,null]],
 cast:[[0,'dust'],[2,'cut'],[5,'bundle'],[7,null]]
};
const captions={
 brick:'На циновке лежит сырой кирпич.',
 hand:'Мастер прижимает ладонь к влажной глине и убирает руку.',
 echo:'Рядом проступает второй отпечаток, чуть больше первого.',
 lesson:'Ученик повторяет движение. Добытчики возвращаются к своим инструментам.',
 dust:'На руках и инструментах видна светлая глиняная пыль.',
 cut:'Край пласта отделяется под рукой добытчика.',
 bundle:'Тростник ложится плотной связкой. Работа дворов продолжается.'
};

export function creatorSceneFrame(kind,seconds){
 return timing[kind]?.findLast(([at])=>at<=seconds)?.[1]??null;
}

export function creatorScenePoints(s){
 const active=new Set(s.citizens.map(c=>c.work));
 const find=type=>s.buildings.find(b=>b.type===type&&isOperational(b)&&active.has(buildingKey(b)))||null;
 const brick=s.buildings.find(b=>b.type==='brickyard'&&isOperational(b)&&(b.creatorDedication||(b.brickmaking?.ready||0)+(b.workshopStock?.output?.brick||0)>0))||null;
 return {brick,clay:find('clay'),reed:find('reed')};
}

export function createCreatorPresentation(root,{focus,cue}={}){
 const panel=root.ownerDocument.createElement('section');
 panel.className='creator-scene';panel.hidden=true;panel.setAttribute('aria-label','Сцена Рук творца');
 panel.innerHTML=`<div class="creator-dust" aria-hidden="true"></div><div class="earth-scene-card creator-scene-card">
  <svg viewBox="0 0 146 100" aria-hidden="true">
   <path class="creator-mat" d="m14 65 94-21 27 32-97 21zM21 72l94-21M28 80l94-21M33 88l96-21M35 60l23 31M54 55l24 31M74 51l23 31M93 47l24 31"/>
   <path class="creator-clay" d="m24 46 84-14 16 22v14L40 86 24 62zm0 0 16 24 84-16M40 70v16"/>
   <g class="creator-print"><path d="M50 62q-7-4-10-9-1-3 2-3l7 4-4-12q0-3 3-2l5 10-1-12q1-3 4-1l3 12 3-11q2-3 4 0l-1 14 5-6q4-1 3 3l-7 12q-7 6-16 1z"/></g>
   <g class="creator-echo"><path d="M76 56q-9-3-12-8-1-3 3-4l7 4-4-12q1-4 4-3l5 11-1-14q1-3 5-2l3 14 4-13q3-2 5 1l-2 14 6-7q4-2 4 2l-8 14q-8 7-19 3z"/></g>
   <path class="creator-reeds" d="m24 79 84-42M28 84l88-46M31 89l85-43M38 88l81-39M52 66l9 11m16-25 9 13M94 45l7 12"/>
  </svg>
  <div><small class="earth-scene-step"></small><h2></h2><p role="status"></p></div>
  <button type="button">Пропустить</button>
 </div>`;
 root.append(panel);
 const title=panel.querySelector('h2'),step=panel.querySelector('small'),caption=panel.querySelector('p');
 let seen=false,pending=false,active=null,stopCue=null;
 function silence(){stopCue?.();stopCue=null;}
 function skip(){silence();active=null;panel.hidden=true;}
 panel.querySelector('button').addEventListener('click',skip);
 function start(kind,s){
  skip();active={kind,points:creatorScenePoints(s),seconds:0,phase:null};
  panel.dataset.kind=kind;
  title.textContent=kind==='opening'?'Отпечаток лишней ладони':'Руки творца';
  step.textContent=kind==='opening'?'Открытие дара':'Применение';
 }
 function paint(){
  const phase=creatorSceneFrame(active.kind,active.seconds);
  if(!phase){skip();return;}
  panel.hidden=false;
  if(phase===active.phase)return;
  active.phase=phase;panel.dataset.phase=phase;
  const {brick,clay,reed}=active.points;
  caption.textContent=phase==='brick'&&!brick?'На циновке лежит пласт влажной глины.':captions[phase];
  const point=({brick:brick||clay,lesson:reed||clay,dust:clay||reed,bundle:reed})[phase];
  if(point&&!root.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches)focus?.(point);
  silence();
  if(['hand','echo','dust','bundle'].includes(phase))stopCue=cue?.(phase);
 }
 return {
  reset(s){skip();seen=creatorReady(s);pending=false;},
  cast(s){if(s.creatorMaterials)start('cast',s);},
  tick(s,dt,{allowOpening=true,visible=true}={}){
   if(!seen&&creatorReady(s)){seen=true;pending=true;}
   if(!visible||active?.kind==='opening'&&!allowOpening){panel.hidden=true;silence();return;}
   if(!active&&pending&&allowOpening){start('opening',s);pending=false;}
   if(active){paint();if(active)active.seconds+=dt/1000;}
  },
  get active(){return !!active;},
  skip
 };
}
