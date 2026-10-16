import {BUILDINGS,housingOf} from './definitions.js';
export const isComplete=b=>!b.construction||b.construction.kind==='upgrade';
export const createOrder=(cost,target=1,kind='new')=>({kind,target,priority:1,required:{clay:cost.clay||0,reed:cost.reed||0},remaining:{clay:cost.clay||0,reed:cost.reed||0},delivered:{clay:0,reed:0},work:0});
export const materialsReady=q=>['clay','reed'].every(k=>q.delivered[k]>=q.required[k]);
export function constructionProgress(b){
 const q=b.construction;if(!q)return {ratio:1,stage:'Готово',work:1,materials:1};
 const total=q.required.clay+q.required.reed,materials=total?(q.delivered.clay+q.delivered.reed)/total:1,work=Math.min(1,q.work/(12*q.target));
 return {ratio:materials*.4+work*.6,materials,work,stage:!materialsReady(q)?'Доставка материалов':work<.3?'Фундамент':work<.75?'Возведение стен':'Крыша и отделка'};
}
export function finishConstruction(s){
 let changed=false;
 for(const b of s.buildings){const q=b.construction;if(!q||!materialsReady(q)||q.work<12*q.target-1e-8)continue;
  b.level=q.target;delete b.construction;changed=true;
  s.news.unshift({title:q.kind==='upgrade'?`${BUILDINGS[b.type].name} · уровень ${b.level}`:`Построено: ${BUILDINGS[b.type].name}`,text:'Жители доставили материалы и завершили работы.',kind:'build',year:s.year,season:s.season,tick:s.tick});s.news=s.news.slice(0,80);
  // Workforce synchronization sees the old site and routes builders home.
 }
 if(changed)s.capacity=housingOf(s);return changed;
}

export function orderedSites(s){return s.buildings.map((b,index)=>({b,index})).filter(({b})=>b.construction).sort((a,b)=>(b.b.construction.priority??1)-(a.b.construction.priority??1)||(a.b.construction.order??a.index)-(b.b.construction.order??b.index)).map(({b})=>b);}
export const nextOrder=s=>Math.max(-1,...s.buildings.map((b,i)=>b.construction?.order??i))+1;
