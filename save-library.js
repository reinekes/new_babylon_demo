import {decode,encode} from './engine.js';

export const MAX_SAVE_BYTES=16*1024*1024;
const DB_NAME='new-babylon-save-library',STORE='cities';
const title=name=>String(name||'Без названия').trim().slice(0,80)||'Без названия';
const id=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function parseSaveFile(raw){
 if(typeof raw!=='string'||raw.length>MAX_SAVE_BYTES||new TextEncoder().encode(raw).length>MAX_SAVE_BYTES)throw Error('Файл слишком большой: максимум 16 МБ.');
 const state=decode(raw);if(!state)throw Error('Это повреждённое сохранение или неподдерживаемая версия игры. Текущий город сохранён.');
 return {raw:encode(state),state};
}
export function saveMetadata(state){return {year:state.year,season:state.season,population:state.population,buildings:state.buildings.length,seed:state.world?.seed??null,generated:!!state.world?.generationVersion,mode:state.godhood?.mode||'legacy'};}
const summary=record=>{const {raw,...info}=record;return info;};

// The old localStorage autosave stays independent. A failed archive transaction
// must reject before app.js replaces that active city.
export function createSaveLibrary({indexedDB=globalThis.indexedDB}={}){
 let pending=null,connection=null;
 function open(){
  if(pending)return pending;
  pending=new Promise((resolve,reject)=>{
   if(!indexedDB){reject(Error('Хранилище городов недоступно. Скачай сохранение в файл.'));return;}
   let finished=false,request;const fail=error=>{if(finished)return;finished=true;clearTimeout(timer);reject(error);};
   const timer=setTimeout(()=>fail(Error('Хранилище не ответило. Закрой другие вкладки игры и повтори.')),5000);
   try{request=indexedDB.open(DB_NAME,1);}catch(error){fail(error);return;}
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'id'});};
   request.onerror=()=>fail(request.error||Error('Не удалось открыть хранилище городов.'));
   request.onblocked=()=>fail(Error('Хранилище занято другой вкладкой игры. Закрой её и повтори.'));
   request.onsuccess=()=>{if(finished){request.result.close();return;}finished=true;clearTimeout(timer);connection=request.result;connection.onversionchange=()=>{connection.close();connection=null;pending=null;};resolve(connection);};
  }).catch(error=>{pending=null;throw error;});
  return pending;
 }
 async function transaction(mode,action){
  const db=await open();return new Promise((resolve,reject)=>{
   let tx,result;try{tx=db.transaction(STORE,mode);action(tx.objectStore(STORE),value=>{result=value;});}catch(error){try{tx?.abort();}catch{}reject(error);return;}
   tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(tx.error||Error('Сохранение отменено: возможно, закончилось место в браузере.'));tx.onerror=()=>{};
  });
 }
 return {
  async list(){return transaction('readonly',(store,done)=>{const request=store.getAll();request.onsuccess=()=>done(request.result.map(summary).sort((a,b)=>b.createdAt-a.createdAt||b.id.localeCompare(a.id)));});},
  async read(key){return transaction('readonly',(store,done)=>{const request=store.get(key);request.onsuccess=()=>done(request.result||null);});},
  async create(raw,name,{kind='manual'}={}){
   if(!['manual','archive'].includes(kind))throw Error('Неизвестный тип сохранения.');
   const parsed=parseSaveFile(raw),record={id:id(),name:title(name),kind,createdAt:Date.now(),...saveMetadata(parsed.state),raw:parsed.raw};
   await transaction('readwrite',store=>store.add(record));return summary(record);
  },
  async rename(key,name){return transaction('readwrite',(store,done)=>{const request=store.get(key);request.onsuccess=()=>{const record=request.result;if(!record){done(false);return;}record.name=title(name);store.put(record);done(true);};});},
  async remove(key){return transaction('readwrite',store=>store.delete(key));},
  close(){connection?.close();connection=null;pending=null;}
 };
}
