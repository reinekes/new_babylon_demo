const stories={
 opening:{title:'Чаша перестала дрожать',times:[0,6,13,22],lines:[
  'Человек держит чашу обеими руками.',
  'Рядом ложится ладонь соседа. Вода постепенно успокаивается.',
  'Соседи садятся у стены. Проход остаётся свободным.'
 ]},
 cast:{title:'Тишина сердец',times:[0,2,5,8],lines:[
  'По тени двора проходит едва заметная волна.',
  'Тростник на миг замирает.',
  'У тех, кому помогли, появляется время выдохнуть.'
 ]}
};

export function createPeacePresentation(root,{ready,onOpening,project,cue}={}){
 const doc=root.ownerDocument,panel=doc.createElement('section');
 panel.className='earth-scene peace-scene';panel.hidden=true;
 panel.setAttribute('aria-label','Сцена Тишины сердец');
 panel.innerHTML=`<div class="earth-scene-card peace-scene-card"><svg viewBox="0 0 100 64" aria-hidden="true"><path d="M19 30h62q-6 24-31 24T19 30ZM11 43l10-5m57 0 11 5"/><path class="peace-water" d="M25 30q12-7 25 0t25 0"/></svg><div><small class="earth-scene-step"></small><h2></h2><p role="status"></p></div><button type="button">Пропустить</button></div>`;
 root.append(panel);
 const title=panel.querySelector('h2'),step=panel.querySelector('small'),caption=panel.querySelector('p'),marks=new Map();
 let active=null,seen=false,stopCue;
 function silence(){stopCue?.();stopCue=null;}
 function skip(){silence();active=null;panel.hidden=true;}
 function start(kind){skip();active={kind,time:0,phase:-1};panel.dataset.kind=kind;title.textContent=stories[kind].title;step.textContent=kind==='opening'?'Открытие дара':'Применение';}
 panel.querySelector('button').onclick=skip;
 function drawRelief(s,visible){
  const cast=s.peaceDiscovery?.lastCast,keep=new Set();
  if(visible&&cast&&s.simTime-cast.at<60)for(const person of s.citizens){
   if(!cast.ids.includes(person.id)||!['home','resting'].includes(person.phase)||person.floodShelter)continue;
   const point=project?.(person);
   if(!point)continue;
   keep.add(person.id);
   if(!marks.has(person.id)){
    const mark=doc.createElement('span');mark.className='peace-relief';mark.dataset.resident=person.id;mark.setAttribute('aria-hidden','true');root.append(mark);marks.set(person.id,mark);
   }
   marks.get(person.id).style.transform=`translate(${point.x}px,${point.y}px) translate(-50%,-125%)`;
  }
  for(const [id,mark] of marks)if(!keep.has(id)){mark.remove();marks.delete(id);}
 }
 return {
  get active(){return !!active;},
  skip,cast(){start('cast');},
  reset(){skip();seen=false;drawRelief({},false);},
  tick(s,dt,{visible=true,allowOpening=true,marksVisible=visible}={}){
   drawRelief(s,marksVisible);
   if(!visible||active?.kind==='opening'&&!allowOpening){panel.hidden=true;silence();return;}
   if(!active&&allowOpening&&!seen&&!s.peaceDiscovery?.sceneSeen&&ready?.(s)){seen=true;onOpening?.(s);start('opening');}
   if(!active)return;
   const story=stories[active.kind],phase=story.times.findLastIndex(t=>active.time>=1000*t);
   if(phase===story.lines.length){skip();return;}
   panel.hidden=false;
   if(active.phase!==phase){
    active.phase=phase;panel.dataset.phase=phase;caption.textContent=story.lines[phase];
    silence();stopCue=cue?.(active.kind,phase);
   }
   active.time+=dt;
  }
 };
}
