const phases=[
 {at:0,id:'mat',caption:'Соседи расстилают циновку. Одно место оставляют свободным.'},
 {at:7000,id:'cup',caption:'К свободному месту пододвигают чашу.',cue:'sheaf'},
 {at:15000,id:'light',caption:'Край циновки шевелится, и свет ложится на пустое место.',cue:'breath'},
 {at:22000,id:'neighbors',caption:'Соседи вспоминают тех, кто помог в трудный день. Дар открыт.',cue:'bow'}
];

export function createBlessingPresentation(root,{cue}={}){
 const panel=root.ownerDocument.createElement('section');
 panel.className='earth-scene blessing-scene';
 panel.hidden=true;
 panel.dataset.kind='opening';
 panel.setAttribute('aria-label','Сцена открытия Благословения');
 panel.innerHTML=`<div class="earth-scene-card blessing-scene-card">
  <svg viewBox="0 0 120 80" aria-hidden="true">
   <path class="blessing-light" d="M30 6h59l16 56H15Z"/>
   <path class="blessing-mat" d="M27 37h66l16 30H11Zm-9 23h84M22 52h76M26 44h68m-63-7-11 30m23-30-7 30m17-30-2 30m14-30 2 30m10-30 7 30m5-30 11 30"/>
   <path class="blessing-bowls" d="M29 44h18q-2 11-9 11t-9-11Zm44 0h18q-2 11-9 11t-9-11Z"/>
   <path class="blessing-cup" d="M50 52h20q-2 12-10 12t-10-12Z"/>
  </svg>
  <div><small class="earth-scene-step">Открытие дара</small><h2>Одно место за столом</h2><p role="status"></p></div>
  <button type="button">Пропустить</button>
 </div>`;
 root.append(panel);
 const caption=panel.querySelector('p');
 let seen=null,pending=false,elapsed=null,phase=null,stopCue;
 function silence(){stopCue?.();stopCue=null;}
 function skip(){silence();elapsed=null;phase=null;panel.hidden=true;}
 panel.querySelector('button').onclick=skip;
 return {
  get active(){return elapsed!==null;},
  skip,
  reset(s){skip();seen=s.blessingDiscovery?.qualifiedAt??null;pending=false;},
  tick(s,dt,{visible=true,allowOpening=true}={}){
   const qualified=s.blessingDiscovery?.qualifiedAt??null;
   if(qualified!==null&&qualified!==seen){seen=qualified;pending=true;}
   if(!visible||!allowOpening){panel.hidden=true;silence();return;}
   if(elapsed===null&&pending){elapsed=0;pending=false;}
   if(elapsed===null)return;
   if(elapsed>=28000){skip();return;}
   panel.hidden=false;
   const next=phases.findLast(item=>item.at<=elapsed);
   if(next!==phase){
    phase=next;
    panel.dataset.phase=phase.id;caption.textContent=phase.caption;
    silence();if(phase.cue)stopCue=cue?.(phase.cue);
   }
   elapsed+=dt;
  }
 };
}
