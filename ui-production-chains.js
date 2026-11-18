import {artisanRecipe,COPPER_PRODUCTS,isArtisan} from './artisan.js';
import {buildingDefinition,buildingPresentation} from './building-presentation.js';
import {BRICK_RECIPE} from './bricks.js';
import {AUTUMN_CROPS} from './crop-calendar.js';
import {dairyRecipe} from './dairy.js';
import {capacityOf} from './definitions.js';
import {buildingKnowledgeReason} from './godhood.js';
import {KILN_RECIPE} from './kilns.js';
import {craftBatch,weavingBatch} from './textiles.js';
import {resourceLabel} from './resource-display.js';
import {resourceIcon} from './resource-icons.js';
import {isStrictSumer} from './scenario-profiles.js';
import {BUILDING_GROUPS} from './ui-catalog.js';

const levels=[
 {title:'Добыча и поставки',buildings:[
  [1,'field'],[2,'clay'],[3,'cowshed'],[4,'sheepfold'],[5,'reed'],[6,'market'],
  [7,'waterpoint'],[8,'quarry'],[9,'logging'],[10,'garden'],[11,'fishing'],[12,'hunting']
 ]},
 {title:'Переработка',buildings:[
  [1,'bakery'],[2,'pottery'],[3,'brickyard'],[4,'weaver'],[5,'basketry'],[6,'matYard'],
  [7,'linenYard'],[8,'coppersmith'],[9,'joineryYard']
 ]},
 {title:'Дальнейшая переработка',buildings:[[1,'brewery'],[2,'dairyStore'],[3,'kiln'],[4,'tailor']]}
];
const dependencies=[
 ['field','bakery','grain'],['field','brewery','grain'],['clay','pottery','clay'],['clay','brickyard','clay'],
 ['cowshed','dairyStore','milk'],['pottery','brewery','pottery'],['pottery','dairyStore','pottery'],
 ['brickyard','kiln','brick'],['sheepfold','weaver','wool'],['weaver','tailor','cloth'],['linenYard','tailor','cloth'],
 ['reed','basketry','reed'],['reed','matYard','reed'],
 ['market','linenYard','flax'],['market','coppersmith','copper'],['market','joineryYard','timber']
];
const linked=new Set(levels.flatMap(({buildings})=>buildings.map(([,building])=>building)));
const sourceProducts={field:['grain'],market:['flax','copper','timber'],waterpoint:['water']};
const standaloneExtras={life:['starterHut','reedCamp'],routes:['road']};
const extras={
 road:{name:'Дорога',effect:'Соединяет городские маршруты',desc:'Связывает дома, склады и рабочие места. Построенную дорогу можно улучшать, чтобы ускорять перевозку. Частые проходы жителей оставляют отдельные протоптанные тропы.'}
};
const recipes={
 brickyard:BRICK_RECIPE,kiln:KILN_RECIPE,cowshed:dairyRecipe,
 weaver:{wool:weavingBatch({type:'weaver',level:1})},tailor:{cloth:craftBatch({type:'tailor',level:1})}
};
const notes={
 field:'Урожай пополняет общий запас еды',market:'Эти поставки принимает и речная пристань',
 clay:'Добыча из месторождения · за рейс',reed:'Сбор у зарослей · за рейс',
 brickyard:'Сушка на воздухе',kiln:'Тростник служит топливом',
 sheepfold:'Со стада · за рейс',tailor:'Требуется мастер одежды',
 quarry:'Добыча из месторождения · за рейс. Камень также можно купить у купцов.',
 dairyStore:'Сухой сыр учитывается как еда',linenYard:'Льняное полотно поступает в общий запас ткани'
};
const placementInfo={
 clay:'Ставится на залежи глины.',reed:'Ставится на зарослях тростника.',quarry:'Ставится на залежи камня.',
 logging:'Ставится у лесного месторождения.',garden:'Нужен участок с финиковыми пальмами.',
 fishing:'Нужен доступный рыбацкий участок рядом с водой.',hunting:'Нужны угодья рядом с дичью.'
};

function presentation(state,type){
 if(type==='starterHut'||type==='reedCamp'){
  const house={type:'house',level:1,[type]:true};
  const capacity=capacityOf(house);
  const effect=type==='reedCamp'?`Временное укрытие · ${capacity} мест`:`Стартовое жильё · ${capacity} места`;
  return {...buildingPresentation(state,house),effect};
 }
 return extras[type]??buildingDefinition(state,type);
}

function functionDescription(state,type,definition){
 if(type==='field'){
  const seasons=state.cropCalendar===AUTUMN_CROPS?'Осенью сеют, зимой ячмень растёт, весной его жнут.':'Весной сеют, летом ячмень растёт, осенью его жнут.';
  return `${seasons} Для роста нужен полив или дождь. После жатвы работники обмолачивают снопы и несут зерно на склад. Из зерна город получает еду, а общая печь использует его для хлеба.`;
 }
 if(type==='brewery')return 'Ячмень пополняет общий запас еды. Пивоварня берёт оттуда 4 еды сверх семенного резерва, добавляет 3 воды и выпускает 3 напитка. Один керамический сосуд нужен на четыре партии.';
 if(type==='cowshed')return `Работники приносят тростник и воду, ухаживают за стадом и доят коров. Молоко перевозят на склад, в дома или во двор молочных припасов.${isStrictSumer(state)?' Часть свежего молока портится при смене сезона.':''}`;
 return definition.desc;
}

