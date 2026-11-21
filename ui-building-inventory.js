import {RESOURCE_NAMES} from './definitions.js';
import {resourceIcon} from './resource-icons.js';
import {RESOURCE_GROUPS} from './season-balance.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatter=new Intl.NumberFormat('ru',{maximumFractionDigits:1});
const quantity=n=>formatter.format(Number.isFinite(n)?Math.max(0,n):0);
const name=key=>({water:'вода',crop:'урожай на поле',sheaves:'снопы'}[key]||RESOURCE_NAMES[key]||key);
const positive=values=>Object.fromEntries(Object.entries(values||{}).filter(([,n])=>n>0));
const resourceOrder=new Map([...RESOURCE_GROUPS.flatMap(g=>g.keys),'water','sheaves','crop'].map((key,index)=>[key,index]));

const storeChains=[
 ['Еда и напитки',['food','milk','beer']],
 ['Глина и керамика',['clay','brick','firedBrick','pottery']],
 ['Плетение',['reed','basket','mat']],
 ['Ткани и шкуры',['flax','wool','cloth','clothing','hides']],
 ['Дерево и камень',['wood','timber','joinery','stone']],
 ['Медь и орудия',['copper','blade','chisel','axe']]
];
const stockFormatter=new Intl.NumberFormat('ru',{maximumFractionDigits:2,roundingMode:'trunc'});

/** A compact ledger of the goods physically held at one store. */
export function storeStockSummaryHTML(stock={}){
 const groups=[];
 for(const [title,keys] of storeChains){
  const items=[];
  for(const key of keys){
   const amount=stock?.[key];
   if(!Number.isFinite(amount)||amount<=0)continue;
   const fullName=RESOURCE_NAMES[key];
   const label=fullName[0].toUpperCase()+fullName.slice(1);
   const count=amount<.01?'&lt;0,01':stockFormatter.format(amount);
   items.push(`<div class="store-stock-item" data-stock-resource="${key}"><dt>${label}</dt><dd>${resourceIcon(key,{decorative:true})}<b>${count}</b></dd></div>`);
  }
  if(items.length)groups.push(`<div class="store-stock-group"><span class="store-stock-group-name" aria-hidden="true">${title}</span><dl class="store-stock-grid" aria-label="${title}">${items.join('')}</dl></div>`);
 }
 return `<section class="store-stock-summary" data-store-stock-summary aria-label="Запасы"><h4 class="store-stock-heading">Запасы</h4>${groups.join('')||'<span class="store-stock-empty">Пусто</span>'}</section>`;
}

function resources(values,capacities={}){
 return Object.entries(values||{}).sort(([a],[b])=>(resourceOrder.get(a)??999)-(resourceOrder.get(b)??999)||a.localeCompare(b)).map(([key,amount])=>{const cap=capacities?.[key],label=`${name(key)}: ${quantity(amount)}${cap>0?` из ${quantity(cap)}`:''}`;return `<span class="building-inventory-item" tabindex="0" title="${escape(name(key))}" aria-label="${escape(label)}" data-stock-label="${escape(name(key))}" data-stock-resource="${escape(key)}">${resourceIcon(['crop','sheaves'].includes(key)?'grain':key)}<span class="building-inventory-quantity"><b>${quantity(amount)}</b>${cap>0?`<small>/ ${quantity(cap)}</small>`:''}</span></span>`;}).join('');
}
function group(title,values,capacities,kind,{showEmpty=false}={}){
 if(!showEmpty&&!Object.keys(values||{}).length)return '';
 return `<section class="building-inventory-group" data-stock-group="${kind}"><h4>${title}</h4><div class="building-inventory-resources">${resources(values,capacities)||'<span class="building-inventory-empty">Пусто</span>'}</div></section>`;
}

/** A view of physically separate buffers. It never creates or moves stock. */
export function buildingInventoryHTML(inventory,{house=false,production=false,compactStorage=false,includeStorage=true,transitLabels={}}={}){
 if(!inventory)return '';
 const capacity=inventory.capacities||{};
 const storage=includeStorage?group('Склад',compactStorage?positive(inventory.storage):inventory.storage,capacity.storage,'storage'):'';
 const sections=[
  storage,
  group(house?'Домашние припасы':'Сырьё',inventory.input,capacity.input,'input',{showEmpty:house}),
  group('В работе',inventory.inProcess,null,'in-process'),
  group('Готовая продукция',inventory.output,capacity.output,'output',{showEmpty:production}),
  group(transitLabels.input||'Сырьё в пути',positive(inventory.inTransit?.input),null,'input-transit'),
  group(transitLabels.output||'Готовое в пути',positive(inventory.inTransit?.output),null,'output-transit')
 ].join('');
 return sections||includeStorage?`<div class="building-inventory" aria-label="Местные запасы">${sections}</div>`:'';
}
