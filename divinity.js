export const DIVINE_NAMES={
 water:['Дарующий дождь','Хранитель берегов','Повелитель разлива','Владыка живых вод','Океан над миром'],
 harvest:['Наполняющий амбары','Пробуждающий семена','Отец золотых полей','Владыка изобилия','Тот, чьи сады вечны'],
 life:['Слышащий людей','Хранитель очагов','Возвращающий надежду','Отец многих поколений','Дарующий бессмертную память'],
 craft:['Направляющий руки','Покровитель мастеров','Ваятель городов','Создатель великих стен','Тот, кто вылепил мир'],
 knowledge:['Читающий знамения','Хранитель табличек','Видящий сквозь века','Владыка звёздного свода','Память всех времён'],
 sun:['Зажигающий огни','Несущий рассвет','Хранитель полудня','Сердце небесного пламени','Солнце четырёх сторон']
};
export const DOMAIN_NAMES={water:'Воды',harvest:'Урожай',life:'Жизнь',craft:'Ремесло',knowledge:'Мудрость',sun:'Свет'};
export function createDivinity(){return {domains:Object.fromEntries(Object.keys(DIVINE_NAMES).map(k=>[k,0])),names:[]};}
export function registerMiracle(s,domain){
 s.divinity ||= createDivinity();s.divinity.domains[domain]++;
 const ranked=Object.entries(s.divinity.domains).sort((a,b)=>b[1]-a[1]);
 const [dominant,uses]=ranked[0],rank=uses>=18?4:uses>=10?3:uses>=5?2:uses>=2?1:0;
 let name=DIVINE_NAMES[dominant][rank];
 const second=ranked[1];
 if(second[1]>=5&&uses-second[1]<=1){const pair=[dominant,second[0]].sort().join('+');name=({'harvest+water':'Питающий землю и реки','craft+knowledge':'Архитектор мироздания','life+sun':'Согревающий живых','life+water':'Источник новой жизни','harvest+life':'Хранитель сытых поколений','knowledge+sun':'Око небесного знания'})[pair]||name;}
 s.name=name;if(!s.divinity.names.includes(name))s.divinity.names.push(name);
}
