import {blessingCupAt} from './blessing-discovery.js';
import {displayName} from './citizen-epithets.js';
import {freeCeremonyGuest} from './miracle-celebration.js';

const phases=[
 {at:0,id:'mat',caption:'Соседи расстилают циновку. Одно место оставляют свободным.'},
 {at:7000,id:'cup',caption:'К свободному месту пододвигают чашу.',cue:'sheaf'},
 {at:15000,id:'light',caption:'Край циновки шевелится, и свет ложится на пустое место.',cue:'breath'},
 {at:22000,id:'neighbors',caption:'Соседи вспоминают тех, кто помог в трудный день. Дар открыт.',cue:'bow'}
];

export function createBlessingPresentation(root,{cue,focus,onOpening}={}){
 const panel=root.ownerDocument.createElement('section');
 panel.className='earth-scene blessing-scene';
 panel.hidden=true;
 panel.dataset.kind='opening';
 panel.setAttribute('aria-label','Сцена открытия Благословения');
 panel.innerHTML=`<div class="earth-scene-card blessing-scene-card">
  <svg viewBox="0 0 120 80" aria-hidden="true">
   <path class="blessing-light" d="M30 6h59l16 56H15Z"/>
   ${[22,49,78].map(x=>`<g class="blessing-shadow" transform="translate(${x} 0)" hidden><circle cx="7" cy="16" r="4"/><path d="M3 21q6-5 11 3l4 12H0Z"/></g>`).join('')}
   <path class="blessing-mat" d="M27 37h66l16 30H11Zm-9 23h84M22 52h76M26 44h68m-63-7-11 30m23-30-7 30m17-30-2 30m14-30 2 30m10-30 7 30m5-30 11 30"/>
   <path class="blessing-bowls" d="M29 44h18q-2 11-9 11t-9-11Zm44 0h18q-2 11-9 11t-9-11Z"/>
   <path class="blessing-cup" d="M50 52h20q-2 12-10 12t-10-12Z"/>
  </svg>
  <div><small class="earth-scene-step">Открытие дара</small><h2>Одно место за столом</h2><p role="status"></p><small data-blessing-guests hidden></small></div>
  <div class="blessing-scene-actions"><button type="button">Пропустить</button><button type="button" data-blessing-focus hidden>К чаше</button></div>
 </div>`;
 root.append(panel);
 const caption=panel.querySelector('p'),guests=panel.querySelector('[data-blessing-guests]'),shadows=panel.querySelectorAll('.blessing-shadow');
 const focusButton=panel.querySelector('[data-blessing-focus]');
 const title=panel.querySelector('h2'),step=panel.querySelector('.earth-scene-step');
 let seen=null,pending=false,elapsed=null,phase=null,stopCue,city,outcome=null;
 function silence(){stopCue?.();stopCue=null;}
 function skip(){silence();elapsed=null;phase=null;city=null;outcome=null;panel.hidden=true;}
 panel.querySelector('button').onclick=skip;
 const courtyard=s=>s?.buildings?.find(building=>blessingCupAt(s,building));
 focusButton.onclick=()=>{
  if(panel.hidden)return;
  const home=courtyard(city);
  if(home)focus?.(home);
 };
 return {
  get active(){return elapsed!==null;},
  skip,
  cast(s,result){
   skip();city=s;outcome=result;elapsed=0;
   panel.dataset.kind='cast';panel.dataset.phase='light';
   panel.setAttribute('aria-label','Сцена применения Благословения');
   step.textContent='Дар применён';title.textContent='Благословение';
   caption.textContent=`Довольство +${Math.round(result.happiness)} · Новых жителей · ${result.newResidents}`;
   guests.hidden=true;
   shadows.forEach(shadow=>shadow.setAttribute('hidden',''));
   stopCue=cue?.('blessing');
  },
  reset(s){skip();seen=s.blessingDiscovery?.qualifiedAt??null;pending=s.blessingDiscovery?.openingPending===true;},
  tick(s,dt,{visible=true,allowOpening=true}={}){
   const qualified=s.blessingDiscovery?.qualifiedAt??null;
   if(qualified!==null&&qualified!==seen){seen=qualified;pending=true;}
   if(!visible||!outcome&&!allowOpening){panel.hidden=true;silence();return;}
   if(elapsed===null&&pending){
    elapsed=0;pending=false;panel.dataset.kind='opening';
    panel.setAttribute('aria-label','Сцена открытия Благословения');
    step.textContent='Открытие дара';title.textContent='Одно место за столом';onOpening?.(s);
   }
   if(elapsed===null)return;
   if(elapsed>=(outcome?7000:28000)){skip();return;}
   panel.hidden=false;city=s;
   if(outcome){
    focusButton.hidden=!focus||!courtyard(s);
    elapsed+=dt;
    return;
   }
   const next=phases.findLast(item=>item.at<=elapsed);
   if(next!==phase){
    phase=next;
    panel.dataset.phase=phase.id;caption.textContent=phase.caption;
    silence();if(phase.cue)stopCue=cue?.(phase.cue);
   }
   const home=courtyard(s);
   focusButton.hidden=!focus||!home;
   const present=home&&phase.id!=='mat'?s.citizens.filter(c=>c.home===s.blessingDiscovery.cup.home&&
    Math.hypot(c.x-home.x,c.y-home.y)<=1.4&&freeCeremonyGuest(c,s.simTime)).slice(0,shadows.length):[];
   const names=present.length?`Во дворе · ${present.map(c=>displayName(s,c)).join(', ')}`:'';
   if(guests.textContent!==names)guests.textContent=names;
   guests.hidden=!names;
   shadows.forEach((shadow,i)=>shadow.toggleAttribute('hidden',!present[i]));
   elapsed+=dt;
  }
 };
}
