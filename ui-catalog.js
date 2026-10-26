export const BUILDING_GROUPS=[
 {id:'life',name:'Жители',types:['house','healer']},
 {id:'food',name:'Пища',types:['field','garden','fishing','hunting','cowshed']},
 {id:'materials',name:'Сырьё',types:['clay','reed','logging','quarry']},
 {id:'craft',name:'Ремёсла',types:['pottery','brewery','kiln','brickyard','sheepfold','weaver','tailor']},
 {id:'supply',name:'Снабжение',types:['waterpoint','granary','depot','market']},
 {id:'sacred',name:'Храмы',types:['shrine','ziggurat']},
 {id:'routes',name:'Пути и вода',types:['canal','bridge','harbor']}
];
export const groupFor=type=>BUILDING_GROUPS.find(g=>g.types.includes(type));
