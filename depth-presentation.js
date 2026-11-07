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
 const svg='http://www.w3.org/2000/svg',wave=doc.createElementNS(svg,'svg'),trail=doc.createElementNS(svg,'path'),ring=doc.createElementNS(svg,'ellipse');
 wave.setAttribute('class','depth-wave');wave.setAttribute('aria-hidden','true');wave.setAttribute('hidden','');
 wave.append(trail,ring);
 panel.className='earth-scene depth-scene';panel.hidden=true;panel.setAttribute('aria-label','Сцена Пробуждения глубин');
 panel.innerHTML=`<div class="earth-scene-card depth-scene-card"><svg viewBox="0 0 120 76" aria-hidden="true"><path d="M17 40h86q-8 26-43 26T17 40Z"/><ellipse class="depth-surface" cx="60" cy="40" rx="43" ry="9"/><ellipse class="depth-inner" cx="60" cy="40" rx="27" ry="5"/><path class="depth-arch" d="M26 32q34-45 68 0"/><path class="depth-relic" d="m53 45 7-15 8 15Z"/></svg><div><small class="earth-scene-step"></small><h2></h2><p role="status"></p></div><button type="button">Пропустить</button></div>`;
 ripple.className='depth-ripple';ripple.hidden=true;ripple.setAttribute('aria-hidden','true');
 root.append(panel,ripple,wave);
 const title=panel.querySelector('h2'),step=panel.querySelector('small'),caption=panel.querySelector('p');
 let active=null,seen=false,stopCue;
 function silence(){stopCue?.();stopCue=null;}
 function skip(){silence();active=null;panel.hidden=true;wave.setAttribute('hidden','');}
 function start(kind,target){
  skip();
  const reach=target?.edges?.reduce((max,edge)=>Math.max(max,edge.distance),1)||1;
  active={kind,time:0,phase:-1,target,reach};panel.dataset.kind=kind;
  title.textContent=stories[kind].title;step.textContent=kind==='opening'?'Доставка реликвии':'Применение';
 }
 function drawWave(visible){
  const target=visible&&active?.target;
  if(!target){wave.setAttribute('hidden','');return;}
  wave.removeAttribute('hidden');
  const time=active.time,point=project?.(target.point);
  ring.setAttribute('visibility',point&&time<5000?'visible':'hidden');
  if(point&&time<5000){
   ring.setAttribute('cx',point.x);ring.setAttribute('cy',point.y);
   ring.setAttribute('rx',18-time/500);ring.setAttribute('ry',8-time/1000);
  }
  const reached=Math.max(0,(time-4000)/7000)*active.reach;
  let path='';
  for(const edge of target.edges||[]){
   if(edge.distance>Math.ceil(reached)||reached<=0)break;
   const from=project?.(edge.from),to=project?.(edge.to);
   if(from&&to)path+=`M${from.x} ${from.y}L${to.x} ${to.y}`;
  }
  trail.setAttribute('d',path);
 }
 panel.querySelector('button').onclick=skip;
 return {
  get active(){return !!active;},
  skip,cast(target){start('cast',target);},
  reset(){skip();seen=false;ripple.hidden=true;},
  tick(s,dt,{visible=true,allowOpening=true,rippleVisible=visible}={}){
   const q=s.relicQuest;
   const point=rippleVisible&&s.depthSupply&&q?.phase==='dormant'&&eligible?.(s)&&project?.(q.site);
   ripple.hidden=!point;
   if(point)ripple.style.transform=`translate(${point.x}px,${point.y}px) translate(-50%,-50%)`;
   if(!visible||active?.kind==='opening'&&!allowOpening){panel.hidden=true;drawWave(false);silence();return;}
   if(!active&&allowOpening&&!seen&&s.depthSupply&&!s.depthSupply.sceneSeen&&q?.phase==='completed'){
    seen=true;onOpening?.(s);start('opening');
   }
   if(!active)return;
   const story=stories[active.kind],phase=story.times.findLastIndex(t=>active.time>=1000*t);
   if(phase===story.lines.length){skip();return;}
   panel.hidden=false;drawWave(true);
   if(active.phase!==phase){active.phase=phase;panel.dataset.phase=phase;caption.textContent=story.lines[phase];silence();stopCue=cue?.(active.kind,phase);}
   active.time+=dt;
  }
 };
}
