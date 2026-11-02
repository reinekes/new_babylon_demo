import test from 'node:test';
import assert from 'node:assert/strict';
import {saveLibraryHTML} from '../ui-saves.js';
import {createSaveLibraryUI} from '../ui-saves.js';
import {createSaveLibrary} from '../save-library.js';
import {createGame,encode} from '../engine.js';
import {IDBFactory} from 'fake-indexeddb';
import {JSDOM} from 'jsdom';
const current={year:3,season:2,population:24,buildings:10,seed:42,generated:true,mode:'adult'};
test('saved names and metadata are escaped; snapshots and archives filter independently',()=>{
 const entries=[{...current,id:'1',name:'<img src=x onerror=alert(1)>',kind:'manual',createdAt:1},{...current,id:'2',name:'Архив города',kind:'archive',createdAt:2}];
 const all=saveLibraryHTML({entries,current});assert.ok(!all.includes('<img'));assert.match(all,/&lt;img/);assert.match(all,/Долина № 42/);assert.match(all,/Архив города/);
 const manual=saveLibraryHTML({entries,current,tab:'manual'});assert.ok(!manual.includes('<h3>Архив города'));assert.match(manual,/Загрузить/);
 const removal=saveLibraryHTML({entries,current,confirmDelete:'1'});assert.match(removal,/Удалить только этот снимок/);assert.match(removal,/data-save-action="confirm-delete"/);
});

test('real DOM controls create, rename, export, load, filter and confirm deletion',async()=>{
 const dom=new JSDOM('<main id="root"></main>'),root=dom.window.document.querySelector('main'),s=createGame({seed:100}),lib=createSaveLibrary({indexedDB:new IDBFactory()}),downloads=[],loaded=[];
 const ui=createSaveLibraryUI({root,library:lib,getState:()=>s,encode,onLoad:(state,name)=>loaded.push({state,name}),onClose(){},onNew(){},download:(raw,name)=>downloads.push({raw,name})});
 const wait=async predicate=>{for(let i=0;i<200&&!predicate();i++)await new Promise(r=>setTimeout(r,2));assert.ok(predicate(),'UI action completed');};
 const idle=()=>!root.querySelector('.save-status').textContent.includes('Подожди');
 const click=selector=>root.querySelector(selector).click();
 try{
  await ui.ready;root.querySelector('input[name="save-name"]').value='Речной город';root.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await wait(()=>idle()&&root.querySelectorAll('.save-card').length===1);
  click('[data-save-action="rename"]');const form=root.querySelector('[data-save-form="rename"]');form.elements.namedItem('save-name').value='Мой город';form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await wait(()=>idle()&&root.querySelector('.save-card h3').textContent==='Мой город');
  click('[data-save-action="export"]');await wait(()=>idle()&&downloads.length===1);assert.equal(JSON.parse(downloads[0].raw).world.seed,100);
  click('[data-save-action="load"]');await wait(()=>idle()&&loaded.length===1);assert.deepEqual(loaded[0].state.world,s.world);
  click('[data-save-tab="archive"]');assert.equal(root.querySelectorAll('.save-card').length,0);click('[data-save-tab="all"]');
  click('[data-save-action="delete"]');assert.equal((await lib.list()).length,1);click('[data-save-action="cancel"]');assert.equal((await lib.list()).length,1);
  click('[data-save-action="delete"]');click('[data-save-action="confirm-delete"]');await wait(()=>idle()&&!root.querySelector('.save-card'));assert.equal((await lib.list()).length,0);
 }finally{ui.destroy();lib.close();dom.window.close();}
});

test('a failed load or corrupt import leaves existing cards and current city intact',async()=>{
 const dom=new JSDOM('<main></main>'),root=dom.window.document.querySelector('main'),state=createGame(),before=encode(state),lib=createSaveLibrary({indexedDB:new IDBFactory()});await lib.create(before,'Исходный');
 const ui=createSaveLibraryUI({root,library:lib,getState:()=>state,encode,onLoad:async()=>{throw Error('Архив не записан: места нет');},onClose(){},onNew(){}});
 const wait=async predicate=>{for(let i=0;i<200&&!predicate();i++)await new Promise(r=>setTimeout(r,2));assert.ok(predicate());};
 try{await ui.ready;root.querySelector('[data-save-action="load"]').click();await wait(()=>!!root.querySelector('[role="alert"]'));assert.match(root.querySelector('[role="alert"]').textContent,/Архив не записан/);assert.equal(encode(state),before);
  const input=root.querySelector('[data-save-import]');Object.defineProperty(input,'files',{value:[{size:2,name:'bad.json',text:async()=>'{}'}]});input.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await wait(()=>!!root.querySelector('[role="alert"]'));assert.match(root.querySelector('[role="alert"]').textContent,/повреждённое/);assert.equal((await lib.list()).length,1);assert.equal(encode(state),before);
 }finally{ui.destroy();lib.close();dom.window.close();}
});

test('closing the library while reading a snapshot never starts a late city replacement',async()=>{
 const dom=new JSDOM('<main></main>'),root=dom.window.document.querySelector('main'),state=createGame();let finish,loads=0;
 const library={list:async()=>[{...current,id:'one',name:'Снимок',kind:'manual',createdAt:1}],read:()=>new Promise(resolve=>{finish=resolve;})};
 const ui=createSaveLibraryUI({root,library,getState:()=>state,encode,onLoad:()=>{loads++;},onClose(){},onNew(){}});
 await ui.ready;root.querySelector('[data-save-action="load"]').click();ui.destroy();finish({raw:encode(state),name:'Снимок'});await new Promise(resolve=>setTimeout(resolve,0));assert.equal(loads,0);dom.window.close();
});
