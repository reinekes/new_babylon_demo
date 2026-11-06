import {buildingKey,isOperational} from './definitions.js';
import {networkFor,routeBetween} from './workforce.js';
import {windKnowledgeReason} from './wind-delivery.js';

const timing={opening:[[0,'load'],[8,'trail'],[16,'receive'],[24,null]],cast:[[0,'gust'],[3,'cloth'],[6,null]]};
const captions={
 load:'У двора носильщик ставит корзину, чтобы перевести дыхание.',
 trail:'Пыль продолжает путь по улице, словно ношу подхватил ветер.',
 receive:'У места приёмки человек оборачивается на тихий шорох.',
 gust:'Вдоль пути проходит низкая полоса ветра.',
 cloth:'Свободный край ткани тянется вперёд. Носильщики продолжают свой путь.'
};
const ready=s=>!!s.windDelivery&&!windKnowledgeReason(s);
export const windSceneFrame=(kind,seconds)=>timing[kind]?.findLast(([at])=>at<=seconds)?.[1]??null;
const tile=b=>b?{x:b.x,y:b.y}:null;

export function windSceneRoute(s,target=null){
 if(target){
  const carrier=s.citizens.filter(c=>c.phase==='toDistrictStore'&&c.windCargo&&c.routeIndex<c.route?.length)
   .sort((a,b)=>Math.hypot(a.x-target.x,a.y-target.y)-Math.hypot(b.x-target.x,b.y-target.y))[0];
  if(carrier){
   const points=[tile(carrier),...carrier.route.slice(carrier.routeIndex)];
   return {source:points[0],target:points.at(-1),points};
  }
 }
 const record=s.windDelivery?.path;
 const find=key=>s.buildings.find(b=>buildingKey(b)===key&&isOperational(b));
 const source=find(record?.source),destination=find(record?.target);
 if(!source||!destination)return {source:tile(source),target:tile(destination),points:[]};
 const network=networkFor(s);
 const port=b=>network.ports.find(p=>p.building===b)?.key;
 const from=port(source),to=port(destination);
 const points=from&&to?routeBetween(s,from,to,{network})||[]:[];
 return {source:tile(source),target:tile(destination),points};
}

export function createWindPresentation(root,{focus,project,cue}={}){
 const doc=root.ownerDocument,panel=doc.createElement('section');
 panel.className='wind-scene';panel.hidden=true;panel.setAttribute('aria-label','Сцена Попутного ветра');
 panel.innerHTML=`<svg class="wind-route" aria-hidden="true"><path/></svg><div class="earth-scene-card wind-scene-card">
  <svg viewBox="0 0 128 88" aria-hidden="true">
   <path class="wind-basket" d="M18 36h65l-9 33H28zm10 0c0-27 45-27 45 0M23 46h57M26 56h51M36 37l4 31m9-31v31m12-31-3 31m14-31-6 31"/>
   <path class="wind-cloth" d="M57 39q14-16 28-6t29-10q-4 28-25 27T57 39Z"/>
   <path class="wind-threads" d="M78 18q16 1 29-8m-15 48q13 2 25-5m-27 15q13 2 23-3"/>
  </svg>
  <div><small class="earth-scene-step"></small><h2></h2><p role="status"></p></div><button type="button">Пропустить</button>
 </div>`;
 root.append(panel);
 const path=panel.querySelector('.wind-route path'),title=panel.querySelector('h2'),step=panel.querySelector('small'),caption=panel.querySelector('p');
 const reduce=()=>doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 let seen=false,pending=false,active=null,stopCue=null;
 function silence(){stopCue?.();stopCue=null;}
 function skip(){silence();active=null;panel.hidden=true;path.removeAttribute('d');}
 panel.querySelector('button').addEventListener('click',skip);
 function start(kind,s,target){
  skip();active={kind,route:windSceneRoute(s,kind==='cast'?target:null),seconds:0,phase:null};
  panel.dataset.kind=kind;
  title.textContent=kind==='opening'?'Ноша стала легче':'Попутный ветер';
  step.textContent=kind==='opening'?'Открытие дара':'Применение';
 }
 function paintTrail(phase){
  const {points}=active.route;
  if(reduce()||points.length<2||!['trail','gust','cloth'].includes(phase)){path.removeAttribute('d');return;}
  const fraction=active.kind==='cast'?active.seconds/6:(active.seconds-8)/8;
  const end=Math.min(points.length-1,Math.max(0,fraction)*(points.length-1));
  const start=Math.max(0,end-4);
  const at=index=>{
   const i=Math.floor(index),a=points[i],b=points[i+1]||a,t=index-i;
   return project?.({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  };
  const strip=[at(start)];
  for(let i=Math.floor(start)+1;i<end;i++)strip.push(at(i));
  strip.push(at(end));
  if(strip.some(p=>!p)){path.removeAttribute('d');return;}
  path.setAttribute('d',strip.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '));
 }
 function paint(){
  const phase=windSceneFrame(active.kind,active.seconds);
  if(!phase){skip();return;}
  panel.hidden=false;
  if(phase!==active.phase){
   active.phase=phase;panel.dataset.phase=phase;
   const {source,target,points}=active.route,middle=points[Math.floor(points.length/2)];
   caption.textContent=(!source||!target||!points.length)&&active.kind==='opening'?'Город помнит доставку. С тех пор путь изменился.':captions[phase];
   const point=({load:source,trail:middle,receive:target,gust:middle||source})[phase];
   if(point&&!reduce())focus?.(point);
   silence();
   if(['trail','receive','gust','cloth'].includes(phase))stopCue=cue?.(phase);
  }
  paintTrail(phase);
 }
 return {
  reset(s){skip();seen=ready(s);pending=false;},
  cast(s,target){if(ready(s))start('cast',s,target);},
  tick(s,dt,{allowOpening=true,visible=true}={}){
   if(!seen&&ready(s)){seen=true;pending=true;}
   if(!visible||active?.kind==='opening'&&!allowOpening){panel.hidden=true;silence();return;}
   if(!active&&pending&&allowOpening){start('opening',s);pending=false;}
   if(active){paint();if(active)active.seconds+=dt/1000;}
  },
  get active(){return !!active;},
  skip
 };
}
