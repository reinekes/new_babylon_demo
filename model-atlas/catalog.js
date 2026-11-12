import { BUILDINGS, RESOURCE_NAMES } from '../definitions.js';
import { buildingDefinition, buildingPresentation } from '../building-presentation.js';
import { strictScenario, legacyScenario } from '../scenario-profiles.js';
import { GOODS_KINDS } from '../game3d/goods.js?v=sumer-props-20261112';
import * as ambient from '../game3d/ambient-fauna.js';

export const groups = {
  buildings:'Здания и сооружения', people:'Люди', animals:'Животные', birds:'Птицы',
  transport:'Транспорт', plants:'Растения', goods:'Грузы и предметы', other:'Отдельные сцены и резерв'
};

export const statuses = {
  active:'Используется', fallback:'Резерв при ошибке', optional:'Отдельная сцена', spare:'Файл в запасе'
};

const singleLevel = new Set(['cityWall','cityGate','canal','levee']);
const model = (kind, label, fields={}) => ({kind,label,...fields});
const row = (group, title, description, ...previews) => ({group,title,description,previews});
const built = (type, level, starter=false) => model('building', `Уровень ${level}`, {type,level,starter});
const names = {
  'source-walk-male':'Взрослый мужчина','source-walk-female':'Взрослая женщина',
  'source-walk-child':'Ребёнок','source-walk-adolescent':'Подросток',
  'resident':'Житель, основной резерв','resident-lod':'Житель, облегчённый GLB',
  'sumer-people':'Шумерские взрослые, резерв','sumer-child':'Шумерский ребёнок, резерв','sumer-adolescent':'Шумерский подросток, резерв',
  'historical-man':'Жрец и музыкант','caravan-merchant':'Купец, прежняя ветка',
  'goat-downloaded':'Коза, городская модель','goat-authored-lod':'Коза, авторская модель',
  'goat-authored':'Коза, исходная авторская модель','goat':'Коза, прежний GLB',
  'ambient-bull':'Бык и основа модели вола','ambient-donkey':'Вьючный осёл',
  'ambient-dog':'Собака','ambient-sheep-kenchoo':'Овца, фоновая модель','sheep':'Овца из овчарни',
  'imported-boar':'Кабан','imported-fox':'Лиса','imported-lioness':'Львица',
  'gazelle-downloaded':'Газель','jackal':'Шакал','cat-walk':'Кошка, ходьба','cat-sitting':'Кошка, сидит',
  'shore-kingfisher':'Зимородок · самец (вариант для сравнения)',
  'shore-seagull':'Чайка · самка (вариант для сравнения)',
  'ambient-duck':'Утка','imported-goose':'Гусь','imported-orange-bird':'Мелкая оранжевая птица',
  'imported-sky-birds':'Стая, импортированный GLB','sky-bird-single':'Птица в полёте, GLB',
  'caravan-camel':'Верблюд, прежняя ветка','river-cargo-boat':'Грузовая лодка, прежняя ветка',
  'adobe-courtyard':'Двор из художественной сцены','date-palm':'Финиковая пальма, художественный двор',
  'valley-date-palm':'Финиковая пальма долины','valley-barley':'Ячмень','crop-emmer':'Полба',
  'festival-candle':'Свеча праздника','sacred-ishtar-gate':'Врата Иштар, исходный GLB',
  'sacred-shrine-3':'Святилище III, исходный GLB','sacred-ziggurat-1':'Зиккурат I, исходный GLB',
  'sacred-ziggurat-3':'Зиккурат III, исходный GLB',
};
const ages = {male:'Мужчина',female:'Женщина',child:'Ребёнок',adolescent:'Подросток'};
function glbGroup(name) {
  if (/^(?:human-native-|source-walk-|sumer-(?:people|child|adolescent)|resident|historical-man|caravan-merchant)/.test(name)) return 'people';
  if (/duck|goose|bird|kingfisher|seagull/.test(name)) return 'birds';
  if (/^ambient-|^caravan-camel|^cat-|^gazelle|^goat|^imported-|^jackal|^sheep/.test(name)) return 'animals';
  if (name==='river-cargo-boat') return 'transport';
  if (/^crop-|^date-palm|^valley-|^miracle-/.test(name)) return 'plants';
  if (name==='festival-candle') return 'goods';
  return 'other';
}
function glbName(name) {
  if (names[name]) return names[name];
  if (name.startsWith('human-native-')) return `${ages[name.slice(13)] ?? name} · резерв`;
  if (/^valley-reed-/.test(name)) return `Тростник · вариант ${name.at(-1)}`;
  if (/^valley-dry-grass-/.test(name)) return `Сухая трава · вариант ${name.at(-1)}`;
  if (name.startsWith('miracle-')) return `Растение чудесного сада · ${name.slice(8)}`;
  return name;
}
export function usageOf(row) {
  const item=row.previews[0];
  const status=item.entry?.status;
  if (status==='optional') return 'studio';
  if (status==='spare'||status==='fallback'||item.reserve) return 'reserve';
  return 'game';
}

