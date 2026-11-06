import {buildingKey} from './definitions.js';
import {fishingWaterTargets} from './fishing-water.js';
import {terrain,isDryPoint} from './world.js';

const timing={
 opening:[[0,'unload'],[6,'share'],[12,'reflection'],[20,'still'],[27,null]],
 cast:[[0,'ripple'],[2,'school'],[5,'silt'],[8,null]]
};
const captions={
 unload:'Рыбак принёс десятый улов. Сеть поднялась над водой.',
 share:'Два жилых двора получили долю улова.',
 reflection:'Под водой сеть всё ещё раскрыта. Рыбы собираются в её тени.',
 still:'Рыбак замер и смотрит на отражение. Богатый улов открыт.',
 ripple:'Круг по воде пошёл против течения.',
 school:'Стайка повернула разом.',
 silt:'Мутная вода скрыла рыб. Следующие уловы станут тяжелее.'
};

export function catchSceneFrame(kind,seconds){
 return timing[kind]?.findLast(([at])=>at<=seconds)?.[1]??null;
}

function waterPoint(s,yard){
 if(!yard)return null;
 const site=fishingWaterTargets(s,yard)[0];
 if(site)return site;
 // Earlier worlds use the legacy fishing routine, but still have water tiles.
 let closest=null,distance=3;
 for(let y=yard.y-2;y<=yard.y+2;y++)for(let x=yard.x-2;x<=yard.x+2;x++){
  const d=Math.hypot(x-yard.x,y-yard.y);
  if(d<distance&&terrain(x,y,s)==='water'&&!isDryPoint(s,x,y)){closest={x,y};distance=d;}
 }
 return closest||yard;
}

export function catchOpeningPoints(s){
 const q=s.richCatchEvidence;
 const key=q.site??s.citizens.find(c=>c.id===q.fisher)?.work;
 const yard=s.buildings.find(b=>b.type==='fishing'&&buildingKey(b)===key);
 const [x,y]=q.homes.at(-1).split(',').map(Number);
 return {yard,home:{x,y},water:waterPoint(s,yard)};
}

export function createRichCatchPresentation(root,{focus,cue}={}){
 const panel=root.ownerDocument.createElement('section');
 panel.className='catch-scene';panel.hidden=true;panel.setAttribute('aria-label','Сцена Богатого улова');
 panel.innerHTML=`<div class="catch-scene-water" aria-hidden="true"></div>
 <div class="earth-scene-card catch-scene-card">
  <svg viewBox="0 0 146 100" aria-hidden="true">
   <path class="catch-scene-bank" d="M6 56q32-10 68 0t66 0M6 65q32-10 68 0t66 0"/>
   <g class="catch-scene-basket"><path d="M20 38h53L62 57H30Zm2 4h48m-45 5h42m-39 5h35M31 40l6 15m5-15 2 15m9-15-1 15m11-15-4 15M30 37q14-21 32 0"/></g>
   <g class="catch-scene-net"><path d="M80 20l30 26H53zm-9 8 30 18m-37-10 24 10m-1-18L65 46m28-12-14 12m20-6-7 6m-12-26v-9"/></g>
   <ellipse class="catch-scene-ring" cx="83" cy="69" rx="39" ry="10"/>
   <g class="catch-scene-school"><path d="M58 76q9-8 19 0-10 8-19 0l-6-4v8zm26 8q9-7 16 0-7 7-16 0l-5-4v8zm17-12q9-7 16 0-7 7-16 0l-5-4v8z"/></g>
  </svg>
  <div><small class="earth-scene-step"></small><h2></h2><p role="status"></p></div>
  <button type="button">Пропустить</button>
 </div>`;
 root.append(panel);
 const title=panel.querySelector('h2'),step=panel.querySelector('small'),caption=panel.querySelector('p');
 let seen=false,pending=null,active=null,stopCue=null;
 const unlocked=s=>s.richCatchEvidence?.fisher!==undefined&&s.richCatchEvidence.homes.length===2;

 function skip(){
  stopCue?.();stopCue=null;active=null;panel.hidden=true;
 }
 panel.querySelector('button').addEventListener('click',skip);

 function start(kind,points){
  skip();
  active={kind,points,phase:null,seconds:0};
  title.textContent=kind==='opening'?'Сеть вспомнила реку':'Богатый улов';
  step.textContent=kind==='opening'?'Открытие дара':'Применение';
  panel.dataset.kind=kind;
 }

 function paint(){
  const phase=catchSceneFrame(active.kind,active.seconds);
  if(!phase){skip();return;}
  panel.hidden=false;
  if(phase===active.phase)return;
  active.phase=phase;panel.dataset.phase=phase;caption.textContent=captions[phase];
  const point=active.points[{unload:'yard',share:'home',reflection:'water',ripple:'water'}[phase]];
  if(point&&!root.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches)focus?.(point);
  stopCue?.();stopCue=null;
  if(['unload','reflection','ripple','school'].includes(phase))stopCue=cue?.(phase);
 }

 return {
  reset(s){skip();seen=unlocked(s);pending=null;},
  cast(s,yard){if(yard)start('cast',{water:waterPoint(s,yard)});},
  tick(s,dt,{allowOpening=true,visible=true}={}){
   if(!seen&&unlocked(s)){seen=true;pending=catchOpeningPoints(s);}
   if(!visible||active?.kind==='opening'&&!allowOpening){
    panel.hidden=true;stopCue?.();stopCue=null;return;
   }
   if(!active&&pending&&allowOpening){start('opening',pending);pending=null;}
   if(active){paint();if(active)active.seconds+=dt/1000;}
  },
  get active(){return !!active;},
  skip
 };
}
