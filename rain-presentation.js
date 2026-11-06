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
 let seen=null,active=null,stopCue=null;
 function skip(){
  stopCue?.();stopCue=null;active=null;panel.hidden=true;
 }
 panel.querySelector('button').addEventListener('click',skip);
 function start(kind,state,selection,now){
  skip();
  active={kind,startedAt:now,phase:null};
  panel.dataset.kind=kind;
  title.textContent=kind==='opening'?'Одна капля':'Небесный дождь';
  panel.hidden=false;
  const target=fieldTarget(state,selection);
  if(target)focus?.(target);
 }
 function paint(now){
  if(!active)return;
  const phase=rainSceneFrame(active.kind,(now-active.startedAt)/1000);
  if(!phase){skip();return;}
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
   paint(now);
  },
  cast(state,target,now){
   seen=state.irrigatedHarvest??null;
   start('cast',state,target,now);paint(now);
  },
  skip
 };
}
