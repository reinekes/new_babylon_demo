import { sections, sectionForGroup, usageOf } from './sections.js?v=atlas-sections-20261116';

const byId=id=>document.getElementById(id);
const catalog=byId('catalog'), group=byId('group'), search=byId('search'), profile=byId('profile');
const supplied=byId('supplied');
const tabs=[...byId('category-tabs').querySelectorAll('a')];
const viewer=byId('viewer'), canvas=byId('model-canvas'), parking=byId('preview-parking');
const clip=byId('clip'), rotate=byId('rotate'), status=byId('model-status');
const cache=new Map(), queue=new Map();
let data, section, preview, pending, active=false, drawing=false;
let observer;
let usage='game';
const usageButtons=[...byId('usage').querySelectorAll('button')];
const usageLabels={all:'Все модели',game:'В игре',reserve:'Резерв',studio:'Отдельные сцены',source:'У автора'};
const usageHelp={
  all:'Все модели. У каждой строки указан статус использования.',
  game:'Модели основного города. Варианты, действующие только в прежней ветке, подписаны отдельно.',
  reserve:'Запасные файлы и модели, которые могут подменить основные при ошибке загрузки.',
  studio:'Модели отдельных художественных и проверочных сцен.',
  source:'Модели, доступные для просмотра на странице автора.'
};

const element=(tag,text,className)=>{
  const node=document.createElement(tag);
  if (text) node.textContent=text;
  if (className) node.className=className;
  return node;
};
const getPreview=()=>preview??=import('./preview.js?v=alluvial-craft-20261118').then(m=>m.createPreview(canvas)).catch(error=>{
  preview=null;
  throw error;
});
function showImage(button,src) {
  const image=element('img');
  image.src=src;
  image.alt='';
  button.firstElementChild.replaceWith(image);
}
const identity=(item,mode)=>item.kind==='glb'?item.entry.file:JSON.stringify([mode,item]);

async function drain() {
  if (drawing||active) return;
  drawing=true;
  try {
    while (queue.size&&!active) {
      const [button,request]=queue.entries().next().value;
      queue.delete(button);
      observer.unobserve(button);
      if (!button.isConnected) continue;
      const {item,mode}=request;
      const key=identity(item,mode);
      const task=(async()=>{
        if (!cache.has(key)) {
          const renderer=await getPreview();
          try {
            await renderer.open(item,mode);
            cache.set(key,renderer.capture());
          } finally {
            renderer.close();
          }
        }
        if (button.isConnected) showImage(button,cache.get(key));
      })();
      pending=task;
      try { await task; }
      catch { if (button.isConnected) button.firstElementChild.textContent='Открыть 3D'; }
      finally { if (pending===task) pending=null; }
      // Yield between views so scrolling and opening a model stay responsive.
      await new Promise(resolve=>requestAnimationFrame(resolve));
    }
  } finally {
    drawing=false;
  }
}

async function open(item,mode,title) {
  if (active) return;
  active=true;
  const job=pending;
  byId('model-title').textContent=title+' · '+item.label;
  status.textContent='Загрузка модели…';
  byId('clip-label').hidden=true;
  rotate.disabled=true;
  rotate.setAttribute('aria-pressed','false');
  const record=item.entry;
  byId('model-detail').textContent=record
    ? `${record.purpose} · ${Number(record.triangles||0).toLocaleString('ru-RU')} треугольников · ${record.file}`
    : 'Модель создана игровым рендерером для изолированного просмотра.';
  const sources=byId('model-sources');
  sources.replaceChildren();
  for (const source of record?.sources??item.sources??[]) {
    const line=element('span',[source.author,source.license].filter(Boolean).join(' · '));
    if (/^https?:\/\//.test(source.source??'')) {
      const link=element('a',' Источник');
      link.href=source.source;
      line.append(link);
    }
    sources.append(line,document.createElement('br'));
  }
  viewer.showModal();
  // Keep the canvas in its parking slot until the current thumbnail is finished.
  const loading=(async()=>{
    if (job) await job.catch(()=>{});
    if (!viewer.open) return;
    const renderer=await getPreview();
    if (!viewer.open) return;
    byId('stage').append(canvas);
    const clips=await renderer.open(item,mode);
    if (!viewer.open) return;
    clip.replaceChildren(new Option('Неподвижно',''),...clips.map((name,i)=>new Option(name,String(i))));
    byId('clip-label').hidden=!clips.length;
    rotate.disabled=false;
    renderer.interactive();
    status.textContent='Перетаскивание — поворот · колесо или щипок — масштаб';
  })();
  pending=loading;
  try { await loading; }
  catch (error) { if(viewer.open) status.textContent=`Модель не загрузилась. ${error.message}`; }
  finally { if(pending===loading) pending=null; }
}

