import {RESOURCE_NAMES} from './definitions.js';
import {resourceIcon} from './resource-icons.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatter=new Intl.NumberFormat('ru',{maximumFractionDigits:1});
const quantity=n=>formatter.format(Number.isFinite(n)?Math.max(0,n):0);
const name=key=>({water:'вода',crop:'урожай на поле',sheaves:'снопы'}[key]||RESOURCE_NAMES[key]||key);

function resources(values,capacities={}){
 return Object.entries(values||{}).map(([key,amount])=>`<span class="building-inventory-item" title="${escape(name(key))}" data-stock-resource="${escape(key)}">${resourceIcon(['crop','sheaves'].includes(key)?'grain':key)}<span>${escape(name(key))}</span><b>${quantity(amount)}</b>${capacities?.[key]>0?`<small>/ ${quantity(capacities[key])}</small>`:''}</span>`).join('');
}
function group(title,values,capacities,kind,{showEmpty=false}={}){
 if(!showEmpty&&!Object.keys(values||{}).length)return '';
 return `<section class="building-inventory-group" data-stock-group="${kind}"><h4>${title}</h4><div class="building-inventory-resources">${resources(values,capacities)||'<span class="building-inventory-empty">Пусто</span>'}</div></section>`;
}

/** A view of physically separate buffers. It never creates or moves stock. */
export function buildingInventoryHTML(inventory,{house=false,production=false}={}){
 if(!inventory)return '';
 const capacity=inventory.capacities||{};
 return `<div class="building-inventory" aria-label="Местные запасы">${group('Склад',inventory.storage,capacity.storage,'storage')}${group(house?'Домашние припасы':'Сырьё',inventory.input,capacity.input,'input',{showEmpty:house})}${group('В работе',inventory.inProcess,null,'in-process')}${group('Готовая продукция',inventory.output,capacity.output,'output',{showEmpty:production})}${group('Сырьё в пути',inventory.inTransit?.input,null,'input-transit')}${group('Готовое в пути',inventory.inTransit?.output,null,'output-transit')}</div>`;
}
