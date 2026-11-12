import { groups, makeCatalog, usageOf } from './catalog.js?v=anzud-relief-20261112';

const byId=id=>document.getElementById(id);
const catalog=byId('catalog'), group=byId('group'), search=byId('search'), profile=byId('profile');
const viewer=byId('viewer'), canvas=byId('model-canvas'), parking=byId('preview-parking');
const clip=byId('clip'), rotate=byId('rotate'), status=byId('model-status');
const cache=new Map(), queue=new Map();
let index, preview, pending, active=false, drawing=false;
let observer;
let usage='game';
const usageButtons=[...byId('usage').querySelectorAll('button')];
const usageLabels={game:'В игре',reserve:'Резерв',studio:'Отдельные сцены'};
const usageHelp={
  game:'Модели основного города. Варианты, действующие только в прежней ветке, подписаны отдельно.',
  reserve:'Запасные файлы и модели, которые могут подменить основные при ошибке загрузки.',
  studio:'Модели отдельных художественных и проверочных сцен.'
};

const element=(tag,text,className)=>{
  const node=document.createElement(tag);
  if (text) node.textContent=text;
  if (className) node.className=className;
  return node;
};
const getPreview=()=>preview??=import('./preview.js?v=anzud-relief-20261112').then(m=>m.createPreview(canvas)).catch(error=>{
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
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      queue.set(entry.target,entry.target.previewRequest);
    }
    drain();
  },{rootMargin:'160px'});
  const query=search.value.trim().toLocaleLowerCase('ru');
  const allRows=makeCatalog(index,profile.value);
  for (const button of usageButtons) {
    const key=button.dataset.usage;
    button.textContent=`${usageLabels[key]} · ${allRows.filter(row=>usageOf(row)===key).length}`;
    button.setAttribute('aria-pressed',String(key===usage));
  }
  byId('usage-help').textContent=usageHelp[usage];
  const rows=allRows.filter(row=>
    usageOf(row)===usage&&(!group.value||group.value===row.group)&&
    [row.title,row.description,...row.previews.map(p=>p.label)].some(text=>text?.toLocaleLowerCase('ru').includes(query)));
  catalog.replaceChildren();
  byId('results').textContent=rows.length?`Строк в выборке: ${rows.length}`:'В этой вкладке совпадений нет';
  for(const [key,title] of Object.entries(groups)) {
    const selected=rows.filter(row=>row.group===key);
    if(!selected.length) continue;
    const section=element('section'), heading=element('h2',title);
    heading.id=`group-${key}`;
    section.setAttribute('aria-labelledby',heading.id);
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
      tr.append(name);
      for(const item of row.previews) tr.insertCell().append(thumbnail(item,row.title,profile.value));
      if(key==='buildings') {
        for(let i=row.previews.length;i<3;i++) tr.insertCell().append(element('span','—','empty'));
      } else {
        const record=row.previews[0].entry;
        tr.insertCell().textContent=record?`Файл GLB · ${row.previews[0].label}`:row.description;
      }
    }
    scroller.append(table);
    section.append(heading,scroller);
    catalog.append(section);
  }
}
async function start() {
  const response=await fetch(new URL('../docs/model-index.json?v=anzud-relief-20261112',import.meta.url));
  if(!response.ok) throw Error(`HTTP ${response.status}`);
  index=await response.json();
  const rows=makeCatalog(index,'strict');
  byId('totals').textContent=`${rows.filter(r=>r.previews[0].kind==='building'&&!r.previews[0].starter).length} типов зданий · ${index.models.length} файлов GLB · отдельные процедурные объекты`;
  for(const [id,name] of Object.entries(groups)) group.add(new Option(name,id));
  for(const field of [group,profile]) field.addEventListener('change',render);
  search.addEventListener('input',render);
  for(const button of usageButtons) button.addEventListener('click',()=>{
    usage=button.dataset.usage;
    group.value='';
    render();
  });
  const params=new URLSearchParams(location.search);
  const file=params.get('model'),species=params.get('species');
  const selected=rows.find(({previews:[item]})=>file?item.entry?.file===file:(item.kind==='wildlife'||item.kind==='relief')&&item.species===species);
  if(selected){
    usage=usageOf(selected);
    search.value=file||selected.title;
  }
  render();
  if(selected)await open(selected.previews[0],profile.value,selected.title);
}
start().catch(error=>{byId('totals').textContent=`Каталог недоступен. Откройте страницу через HTTP. ${error.message}`;});
