export const MATERIALS=['food','clay','reed','wood','stone','hides'];
export const BUILDINGS={
 house:{name:'Дом',icon:'⌂',clay:12,reed:8,desc:'Дом для восьми жителей. У каждого человека есть дом, место работы и распорядок дня.',effect:'+8 мест',output:{}},
 field:{name:'Ячменное поле',icon:'≋',clay:8,reed:5,desc:'Два земледельца собирают еду и относят урожай на склад. Нужна плодородная земля.',effect:'Еда · 2 работника',output:{food:7},workTime:3.5},
 clay:{name:'Глиняный карьер',icon:'◈',clay:10,reed:4,desc:'Два глиняных мастера добывают глину и доставляют её на склад.',effect:'Глина · 2 работника',output:{clay:6},workTime:3},
 reed:{name:'Тростниковый двор',icon:'♧',clay:8,reed:0,desc:'Два заготовителя собирают тростник и несут связки на склад.',effect:'Тростник · 2 работника',output:{reed:5},workTime:3},
 shrine:{name:'Святилище',icon:'♜',clay:22,reed:12,desc:'Два жреца приносят веру и престиж. Первое святилище служит центральным складом.',effect:'Вера + престиж · склад',output:{faith:.85,prestige:.17},workTime:4},
 garden:{name:'Финиковый сад',icon:'✳',clay:18,reed:12,desc:'Садовники собирают финики. Сад повышает целевое довольство города.',effect:'Еда · +4 довольства',output:{food:3.5},workTime:3.5},
 granary:{name:'Амбар и склад',icon:'▥',clay:25,reed:15,desc:'Хранит все виды грузов и добавляет по 150 мест для каждого материала. Работники выбирают ближайший доступный склад.',effect:'+150 хранения · приём грузов',output:{}},
 ziggurat:{name:'Великий зиккурат',icon:'▲',clay:160,reed:90,faith:80,prestige:50,desc:'Уникальный храм, производящий много веры и престижа. Нужны 50 престижа; расходует 80 веры.',effect:'Много веры + престижа',output:{faith:2.1,prestige:.7},workTime:4},
 bridge:{name:'Мост через реку',icon:'⌒',clay:45,reed:25,desc:'Поставь на воду: мост соединит берега и дорожные сети. По нему можно носить грузы на склад.',effect:'Соединяет берега и рабочие пути',output:{}},
 fishing:{name:'Рыбацкая хижина',icon:'♓',clay:8,reed:8,wood:10,desc:'Рыбаки доставляют еду с реки и озёр.',effect:'Еда · 2 работника',output:{food:5},workTime:4},
 hunting:{name:'Охотничий домик',icon:'➶',clay:8,reed:6,wood:12,desc:'Охотники добывают еду и шкуры рядом с дичью.',effect:'Еда + шкуры · 2 работника',output:{food:4,hides:1},workTime:4},
 logging:{name:'Лесорубная хижина',icon:'♠',clay:10,reed:4,desc:'Лесорубы доставляют дерево с лесного участка.',effect:'Дерево · 2 работника',output:{wood:6},workTime:4},
 quarry:{name:'Каменоломня',icon:'⬟',clay:10,reed:0,wood:12,desc:'Каменотёсы доставляют камень из месторождения.',effect:'Камень · 2 работника',output:{stone:5},workTime:4}
};
export const MIRACLES={
 rain:{name:'Небесный дождь',cost:15,cooldown:2,icon:'☂',domain:'water',desc:'Снимает засуху; урожай ×1,5 на два сезона.'},
 abundance:{name:'Изобилие',cost:25,cooldown:2,icon:'✧',domain:'harvest',desc:'+45 еды прямо в амбары.'},
 bless:{name:'Благословение',cost:20,cooldown:3,icon:'☀',domain:'life',desc:'+15 довольства; до трёх новых жителей.'},
 fertility:{name:'Дыхание земли',cost:35,cooldown:3,icon:'❧',domain:'harvest',desc:'Сбор еды и фиников ×1,6 на три сезона.'},
 inspiration:{name:'Руки творца',cost:30,cooldown:3,icon:'⚒',domain:'craft',desc:'Глина и тростник ×1,75 на три сезона.'},
 haste:{name:'Попутный ветер',cost:40,cooldown:3,icon:'➶',domain:'craft',desc:'Скорость работников ×1,5 на три сезона.'},
 revelation:{name:'Откровение',cost:35,cooldown:3,icon:'◉',domain:'knowledge',desc:'+20 веры и +12 престижа.'},
 peace:{name:'Тишина сердец',cost:30,cooldown:2,icon:'♡',domain:'life',desc:'+25 довольства; жители быстрее обретают надежду.'},
 sunlight:{name:'Золотое сияние',cost:30,cooldown:3,icon:'✺',domain:'sun',desc:'Храмовые подношения ×1,8 на три сезона; +10 довольства.'},
 healing:{name:'Новая жизнь',cost:45,cooldown:4,icon:'✚',domain:'life',desc:'До шести новых жителей при свободном жилье; +10 довольства.'},
 stars:{name:'Мудрость звёзд',cost:45,cooldown:4,icon:'✶',domain:'knowledge',desc:'+18 престижа; открывает мудрые имена.'},
 shaping:{name:'Повеление глине',cost:50,cooldown:4,icon:'◈',domain:'craft',desc:'+60 глины и +40 тростника.'}
};
export const RESOURCE_NAMES={food:'еда',clay:'глина',reed:'тростник',wood:'дерево',stone:'камень',hides:'шкуры',faith:'вера',prestige:'престиж'};
export const levelOf=b=>b.level||1;
export const isOperational=b=>!b.construction||b.construction.kind==='upgrade';
export const capacityOf=b=>b.type==='house'&&isOperational(b)?4+4*levelOf(b):0;
export const outputMultiplier=b=>[0,1,1.6,2.4][levelOf(b)];
export const buildingKey=b=>b.id||`${b.x},${b.y}`;
export const storageOf=s=>200+s.buildings.filter(b=>b.type==='granary'&&isOperational(b)).reduce((n,b)=>n+150*levelOf(b),0);
export const housingOf=s=>s.buildings.reduce((n,b)=>n+capacityOf(b),0);
