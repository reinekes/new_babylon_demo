const stories={
 opening:{title:'Небо поместилось в чаше',times:[0,8,16,24,32],lines:[
  'В ночном дворе наблюдатель склоняется над чашей.',
  'У края остаётся неглубокая отметка.',
  'Вода затихает. В отражении проступают новые точки.',
  'Отражения ложатся на землю у дворов и полей.'
 ]},
 cast:{title:'Мудрость звёзд',times:[0,3,6,9],lines:[
  'В чаше на миг темнеет вода.',
  'От отражений тянутся тонкие линии к отмеченным местам.',
  'В обзоре города видны причины и условия прогноза.'
 ]}
};
const signs={food:'◒',water:'≈',construction:'◇'};

export function createStarPresentation(root,{ready,onOpening,forecasts,project,cue}={}){
 const doc=root.ownerDocument,panel=doc.createElement('section'),marks=new Map();
 panel.className='earth-scene star-scene';panel.hidden=true;
 panel.setAttribute('aria-label','Сцена Мудрости звёзд');
 panel.innerHTML=`<div class="earth-scene-card star-scene-card"><svg viewBox="0 0 120 72" aria-hidden="true"><path class="star-lines" d="M35 35 11 64m47-29 3 30m18-30 29 29"/><path d="M18 34h84q-9 24-42 24T18 34Z"/><ellipse class="star-water" cx="60" cy="34" rx="42" ry="9"/><g class="star-reflections"><circle cx="35" cy="35" r="2"/><circle cx="58" cy="31" r="2"/><circle cx="79" cy="36" r="2"/></g></svg><div><small class="earth-scene-step"></small><h2></h2><p role="status"></p></div><button type="button">Пропустить</button></div>`;
 root.append(panel);
 const title=panel.querySelector('h2'),step=panel.querySelector('small'),caption=panel.querySelector('p');
 let active=null,seen=false,stopCue,record,rows=[],refresh=0;
 function silence(){stopCue?.();stopCue=null;}
 function skip(){silence();active=null;panel.hidden=true;}
 function start(kind){
  skip();active={kind,time:0,phase:-1};panel.dataset.kind=kind;
  title.textContent=stories[kind].title;step.textContent=kind==='opening'?'Открытие дара':'Применение';
 }
 panel.querySelector('button').onclick=skip;
 function drawMarks(s,dt,visible){
  const forecast=s.starObservations?.forecast,keep=new Set();
  refresh-=dt;
  if(visible&&forecast&&forecast.tick===s.tick&&(record!==forecast||refresh<=0)){
   record=forecast;refresh=250;rows=forecasts?.(s)||[];
  }
  if(visible&&forecast&&forecast.tick===s.tick)for(const row of rows){
   const point=project?.(row);
   if(!point)continue;
   keep.add(row.kind);
   let mark=marks.get(row.kind);
   if(!mark){
    mark=doc.createElement('span');mark.className='star-mark';mark.dataset.kind=row.kind;
    mark.textContent=signs[row.kind];mark.setAttribute('aria-hidden','true');
    marks.set(row.kind,mark);root.append(mark);
   }
   mark.style.transform=`translate(${point.x}px,${point.y}px) translate(-50%,-125%)`;
  }
  for(const [kind,mark] of marks)if(!keep.has(kind)){mark.remove();marks.delete(kind);}
 }
 return {
  skip,cast(){start('cast');},
  reset(){skip();seen=false;record=null;rows=[];refresh=0;drawMarks({},0,false);},
  tick(s,dt,{visible=true,allowOpening=true,marksVisible=visible}={}){
   drawMarks(s,dt,marksVisible);
   if(!visible||active?.kind==='opening'&&!allowOpening){panel.hidden=true;silence();return;}
   if(!active&&allowOpening&&!seen&&!s.starObservations?.sceneSeen&&ready?.(s)){seen=true;onOpening?.(s);start('opening');}
   if(!active)return;
   const story=stories[active.kind],phase=story.times.findLastIndex(t=>active.time>=1000*t);
   if(phase===story.lines.length){skip();return;}
   panel.hidden=false;
   if(active.phase!==phase){active.phase=phase;panel.dataset.phase=phase;caption.textContent=story.lines[phase];silence();stopCue=cue?.(active.kind,phase);}
   active.time+=dt;
  }
 };
}
