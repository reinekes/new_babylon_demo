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

const chains=[
 {id:'clay',title:'Кирпич',icon:'clay',stages:[['Сырьё','clay'],['Переработка','brickyard'],['Готовый продукт','kiln']]},
 {id:'wool',title:'Текстиль',icon:'wool',stages:[['Сырьё','sheepfold'],['Переработка','weaver'],['Готовый продукт','tailor']]},
 {id:'stone',title:'Камень',icon:'stone',stages:[['Сырьё','quarry'],['Применение',{building:'bakery',use:'stone'}]]},
 {id:'bread',title:'Хлеб',icon:'food',stages:[['Сырьё','field'],['Готовый продукт','bakery']]},
 {id:'milk',title:'Молочные припасы',icon:'milk',stages:[['Сырьё','cowshed'],['Готовый продукт','dairyStore']]},
 {id:'beer',title:'Сосуды и напитки',icon:'pottery',stages:[['Посуда','pottery'],['Готовый продукт','brewery']]},
 {id:'reed',title:'Изделия из тростника',icon:'reed',stages:[['Сырьё','reed'],['Готовые изделия','basketry','matYard']]},
 {id:'imports',title:'Привозное сырьё',icon:'timber',stages:[['Купцы доставляют лён, медь и лес','market','harbor'],['Переработка','linenYard','coppersmith','joineryYard']]}
];
const groups=[
 {title:'Материалы и одежда',chains:chains.slice(0,3)},
 {title:'Еда, напитки и посуда',chains:chains.slice(3,6)},
 {title:'Плетение и привозное сырьё',chains:chains.slice(6)}
];
const linked=new Set(chains.flatMap(({stages})=>stages.flatMap(([, ...steps])=>steps.map(step=>step.building??step))));
const standaloneExtras={life:['starterHut','reedCamp'],routes:['road']};
const extras={
 road:{name:'Дорога',effect:'Соединяет городские маршруты',desc:'Связывает дома, склады и рабочие места. Построенную дорогу можно улучшать, чтобы ускорять перевозку. Частые проходы жителей оставляют отдельные протоптанные тропы.'}
};
const recipes={
 brickyard:BRICK_RECIPE,kiln:KILN_RECIPE,cowshed:dairyRecipe,
 weaver:{wool:weavingBatch({type:'weaver',level:1})},tailor:{cloth:craftBatch({type:'tailor',level:1})}
};
const notes={
 clay:'Добыча из месторождения · за рейс',reed:'Сбор у зарослей · за рейс',
 brickyard:'Сушка на воздухе',kiln:'Тростник служит топливом',
 sheepfold:'Со стада · за рейс',tailor:'Требуется мастер одежды',
 quarry:'Добыча из месторождения · за рейс. Камень также можно купить у купцов.',
 dairyStore:'Сухой сыр учитывается как еда',linenYard:'Льняное полотно поступает в общий запас ткани',
 coppersmith:'Изделие выбирается в мастерской'
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
 if(type==='cowshed')return `Работники приносят тростник и воду, ухаживают за стадом и доят коров. Молоко перевозят на склад, в дома или во двор молочных припасов.${isStrictSumer(state)?' Часть свежего молока портится при смене сезона.':''}`;
 return definition.desc;
}

function resource(key,units,{input=false,upTo=false}={}){
 return `<span class="chain-resource" ${input?'data-chain-input':'data-chain-output'}="${key}" data-units="${units}">${resourceIcon(key,{decorative:true})}<span>${resourceLabel(key)}</span><b>${upTo?'до ':'×'}${units}</b></span>`;
}

function cardHTML(state,step,inChain){
 const building=step.building??step,use=step.use;
 const def=presentation(state,building);
 const recipe=recipes[building]??(isArtisan({type:building})?artisanRecipe({type:building}):null);
 const ingredientKeys=Object.keys(recipe??{}).filter(key=>building!=='brewery'||key!=='pottery');
 const costs=use?[[use,def[use]]]:ingredientKeys.map(key=>[key,recipe[key]]);
 const condition=building in extras||['starterHut','reedCamp'].includes(building)?'':buildingKnowledgeReason(state,building);
 const outputKeys=building==='coppersmith'?COPPER_PRODUCTS:Object.keys(def.output??{});
 const showOutput=inChain&&!use&&building!=='field'&&outputKeys.length;
 const note=use?'Камень входит в стоимость постройки':notes[building];
 return `<article class="chain-entry" data-chain-building="${building}">
  <div class="chain-card-heading">
   <h4>${def.name}</h4>
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
   <img src="assets/ui/production-chains/${building}.webp" width="320" height="200" alt="" loading="lazy" decoding="async">
   <div class="chain-card-body">
    ${showOutput?`<div class="chain-product">${building==='coppersmith'?'<span>На выбор</span>':''}${outputKeys.map(key=>resource(key,def.output[key],{upTo:building==='sheepfold'})).join('')}</div>`:`<p class="chain-effect">${building==='field'?'Ячмень · урожай после обмолота':def.effect}</p>`}
    ${costs.length?`<div class="chain-input"><span>${use?'Для стройки':'Нужно'}</span>${costs.map(([key,units])=>resource(key,units,{input:true})).join('')}</div>`:''}
    ${building==='brewery'?`<div class="chain-input"><span>На 4 партии</span>${resource('pottery',recipe.pottery,{input:true})}</div>`:''}
    ${note?`<p class="chain-note">${note}</p>`:''}
   </div>
  </div>
 </article>`;
}

function chainHTML(state,{id,title,icon,stages}){
 return `<section class="production-chain" data-production-chain="${id}" aria-label="${title}">
  <h3>${resourceIcon(icon,{decorative:true})}${title}</h3>
  <ol>${stages.map(([label,...steps],i)=>`<li class="chain-step">
   ${i?'<span class="chain-arrow" aria-hidden="true">↓</span>':''}
   <p class="chain-stage">Этап ${i+1} · ${label}</p>
   ${steps.map(step=>cardHTML(state,step,true)).join('')}
  </li>`).join('')}</ol>
 </section>`;
}

export function productionChainsHTML(state){
 const standalone=BUILDING_GROUPS.map(({id,name,types})=>({name,types:[...types.filter(type=>!linked.has(type)),...(standaloneExtras[id]??[])]}));
 return `<div class="production-chains" data-city-scroll>
  <div class="chains-intro"><p>Нажми «?», чтобы узнать назначение постройки. Количество ресурсов указано для I уровня.</p>
   <a href="#chain-directory-title">К остальным постройкам ↓</a></div>
  ${groups.map(({title,chains})=>`<section class="chain-group" aria-label="${title}">
   <h3 class="chain-group-title">${title}</h3>
   <div class="production-chains-grid${chains.length===2?' production-chains-grid-two':''}">${chains.map(chain=>chainHTML(state,chain)).join('')}</div>
  </section>`).join('')}
  <section class="chain-directory" aria-labelledby="chain-directory-title">
   <h3 class="chain-group-title" id="chain-directory-title" tabindex="-1">Остальные постройки</h3>
   ${standalone.filter(({types})=>types.length).map(({name,types})=>`<section class="chain-directory-group" aria-label="${name}">
    <h3>${name}</h3><div class="chain-directory-grid">${types.map(type=>cardHTML(state,type,false)).join('')}</div>
   </section>`).join('')}
  </section>
 </div>`;
}