viewer.addEventListener('close',async()=>{
  if(pending) await pending.catch(()=>{});
  if(preview) (await preview.catch(()=>null))?.close();
  parking.append(canvas);
  active=false;
  drain();
});
clip.addEventListener('change',async()=>{(await getPreview()).play(clip.value===''?-1:Number(clip.value));});
rotate.addEventListener('click',async()=>{
  const value=rotate.getAttribute('aria-pressed')!=='true';
  rotate.setAttribute('aria-pressed',String(value));
  (await getPreview()).rotate(value);
});

function thumbnail(item,title,mode) {
  const button=element('button',null,'thumb');
  button.type='button';
  button.setAttribute('aria-label',`Открыть модель: ${title}, ${item.label}`);
  button.append(element('span','3D','placeholder'),element('span',item.label));
  button.addEventListener('click',()=>open(item,mode,title));
  const cached=cache.get(identity(item,mode));
  if(cached) showImage(button,cached);
  else {
    button.previewRequest={item,mode};
    observer.observe(button);
  }
  return button;
}

function render() {
  observer?.disconnect();
  queue.clear();
  observer=new IntersectionObserver(entries=>{
    for(const entry of entries) {
      if (entry.isIntersecting) queue.set(entry.target,entry.target.previewRequest);
      else queue.delete(entry.target);
    }
    drain();
  },{rootMargin:'160px'});
  const query=search.value.trim().toLocaleLowerCase('ru');
  const scopedRows=profile.value==='legacy'&&data.legacyLabels
    ? data.rows.map((row,i)=>({...row,...data.legacyLabels[i]})) : data.rows;
  const allRows=scopedRows.filter(row=>(!group.value||group.value===row.group)&&(!supplied.checked||row.originalFile));
  for(const tab of tabs){
    const url=new URL(tab.href);
    url.searchParams.set('usage',usage==='source'?'all':usage);
    tab.href=url.href;
  }
  for (const button of usageButtons) {
    const key=button.dataset.usage;
    button.textContent=`${usageLabels[key]} · ${key==='all'?allRows.length:allRows.filter(row=>usageOf(row)===key).length}`;
    button.setAttribute('aria-pressed',String(key===usage));
  }
  byId('usage-help').textContent=query?'Поиск по всем статусам в выбранном разделе.':usageHelp[usage];
  const rows=allRows.filter(row=>
    (query||usage==='all'||usageOf(row)===usage)&&
    [row.title,row.description,row.originalFile,...row.previews.flatMap(p=>[p.label,p.species,p.entry?.file])].some(text=>text?.toLocaleLowerCase('ru').includes(query)));
  catalog.replaceChildren();
  byId('results').textContent=rows.length?`Строк в выборке: ${rows.length}`:'Совпадений нет';
  for(const [key,title] of Object.entries(sections[section])) {
    const selected=rows.filter(row=>row.group===key);
    if(!selected.length) continue;
    const panel=element('section'), heading=element('h2',title);
    heading.id=`group-${key}`;
    panel.setAttribute('aria-labelledby',heading.id);
    const scroller=element('div',null,'scroll'), table=element('table',null,`grid ${key==='buildings'?'levels':''}`);
    const head=table.createTHead().insertRow();
    const headers=key==='buildings'?['Объект','I уровень','II уровень','III уровень']:['Объект','3D-модель','Источник / статус'];
    for(const name of headers) {
      const th=element('th',name);
      th.scope='col';
      head.append(th);
    }
    const body=table.createTBody();
    for(const row of selected) {
      const tr=body.insertRow(), name=element('th',row.title);
      name.scope='row';
      name.append(element('span',row.description,'hint'));
      if(row.originalFile)name.append(element('span',row.originalFile,'hint original-file'));
      if(usage==='all'||query)name.append(element('span',usageLabels[usageOf(row)],'usage-tag'));
      tr.append(name);
      for(const item of row.previews){
        const cell=tr.insertCell();
        if(item.kind==='source'){
          const link=element('a','Смотреть у автора ↗');
          link.href=item.sources[0].source;
          link.target='_blank';
          link.rel='noopener';
          cell.append(link);
        }else cell.append(thumbnail(item,row.title,profile.value));
      }
      if(key==='buildings') {
        for(let i=row.previews.length;i<3;i++) tr.insertCell().append(element('span','—','empty'));
      } else {
        const item=row.previews[0], record=item.entry;
        tr.insertCell().textContent=item.kind==='source'?item.label:record?`Файл GLB · ${item.label}`:row.description;
      }
    }
    scroller.append(table);
    panel.append(heading,scroller);
    catalog.append(panel);
  }
}

