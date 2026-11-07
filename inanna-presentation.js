const scenes={
 opening:{title:'Кто остался снаружи',times:[0,10,20,30,40],lines:[
  'У порога встретились жрец, жители и приглашённый гость.',
  'Последнему гостю освобождают проход.',
  'На стене на миг проступает тень зверя.',
  'Община сохранила открытый проход. Открылся Покров Инанны.'
 ]},
 cast:{title:'Покров Инанны',times:[0,4,9,14],lines:[
  'На знаке порога гаснет свет.',
  'Вдоль крыш хранилищ проходит тонкий отблеск.',
  'Мыши остаются в городе. Три сезона они портят вдвое меньше еды.'
 ]}
};

export function createInannaPresentation(root,{openingGate,onOpening,project,cue}={}){
 const doc=root.ownerDocument,panel=doc.createElement('section');
 panel.className='earth-scene inanna-scene';
 panel.setAttribute('aria-label','Сцена Покрова Инанны');
 panel.innerHTML=`<div class="earth-scene-card inanna-scene-card"><svg viewBox="0 0 112 76" aria-hidden="true"><path class="inanna-gate" d="M13 63V16h86v47H75V33H37v30z"/><path class="inanna-cloth" d="M38 33h36v24l-18-7-18 7z"/><path class="inanna-shadow" d="M22 57q8-10 18-8l12-8 19 1 9-8 11 2 3 8-9 5-5 11h-7l2-9-18 4-6 7h-7l4-7-13 4z"/><path class="inanna-mouse-shadow" d="M79 65q2-4 8-4l4 3-4 2h-8q-6 0-7-3"/></svg><div><small class="earth-scene-step"></small><h2></h2><p role="status"></p></div><button type="button">Пропустить</button></div>`;
 const marks=Array.from({length:3},()=>{
  const mark=doc.createElement('span');
  mark.className='inanna-roof-mark';mark.setAttribute('aria-hidden','true');
  return mark;
 });
 root.append(panel,...marks);
 const title=panel.querySelector('h2'),step=panel.querySelector('small'),caption=panel.querySelector('[role="status"]');
 let active=null,seen=false,stopCue;
 function hideMarks(){for(const mark of marks)mark.hidden=true;}
 function silence(){stopCue?.();stopCue=null;}
 function skip(){silence();active=null;panel.hidden=true;hideMarks();}
 function start(kind,{gate=null,stores=[]}={}){
  skip();active={kind,elapsed:0,phase:-1,gate,stores:stores.slice(0,3)};
  panel.dataset.kind=kind;title.textContent=scenes[kind].title;
  step.textContent=kind==='opening'?'Встреча у порога':'Применение';
 }
 panel.querySelector('button').onclick=skip;skip();
 return {
  get active(){return !!active;},
  skip,cast(target){start('cast',target);},
  reset(){skip();seen=false;},
  tick(s,dt,{visible=true,allowOpening=true}={}){
   if(!visible||active?.kind==='opening'&&!allowOpening){panel.hidden=true;hideMarks();silence();return;}
   if(!active&&allowOpening&&!seen&&s.inannaDiscovery&&!s.inannaSceneSeen&&s.sacred?.unlocks?.inannaProtection){
    seen=true;onOpening?.(s);start('opening',{gate:openingGate?.(s)});
   }
   if(!active)return;
   const scene=scenes[active.kind],phase=scene.times.findLastIndex(time=>active.elapsed>=time*1000);
   if(phase===scene.lines.length){skip();return;}
   panel.hidden=false;
   if(active.phase!==phase){
    active.phase=phase;panel.dataset.phase=phase;
    caption.textContent=!active.gate&&phase===0?'На глиняном знаке проступает посвящение Инанне.':scene.lines[phase];
    silence();stopCue=cue?.(active.kind,phase);
   }
   for(const [index,mark] of marks.entries()){
    const store=active.stores[index];
    const point=phase===1&&s.buffs.inannaProtection>0&&store&&s.buildings.includes(store)&&project?.(store);
    mark.hidden=!point;
    if(point)mark.style.transform=`translate(${point.x}px,${point.y}px) translate(-50%,-34px)`;
   }
   active.elapsed+=dt;
  }
 };
}
