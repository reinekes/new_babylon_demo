import {ABUNDANCE_HOMES} from './abundance-discovery.js';
import {buildingKey,isOperational} from './definitions.js';

const timeline={
 opening:[[0,'first'],[5,'second'],[10,'third'],[15,'measure'],[21,'grains'],[26,null]],
 cast:[[0,'empty'],[2,'fill'],[6,'accepted'],[7.5,'grain'],[9,null]]
};
const captions={
 first:'Первый дом получил свою долю зерна.',
 second:'Еда дошла до второго дома. Семена остались в резерве.',
 third:'Третья семья приняла свою долю.',
 measure:'Хранитель показывает опустевшую меру для раздачи.',
 grains:'Последние зёрна на миг складываются в рисунок чаши.',
 empty:'У выбранного хранилища стоит пустая корзина.',
 fill:'В тишине слышно, как сыплется зерно.',
 grain:'Одно зерно скатывается с края. Хранитель поднимает его.'
};
const ready=s=>s.abundanceDiscovery?.homes.length===ABUNDANCE_HOMES;
export const abundanceSceneFrame=(kind,seconds)=>timeline[kind]?.findLast(([at])=>seconds>=at)?.[1]??null;

export function createAbundancePresentation(root,{focus,cue}={}){
 const doc=root.ownerDocument,panel=doc.createElement('section');
 panel.className='abundance-scene';panel.hidden=true;panel.setAttribute('aria-label','Сцена Изобилия');
 panel.innerHTML=`<div class="earth-scene-card abundance-scene-card">
  <svg viewBox="0 0 126 86" aria-hidden="true">
   <path class="abundance-basket" d="M20 34Q63 24 106 34L94 72Q63 82 32 72Zm3 8q40 10 80 0M26 53q37 11 74 0M29 63q34 10 68 0M40 40l6 35m8-33 2 35m15-35-2 35m16-37-6 35"/>
   <path class="abundance-fill" d="M20 34q15-8 31-6 12-10 28-3 12 0 27 9-42 16-86 0Z"/>
   <path class="abundance-grains" d="M39 23q4-4 7 0-4 5-7 0Zm15-9q4-4 7 0-4 5-7 0Zm18 0q4-4 7 0-4 5-7 0Zm14 8q4-4 7 0-4 5-7 0Z"/>
   <path class="abundance-single" d="M96 34q5-4 8 0-4 6-8 0Z"/>
  </svg><div><small class="earth-scene-step"></small><h2></h2><p role="status"></p></div><button type="button">Пропустить</button></div>`;
 root.append(panel);
 const title=panel.querySelector('h2'),step=panel.querySelector('small'),caption=panel.querySelector('p');
 let seen=false,pending=false,active=null,stopCue=null;
 const silence=()=>{stopCue?.();stopCue=null;};
 function skip(){silence();active=null;panel.hidden=true;caption.textContent='';}
 panel.querySelector('button').addEventListener('click',skip);
 function start(kind,s){
  skip();
  active={kind,homes:[...s.abundanceDiscovery?.homes||[]],receipt:s.abundanceGift?.last,seconds:0,phase:null};
  panel.dataset.kind=kind;
  title.textContent=kind==='opening'?'Последняя пригоршня':'Изобилие';
  step.textContent=kind==='opening'?'Открытие дара':'Применение';
 }
 function paint(s){
  const phase=abundanceSceneFrame(active.kind,active.seconds);
  if(!phase){skip();return;}
  panel.hidden=false;
  if(active.phase===phase)return;
  active.phase=phase;panel.dataset.phase=phase;
  const home=active.homes[['first','second','third'].indexOf(phase)];
  const key=phase==='empty'?active.receipt.store:home;
  const point=key&&s.buildings.find(b=>buildingKey(b)===key&&isOperational(b));
  if(point&&!doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)focus?.(point);
  const amount=active.receipt?.amount.toLocaleString('ru-RU',{maximumFractionDigits:2});
  caption.textContent=phase==='accepted'?`Хранилище приняло ${amount} еды.`:captions[phase];
  silence();
  if(['grains','fill','grain'].includes(phase))stopCue=cue?.(phase);
 }
 return {
  reset(s){skip();seen=ready(s);pending=false;},
  cast(s){if(s.abundanceGift?.last)start('cast',s);},
  tick(s,dt,{allowOpening=true,visible=true}={}){
   if(!seen&&ready(s)){seen=true;pending=true;}
   if(!visible||active?.kind==='opening'&&!allowOpening){panel.hidden=true;silence();return;}
   if(!active&&pending&&allowOpening){start('opening',s);pending=false;}
   if(active){paint(s);if(active)active.seconds+=dt/1000;}
  },
  get active(){return !!active;},
  skip
 };
}
