import {dairyRecipe} from './dairy.js';
import {BUILDINGS,MATERIALS,buildingKey,outputMultiplier} from './definitions.js';
import {artisanSummary,artisanRecipe,isArtisan} from './artisan.js';
import {BRICK_RECIPE} from './bricks.js';
import {KILN_RECIPE,FIRING_SECONDS,COOLING_SECONDS} from './kilns.js';
import {weavingBatch,craftBatch,flockSize} from './textiles.js';
import {beliefMultiplier} from './wellbeing.js';
import {resourceLabel,resourceUnits} from './resource-display.js';
const n=value=>Number.isFinite(value)?Math.max(0,value):0;
const amount=value=>Number(n(value).toFixed(2));
const quantities=values=>Object.entries(values).map(([key,value])=>`${amount(value)} ${resourceUnits[key]||resourceLabel(key).toLowerCase()}`).join(' + ');
const stages={idle:'Ожидание сырья',forming:'Формовка сосудов',drying:'Сушка сосудов',firing:'Обжиг керамики',cooling:'Остывание печи',brewing:'Приготовление напитка',ready:'Готово к перевозке'};
function reserved(s,resource){
 let total=0;
 for(const b of [...s.buildings||[],...s.roads||[]])total+=n(b.construction?.required?.[resource]);
 for(const q of s.trade?.sales||[])if(q.resource===resource)total+=Math.max(0,n(q.amount)-n(q.loaded)-n(q.cancelled));
 if(s.festival&&!s.festival.consumed)for(const allocation of Object.values(s.festival.allocations||{}))total+=n(allocation[resource]);
 return total;
}
function outputAmounts(s,b){
 const mult=outputMultiplier(b);
 if(b.type==='cowshed')return {milk:3};
 if(isArtisan(b))return b.type==='pottery'?{pottery:2}:{beer:3};
 if(b.type==='brickyard')return {brick:4};if(b.type==='kiln')return {firedBrick:4};
 if(b.type==='field')return {food:Math.min(7*mult,n(b.crop?.sheaves))};
 return Object.fromEntries(Object.entries(BUILDINGS[b.type].output).map(([key,value])=>[key,value*mult*(key==='food'&&s.buffs?.fertility?1.6:['clay','reed'].includes(key)&&s.buffs?.inspiration?1.75:['faith','prestige'].includes(key)&&s.buffs?.sunlight?1.8:1)*(key==='faith'?beliefMultiplier(s):1)]));
}
export function productionReadout(s,b){
 const def=BUILDINGS[b.type];if(!def||!Object.keys(def.output).length)return '';
 const key=buildingKey(b),artisan=artisanSummary(b),v=artisan||b.brickmaking||b.firing||b.weaving||b.tailoring||b.dairy||{},output=outputAmounts(s,b),people=s.citizens||[];
 const recipe=b.type==='cowshed'?dairyRecipe:isArtisan(b)?artisanRecipe(b):b.type==='brickyard'?BRICK_RECIPE:b.type==='kiln'?KILN_RECIPE:b.type==='weaver'?{wool:weavingBatch(b)}:b.type==='tailor'?{cloth:craftBatch(b)}:b.type==='field'?{food:4}:{};
 const active=isArtisan(b)?v.stage!=='idle':b.type==='brickyard'?v.wet>0||v.ready>0:b.type==='kiln'?v.hot>0||v.ready>0:false;
 const incoming=resource=>people.reduce((total,c)=>total+(resource==='water'&&c.waterTrip?.target===key?n(c.waterTrip.load):c.seedField===key&&resource==='food'?n(c.seedFood):c.craftSite===key?(c.craftMaterial===resource?n(c.craftAmount):resource==='wool'?n(c.craftWool):resource==='cloth'?n(c.craftCloth):0):0),0);
 const buffer=resource=>b.type==='field'?n(b.crop?.seedStock):n(v[resource]);
 const needs=resource=>active?null:Math.max(0,recipe[resource]-(b.type==='field'?n(b.crop?.seedUsed??n(b.crop?.sown)*4):0)-(resource==='pottery'&&v.vesselUses>0?1:buffer(resource))-incoming(resource));
 const stage=b.type==='cowshed'?`Доение · ${b.dairy?.cows||0} коров · ${b.dairy?.calves||0} телят`:artisan?stages[v.stage]:b.type==='brickyard'?v.wet?'Сырец сохнет':v.ready?'Готово к перевозке':'Ожидание сырья / формовка':b.type==='kiln'?v.hot?v.time<FIRING_SECONDS?'Идёт обжиг':'Печь остывает':v.ready?'Готово к перевозке':'Ожидание сырья / загрузка':b.type==='field'?'Посев, жатва и обмолот':b.type==='sheepfold'?`Стадо · ${flockSize(b)} овец`:'Производство';
 const recipeText=b.type==='field'?'4 еды на посев · урожай и снопы учитываются отдельно':`${Object.keys(recipe).length?`${quantities(b.type==='brewery'?{food:4,water:3}:recipe)} → `:''}${quantities(output)} ${['weaver','tailor','pottery','brewery','brickyard','kiln'].includes(b.type)?'за партию':'за рейс'}`;
 const inputs=Object.keys(recipe).length?`<div class="production-materials"><table><caption>Сырьё двора</caption><thead><tr><th>Материал</th><th>${b.type==='field'?'На посев':'На партию'}</th><th>В буфере</th><th>В пути</th><th>Нужно</th></tr></thead><tbody>${Object.keys(recipe).map(resource=>`<tr><th scope="row">${resourceLabel(resource)}</th><td>${b.type==='brewery'&&resource==='pottery'?'1 на 4 партии':amount(recipe[resource])}</td><td>${amount(buffer(resource))}</td><td>${amount(incoming(resource))}</td><td>${needs(resource)===null?'—':amount(needs(resource))}</td></tr>`).join('')}</tbody></table></div>`:'';
 const results=Object.keys(output).map(resource=>{const ready=isArtisan(b)||['brickyard','kiln'].includes(b.type)?n(v.ready):b.type==='sheepfold'?n(b.flock?.fleece):null,carried=people.reduce((total,c)=>total+(c.work===key&&!c.site&&!c.tradeJob&&!c.saleJob&&!c.districtJob?n(c.cargo?.[resource]):0),0);return `<p class="production-output"><b>${resourceLabel(resource)}</b>${ready!==null?`<br>${b.type==='sheepfold'?'Доступно для сбора':'Готово на месте'}: <b>${amount(ready)}</b>`:''}<br>Несут на склад: <b>${amount(carried)}</b><br>${MATERIALS.includes(resource)?'На складах города':'Накоплено городом'}: <b>${amount(s.resources?.[resource])}</b>${MATERIALS.includes(resource)?`<br>Зарезервировано городом: <b>${amount(reserved(s,resource))}</b>`:''}</p>`;}).join('');
 const notes=[Object.keys(recipe).length?'В буфере — уже доставленное сырьё; груз в пути ещё не доступен мастерам.':'',active?'Сырьё текущей партии уже израсходовано.':'','Городские запасы уже доставлены на склады. Резервы отложены на стройки, продажи и праздник.',isArtisan(b)?`Труд ×${amount(v.laborMultiplier)}; сушка, обжиг и остывание идут отдельно от труда.`:'',b.type==='brewery'?`Сосуд служит 4 партиям; использований сосуда: <b>${amount(v.vesselUses)}</b>.`:'',b.type==='field'?`Осталось в поле: ${amount(b.crop?.remaining)} еды; снопов на току: ${amount(b.crop?.sheaves)}. Снопы требуют обмолота.`:'',b.type==='sheepfold'?'Показана шерсть на овцах; пастухам ещё нужно её собрать.':'',Object.hasOwn(recipe,'water')?'Вода хранится только на месте и у водоносов; общего складского запаса нет.':''].filter(Boolean).join('<br>');
 const progress=artisan?.duration>0?Math.floor(Math.min(1,n(v.elapsed)/v.duration)*100):b.type==='brickyard'&&v.wet?Math.floor(Math.min(1,n(v.drying)/30)*100):b.type==='kiln'&&v.hot?Math.floor(Math.min(1,v.time<FIRING_SECONDS?n(v.time)/FIRING_SECONDS:n(v.time-FIRING_SECONDS)/COOLING_SECONDS)*100):null;
 return `<section class="production-readout" aria-label="Производство: ${def.name}"><h4>${stage}</h4>${progress===null?'':`<div class="artisan-stage" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}" aria-label="Этап выполнен на ${progress}%"><i style="width:${progress}%"></i></div><small>Этап выполнен на ${progress}%</small>`}<p class="production-recipe">${recipeText}</p>${inputs}${Object.keys(recipe).some(resource=>MATERIALS.includes(resource))?`<small class="production-note">Сырьё на складах города: ${quantities(Object.fromEntries(Object.keys(recipe).filter(resource=>MATERIALS.includes(resource)).map(resource=>[resource,n(s.resources?.[resource])])))}</small>`:''}${results}<small class="production-note">${notes}</small></section>`;
}
