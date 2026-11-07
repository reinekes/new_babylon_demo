const script={
 opening:{title:'Следы у старого двора',times:[0,9,18,27,36],lines:[
  'Принятая храмом Печать касается мягкой земли.',
  'На глине проступает узор старого двора.',
  'В узоре угадываются знакомые жесты.',
  'Живой участник повторяет последний жест. Память остаётся в городе.'
 ]},
 cast:{title:'Память земли',times:[0,4,8,12],lines:[
  'В глине снова проступают следы.',
  'У сохранившихся мест видны образы прежних занятий.',
  'Следы меркнут. Живые участники сохраняют поддержку.'
 ]}
};
const poses={
 building:'M22 37l-5-11 11-6 8 10M26 19l3-7h10v7H28M22 37l-8 11m8-11 7 11',
 food:'M23 38l5-15 10 8m-10-8-10 7m5 8-8 10m8-10 6 10M41 48V19m0 5 5-6m-5 11-5-6',
 memorial:'M23 38V22l10 10 7-5m-17 11-8 10m8-10 6 10M36 26h10l-2 5h-6z'
};

export function createLandPresentation(root,{openingStories,onOpening,project,cue}={}){
 const doc=root.ownerDocument,panel=doc.createElement('section');
 panel.className='earth-scene land-scene';
 panel.setAttribute('aria-label','Сцена Памяти земли');
 panel.innerHTML=`<div class="earth-scene-card land-scene-card"><svg viewBox="0 0 100 76" aria-hidden="true"><path class="land-tablet" d="M20 15q30-9 60 0v47q-30 8-60 0z"/><path class="land-imprint" d="M33 51V32l17-9 17 9v19H33m12 0V39h10v12M26 57h48"/></svg><div><small class="earth-scene-step"></small><h2></h2><p role="status"></p><p class="land-scene-names"></p></div><button type="button">Пропустить</button></div>`;
 const marks=Array.from({length:3},()=>{
  const mark=doc.createElement('span');
  mark.className='land-trace';mark.setAttribute('aria-hidden','true');
  mark.innerHTML='<svg viewBox="0 0 56 58"><ellipse cx="24" cy="51" rx="15" ry="4"/><circle cx="23" cy="16" r="3"/><path/></svg>';
  return mark;
 });
 root.append(panel,...marks);
 const title=panel.querySelector('h2'),caption=panel.querySelector('[role="status"]'),step=panel.querySelector('small');
 const names=panel.querySelector('.land-scene-names');
 let active=null,seen=false,stopCue;
 function hideMarks(){for(const mark of marks)mark.hidden=true;}
 function silence(){stopCue?.();stopCue=null;}
 function skip(){silence();active=null;panel.hidden=true;hideMarks();}
 function start(kind,stories=[]){
  skip();
  active={kind,elapsed:0,phase:-1,hasLiving:stories.some(row=>row.livingIds?.length),places:stories.filter(row=>row.place).slice(0,3)};
  title.textContent=script[kind].title;panel.dataset.kind=kind;
  step.textContent=kind==='opening'?'Принятие Печати':'Применение';
  names.textContent=[...new Set(stories.map(row=>row.name).filter(Boolean))].join(' · ');
  for(const [index,row] of active.places.entries()){
   marks[index].querySelector('path').setAttribute('d',poses[row.kind]||poses.memorial);
  }
 }
 panel.querySelector('button').onclick=skip;skip();
 return {
  get active(){return !!active;},
  skip,cast(stories){start('cast',stories);},
  reset(){skip();seen=false;},
  tick(s,dt,{visible=true,allowOpening=true}={}){
   if(!visible||active?.kind==='opening'&&!allowOpening){panel.hidden=true;hideMarks();silence();return;}
   if(!active&&allowOpening&&!seen&&s.landMemoryChapter===1&&!s.landMemorySceneSeen&&s.landRelicQuest?.phase==='completed'){
    seen=true;onOpening?.(s);start('opening',openingStories?.(s));
   }
   if(!active)return;
   const story=script[active.kind],phase=story.times.findLastIndex(time=>active.elapsed>=time*1000);
   if(phase===story.lines.length){skip();return;}
   panel.hidden=false;
   if(active.phase!==phase){
    active.phase=phase;panel.dataset.phase=phase;
    caption.textContent=active.kind==='opening'&&phase===3&&!active.hasLiving?
     'Имена остались в записях города. Печать хранится в храме.':story.lines[phase];
    silence();
    stopCue=cue?.(active.kind,phase);
   }
   for(const [index,mark] of marks.entries()){
    const row=active.places[index];
    const point=phase>0&&row&&s.buildings.includes(row.place)&&project?.(row.place);
    mark.hidden=!point;
    if(point)mark.style.transform=`translate(${point.x}px,${point.y}px) translate(-50%,-88%)`;
   }
   active.elapsed+=dt;
  }
 };
}
