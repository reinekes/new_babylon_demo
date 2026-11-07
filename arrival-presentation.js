import {arrivalWelcomeHouse} from './arrival-hospitality.js';

const stories={
 opening:{title:'Дым, который виден издалека',timing:[0,7,15,23,30],lines:[
  'У тёплого очага расстилают вторую циновку.',
  'Дым над двором на миг складывается в знак чаши.',
  'У края долины путники замечают дым.',
  'Вдалеке отвечает слабый огонёк.'
 ]},
 cast:{title:'Зов новых жителей',timing:[0,3,6,9,12],lines:[
  'В пыли проступает дорога.',
  'На краю долины видны путники с тюками.',
  'Они идут к подготовленному дому.',
  'Место у очага ждёт их прибытия.'
 ]}
};
const art=`<svg viewBox="0 0 120 86" aria-hidden="true">
 <path class="arrival-ground" d="M8 70h105M13 62V37l21-13 22 13v25m-18 0V47H28v15M11 68l13-8 17 4-12 8z"/>
 <path class="arrival-smoke" d="M41 30c-11-8 12-11 6-20m-8 4q15 17 29 0z"/>
 <path class="arrival-road" d="M35 82Q67 77 76 57T110 29"/>
 <path class="arrival-traveler" d="M91 55l7-12 6 7m-6-7-3-10 7 4 5 18m-18-20 6-2"/>
 <circle class="arrival-traveler" cx="93" cy="28" r="3"/>
 <circle class="arrival-light" cx="111" cy="23" r="3"/>
 </svg>`;

export function createArrivalPresentation(root,{opening,onOpening,project,cue}={}){
 const doc=root.ownerDocument,panel=doc.createElement('section'),mark=doc.createElement('div');
 panel.className='earth-scene arrival-scene';panel.hidden=true;panel.setAttribute('aria-label','Сцена Зова новых жителей');
 panel.innerHTML=`<div class="earth-scene-card arrival-scene-card">${art}<div><small class="earth-scene-step"></small><h2></h2><p role="status"></p></div><button type="button">Пропустить</button></div>`;
 mark.className='arrival-mark';mark.hidden=true;mark.title='Глиняный знак семьи';
 mark.innerHTML='<svg viewBox="0 0 24 20" aria-hidden="true"><path d="M3 4 17 2l5 4-2 11-15 1-3-5Z"/><path d="m7 12 4-5 4 5m-7 3h8"/></svg>';
 root.append(panel,mark);
 const title=panel.querySelector('h2'),caption=panel.querySelector('p'),step=panel.querySelector('small');
 let active=null,seen=false,retry=0,stopCue;
 function silence(){stopCue?.();stopCue=null;}
 function skip(){silence();active=null;panel.hidden=true;}
 function start(kind,count=0){
  skip();active={kind,count,elapsed:0,phase:-1};panel.dataset.kind=kind;
  title.textContent=stories[kind].title;step.textContent=kind==='opening'?'Открытие дара':'Применение';
 }
 panel.querySelector('button').addEventListener('click',skip);
 return {
  reset(){skip();seen=false;retry=0;mark.hidden=true;},
  cast(count){if(count>0)start('cast',count);},
  get active(){return !!active;},
  skip,
  tick(s,dt,{visible=true,allowOpening=true,markVisible=visible}={}){
   const welcome=s.arrivalHospitality?.welcomes?.at(-1);
   const house=markVisible&&welcome&&arrivalWelcomeHouse(s,welcome);
   const point=house&&project?.(house);
   mark.hidden=!point;
   if(point)mark.style.transform=`translate(${point.x}px,${point.y}px) translate(-50%,-125%)`;
   if(!visible||active?.kind==='opening'&&!allowOpening){panel.hidden=true;silence();return;}
   if(!active&&allowOpening&&!seen&&!s.arrivalHospitality?.sceneSeen){
    retry-=dt;
    if(retry<=0){
     retry=1000;
     if(opening?.(s)){seen=true;onOpening?.(s);start('opening');}
    }
   }
   if(!active)return;
   const story=stories[active.kind],phase=story.timing.findLastIndex(at=>active.elapsed>=at*1000);
   if(phase===story.lines.length){skip();return;}
   panel.hidden=false;
   if(phase!==active.phase){
    active.phase=phase;panel.dataset.phase=String(phase);caption.textContent=phase===1&&active.kind==='cast'?story.lines[phase]+' В группе '+active.count+' чел.':story.lines[phase];
    silence();stopCue=cue?.(active.kind,phase);
   }
   active.elapsed+=dt;
  }
 };
}
