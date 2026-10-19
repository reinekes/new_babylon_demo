import {BUILDINGS,housingOf,MATERIALS} from './definitions.js';
export const isComplete=b=>!b.construction||b.construction.kind==='upgrade';
export const constructionEntities=s=>[...s.buildings,...s.roads||[]];
export const workRequired=b=>(b.type==='road'?6:12)*b.construction.target;
export const createOrder=(cost,target=1,kind='new')=>({kind,target,priority:1,required:Object.fromEntries(MATERIALS.map(k=>[k,cost[k]||0])),remaining:Object.fromEntries(MATERIALS.map(k=>[k,cost[k]||0])),delivered:Object.fromEntries(MATERIALS.map(k=>[k,0])),work:0});
export const materialsReady=q=>Object.keys(q.required).every(k=>(q.delivered[k]||0)>=q.required[k]);
export function constructionProgress(b){
 const q=b.construction;if(!q)return {ratio:1,stage:'Готово',work:1,materials:1};
 const total=Object.values(q.required).reduce((a,b)=>a+b,0),materials=total?Object.values(q.delivered).reduce((a,b)=>a+b,0)/total:1,work=Math.min(1,q.work/(workRequired(b)));
 return {ratio:materials*.4+work*.6,materials,work,stage:!materialsReady(q)?'Доставка материалов':b.type==='road'?'Укладка покрытия':b.type==='canal'?(work<.7?'Выкапывание русла':'Укрепление берегов'):work<.3?'Фундамент':work<.75?'Возведение стен':'Крыша и отделка'};
}
export function finishConstruction(s){
 let changed=false;
 for(const b of constructionEntities(s)){const q=b.construction;if(!q||!materialsReady(q)||q.work<workRequired(b)-1e-8)continue;
  b.level=q.target;if(q.legacyMasonry&&b.type!=='road')b.legacyMasonryLevel=q.target;if(q.legacyFiring&&b.type!=='road')b.legacyFiringLevel=q.target;delete b.construction;changed=true;
  s.news.unshift({title:q.kind==='upgrade'?`${(BUILDINGS[b.type]?.name||'Дорога')} · уровень ${b.level}`:`Построено: ${(BUILDINGS[b.type]?.name||'Дорога')}`,text:'Жители доставили материалы и завершили работы.',kind:'build',year:s.year,season:s.season,tick:s.tick});s.news=s.news.slice(0,80);
  // Workforce synchronization sees the old site and routes builders home.
 }
 if(changed)s.capacity=housingOf(s);return changed;
}

export function orderedSites(s){return constructionEntities(s).map((b,index)=>({b,index})).filter(({b})=>b.construction).sort((a,b)=>(b.b.construction.priority??1)-(a.b.construction.priority??1)||(a.b.construction.order??a.index)-(b.b.construction.order??b.index)).map(({b})=>b);}
export const nextOrder=s=>Math.max(-1,...constructionEntities(s).map((b,i)=>b.construction?.order??i))+1;
