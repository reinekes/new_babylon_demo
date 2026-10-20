export function photoFilename(s,date=new Date()){return `new-babylon-y${s.year}-${date.toISOString().slice(0,10)}.png`;}
export function photoLighting(renderer,value){renderer.lightMode=['auto','day','sunset','night'].includes(value)?value:'auto';return renderer.lightMode;}
export function createPhotoMode({renderer,canvas,getState,onEnter,onExit,onMessage}){
 const world=canvas.closest('.world'),toolbar=document.createElement('div');toolbar.className='photo-toolbar';toolbar.hidden=true;
 toolbar.innerHTML='<div><b>Город в кадре</b><small>Освещение кадра не меняет время города</small></div><label>Свет <select aria-label="Освещение фотографии"><option value="auto">Как в городе</option><option value="day">День</option><option value="sunset">Закат</option><option value="night">Ночь</option></select></label><button data-photo-zoom="out" aria-label="Отдалить кадр">−</button><button data-photo-zoom="in" aria-label="Приблизить кадр">+</button><button data-photo-save>Сохранить PNG</button><button data-photo-exit>Вернуться · Esc</button>';
 world.append(toolbar);let active=false,previous,view;
 const exit=()=>{if(!active)return;active=false;document.body.classList.remove('photo-mode');toolbar.hidden=true;Object.assign(renderer,previous);renderer.restoreView?.(view);renderer.resize();onExit?.();canvas.focus();};
 const enter=()=>{if(active)return;active=true;view=renderer.captureView?.();previous={lightMode:renderer.lightMode,zoom:renderer.zoom,pan:{...renderer.pan},mapOverview:renderer.mapOverview};toolbar.querySelector('select').value=renderer.lightMode;document.body.classList.add('photo-mode');toolbar.hidden=false;onEnter?.();renderer.resize();toolbar.querySelector('[data-photo-exit]').focus();};
 toolbar.querySelector('select').onchange=e=>photoLighting(renderer,e.target.value);
 toolbar.querySelector('[data-photo-exit]').onclick=exit;
 for(const b of toolbar.querySelectorAll('[data-photo-zoom]'))b.onclick=()=>{renderer.mapOverview=false;if(renderer.zoomBy)renderer.zoomBy(b.dataset.photoZoom==='in'?.2:-.2);else{renderer.zoom=Math.max(.3,Math.min(4,renderer.zoom+(b.dataset.photoZoom==='in'?.2:-.2)));renderer.layout();}};
 toolbar.querySelector('[data-photo-save]').onclick=()=>{const button=toolbar.querySelector('[data-photo-save]');button.disabled=true;canvas.toBlob(blob=>{button.disabled=false;if(!blob){onMessage?.('Не удалось сохранить кадр');return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=photoFilename(getState());a.click();setTimeout(()=>URL.revokeObjectURL(url),15000);onMessage?.('Кадр сохранён в PNG');},'image/png');};
 document.addEventListener('keydown',e=>{if(active&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();exit();}},true);
 return {enter,exit,get active(){return active;}};
}
