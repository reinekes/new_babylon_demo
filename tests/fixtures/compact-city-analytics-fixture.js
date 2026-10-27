import {createGame} from '../../engine.js';
import {renderCityTools} from '../../ui-city-tools.js';
import {renderLifeAnalytics} from '../../ui-life-analytics.js';
import {snapshotLifeAnalytics} from '../../life-analytics.js';

// Reproducible UI exercise, not manual pointer QA. It never reads localStorage.
const state=createGame({start:'established'}),host=document.querySelector('#overview'),events=document.querySelector('#events'),width=innerWidth;
state.buildings.push({type:'pottery',x:6,y:8,level:1},{type:'pottery',x:7,y:8,level:2,built:{year:3,season:1,elapsed:1,order:2}},{type:'musicHouse',x:8,y:8,level:1},{type:'granary',x:11,y:3,level:1});
state.citizens[0].cargo={clay:2};state.citizens[0].hunger=90;state.citizens[1].health=40;
for(let tick=1;tick<=8;tick++){state.tick=tick;state.citizens[1].health=40+tick*5;state.citizens[2].faith=50+tick*3;snapshotLifeAnalytics(state);}
const before=JSON.stringify(state),callbacks={onCitizen:id=>{events.textContent='Открыт житель ID '+id;},onFocus:key=>{events.textContent='Выбрано здание '+key;}};
document.querySelector('#width').textContent=width+' px · сохранения не используются';
let root;
function show(view){host.innerHTML='';root=document.createElement('div');host.append(root);if(['districts','citizens','workshops'].includes(view))renderCityTools(root,state,{...callbacks,tab:view});else renderLifeAnalytics(root,state,{...callbacks,tab:view});}
const frame=()=>new Promise(requestAnimationFrame),layouts=[];
for(const view of ['districts','citizens','workshops','overview','wellbeing','work','faith','residents','family','history']){
 show(view);await frame();
 layouts.push({view,overflow:document.documentElement.scrollWidth>width+1,cards:root.querySelectorAll('.city-tools-row,.life-chart-card').length,chartLabels:[...root.querySelectorAll('[role="img"]')].every(e=>!!e.getAttribute('aria-label')),columns:getComputedStyle(root.querySelector('.city-tools-card-grid,.life-chart-grid')||root).gridTemplateColumns});
}
show('citizens');await frame();
const sort=root.querySelector('[data-city-filter="sort"]');sort.value='hunger';sort.dispatchEvent(new Event('change',{bubbles:true}));
const sortedFirst=Number(root.querySelector('[data-city-citizen]').dataset.cityCitizen),first=root.querySelector('[data-city-person-disclosure]'),personId=first.dataset.cityPersonDisclosure;first.querySelector('summary').click();await frame();renderCityTools(root,state,callbacks);await frame();
const disclosureRetained=root.querySelector(`[data-city-person-disclosure="${personId}"]`).open;
root.querySelector(`[data-city-citizen="${personId}"]`).click();
const linkFired=events.textContent==='Открыт житель ID '+personId;
const result={kind:'compact-city-results',width,layouts,sortedFirst,disclosureRetained,linkFired,viewPure:before===JSON.stringify(state),closedCardHeight:Math.round(root.querySelector('.city-tools-person:not(:has(details[open]))')?.getBoundingClientRect().height||0),failures:layouts.filter(r=>r.overflow&&r.view!=='history').map(r=>r.view)};
parent.postMessage(result,location.origin);
show(new URLSearchParams(location.search).get('view')||'citizens');
window.addEventListener('message',event=>{if(event.origin===location.origin&&event.data?.kind==='compact-city-view')show(event.data.view);});
