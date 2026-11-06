import {SICKLE_EDGE} from './agriculture.js';
import {startManagedDairy} from './dairy.js';
import {startManagedFlock} from './textiles.js';
import {buildingDefinition} from './building-presentation.js';
import {recordBuilderCompletion} from './godhood.js';
import {housingOf,MATERIALS,isOperational} from './definitions.js';
import {stampBuildingCompletion} from './building-chronology.js';
import {initializeProductionAccounting} from './building-production-history.js';
import {isStrictSumer} from './scenario-profiles.js';
import {markRoadTopologyChanged} from './road-revisions.js';
export const isComplete=isOperational;
export const floodRepairCost=b=>b.type==='road'?{clay:2,reed:1}:{clay:4,reed:2};
export const constructionEntities=s=>[...s.buildings,...s.roads||[]];
export const workRequired=b=>b.construction.kind==='repair'?(b.type==='road'?6:8):(b.type==='road'?6:12)*b.construction.target;
export const createOrder=(cost,target=1,kind='new')=>({kind,target,priority:1,required:Object.fromEntries(MATERIALS.map(k=>[k,cost[k]||0])),remaining:Object.fromEntries(MATERIALS.map(k=>[k,cost[k]||0])),delivered:Object.fromEntries(MATERIALS.map(k=>[k,0])),work:0});
export const materialsReady=q=>Object.keys(q.required).every(k=>(q.delivered[k]||0)>=q.required[k]);
export function constructionProgress(b){
 const q=b.construction;if(!q)return {ratio:1,stage:'Готово',work:1,materials:1};
 const total=Object.values(q.required).reduce((a,b)=>a+b,0),materials=total?Object.values(q.delivered).reduce((a,b)=>a+b,0)/total:1,work=Math.min(1,q.work/(workRequired(b)));
 return {ratio:materials*.4+work*.6,materials,work,stage:!materialsReady(q)?'Доставка материалов':q.kind==='repair'?'Ремонт':b.type==='road'?'Укладка покрытия':b.type==='canal'?(work<.7?'Выкапывание русла':'Укрепление берегов'):work<.3?'Фундамент':work<.75?'Возведение стен':'Крыша и отделка'};
}
export function finishConstruction(s){
 let changed=false;
 for(const b of constructionEntities(s)){const q=b.construction;if(!q||!materialsReady(q)||q.work<workRequired(b)-1e-8)continue;
  if(q.kind==='new'&&b.type!=='road'){
   stampBuildingCompletion(s,b);
   if(b.type==='field'&&isStrictSumer(s))b.sickle={edge:SICKLE_EDGE,pottery:0};
   if(b.type==='garden'&&isStrictSumer(s))b.orchardPlantedTick=s.tick;
   if(b.type==='sheepfold'&&isStrictSumer(s))startManagedFlock(b);
   if(b.type==='kiln'&&isStrictSumer(s))b.kilnWear=0;
   if(b.type==='cowshed'&&isStrictSumer(s))startManagedDairy(b);
  }
  if(q.kind==='repair')delete b.floodDamage;
  recordBuilderCompletion(s,b);b.level=q.target;if(b.type==='road')markRoadTopologyChanged(s);if(q.legacyMasonry&&b.type!=='road')b.legacyMasonryLevel=q.target;if(q.legacyFiring&&b.type!=='road')b.legacyFiringLevel=q.target;delete b.construction;changed=true;
  s.news.unshift({title:q.kind==='repair'?`Отремонтировано: ${buildingDefinition(s,b.type)?.name||'Дорога'}`:q.kind==='upgrade'?`${(buildingDefinition(s,b.type)?.name||'Дорога')} · уровень ${b.level}`:`Построено: ${(buildingDefinition(s,b.type)?.name||'Дорога')}`,text:'Жители доставили материалы и завершили работы.',kind:'build',year:s.year,season:s.season,tick:s.tick});s.news=s.news.slice(0,80);
  // Workforce synchronization sees the old site and routes builders home.
 }
 if(changed){s.capacity=housingOf(s);initializeProductionAccounting(s);}return changed;
}

export function orderedSites(s){return constructionEntities(s).map((b,index)=>({b,index})).filter(({b})=>b.construction).sort((a,b)=>(b.b.construction.priority??1)-(a.b.construction.priority??1)||(a.b.construction.order??a.index)-(b.b.construction.order??b.index)).map(({b})=>b);}
export const nextOrder=s=>Math.max(-1,...constructionEntities(s).map((b,i)=>b.construction?.order??i))+1;