function resource(key,units,{kind='output',upTo=false,grain=false}={}){
 const symbol=grain?'grain':key;
 const label=grain?'Ячмень / еда':symbol==='grain'?'Ячмень':resourceLabel(key);
 const count=units===undefined?'':` data-units="${units}"`;
 return `<span class="chain-resource" data-chain-${kind}="${key}"${count}>${resourceIcon(symbol,{decorative:true})}<span>${label}</span>${units===undefined?'':`<b>${upTo?'до ':'×'}${units}</b>`}</span>`;
}

function cardHTML(state,building,column){
 const def=presentation(state,building);
 const recipe=recipes[building]??(isArtisan({type:building})?artisanRecipe({type:building}):null);
 const costs=Object.entries(recipe??{}).filter(([key])=>building!=='brewery'||key!=='pottery');
 const condition=building in extras||['starterHut','reedCamp'].includes(building)?'':buildingKnowledgeReason(state,building);
 const outputKeys=sourceProducts[building]??(building==='coppersmith'?COPPER_PRODUCTS:Object.keys(def.output??{}));
 const showOutput=column&&outputKeys.length;
 const note=notes[building];
 const graphNode=column?` data-production-node="${building}" data-production-column="${column}" style="grid-column:${column}"`:'';
 const heading=column?`<button type="button" class="production-card-toggle" aria-pressed="false" aria-label="${def.name}, подсветить цепочку">${def.name}</button>`:def.name;
 return `<article class="chain-entry" data-chain-building="${building}"${graphNode}>
  <div class="chain-card-heading">
   <h4>${heading}</h4>
   <details class="chain-help" name="production-building-help">
    <summary aria-label="О постройке: ${def.name}">?</summary>
    <div class="chain-help-text" role="region" aria-label="${def.name}">
     <p>${functionDescription(state,building,def)}</p>
     ${placementInfo[building]?`<p>${placementInfo[building]}</p>`:''}
     ${condition?`<p class="chain-help-condition">${condition}</p>`:''}
    </div>
   </details>
  </div>
  <div class="chain-card">
   <img src="assets/ui/production-chains/${building}.webp?v=alluvial-craft-20261118" width="320" height="200" alt="" loading="lazy" decoding="async">
   <div class="chain-card-body">
    ${showOutput?`<div class="chain-product">${building==='coppersmith'?'<span>На выбор</span>':''}${outputKeys.map(key=>resource(key,def.output[key],{upTo:building==='sheepfold'})).join('')}</div>`:`<p class="chain-effect">${def.effect}</p>`}
    ${costs.length?`<div class="chain-input"><span>Нужно</span>${costs.map(([key,units])=>resource(key,units,{kind:'input',grain:key==='food'&&['bakery','brewery'].includes(building)})).join('')}</div>`:''}
    ${building==='brewery'?`<div class="chain-input"><span>На 4 партии</span>${resource('pottery',recipe.pottery,{kind:'input'})}</div>`:''}
    ${building==='bakery'?`<div class="chain-input"><span>Для стройки</span>${resource('stone',def.stone,{kind:'construction'})}</div>`:''}
    ${note?`<p class="chain-note">${note}</p>`:''}
   </div>
  </div>
 </article>`;
}

function graphHTML(state){
 const columns=Math.max(...levels.flatMap(({buildings})=>buildings.map(([column])=>column)));
 return `<div class="production-viewport" tabindex="0" role="region" aria-label="Схема производства с горизонтальной прокруткой" data-city-scroll>
  <div class="production-graph" style="--production-columns:${columns}">
   <p class="production-selection-status" role="status" data-production-status></p>
   <svg class="production-edges" data-production-edges aria-hidden="true" focusable="false">
    <defs><marker id="production-arrow" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8Z" fill="context-stroke"/></marker></defs>
    ${dependencies.map(([from,to,key])=>`<path data-from="${from}" data-to="${to}" data-resource="${key}" marker-end="url(#production-arrow)"/>`).join('')}
   </svg>
   ${levels.map(({title,buildings},i)=>`<section class="production-level" data-production-level="${i+1}" aria-label="${title}">
    <h3><span>Уровень ${i+1}</span>${title}</h3>
    <div class="production-level-nodes">${buildings.map(([column,building])=>cardHTML(state,building,column)).join('')}</div>
   </section>`).join('')}
  </div>
 </div>`;
}

export function productionChainsHTML(state){
 const standalone=BUILDING_GROUPS.map(({id,name,types})=>({name,types:[...types.filter(type=>!linked.has(type)),...(standaloneExtras[id]??[])]}));
 return `<div class="production-chains">
  <div class="chains-intro"><p>Нажми на постройку, чтобы подсветить её связи. Повторное нажатие снимет подсветку.</p>
   <div class="production-navigation">
    <button type="button" data-production-pan="-1" aria-label="Прокрутить схему влево">←</button>
    <button type="button" data-production-pan="1" aria-label="Прокрутить схему вправо">→</button>
    <a href="#chain-directory-title">К остальным постройкам ↓</a>
   </div></div>
  ${graphHTML(state)}
  <section class="chain-directory" aria-labelledby="chain-directory-title">
   <h3 class="chain-group-title" id="chain-directory-title" tabindex="-1">Остальные постройки</h3>
   ${standalone.filter(({types})=>types.length).map(({name,types})=>`<section class="chain-directory-group" aria-label="${name}">
    <h3>${name}</h3><div class="chain-directory-grid">${types.map(type=>cardHTML(state,type)).join('')}</div>
   </section>`).join('')}
  </section>
 </div>`;
}
