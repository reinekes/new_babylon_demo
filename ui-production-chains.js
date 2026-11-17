import {buildingDefinition} from './building-presentation.js';
import {BRICK_RECIPE} from './bricks.js';
import {KILN_RECIPE} from './kilns.js';
import {craftBatch,weavingBatch} from './textiles.js';
import {resourceLabel} from './resource-display.js';
import {resourceIcon} from './resource-icons.js';

const chains=[
 {id:'clay',title:'Кирпич',steps:[
  {building:'clay',output:'clay',note:'Из месторождения · за рейс'},
  {building:'brickyard',output:'brick',inputs:BRICK_RECIPE,note:'Сушка на воздухе'},
  {building:'kiln',output:'firedBrick',inputs:KILN_RECIPE,note:'Тростник служит топливом'}
 ]},
 {id:'wool',title:'Текстиль',steps:[
  {building:'sheepfold',output:'wool',upTo:true,note:'Со стада · за рейс'},
  {building:'weaver',output:'cloth',inputs:{wool:weavingBatch({type:'weaver',level:1})}},
  {building:'tailor',output:'clothing',inputs:{cloth:craftBatch({type:'tailor',level:1})},note:'Требуется мастер одежды'}
 ]},
 {id:'stone',title:'Камень',steps:[
  {building:'quarry',output:'stone',note:'Из месторождения · за рейс. Камень также можно купить у купцов.'},
  {building:'bakery',use:'stone',note:'Камень входит в стоимость постройки'}
 ]}
];

const stages=['Сырьё','Переработка','Готовый продукт'];
function resource(key,units,{input=false,upTo=false}={}){
 return `<span class="chain-resource" ${input?'data-chain-input':'data-chain-output'}="${key}" data-units="${units}">${resourceIcon(key,{decorative:true})}<span>${resourceLabel(key)}</span><b>${upTo?'до ':'×'}${units}</b></span>`;
}

function stepHTML(state,step,index){
 const {building,output,inputs,use,note,upTo}=step;
 const definition=buildingDefinition(state,building);
 const costs=use?{[use]:definition[use]}:inputs;
 const stage=use?'Применение':stages[index];
 return `<li class="chain-step" data-chain-building="${building}">
  ${index?'<span class="chain-arrow" aria-hidden="true">↓</span>':''}
  <p class="chain-stage">Этап ${index+1} · ${stage}</p>
  <div class="chain-card">
   <img src="assets/ui/production-chains/${building}.webp" width="320" height="200" alt="" loading="lazy" decoding="async">
   <div class="chain-card-body">
    <h4>${definition.name}</h4>
    ${output?`<div class="chain-product">${resource(output,definition.output[output],{upTo})}</div>`:''}
    ${costs?`<div class="chain-input"><span>${use?'Для стройки':'Нужно'}</span>${Object.entries(costs).map(([key,units])=>resource(key,units,{input:true})).join('')}</div>`:''}
    ${note?`<p class="chain-note">${note}</p>`:''}
   </div>
  </div>
 </li>`;
}

export function productionChainsHTML(state){
 return `<div class="production-chains" data-city-scroll>
  <p class="chains-intro">Три примера · объёмы для зданий I уровня</p>
  <div class="production-chains-grid">
   ${chains.map(({id,title,steps})=>`<section class="production-chain" data-production-chain="${id}" aria-label="${title}">
    <h3>${resourceIcon(id,{decorative:true})}${title}</h3>
    <ol>${steps.map((step,i)=>stepHTML(state,step,i)).join('')}</ol>
   </section>`).join('')}
  </div>
 </div>`;
}
