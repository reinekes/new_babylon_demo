import {blessingCupAt} from './blessing-discovery.js';
import {displayName} from './citizen-epithets.js';
import {freeCeremonyGuest} from './miracle-celebration.js';
import {navigationSegmentClear} from './navigation.js';
import {floodedSegment} from './river-flood.js';

const noApproach=[];
export function planBlessingApproach(s,home,network){
 const port=network.ports.find(row=>row.building===home);
 if(!port)return noApproach;
 const dx=port.x-home.x,dy=port.y-home.y;
 const norm=Math.hypot(dx,dy);
 if(!norm)return noApproach;
 const clear=(a,b)=>navigationSegmentClear(s,a,b,network.navigation?.obstacles)&&
  (!network.navigation?.flooded||!floodedSegment(network.navigation.flooded,a,b));
 const places=[-.34,.34,.65].map(offset=>({x:port.x-dy/norm*offset,y:port.y+dx/norm*offset}));
 const routes=[];
 for(const c of s.citizens){
  if(c.home!==s.blessingDiscovery.cup.home||!freeCeremonyGuest(c,s.simTime)||Math.hypot(c.x-home.x,c.y-home.y)>1.4)continue;
  const from=Math.hypot(c.x-home.x,c.y-home.y)<.2?{x:port.x,y:port.y}:{x:c.x,y:c.y};
  const i=places.findIndex(to=>Math.hypot(from.x-to.x,from.y-to.y)>.1&&clear(from,to));
  if(i<0)continue;
  const [to]=places.splice(i,1);
  routes.push({id:c.id,from,to,originX:c.x,originY:c.y});
  if(!places.length)break;
 }
 return routes;
}

export function showBlessingApproach(people,s,approach){
 if(!approach?.length||s.funeral||s.miracleCelebration||s.festival||s.event)return people;
 const actors=[];
 for(const sample of approach){
  const c=s.citizens.find(person=>person.id===sample.id);
  if(!c||!freeCeremonyGuest(c,s.simTime)||people.some(person=>person.id===sample.id))continue;
  actors.push({...c,...sample,kind:'person',phase:'blessingGuest',miracleContact:sample});
 }
 return actors.length?[...people,...actors]:people;
}

const phases=[
 {at:0,id:'mat',caption:'Соседи расстилают циновку. Одно место оставляют свободным.'},
 {at:7000,id:'cup',caption:'К свободному месту пододвигают чашу.',cue:'sheaf'},
 {at:15000,id:'light',caption:'Край циновки шевелится, и свет ложится на пустое место.',cue:'breath'},
 {at:22000,id:'neighbors',caption:'Соседи вспоминают тех, кто помог в трудный день. Дар открыт.',cue:'bow'}
];

export function createBlessingPresentation(root,{cue,focus,onOpening,approachNetwork}={}){
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
 let seen=null,pending=false,elapsed=null,phase=null,stopCue,city,outcome=null,routes=noApproach,approach=noApproach,plannedNetwork,lastRouteCheck=-500,approachStarted=0;
 function silence(){stopCue?.();stopCue=null;}
 function skip(){silence();elapsed=null;phase=null;city=null;outcome=null;routes=approach=noApproach;plannedNetwork=null;panel.hidden=true;}
 panel.querySelector('button').onclick=skip;
 const courtyard=s=>s?.buildings?.find(building=>blessingCupAt(s,building));
 focusButton.onclick=()=>{
  if(panel.hidden)return;
  const home=courtyard(city);
  if(home)focus?.(home);
 };
 return {
  get active(){return elapsed!==null;},
  get approach(){return approach;},
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
   if(!visible||!outcome&&!allowOpening){panel.hidden=true;approach=noApproach;silence();return;}
   if(elapsed===null&&pending){
    elapsed=0;pending=false;panel.dataset.kind='opening';
    panel.setAttribute('aria-label','Сцена открытия Благословения');
    step.textContent='Открытие дара';title.textContent='Одно место за столом';
    lastRouteCheck=-500;
    onOpening?.(s);
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
   if(home&&approachNetwork&&(routes.length||elapsed<17500)&&elapsed-lastRouteCheck>=500){
    lastRouteCheck=elapsed;
    const network=approachNetwork(s);
    if(network!==plannedNetwork)routes=noApproach;
    if(!routes.length&&elapsed<17500){
     routes=planBlessingApproach(s,home,network);
     approachStarted=elapsed;
    }
    plannedNetwork=network;
   }
   if(routes.length){
    routes=home?routes.filter(route=>{
     const c=s.citizens.find(person=>person.id===route.id);
     return c?.home===s.blessingDiscovery.cup.home&&freeCeremonyGuest(c,s.simTime)&&c.x===route.originX&&c.y===route.originY;
    }):noApproach;
    const progress=Math.min(1,(elapsed-approachStarted)/4500,(28000-elapsed)/5500),returning=elapsed>22500;
    approach=routes.map(({id,from,to})=>({id,x:from.x+(to.x-from.x)*progress,y:from.y+(to.y-from.y)*progress,
     yaw:Math.atan2(to.x-from.x,to.y-from.y)+(returning?Math.PI:0),step:elapsed/100,walking:progress<1}));
   }else approach=noApproach;
   const present=home&&phase.id!=='mat'?s.citizens.filter(c=>c.home===s.blessingDiscovery.cup.home&&
    Math.hypot(c.x-home.x,c.y-home.y)<=1.4&&freeCeremonyGuest(c,s.simTime)&&(!approachNetwork||routes.some(route=>route.id===c.id))).slice(0,shadows.length):[];
   const names=present.length?`Во дворе · ${present.map(c=>displayName(s,c)).join(', ')}`:'';
   if(guests.textContent!==names)guests.textContent=names;
   guests.hidden=!names;
   shadows.forEach((shadow,i)=>shadow.toggleAttribute('hidden',!present[i]));
   elapsed+=dt;
  }
 };
}