async function readData(name) {
  const response=await fetch(new URL(`./data/${name}.json?v=river-herds-20261118`,import.meta.url),{cache:'no-cache'});
  if (!response.ok) throw Error(`HTTP ${response.status}`);
  return response.json();
}

async function start() {
  const params=new URLSearchParams(location.search);
  const file=params.get('model'), requestedSpecies=params.get('species');
  const species=requestedSpecies==='snakes'?'cobra-base':requestedSpecies;
  const requested=params.get('group');
  const requestedSection=sectionForGroup(requested);
  const suppliedOnly=params.get('supplied')==='1';
  let linkedSection;
  if (file||species) {
    const links=await readData('links');
    const entries=file?links.model:links.species;
    const key=file||species;
    if (Object.hasOwn(entries,key)) linkedSection=entries[key];
  }
  section=linkedSection??requestedSection??(suppliedOnly?'animals':'buildings');
  for(const tab of tabs) {
    if (tab.dataset.category===section) tab.setAttribute('aria-current','page');
    else tab.removeAttribute('aria-current');
  }
  byId('fauna-tools').hidden=section!=='animals';
  byId('supplied-filter').hidden=section!=='animals';
  byId('profile-filter').hidden=section!=='buildings';
  const selectedUsage=params.get('usage');
  if (Object.hasOwn(usageLabels,selectedUsage)) usage=selectedUsage;
  else if(requestedSection||suppliedOnly) usage='all';
  data=await readData(section);
  const {rows}=data;
  const selected=rows.find(({previews:[item]})=>file?item.entry?.file===file:!!species&&item.species===species);
  const glbCount=rows.filter(row=>row.previews.some(item=>item.kind==='glb')).length;
  byId('totals').textContent=`Позиций в разделе: ${rows.length} · GLB: ${glbCount}`;
  for(const [id,name] of Object.entries(sections[section])) group.add(new Option(name,id));
  if(requested!==section&&Object.hasOwn(sections[section],requested)&&(!selected||selected.group===requested))group.value=requested;
  supplied.checked=section==='animals'&&suppliedOnly&&(!selected||!!selected.originalFile);
  usageButtons.find(button=>button.dataset.usage==='source').hidden=!rows.some(row=>usageOf(row)==='source');
  for(const field of [group,profile,supplied]) field.addEventListener('change',render);
  search.addEventListener('input',render);
  for(const button of usageButtons) button.addEventListener('click',()=>{
    usage=button.dataset.usage;
    render();
  });
  if(selected){
    usage=usageOf(selected);
    search.value=file||selected.title;
  }
  render();
  if(selected&&selected.previews[0].kind!=='source')await open(selected.previews[0],profile.value,selected.title);
}
start().catch(error=>{byId('totals').textContent=`Каталог недоступен. Откройте страницу через HTTP. ${error.message}`;});
