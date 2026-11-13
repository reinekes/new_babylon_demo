// Presentation only: existing controls, listeners and authoritative game fields survive.
const icon=name=>`<img src="assets/ui/icons/${name}.svg" alt="" aria-hidden="true">`;
export function createUrukInterface({document=globalThis.document,onResize=()=>{},getState=()=>({})}={}){
 const d=document,body=d.body,$=id=>d.getElementById(id),listeners=[];
 const listen=(target,type,fn)=>{target.addEventListener(type,fn);listeners.push(()=>target.removeEventListener(type,fn));};
 body.classList.add('uruk-ui');body.dataset.urukPanel='';
 const dock=d.createElement('nav');dock.className='uruk-dock';dock.setAttribute('aria-label','Действия города');
 dock.innerHTML=[['build','hammer','Строить'],['people','users','Жители'],['city','buildings','Город'],['miracles','sun','Чудеса'],['menu','list','Меню']].map(([id,image,title])=>`<button type="button" data-uruk-action="${id}"${['build','miracles','menu'].includes(id)?' aria-expanded="false"':''}>${icon(image)}<span>${title}</span></button>`).join('')+'<div class="uruk-transport"></div>';
 body.append(dock);dock.querySelector('.uruk-transport').append(d.querySelector('.time-controls'));
 const menu=d.createElement('section');menu.className='uruk-menu';menu.setAttribute('aria-label','Меню города');menu.innerHTML='<div class="uruk-drawer-heading"><h2>Меню</h2></div>';const management=d.querySelector('.management-nav'),header=d.querySelector('.header-actions');
 for(const id of ['open-construction','open-supply','open-trade','open-roads','lay-roads','open-civic-order','open-festival','open-relic','open-life','open-song-library','open-save-library','test-resources']){
  const control=$(id);if(control?.parentElement===management)management.append(control);
 }
 for(const id of ['open-residents','open-city-tools'])if($(id)?.parentElement===management)$(id).hidden=true;
 if(header.querySelector('.district-link'))header.querySelector('.district-link').hidden=true;
 if($('save-status'))$('save-status').hidden=true;
 const quick=d.createElement('button');quick.type='button';quick.className='quick-build-indicator';quick.textContent='Быстрое строительство · вкл.';
 d.querySelector('.build-panel .section-label').after(quick);
 listen(quick,'click',()=>{close();$('test-resources').click();});

 menu.append(management,header);const viewOptions=d.querySelector('.game3d-options,.panel-dock-2d');if(viewOptions)menu.append(viewOptions);body.append(menu);
 // The management grid already contains these two destinations.
 for(const id of ['open-saves','open-encyclopedia'])if($(id))$(id).hidden=true;
 if($('help'))$('help').textContent='Как играть';
 if($('reset'))$('reset').textContent='Новая игра';
 for(const [key,panel,title]of [['build',d.querySelector('.build-panel'),'Закрыть строительство'],['miracles',d.querySelector('.miraclebar'),'Закрыть чудеса'],['story',d.querySelector('.story-panel'),'Закрыть историю'],['menu',menu,'Закрыть меню']]){
  const closeButton=d.createElement('button');closeButton.type='button';closeButton.className='uruk-close';closeButton.dataset.urukClose=key;closeButton.setAttribute('aria-label',title);closeButton.innerHTML=icon('x');panel.prepend(closeButton);panel.dataset.urukDrawer=key;
 }
 const panelOptions=d.querySelector('.panel-options');if(panelOptions){for(const label of panelOptions.querySelectorAll('label'))label.hidden=true;const note=panelOptions.querySelector('small');if(note)note.textContent='H — оставить только город или вернуть интерфейс. Окна открываются с нижней панели.';}
 const resources=d.createElement('button');resources.type='button';resources.className='uruk-resource-toggle';resources.dataset.urukAction='resources';resources.setAttribute('aria-label','Все ресурсы');resources.setAttribute('aria-controls','resources');resources.setAttribute('aria-expanded','false');resources.innerHTML=icon('dots-three')+icon('x');d.querySelector('.resourcebar').append(resources);
 const groups=[...d.querySelectorAll('[data-build-group]')],category=d.createElement('select');category.dataset.urukBuildCategory='';category.setAttribute('aria-label','Категория построек');
 for(const group of groups){const option=d.createElement('option');option.value=group.dataset.buildGroup;option.textContent=group.querySelector('summary span')?.textContent||group.querySelector('summary')?.textContent;category.append(option);}
 function selectBuildGroup(id){if(!groups.some(g=>g.dataset.buildGroup===id))return;category.value=id;for(const group of groups){const selected=group.dataset.buildGroup===id;group.hidden=!selected;group.open=selected;}}
 if(groups.length){d.querySelector('.build-panel .section-label').after(category);selectBuildGroup(groups.find(g=>g.open)?.dataset.buildGroup||groups[0].dataset.buildGroup);listen(category,'change',()=>selectBuildGroup(category.value));}
 const clock=d.createElement('div');clock.className='uruk-header-clock';const track=$('season-track');track.setAttribute('role','group');track.setAttribute('aria-label','Месяцы года');clock.append($('day-cycle'),$('date'),track);d.querySelector('.topbar').append(clock);
 const identity=d.createElement('div'),wordmark=d.querySelector('.topbar .brand'),population=$('population').closest('.citizens');identity.className='uruk-header-identity';population.classList.add('uruk-header-population');wordmark.before(identity);identity.append(wordmark,population);
 const badge=d.createElement('button');badge.type='button';badge.className='uruk-god';badge.setAttribute('aria-label','Имя бога и летопись');badge.innerHTML=icon('sun')+'<span><small>ИМЯ, КОТОРОЕ ДАЛИ ЛЮДИ</small><span class="uruk-god-name"></span></span>';d.querySelector('.world').append(badge);
 const brand=d.querySelector('.brandmark');brand.textContent='';const seal=d.createElement('img');seal.src='assets/ui/uruk-seal.webp';seal.alt='';brand.append(seal);
 let opener=null,dialogReturnTarget=null;
 function close({restoreFocus=false}={}){body.dataset.urukPanel='';body.classList.remove('uruk-resources-open');resources.setAttribute('aria-expanded','false');resources.setAttribute('aria-label','Все ресурсы');for(const button of dock.querySelectorAll('[aria-expanded]'))button.setAttribute('aria-expanded','false');badge.setAttribute('aria-expanded','false');if(restoreFocus)opener?.focus();onResize();}
 function open(key,source){const current=body.dataset.urukPanel;close();if(current===key)return;opener=source||dock.querySelector(`[data-uruk-action="${key}"]`)||badge;body.dataset.urukPanel=key;opener?.setAttribute('aria-expanded','true');d.querySelector(`[data-uruk-drawer="${key}"] [data-uruk-close]`)?.focus();onResize();}
 function refresh(state=getState()){const name=state.name||'Безымянный дух',el=badge.querySelector('.uruk-god-name');if(el.textContent!==name)el.textContent=name;}
 listen(dock,'click',event=>{const button=event.target.closest('[data-uruk-action]');if(!button)return;const key=button.dataset.urukAction;if(key==='people'||key==='city'){close();$(key==='people'?'open-residents':'open-city-tools').click();if(d.querySelector('dialog[open]'))dialogReturnTarget=button;}else open(key,button);});
 for(const button of d.querySelectorAll('[data-uruk-close]'))listen(button,'click',()=>close({restoreFocus:true}));
 listen(resources,'click',()=>{const expanded=!body.classList.contains('uruk-resources-open');close();opener=resources;body.classList.toggle('uruk-resources-open',expanded);resources.setAttribute('aria-expanded',String(expanded));resources.setAttribute('aria-label',expanded?'Закрыть запасы города':'Все ресурсы');});
 listen(badge,'click',()=>open('story',badge));
 listen(d,'keydown',event=>{if(event.key==='Escape'&&!d.querySelector('dialog[open]'))close({restoreFocus:true});});
 listen(d.querySelector('#buildings'),'click',event=>{if(event.target.closest('.building-info')){close();$('tile-detail')?.querySelector('.detail-close')?.focus();return;}const card=event.target.closest('.building-card');if(card&&!card.disabled){close();$('city').focus();}});
 listen(menu,'click',event=>{if(event.target.closest('.management-nav button,.header-actions button,.header-actions a')){const dialog=d.querySelector('dialog[open]');if(dialog)dialogReturnTarget=opener;close({restoreFocus:!dialog});}});
 listen($('dialog'),'close',()=>{dialogReturnTarget?.focus();dialogReturnTarget=null;});
 refresh();return {open,close,refresh,selectBuildGroup,dispose(){for(const remove of listeners)remove();}};
}
