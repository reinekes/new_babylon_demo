import {MAX_SAVE_BYTES,parseSaveFile,saveMetadata} from './save-library.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const seasons=['Весна','Лето','Осень','Зима'];
const modes={awakening:'Пробуждение',mature:'Взрослый бог',legacy:'Прежний город'};
const facts=entry=>`Год ${esc(entry.year)} · ${seasons[entry.season]||'—'} · ${esc(entry.population)} жителей · ${esc(entry.buildings)} построек`;
const mapInfo=entry=>entry.generated?`Долина № ${esc(entry.seed)}`:'Первоначальная долина';
export function saveLibraryHTML({entries=[],current,tab='all',busy=false,message='',error='',confirmDelete=null,renameId=null}={}){
 const filtered=entries.filter(e=>tab==='all'||e.kind===tab);
 return `<div class="save-library"><header class="save-heading"><span class="eyebrow">ТВОИ ГОРОДА И ИСТОРИИ</span><h2>Сохранения</h2><button class="management-close" data-save-action="close" aria-label="Закрыть сохранения" ${busy?'disabled':''}>×</button></header>
 <p class="save-help">Хранятся в этом браузере. Для переноса на другой компьютер или защиты от очистки браузера скачай файл.</p>
 <section class="save-current"><h3>Текущий город</h3><p>${facts(current)}<br><small>${mapInfo(current)} · ${esc(modes[current.mode]||current.mode)}</small></p>
 <form data-save-form="create"><label>Название снимка<input name="save-name" maxlength="80" required value="Год ${esc(current.year)} · ${seasons[current.season]}" ${busy?'disabled':''}></label><button class="primary" ${busy?'disabled':''}>Сохранить снимок</button></form>
 <div class="save-actions"><button data-save-action="export-current" ${busy?'disabled':''}>Скачать текущий город</button><label class="save-import">Импорт из файла<input type="file" accept=".json,application/json" data-save-import ${busy?'disabled':''}></label><button data-save-action="new" ${busy?'disabled':''}>Новая игра</button></div>
 <small>Автосохранение работает отдельно. Перед загрузкой другого города или новой игрой этот город попадёт в архив.</small></section>
 <div class="save-tabs" role="tablist" aria-label="Тип сохранений">${[['all','Все'],['manual','Снимки'],['archive','Архивы']].map(([id,label])=>`<button role="tab" aria-selected="${tab===id}" data-save-tab="${id}" ${busy?'disabled':''}>${label} · ${id==='all'?entries.length:entries.filter(e=>e.kind===id).length}</button>`).join('')}</div>
 <p class="save-status" role="status">${esc(busy?'Подожди, работаем с сохранением…':message)}</p>${error?`<p class="save-error" role="alert">${esc(error)}</p>`:''}
 <div class="save-grid">${filtered.map(e=>`<article class="save-card"><h3>${esc(e.name)}</h3><p>${facts(e)}</p><p><small>${mapInfo(e)} · ${esc(modes[e.mode]||e.mode)}<br>${esc(new Date(e.createdAt).toLocaleString('ru-RU'))} · ${e.kind==='archive'?'Архив':'Снимок'}</small></p>
 ${renameId===e.id?`<form data-save-form="rename" data-id="${esc(e.id)}"><label>Новое название<input name="save-name" value="${esc(e.name)}" maxlength="80" required></label><button>Сохранить имя</button></form>`:''}
 ${confirmDelete===e.id?`<p>Удалить только этот снимок? Текущий город останется.</p><div class="save-actions"><button class="danger" data-save-action="confirm-delete" data-id="${esc(e.id)}" ${busy?'disabled':''}>Удалить снимок</button><button data-save-action="cancel" ${busy?'disabled':''}>Отмена</button></div>`:`<div class="save-actions">${[['load','Загрузить'],['export','Скачать'],['rename','Имя'],['delete','Удалить']].map(([action,label])=>`<button data-save-action="${action}" data-id="${esc(e.id)}" ${busy?'disabled':''}>${label}</button>`).join('')}</div>`}</article>`).join('')||'<p class="save-empty">Здесь пока пусто. Сохрани первый снимок города.</p>'}</div></div>`;
}

