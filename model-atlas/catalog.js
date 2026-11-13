import { suppliedFauna } from './supplied-fauna.js?v=fauna-500-20261113';
import { BUILDINGS, RESOURCE_NAMES } from '../definitions.js';
import { buildingDefinition, buildingPresentation } from '../building-presentation.js';
import { strictScenario, legacyScenario } from '../scenario-profiles.js';
import { GOODS_KINDS } from '../game3d/goods.js?v=sumer-props-20261112';
import * as ambient from '../game3d/ambient-fauna.js';

export const groups = {
  buildings:'Здания и сооружения', people:'Люди', animals:'Животные', birds:'Птицы',
  mythology:'Мифология', transport:'Транспорт', plants:'Растения', goods:'Грузы и предметы', other:'Отдельные сцены и резерв'
};

export const statuses = {
  active:'Используется', fallback:'Резерв при ошибке', optional:'Отдельная сцена', spare:'Файл в запасе'
};

const singleLevel = new Set(['cityWall','cityGate','canal','levee','watchHouse']);
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
  'ambient-dog':'Собака','ambient-sheep-kenchoo':'Овца · вариант стада','sheep':'Овца из овчарни',
  'ambient-yard-pig':'Домашняя свинья',
  'imported-boar':'Кабан','imported-fox':'Лиса','imported-lioness':'Львица',
  'gazelle-downloaded':'Газель','jackal':'Шакал','cat-walk':'Кошка, ходьба','cat-sitting':'Кошка, сидит',
  'shore-mallard-female':'Кряква · самка',
  'shore-mallard':'Кряква · селезень',
  'shore-seagull':'Чайка · самка (вариант для сравнения)',
  'ambient-duck':'Утка · декоративный вариант','imported-goose':'Гусь','imported-orange-bird':'Мелкая оранжевая птица',
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
  if (/duck|goose|bird|seagull|mallard/.test(name)) return 'birds';
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
  if (item.kind==='source') return 'source';
  if (item.studio||status==='optional') return 'studio';
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
    model('flock','Резервная геометрия',{reserve:true})));
  rows.push(row('mythology','Анзуд','Львиноголовый орёл по мотивам сосуда Энметены',model('relief','Игровой рельеф',{
    species:'anzud',studio:true,sources:[
      {author:'Сосуд Энметены, Лувр',source:'https://collections.louvre.fr/en/ark:/53355/cl010120706'},
      {author:'Лугальбанда и птица Анзуд, ETCSL',source:'https://etcsl.orinst.ox.ac.uk/section1/tr1822.htm'}
    ]
  })));
  rows.push(row('mythology','Небесный бык','Инанна ведёт быка на лазуритовом поводе',model('bust','Игровая скульптура',{
    species:'heavenly-bull',studio:true,sources:[
      {author:'Гильгамеш и Небесный бык, ETCSL',source:'https://etcsl.orinst.ox.ac.uk/section1/tr1812.htm'},
      {author:'Бычья голова для лиры, Метрополитен-музей',source:'https://www.metmuseum.org/art/collection/search/324023'}
    ]
  })));
  rows.push(row('mythology','Змеи Нингишзиды','Переплетённые змеи на сосуде для возлияний',model('vessel','Игровая реконструкция',{
    species:'ningishzida',studio:true,sources:[
      {author:'Сосуд Гудеа, Лувр',source:'https://collections.louvre.fr/en/ark:/53355/cl010143800'}
    ]
  })));
  const literature='https://etcsl.orinst.ox.ac.uk/section1/tr162.htm';
  const seals='https://www.metmuseum.org/art/collection/search/324421';
  for(const [species,title,description,author,source] of [
    ['human-headed-bull','Бык-человек','Авторская скульптура по мотивам шумерской печати','Раннединастическая печать, Метрополитен-музей',seals],
    ['seven-headed-serpent','Семиглавый змей','Авторская скульптура по сюжету о Нинурте','Подвиги Нинурты, ETCSL',literature],
    ['six-headed-ram','Шестиглавый дикий баран','Авторская скульптура по сюжету о Нинурте','Подвиги Нинурты, ETCSL',literature]
  ]) rows.push(row('mythology',title,description,model('myth-sculpture','Авторская реконструкция',{
    species,studio:true,sources:[{author,source}]
  })));
  const wildlife = {
    fish:['Рыба долины · прежняя модель','Резервная геометрия'], mouse:['Домовая мышь · прежняя модель','Резервная геометрия'],
    rat:['Крыса · прежняя модель','Резервная геометрия'], goat:['Коза','Резервная геометрия'],
    gazelle:['Газель','Резервная геометрия'], cat:['Кошка','Резервная геометрия'],
    jackal:['Шакал','Резервная геометрия'], bird:['Береговая птица','Процедурная модель прежнего слоя']
  };
  rows.push(row('plants','Перекати-поле','Фоновая геометрия долины',model('nature','Игровая геометрия',{species:'tumbleweeds'})));
  if (ambient.courtyardFauna) Object.assign(wildlife, {pig:['Домашняя свинья','Резервная геометрия'],turtle:['Евфратская мягкотелая черепаха · прежняя модель','Резервная геометрия'],egret:['Малая белая цапля','Резервная геометрия'],otter:['Гладкошёрстная выдра','Резервная геометрия']});
  if(ambient.courtyardFauna){
    const marshes={author:'Полевое исследование птиц болот Ирака',source:'https://doi.org/10.1155/2017/4198690'};
    const regional=[
      ['birds','pied-kingfisher','Пегий зимородок','Зависает над водой и ныряет',marshes],
      ['birds','glossy-ibis','Каравайка','Ищет корм на мелководье',marshes],
      ['birds','white-pelican','Розовый пеликан','Прилетает зимой, плавает и ловит рыбу на поверхности',marshes],
      ['birds','pygmy-cormorant','Малый баклан','Ныряет и выныривает на реке',marshes],
      ['birds','marsh-harrier','Болотный лунь','Патрулирует берег низким полётом',marshes],
      ['animals','savigny-tree-frog','Квакша Савиньи','Прыгает короткими перебежками на берегу',
        {author:'Полевые наблюдения в Эль-Хавизе, Университет Ди-Кара',source:'https://jutq.utq.edu.iq/index.php/main/article/download/152/145'}],
      ['animals','onager','Онагр','Резервная модель дикого осла · просмотр шага и выпаса',
        {author:'Древняя ДНК непарнокопытных, Science Advances',source:'https://pmc.ncbi.nlm.nih.gov/articles/PMC8759742/'}]
    ];
    for(const [group,species,title,description,source] of regional){
      const reserve=['white-pelican','onager','pied-kingfisher','glossy-ibis','pygmy-cormorant','marsh-harrier'].includes(species);
      rows.push(row(group,title,description,model('wildlife',reserve?'Резервная геометрия':species==='savigny-tree-frog'?'Резерв при ошибке загрузки':'Игровая геометрия',{species,reserve:reserve||species==='savigny-tree-frog',sources:[source]})));
    }
  }
  for (const [species,[title,label]] of Object.entries(wildlife)) {
    rows.push(row(['bird','egret'].includes(species)?'birds':'animals',title,label,model('wildlife',label,{species,reserve:label!=='Игровая геометрия'})));
  }
  for (const [key,title] of Object.entries({flax:'Лён',lentil:'Чечевица',pea:'Горох',chickpea:'Нут',onion:'Лук'})) {
    rows.push(row('plants',title,'Процедурное растение поля или двора',model('crop','Игровая геометрия',{key})));
  }
  for (const [title,calf] of [['Корова',false],['Телёнок',true]]) {
    rows.push(row('animals',title,'Городской вариант модели коровника',model('dairy','Игровая геометрия',{calf})));
  }
  for (const key of GOODS_KINDS) rows.push(row('goods',(key==='water'?'Вода в кувшинах':RESOURCE_NAMES[key]??key),'Упаковка на складе и при переноске',model('goods','Игровая геометрия',{key})));
  rows.push(row('goods','Светильник из раковины','Форма по раковине из Ниппура (Ур III) · назначение предмета предположительное',model('lamp','Игровая геометрия')));
  for(const item of suppliedFauna){
    const entry=index.models.find(model=>model.file===item.file);
    rows.push({
      ...row(item.group,item.title,item.note,model(entry?'glb':'source',item.license,{entry,species:item.id,sources:[item]})),
      originalFile:item.originalFile
    });
  }
  for (const entry of index.models) {
    if(suppliedFauna.some(item=>item.file===entry.file))continue;
    const name = entry.file.replace(/\.glb$/i,'');
    rows.push(row(glbGroup(name), glbName(name), name==='festival-candle'?'Прежняя эпоха · '+entry.file:entry.file,
      model('glb',statuses[entry.status]??entry.status,{entry})));
  }
  return rows;
}
