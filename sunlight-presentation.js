import {buildingKey,isOperational} from './definitions.js';
import {isMemoryKeeper,isVotiveTemple,templeOfferings} from './votive-offerings.js';
import {sunlightKnowledgeReason} from './sunlight-gathering.js';

const timelines={
 opening:[[0,'meal'],[6,'clean'],[13,'beam'],[20,'witness'],[27,'threshold'],[32,null]],
 cast:[[0,'beam'],[3,'cloud'],[5,'reflection'],[8,null]]
};
const captions={
 meal:'Общая трапеза закончилась. Люди расходятся по домам.',
 clean:'Жрец остаётся убрать святилище. Снаружи гаснет дневной свет.',
 beam:'Узкая полоса света раскрывается на глиняной стене.',
 witness:'Жрец зовёт одного свидетеля. Свет следует за их руками.',
 threshold:'Уходящий свидетель на миг видит тот же свет у порога своего дома.',
 cloud:'Облако проходит. Полоса остаётся.',
 reflection:'Стена и сосуды отражают тёплый свет.'
};
const ready=s=>s.sunlightChapter===1&&!!(s.sunlightFeast||s.sunlightMeal)&&!sunlightKnowledgeReason(s);

function serviceTemple(s,working=false){
 let temple;
 for(const c of s.citizens){
  if(!c.workplace||!isMemoryKeeper(c,c.workplace)||working&&(c.phase!=='working'||c.work!==c.workplace))continue;
  const b=s.buildings.find(b=>isVotiveTemple(b)&&buildingKey(b)===c.workplace);
  if(b&&c.workplace===s.sunlightService?.temple)return b;
  temple??=b;
 }
 return temple;
}

export function sunlightVessel(s,temple){
 if(!temple)return;
 const witness=s.godhood?.witnessId;
 return templeOfferings(s,buildingKey(temple))
  .filter(v=>Number.isFinite(v.receivedTick))
  .sort((a,b)=>Number(witness!=null&&b.donorId===witness)-Number(witness!=null&&a.donorId===witness)||
   a.receivedTick-b.receivedTick||a.id-b.id)[0];
}

export function createSunlightPresentation(root,{focus,project,cue}={}){
 const doc=root.ownerDocument,panel=doc.createElement('section'),glow=doc.createElement('div');
 panel.className='sunlight-scene';panel.hidden=true;panel.setAttribute('aria-label','Сцена Золотого сияния');
 glow.className='sunlight-glow';glow.hidden=true;glow.setAttribute('aria-hidden','true');
 panel.innerHTML=`<div class="earth-scene-card sunlight-scene-card">
  <svg viewBox="0 0 126 86" aria-hidden="true">
   <path class="sunlight-wall" d="M7 76V18h112v58ZM7 31h112M7 45h112M7 61h112M29 18v13m52-13v13M46 31v14m50-14v14M23 45v16m55-16v16M40 61v15m57-15v15"/>
   <path class="sunlight-beam" d="m14 32 97 14-2 13L14 39Z"/>
   <path class="sunlight-vessel" d="M51 60q12 3 24 0l-4 9q-8 5-16 0Z"/>
   <path class="sunlight-threshold" d="M44 76V35h38v41M50 76V41h26v35M44 76h38"/>
   <path class="sunlight-hands" d="m18 67 22-13 10-1 5 4-11 3-17 15m80-22-18 8-10-1-3-5 12-2 14-7"/>
   <path class="sunlight-reflection" d="M55 62q8 2 16 0"/>
  </svg><div><small class="earth-scene-step"></small><h2></h2><p role="status"></p></div><button type="button">Пропустить</button></div>`;
 root.append(glow,panel);
 const caption=panel.querySelector('p'),title=panel.querySelector('h2'),step=panel.querySelector('small');
 let active=null,seen=false,pending=false,stopCue;
 const silence=()=>{stopCue?.();stopCue=null;};
 function skip(){silence();active=null;panel.hidden=true;caption.textContent='';}
 panel.querySelector('button').addEventListener('click',skip);
 function start(kind,s,temple){
  skip();
  const vessel=sunlightVessel(s,temple);
  const gathering=[s.sunlightFeast,s.sunlightMeal].filter(Boolean).sort((a,b)=>a.at-b.at)[0];
  active={kind,temple,gathering:gathering?.temple??gathering?.depot,vessel,seconds:0,phase:null};
  panel.dataset.kind=kind;panel.dataset.vessel=String(!!vessel);
  title.textContent=kind==='opening'?'Солнце внутри стены':'Золотое сияние';
  step.textContent=kind==='opening'?'Открытие дара':'Применение';
 }
 function paint(s){
  const phase=timelines[active.kind].findLast(([at])=>active.seconds>=at)?.[1];
  if(!phase){skip();return;}
  panel.hidden=false;
  if(phase===active.phase)return;
  active.phase=phase;panel.dataset.phase=phase;
  const point=phase==='meal'?s.buildings.find(b=>buildingKey(b)===active.gathering&&isOperational(b)):
   ['clean','beam'].includes(phase)&&s.buildings.includes(active.temple)?active.temple:null;
  if(point&&!(phase==='beam'&&active.kind==='opening')&&!doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)focus?.(point);
  caption.textContent=phase==='reflection'&&active.vessel?
   `Самый яркий отблеск — на посвящённом сосуде №${active.vessel.id}.`:
   phase==='reflection'?'Тёплый свет остаётся на стене.':captions[phase];
  silence();
  if(['beam','witness','reflection'].includes(phase))stopCue=cue?.(phase);
 }
 return {
  reset(s){skip();seen=ready(s);pending=false;glow.hidden=true;},
  cast(s){start('cast',s,serviceTemple(s));},
  tick(s,dt,{allowOpening=true,visible=true,glowVisible=visible}={}){
   const temple=glowVisible&&s.buffs?.sunlight>0&&serviceTemple(s,true);
   const p=temple&&project?.(temple);
   glow.hidden=!p;
   if(p)glow.style.transform=`translate(${p.x}px,${p.y}px) translate(-50%,-50%)`;
   if(!seen&&ready(s)){seen=true;pending=true;}
   if(!visible||active?.kind==='opening'&&!allowOpening){panel.hidden=true;silence();return;}
   if(!active&&pending&&allowOpening){start('opening',s,serviceTemple(s));pending=false;}
   if(active){paint(s);if(active)active.seconds+=dt/1000;}
  },
  skip
 };
}
