export const PANEL_STORAGE_KEY='new-babylon:panels:v1';
export const panelDefaults=()=>({top:true,bottom:true,sides:true});
export function panelPreferences(raw){try{const value=typeof raw==='string'?JSON.parse(raw):raw;return Object.fromEntries(Object.keys(panelDefaults()).map(k=>[k,typeof value?.[k]==='boolean'?value[k]:true]));}catch{return panelDefaults();}}
export function panelHotkey(event,document){return event.key?.toLowerCase()==='h'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.repeat&&!document.querySelector('dialog[open]')&&!document.body.classList.contains('photo-mode')&&!event.target?.closest?.('input,select,textarea,[contenteditable="true"]');}
export function createPanelControls({document=globalThis.document,storage,onResize=()=>{}}={}){
 let prefs;try{prefs=panelPreferences((storage??=globalThis.localStorage).getItem(PANEL_STORAGE_KEY));}catch{prefs=panelDefaults();}
 const root=document.createElement('div');root.className='panel-controls';
 root.innerHTML='<button class="panels-toggle" aria-expanded="false" aria-controls="panel-options" title="Скрыть или вернуть панели · H">☷ <span>Панели</span></button><section id="panel-options" class="panel-options" aria-label="Вид карты" hidden><strong>Место для города</strong><label><input type="checkbox" data-panel="top"> Верхние панели</label><label><input type="checkbox" data-panel="sides"> Боковые панели</label><label><input type="checkbox" data-panel="bottom"> Нижние панели</label><button data-map-only>Только карта · H</button><button data-restore>Вернуть все панели</button><small>Время продолжает идти. H возвращает интерфейс.</small></section>';
 document.body.append(root);const toggle=root.querySelector('.panels-toggle'),options=root.querySelector('.panel-options');
 const setOpen=open=>{options.hidden=!open;toggle.setAttribute('aria-expanded',String(open));};
 function apply(){for(const [k,v]of Object.entries(prefs)){document.body.classList.toggle(`hide-${k}-panels`,!v);root.querySelector(`[data-panel="${k}"]`).checked=v;}const only=Object.values(prefs).every(v=>!v);document.body.classList.toggle('map-only',only);toggle.querySelector('span').textContent=only?'Вернуть панели':'Панели';try{storage.setItem(PANEL_STORAGE_KEY,JSON.stringify(prefs));}catch{}globalThis.requestAnimationFrame?.(onResize);}
 function all(value){prefs={top:value,bottom:value,sides:value};apply();}
 toggle.onclick=()=>{if(Object.values(prefs).every(v=>!v)){all(true);setOpen(false);}else setOpen(options.hidden);};
 for(const input of root.querySelectorAll('[data-panel]'))input.onchange=()=>{prefs[input.dataset.panel]=input.checked;apply();};
 root.querySelector('[data-map-only]').onclick=()=>{all(false);setOpen(false);toggle.focus();};root.querySelector('[data-restore]').onclick=()=>{all(true);setOpen(false);toggle.focus();};
 const keydown=e=>{if(e.key==='Escape'&&!options.hidden){setOpen(false);toggle.focus();return;}if(panelHotkey(e,document)){e.preventDefault();all(Object.values(prefs).every(v=>!v));setOpen(false);}};
 document.addEventListener('keydown',keydown);apply();return {get preferences(){return {...prefs};},dispose(){document.removeEventListener('keydown',keydown);root.remove();}};
}
