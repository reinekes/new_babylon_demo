import {isDryPoint} from './world.js';
import {footprintCells} from './footprints.js';
const stages={
 opening:[[0,'waiting'],[6,'drop'],[10,'shadow'],[17,'rain'],[24,null]],
 cast:[[0,'shadow'],[3,'rain'],[10,null]]
};

export function rainSceneFrame(kind,seconds){
 return stages[kind]?.findLast(([at])=>at<=seconds)?.[1]??null;
}

const captions={
 waiting:'После жатвы земледелец поставил чашу у края поля.',
 drop:'Первая капля упала в чашу.',
 shadow:'По ячменю прошла тень облака.',
 rain:'Дождь пошёл над долиной.'
};

function fieldTarget(state,selection){
 const fields=state.buildings.filter(b=>b.type==='field'&&b.construction?.kind!=='new');
 const field=fields.find(b=>b.x===selection?.x&&b.y===selection?.y)||
  fields.find(b=>`${b.x},${b.y}`===state.irrigatedHarvest?.field)||fields[0];
 return field?{x:field.x,y:field.y}:null;
}

function freeObserver(state,c,target){
 if(!target||!(c.age>=16)||!['home','resting','blocked'].includes(c.phase)||
  c.waterTrip||c.pantryTrip||c.districtJob||c.tradeJob||c.saleJob||c.site||c.work&&c.phase==='blocked'||
  c.clinic||c.commonMealTarget||c.eveningGame||c.floodShelter||c.memorialMove||c.manualGathering||
  c.clothingTarget!==undefined||c.craftSite||c.seedField||
  Object.values(c.cargo||{}).some(n=>n>0)||Object.values(c.buildCargo||{}).some(n=>n>0)||
  Math.hypot(c.x-target.x,c.y-target.y)>2.6||!isDryPoint(state,c.x,c.y))return false;
 return !state.buildings.some(b=>!['canal','field'].includes(b.type)&&footprintCells(b).some(p=>Math.abs(p.x-c.x)<.55&&Math.abs(p.y-c.y)<.55));
}

export function showRainObserver(people,state,reaction){
 if(!reaction||people.some(c=>c.id===reaction.id))return people;
 const citizen=state.citizens.find(c=>c.id===reaction.id);
 return citizen?[...people,{...citizen,kind:'person',walking:false,carrying:false}]:people;
}

export function createRainPresentation(root,{focus,cue}={}){
 const panel=root.ownerDocument.createElement('section');
 panel.className='rain-scene';
 panel.hidden=true;
 panel.setAttribute('aria-label','Сцена дождя');
 panel.innerHTML=`<div class="rain-scene-cloud" aria-hidden="true"></div><div class="rain-scene-fall" aria-hidden="true"></div>
 <div class="rain-scene-card">
  <svg viewBox="0 0 180 105" aria-hidden="true">
   <path class="rain-scene-stalks" d="M29 96Q40 55 28 15m8 45-13-11m14-1 11-15M48 96q12-42 5-69m4 32-10-11m12 3 12-14M135 96q-4-40 10-67m-8 35 15-10m-12-4-9-14M151 96q1-49 13-69m-7 33 12-12"/>
   <ellipse cx="92" cy="88" rx="43" ry="7" fill="#171512"/>
   <path d="M49 64q8 26 43 27 35-1 43-27z" fill="#777668" stroke="#c8b99c" stroke-width="2"/>
   <ellipse cx="92" cy="64" rx="43" ry="10" fill="#292a27" stroke="#c8b99c" stroke-width="2"/>
   <path class="rain-scene-drop" d="M92 49q-7 11-4 14 4 5 8 0 3-3-4-14z" fill="#c7e0e2"/>
   <ellipse class="rain-scene-ring" cx="92" cy="65" rx="18" ry="4" fill="none" stroke="#c7e0e2"/>
  </svg>
  <div><h2></h2><p role="status"></p></div><button type="button">Пропустить</button>
 </div>`;
 root.append(panel);
 const title=panel.querySelector('h2'),caption=panel.querySelector('p');
 let seen=null,active=null,stopCue=null,reaction=null;
 function skip(){
  stopCue?.();stopCue=null;active=null;reaction=null;panel.hidden=true;
 }
 panel.querySelector('button').addEventListener('click',skip);
 function start(kind,state,selection,now){
  skip();
  const target=fieldTarget(state,selection);
  active={kind,startedAt:now,phase:null,target,observerId:null};
  panel.dataset.kind=kind;
  title.textContent=kind==='opening'?'Одна капля':'Небесный дождь';
  panel.hidden=false;
  if(target)focus?.(target);
 }
 function paint(state,now){
  if(!active)return;
  const phase=rainSceneFrame(active.kind,(now-active.startedAt)/1000);
  if(!phase){skip();return;}
  if(phase==='rain'&&active.phase!=='rain'){
   const observer=(state.citizens||[]).find(c=>freeObserver(state,c,active.target));
   active.observerId=observer?.id??null;
  }
  if(active.observerId!==null){
   const observer=(state.citizens||[]).find(c=>c.id===active.observerId);
   if(!observer||state.funeral||state.miracleCelebration||!freeObserver(state,observer,active.target))active.observerId=null;
  }
  reaction=active.observerId===null?null:{id:active.observerId,phase:(now-active.startedAt)/1000<(active.kind==='opening'?19:5)?'cover':'laugh'};
  if(active.phase===phase)return;
  active.phase=phase;panel.dataset.phase=phase;
  caption.textContent=active.kind==='opening'&&phase==='rain'?'Дар открыт · первый призыв бесплатный.':captions[phase];
  if(phase==='drop'||phase==='rain'){
   stopCue?.();stopCue=cue?.(phase);
  }
 }
 return {
  reset(state){skip();seen=state.irrigatedHarvest??null;},
  tick(state,now,allowOpening=true){
   if(allowOpening&&!active&&state.rainDiscovery&&state.irrigatedHarvest&&state.irrigatedHarvest!==seen){
    seen=state.irrigatedHarvest;start('opening',state,null,now);
   }
   paint(state,now);
  },
  cast(state,target,now){
   seen=state.irrigatedHarvest??null;
   start('cast',state,target,now);paint(state,now);
  },
  get reaction(){return reaction;},
  skip
 };
}
