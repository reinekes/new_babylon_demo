const stories={
 opening:{title:'Вторая поверхность',times:[0,10,20,30,40],lines:[
  'Доставленную реликвию кладут во влажную чашу.',
  'Вода поднимается по её стенкам.',
  'На стене храма дрожит тень водного свода.',
  'Тень исчезает. На реликвии остаётся влага.'
 ]},
 cast:{title:'Пробуждение глубин',times:[0,4,9,14],lines:[
  'Круги на воде сходятся к центру.',
  'Из глубины поднимается тихий свет.',
  'Отражение скользит против течения. Над долиной собираются облака.'
 ]}
};

export function createDepthPresentation(root,{eligible,onOpening,project,cue}={}){
 const doc=root.ownerDocument,panel=doc.createElement('section'),ripple=doc.createElement('span');
 panel.className='earth-scene depth-scene';panel.hidden=true;panel.setAttribute('aria-label','Сцена Пробуждения глубин');
 panel.innerHTML=`<div class="earth-scene-card depth-scene-card"><svg viewBox="0 0 120 76" aria-hidden="true"><path d="M17 40h86q-8 26-43 26T17 40Z"/><ellipse class="depth-surface" cx="60" cy="40" rx="43" ry="9"/><ellipse class="depth-inner" cx="60" cy="40" rx="27" ry="5"/><path class="depth-arch" d="M26 32q34-45 68 0"/><path class="depth-relic" d="m53 45 7-15 8 15Z"/></svg><div><small class="earth-scene-step"></small><h2></h2><p role="status"></p></div><button type="button">Пропустить</button></div>`;
 ripple.className='depth-ripple';ripple.hidden=true;ripple.setAttribute('aria-hidden','true');
 root.append(panel,ripple);
 const title=panel.querySelector('h2'),step=panel.querySelector('small'),caption=panel.querySelector('p');
 let active=null,seen=false,stopCue;
 function silence(){stopCue?.();stopCue=null;}
 function skip(){silence();active=null;panel.hidden=true;}
 function start(kind){
  skip();active={kind,time:0,phase:-1};panel.dataset.kind=kind;
  title.textContent=stories[kind].title;step.textContent=kind==='opening'?'Доставка реликвии':'Применение';
 }
 panel.querySelector('button').onclick=skip;
 return {
  skip,cast(){start('cast');},
  reset(){skip();seen=false;ripple.hidden=true;},
  tick(s,dt,{visible=true,allowOpening=true,rippleVisible=visible}={}){
   const q=s.relicQuest;
   const point=rippleVisible&&s.depthSupply&&q?.phase==='dormant'&&eligible?.(s)&&project?.(q.site);
   ripple.hidden=!point;
   if(point)ripple.style.transform=`translate(${point.x}px,${point.y}px) translate(-50%,-50%)`;
   if(!visible||active?.kind==='opening'&&!allowOpening){panel.hidden=true;silence();return;}
   if(!active&&allowOpening&&!seen&&s.depthSupply&&!s.depthSupply.sceneSeen&&q?.phase==='completed'){
    seen=true;onOpening?.(s);start('opening');
   }
   if(!active)return;
   const story=stories[active.kind],phase=story.times.findLastIndex(t=>active.time>=1000*t);
   if(phase===story.lines.length){skip();return;}
   panel.hidden=false;
   if(active.phase!==phase){active.phase=phase;panel.dataset.phase=phase;caption.textContent=story.lines[phase];silence();stopCue=cue?.(active.kind,phase);}
   active.time+=dt;
  }
 };
}
