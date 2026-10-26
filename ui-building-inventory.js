import {RESOURCE_NAMES} from './definitions.js';
import {resourceIcon} from './resource-icons.js';
import {RESOURCE_GROUPS} from './season-balance.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatter=new Intl.NumberFormat('ru',{maximumFractionDigits:1});
const quantity=n=>formatter.format(Number.isFinite(n)?Math.max(0,n):0);
const name=key=>({water:'вода',crop:'урожай на поле',sheaves:'снопы'}[key]||RESOURCE_NAMES[key]||key);
const positive=values=>Object.fromEntries(Object.entries(values||{}).filter(([,n])=>n>0));
const resourceOrder=new Map([...RESOURCE_GROUPS.flatMap(g=>g.keys),'water','sheaves','crop'].map((key,index)=>[key,index]));

function resources(values,capacities={}){
 return Object.entries(values||{}).sort(([a],[b])=>(resourceOrder.get(a)??999)-(resourceOrder.get(b)??999)||a.localeCompare(b)).map(([key,amount])=>{const cap=capacities?.[key],label=`${name(key)}: ${quantity(amount)}${cap>0?` из ${quantity(cap)}`:''}`;return `<span class="building-inventory-item" tabindex="0" title="${escape(name(key))}" aria-label="${escape(label)}" data-stock-label="${escape(name(key))}" data-stock-resource="${escape(key)}">${resourceIcon(['crop','sheaves'].includes(key)?'grain':key)}<span class="building-inventory-quantity"><b>${quantity(amount)}</b>${cap>0?`<small>/ ${quantity(cap)}</small>`:''}</span></span>`;}).join('');
}
function group(title,values,capacities,kind,{showEmpty=false}={}){
 if(!showEmpty&&!Object.keys(values||{}).length)return '';
 return `<section class="building-inventory-group" data-stock-group="${kind}"><h4>${title}</h4><div class="building-inventory-resources">${resources(values,capacities)||'<span class="building-inventory-empty">Пусто</span>'}</div></section>`;
}

/** A view of physically separate buffers. It never creates or moves stock. */
export function buildingInventoryHTML(inventory,{house=false,production=false,transitLabels={}}={}){
 if(!inventory)return '';
 const capacity=inventory.capacities||{};
 return `<div class="building-inventory" aria-label="Местные запасы">${group('Склад',inventory.storage,capacity.storage,'storage')}${group(house?'Домашние припасы':'Сырьё',inventory.input,capacity.input,'input',{showEmpty:house})}${group('В работе',inventory.inProcess,null,'in-process')}${group('Готовая продукция',inventory.output,capacity.output,'output',{showEmpty:production})}${group(transitLabels.input||'Сырьё в пути',positive(inventory.inTransit?.input),null,'input-transit')}${group(transitLabels.output||'Готовое в пути',positive(inventory.inTransit?.output),null,'output-transit')}</div>`;
}