export function downloadSave(raw,name='Город'){
 const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),link=document.createElement('a');
 link.href=url;link.download=`${name.replace(/[\\/:*?"<>|\u0000-\u001f]/g,'-').slice(0,80)}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function createSaveLibraryUI({root,library,getState,encode,onLoad,onClose,onNew,download=downloadSave}){
 let entries=[],tab='all',busy=false,message='',error='',confirmDelete=null,renameId=null,destroyed=false;
 const render=()=>{if(!destroyed)root.innerHTML=saveLibraryHTML({entries,current:saveMetadata(getState()),tab,busy,message,error,confirmDelete,renameId});};
 async function run(action,success=''){
  if(busy||destroyed)return;busy=true;error='';render();
  try{await action();if(!destroyed){entries=await library.list();message=success;}}
  catch(e){error=e?.message||'Не удалось выполнить действие. Текущий город сохранён.';}
  finally{busy=false;render();}
 }
 const get=async id=>{const record=await library.read(id);if(!record)throw Error('Снимок уже удалён. Обнови список.');return record;};
 function click(event){
  const button=event.target.closest?.('[data-save-action],[data-save-tab]');if(!button||busy)return;
  if(button.dataset.saveTab){tab=button.dataset.saveTab;render();return;}
  const action=button.dataset.saveAction,id=button.dataset.id;
  if(action==='close'){onClose();return;}if(action==='new'){onNew();return;}
  if(action==='cancel'){confirmDelete=null;renameId=null;render();return;}
  if(action==='rename'){renameId=id;confirmDelete=null;render();root.querySelector('[data-save-form="rename"] input')?.focus();return;}
  if(action==='delete'){confirmDelete=id;renameId=null;render();return;}
  if(action==='export-current'){try{download(encode(getState()),'Новый Вавилон — текущий город');message='Файл подготовлен для скачивания.';}catch(e){error=e.message;}render();return;}
  if(action==='export')run(async()=>{const record=await get(id);if(destroyed)return;download(record.raw,record.name);},'Файл подготовлен для скачивания.');
  if(action==='confirm-delete')run(async()=>{await library.remove(id);confirmDelete=null;},'Снимок удалён.');
  if(action==='load')run(async()=>{const record=await get(id);if(destroyed)return;const parsed=parseSaveFile(record.raw);await onLoad(parsed.state,record.name);});
 }
 function submit(event){
  const form=event.target.closest?.('[data-save-form]');if(!form)return;event.preventDefault();
  const name=form.elements.namedItem('save-name').value;
  if(form.dataset.saveForm==='create'){const raw=encode(getState());run(()=>library.create(raw,name),'Снимок сохранён.');}
  else run(async()=>{if(!await library.rename(form.dataset.id,name))throw Error('Снимок уже удалён.');renameId=null;},'Название сохранено.');
 }
 function change(event){
  if(!event.target.matches?.('[data-save-import]'))return;const file=event.target.files?.[0];if(!file)return;
  run(async()=>{if(file.size>MAX_SAVE_BYTES)throw Error('Файл слишком большой: максимум 16 МБ.');const parsed=parseSaveFile(await file.text());await library.create(parsed.raw,file.name.replace(/\.json$/i,''));},'Файл импортирован. Нажми «Загрузить» на его карточке.');
 }
 root.addEventListener('click',click);root.addEventListener('submit',submit);root.addEventListener('change',change);
 render();const ready=run(async()=>{},'');
 return {ready,destroy(){destroyed=true;root.removeEventListener('click',click);root.removeEventListener('submit',submit);root.removeEventListener('change',change);}};
}
