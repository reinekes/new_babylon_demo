import {displayName} from './citizen-epithets.js';
import {citizenName} from './definitions.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const idOf=value=>typeof value==='object'&&value!==null?value.id:value;
export function residentTarget(s,value){
 const id=idOf(value);if(!Number.isSafeInteger(id)||id<0)return null;
 const living=s.citizens?.find(c=>c.id===id);if(living)return {id,living:true,person:living};
 const archived=s.lifeAnalytics?.people?.find(c=>c.id===id);return archived?{id,living:false,person:archived}:null;
}
/** Identity is always carried by an ID; names and old epithets are labels only. */
export function residentLinkHTML(s,value,{label}={}){
 const target=residentTarget(s,value),id=idOf(value),name=label??(target?displayName(s,value):Number.isSafeInteger(id)?`Житель #${id}`:displayName(s,value));
 return target?`<button type="button" class="resident-link" data-resident-id="${target.id}" title="Открыть карточку жителя">${esc(name)}</button>`:`<span class="resident-unknown">${esc(name)}</span>`;
}
/** Plain chronicle text keeps the name used at the time of the event. Only an
 * unambiguous known identity may be linked; lost ancestors are never invented. */
export function residentTextRenderer(s){
 const aliases=new Map(),people=new Map([...(s.lifeAnalytics?.people||[]),...(s.citizens||[])].map(c=>[c.id,c]));
 for(const c of people.values())for(const name of new Set([displayName(s,c),c.birthName,c.baseName,c.name,citizenName(c.id)].filter(Boolean))){
  if(!aliases.has(name))aliases.set(name,c.id);else if(aliases.get(name)!==c.id)aliases.set(name,null);
 }
 const names=[...aliases.keys()].sort((a,b)=>b.length-a.length);if(!names.length)return text=>esc(text);
 const pattern=new RegExp(`(?<![\\p{L}\\p{N}])(?:${names.map(name=>name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})(?![\\p{L}\\p{N}]|[ \\u00a0]+\\d)`,'gu');
 return text=>{const source=String(text??'');let html='',at=0;for(const match of source.matchAll(pattern)){html+=esc(source.slice(at,match.index));const id=aliases.get(match[0]);html+=id===null?esc(match[0]):residentLinkHTML(s,id,{label:match[0]});at=match.index+match[0].length;}return html+esc(source.slice(at));};
}
export const residentTextHTML=(s,text)=>residentTextRenderer(s)(text);
/** One delegated handler also covers frequently refreshed supply/detail nodes. */
export function bindResidentLinks(root,{getState,onLiving,onArchived}){
 root.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-resident-id]');if(!button||!root.contains(button))return;
  const raw=button.dataset.residentId;if(!/^\d+$/.test(raw))return;
  const target=residentTarget(getState(),Number(raw));if(!target)return;
  event.preventDefault();if(target.living)onLiving?.(target.person);else onArchived?.(target.id);
 });
}
