import {MATERIALS} from './definitions.js';
import {RESOURCE_GROUPS} from './season-balance.js';
import {isStrictSumer} from './scenario-profiles.js';
import {resourceLabel} from './resource-display.js';
import {resourceIcon} from './resource-icons.js';
import {setHTML} from './ui-render.js';

const strictOnly=new Set(['flax','basket','mat','copper','axe','blade','chisel','timber','joinery']);
const pinned=new Set(['food','clay','reed','wood','stone','brick','cloth','clothing','pottery','beer','faith','prestige']);
const widePinned=new Set(['hides','wool','flax','copper','timber','firedBrick','milk','basket']);
const amount=new Intl.NumberFormat('ru',{maximumFractionDigits:1});
const signed=value=>Math.abs(value)<.05?'0':(value>0?'+':'−')+amount.format(Math.abs(value));
const forecastNote='Оценка учитывает работников, местные запасы, дороги, питание, посев и износ одежды. Торговля, стройки и чудеса в расчёт не входят.';

export function createResourceBar(root){
 const document=root.ownerDocument,window=document.defaultView,bar=root.closest('.resourcebar');
 const help=document.createElement('button'),panel=document.createElement('aside');
 help.type='button';help.className='resource-help';help.textContent='?';
 help.setAttribute('aria-label','Справка о ресурсах');help.setAttribute('aria-controls','resource-info');
 help.setAttribute('aria-expanded','false');
 panel.id='resource-info';panel.className='resource-info';panel.hidden=true;
 document.body.append(panel);bar.append(help);
 let model,key=null,locked=false;
 const buttonFor=id=>id==='help'?help:root.querySelector(`[data-resource="${id}"]`);
 function close(){
  if(key)buttonFor(key)?.setAttribute('aria-expanded','false');
  panel.hidden=true;key=null;locked=false;
 }
 function show(id,pin=false){
  const anchor=buttonFor(id);
  if(!anchor?.getClientRects().length){close();return;}
  if(key&&key!==id)buttonFor(key)?.setAttribute('aria-expanded','false');
  key=id;locked=pin;anchor.setAttribute('aria-expanded','true');
  if(id==='help'){
   setHTML(panel,`<h3>Ресурсы города</h3><p>Значок и число показывают текущий запас. Выбери ресурс, чтобы закрепить прогноз.</p><dl>${RESOURCE_GROUPS.map(({name},i)=>`<div><dt>${name}</dt><dd>${['Сырьё и еда','Изделия мастерских','Вера и престиж'][i]}</dd></div>`).join('')}</dl><p>Кнопка «…» открывает полный список.</p>`);
  }else{
   const {resources,balance,seeds}=model,v=balance[id];
   setHTML(panel,`<h3>${resourceIcon(id,{decorative:true})} ${resourceLabel(id)}</h3><dl><div><dt>Текущий запас</dt><dd>${amount.format(resources[id])}</dd></div>${id==='food'?`<div><dt>Запас на посев</dt><dd>${amount.format(seeds)}</dd></div>`:''}</dl><h4>Прогноз на сезон</h4><dl><div><dt>Поступит</dt><dd>≈ ${amount.format(v.income)}</dd></div><div><dt>Расход</dt><dd>≈ ${amount.format(v.outgo)}</dd></div><div><dt>Баланс</dt><dd>${signed(v.net)}</dd></div></dl><p>${forecastNote}</p>`);
  }
  panel.hidden=false;
  const rect=anchor.getBoundingClientRect();
  panel.style.left=`${Math.max(8,Math.min(rect.left,window.innerWidth-panel.offsetWidth-8))}px`;
  const below=rect.bottom+7;
  panel.style.top=`${below+panel.offsetHeight<=window.innerHeight-8?below:Math.max(8,rect.top-panel.offsetHeight-7)}px`;
 }
 root.addEventListener('pointerover',event=>{
  const anchor=event.target.closest('[data-resource]');
  if(event.pointerType!=='touch'&&!locked&&anchor&&key!==anchor.dataset.resource)show(anchor.dataset.resource);
 });
 root.addEventListener('pointerout',event=>{
  const anchor=event.target.closest('[data-resource]');
  if(!locked&&anchor&&!anchor.contains(event.relatedTarget)&&document.activeElement!==anchor)close();
 });
 root.addEventListener('focusin',event=>{if(event.target.dataset.resource&&!locked)show(event.target.dataset.resource);});
 root.addEventListener('focusout',()=>{if(!locked)close();});
 bar.addEventListener('click',event=>{
  const id=event.target.closest('[data-resource]')?.dataset.resource||(help.contains(event.target)?'help':null);
  if(id){if(locked&&key===id)close();else show(id,true);}
  else close();
 });
 document.addEventListener('pointerdown',event=>{if(key&&!bar.contains(event.target)&&!panel.contains(event.target))close();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&key){close();event.preventDefault();event.stopPropagation();}},true);
 window.addEventListener('resize',close);
 root.addEventListener('scroll',close);
 return {render(state,balance,capacity,seeds){
  const {resources}=state;
  model={resources,balance,seeds};
  setHTML(root,'<header class="resource-ledger-title"><h2>Запасы города</h2><p>Текущий запас · баланс за сезон</p></header>'+RESOURCE_GROUPS.map(group=>`<section class="resource-frame resource-frame-${group.id}" aria-label="${group.name}"><span class="resource-group-label">${group.name}</span><div class="resource-group-items">${group.keys.filter(id=>!strictOnly.has(id)||isStrictSumer(state)).map(id=>
   `<button type="button" class="resource${pinned.has(id)?' resource-pinned':widePinned.has(id)?' resource-wide':''}" data-resource="${id}" aria-controls="resource-info" aria-expanded="false"><span class="resource-icon" aria-hidden="true">${resourceIcon(id,{decorative:true})}</span><span class="resource-value"><strong></strong><em class="season-delta"></em></span><small>${resourceLabel(id)}</small></button>`
  ).join('')}</div></section>`).join(''));
  for(const button of root.querySelectorAll('[data-resource]')){
   const id=button.dataset.resource,count=String(Math.floor(resources[id])),delta=signed(balance[id].net);
   const value=button.querySelector('strong'),trend=button.querySelector('em');
   if(value.textContent!==count){
    value.textContent=count;
   }
   value.classList.toggle('overflow',MATERIALS.includes(id)&&resources[id]>capacity);
   const displayDelta=delta==='0'?'—':delta;
   if(trend.textContent!==displayDelta)trend.textContent=displayDelta;
   button.setAttribute('aria-label',`${resourceLabel(id)} · запас ${count} · баланс за сезон ${delta}`);
   trend.className=`season-delta ${balance[id].net>.05?'surplus':balance[id].net<-.05?'deficit':'balanced'}`;
  }
  if(key)show(key,locked);
 }};
}