export function makeCatalog(index, profile) {
  const state = {scenario:profile==='strict' ? strictScenario() : legacyScenario()};
  const rows = Object.keys(BUILDINGS).map(type => row('buildings', buildingDefinition(state,type).name,
    buildingDefinition(state,type).effect, ...Array.from({length:singleLevel.has(type)?1:3}, (_,i)=>built(type,i+1))));
  const house=rows.splice(rows.findIndex(r=>r.previews[0].type==='house'),1)[0];
  rows.unshift(house,row('buildings',buildingPresentation(state,{type:'house',level:1,starterHut:true}).name,
    'Начальный малый двор · после улучшения использует обычный дом', built('house',1,true), built('house',2), built('house',3)));
  rows.push(row('buildings','Дорога','Три покрытия городской дороги',
    ...[1,2,3].map(level=>model('road',`Уровень ${level}`,{level}))));
  rows.push(row('transport','Южношумерское речное судно','Корпус, борт и шест из игрового генератора', model('boat','Игровая геометрия')));
  rows.push(row('birds','Стая над долиной','Процедурные силуэты, отдельные от GLB',
    model('flock','Игровая геометрия')));
  const wildlife = {
    fish:['Рыба','Игровая геометрия'], mouse:['Мышь','Игровая геометрия'],
    rat:['Крыса','Игровая геометрия'], goat:['Коза','Резервная геометрия'],
    gazelle:['Газель','Резервная геометрия'], cat:['Кошка','Резервная геометрия'],
    jackal:['Шакал','Резервная геометрия'], bird:['Береговая птица','Процедурная модель прежнего слоя']
  };
  rows.push(row('animals','Змея','Фоновая геометрия долины',model('nature','Игровая геометрия',{species:'snakes'})));
  rows.push(row('plants','Перекати-поле','Фоновая геометрия долины',model('nature','Игровая геометрия',{species:'tumbleweeds'})));
  if (ambient.courtyardFauna) Object.assign(wildlife, {pig:['Домашняя свинья','Игровая геометрия'],turtle:['Водяная черепаха','Игровая геометрия']});
  for (const [species,[title,label]] of Object.entries(wildlife)) {
    rows.push(row(species==='bird'?'birds':'animals',title,label,model('wildlife',label,{species,reserve:label!=='Игровая геометрия'})));
  }
  for (const [key,title] of Object.entries({flax:'Лён',lentil:'Чечевица',pea:'Горох',chickpea:'Нут',onion:'Лук'})) {
    rows.push(row('plants',title,'Процедурное растение поля или двора',model('crop','Игровая геометрия',{key})));
  }
  for (const [title,calf] of [['Корова',false],['Телёнок',true]]) {
    rows.push(row('animals',title,'Городской вариант модели коровника',model('dairy','Игровая геометрия',{calf})));
  }
  for (const key of GOODS_KINDS) rows.push(row('goods',(key==='water'?'Вода в кувшинах':RESOURCE_NAMES[key]??key),'Упаковка на складе и при переноске',model('goods','Игровая геометрия',{key})));
  rows.push(row('goods','Светильник из раковины','Форма по раковине из Ниппура (Ур III) · назначение предмета предположительное',model('lamp','Игровая геометрия')));
  for (const entry of index.models) {
    const name = entry.file.replace(/\.glb$/i,'');
    rows.push(row(glbGroup(name), glbName(name), name==='festival-candle'?'Прежняя эпоха · '+entry.file:entry.file,
      model('glb',statuses[entry.status]??entry.status,{entry})));
  }
  return rows;
}
