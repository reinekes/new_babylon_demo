const amount=new Intl.NumberFormat('ru',{maximumFractionDigits:2});
const timings={opening:[0,8,17,26,34],cast:[0,3,6,9,12]};
const lines={
 opening:['Мастер сминает влажную глину ладонью.','Стенки макета оседают.','Глина поднимается в форму маленького дома с открытой дверью.','Крупица глины катится вверх по ладони.'],
 cast:['Пыль оседает тяжёлыми комьями.','Глина ложится слоями у двора.','Из слоёв выступают волокна, рядом складываются связки тростника.','На верхнем коме остаётся отпечаток ладони.']
};
const pile='<svg viewBox="0 0 100 70" aria-hidden="true"><g class="shaping-clay"><path d="M8 57l9-16 22-3 16 13-5 10Z"/><path d="M34 58l13-19 20-3 12 13-7 13Z"/><path d="M25 41l6-15 17-6 15 12-6 12Z"/></g><g class="shaping-reeds"><path d="m61 61 27-23m-23 25 26-22m-22 24 25-20m-21 20 23-17m-19 4 6 7"/></g></svg>';
export function createShapingPresentation(root,{project,focus,cue}={}){
 const doc=root.ownerDocument,panel=doc.createElement('section');
 panel.className='shaping-scene';panel.hidden=true;panel.setAttribute('aria-label','Сцена Повеления глине');
 panel.innerHTML=`<div class="earth-scene-card shaping-scene-card"><div class="shaping-art">${pile}<svg class="shaping-model" viewBox="0 0 100 70" aria-hidden="true"><path d="m18 58 4-27 28-15 28 15 5 27H58V42H44v16Z"/></svg><svg class="shaping-hand" viewBox="0 0 100 70" aria-hidden="true"><path d="m42 49-7-9m12 5-3-15m8 15 1-17m4 20 5-14m-21 17q8 15 18 1"/><circle class="shaping-grain" cx="51" cy="57" r="2"/></svg></div><div><small class="earth-scene-step"></small><h2></h2><p role="status"></p></div><button type="button">Пропустить</button></div>`;
 root.append(panel);
 const caption=panel.querySelector('p'),marks=new Map();
 let active=null,seen=false,pending=false,stopCue;
 const silence=()=>{stopCue?.();stopCue=null;};
 function skip(){silence();active=null;panel.hidden=true;}
 panel.querySelector('button').addEventListener('click',skip);
 function start(kind,point){
  skip();active={kind,point,seconds:0,phase:-1};panel.dataset.kind=kind;
  panel.querySelector('h2').textContent=kind==='opening'?'Глина помнит форму':'Повеление глине';
  panel.querySelector('small').textContent=kind==='opening'?'Открытие дара':'Применение';
 }
 function drawPiles(s,visible){
  const keep=new Set();
  for(const b of s.shapingBatches?.rows||[]){
   if(!(b.remaining.clay>0||b.remaining.reed>0))continue;
   const p=visible&&project?.(b);
   if(!p)continue;
   keep.add(b.id);
   let mark=marks.get(b.id);
   if(!mark){
    mark=doc.createElement('div');mark.className='shaping-pile';mark.innerHTML=pile+'<span></span>';
    root.append(mark);marks.set(b.id,mark);
   }
   mark.style.transform=`translate(${p.x}px,${p.y}px) translate(-50%,-85%)`;
   mark.style.setProperty('--clay',Math.sqrt(b.remaining.clay/60));
   mark.style.setProperty('--reed',Math.sqrt(b.remaining.reed/40));
   mark.dataset.grounded=String(b.grounded===true);
   const count=`${amount.format(b.remaining.clay)} глины · ${amount.format(b.remaining.reed)} тростника`;
   const label=mark.querySelector('span');if(label.textContent!==count)label.textContent=count;
  }
  for(const [id,mark] of marks)if(!keep.has(id)){mark.remove();marks.delete(id);}
 }
 return {
  get active(){return !!active;},
  reset(s){skip();seen=s.shapingModel?.completedAt!==undefined;pending=false;drawPiles({},false);},
  cast(batch){if(batch)start('cast',batch);},
  tick(s,dt,{allowOpening=true,visible=true,pilesVisible=visible}={}){
   drawPiles(s,pilesVisible);
   if(!seen&&s.shapingModel?.completedAt!==undefined){seen=true;pending=true;}
   if(!visible||active?.kind==='opening'&&!allowOpening){panel.hidden=true;silence();return;}
   if(!active&&pending&&allowOpening){start('opening',s.shapingModel);pending=false;}
   if(!active)return;
   const {kind,seconds,point}=active,phase=timings[kind].findLastIndex(at=>seconds>=at);
   if(phase===4){skip();return;}
   panel.hidden=false;
   if(phase!==active.phase){
    active.phase=phase;panel.dataset.phase=String(phase);caption.textContent=lines[kind][phase];
    if(phase===0&&!doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)focus?.(point);
    silence();stopCue=cue?.(kind,phase);
   }
   active.seconds+=dt/1000;
  },
  skip
 };
}
