export const DIVINE_NAMES={
 water:['Дарующий дождь','Хранитель берегов','Повелитель разлива','Владыка живых вод','Океан над миром'],
 harvest:['Наполняющий амбары','Пробуждающий семена','Отец золотых полей','Владыка изобилия','Тот, чьи сады вечны'],
 life:['Слышащий людей','Хранитель очагов','Возвращающий надежду','Отец многих поколений','Дарующий бессмертную память'],
 craft:['Направляющий руки','Покровитель мастеров','Ваятель городов','Создатель великих стен','Тот, кто вылепил мир'],
 knowledge:['Читающий знамения','Хранитель табличек','Видящий сквозь века','Владыка звёздного свода','Память всех времён'],
 sun:['Зажигающий огни','Несущий рассвет','Хранитель полудня','Сердце небесного пламени','Солнце четырёх сторон']
};
export const DOMAIN_NAMES={water:'Воды',harvest:'Урожай',life:'Жизнь',craft:'Ремесло',knowledge:'Мудрость',sun:'Свет'};
export function createDivinity(){return {domains:Object.fromEntries(Object.keys(DIVINE_NAMES).map(k=>[k,0])),names:[],rating:0,inspirationAttempts:0,inspirationSuccesses:0};}
export function registerMiracle(s,domain){
 s.divinity ||= createDivinity();s.divinity.domains[domain]++;s.divinity.rating=(s.divinity.rating||0)+2;refreshDivineName(s);
}
export function registerInspiration(s,success){
 s.divinity ||= createDivinity();s.divinity.inspirationAttempts=(s.divinity.inspirationAttempts||0)+1;s.divinity.inspirationSuccesses=(s.divinity.inspirationSuccesses||0)+(success?1:0);s.divinity.rating=Math.max(0,(s.divinity.rating||0)+(success?3:-1));
 if(success){s.divinity.domains.craft++;refreshDivineName(s);}
}
export const MOURNING_NAMES=['Слышащий плач','Хранитель пепла','Владыка погребальных огней','Несущий смерть','Жестокий владыка пустыни'];
export function registerLoss(s,count=1){
 const deaths=Math.max((s.deaths||0)-(s.demography?.naturalDeaths||0),count),rank=deaths>=20?4:deaths>=10?3:deaths>=5?2:deaths>=2?1:0;
 s.name=MOURNING_NAMES[rank];if(!s.divinity.names.includes(s.name))s.divinity.names.push(s.name);
}
function refreshDivineName(s){
 if(s.funeral?.scope==='family'&&!s.hungry){s.name='Хранитель памяти';if(!s.divinity.names.includes(s.name))s.divinity.names.push(s.name);return;}
 if(s.deaths>0&&(s.hungry>0||s.funeral)){registerLoss(s);return;}

 const ranked=Object.entries(s.divinity.domains).sort((a,b)=>b[1]-a[1]);
 const [dominant,uses]=ranked[0],rank=uses>=18?4:uses>=10?3:uses>=5?2:uses>=2?1:0;
 let name=DIVINE_NAMES[dominant][rank];
 const second=ranked[1];
 if(second[1]>=5&&uses-second[1]<=1){const pair=[dominant,second[0]].sort().join('+');name=({'harvest+water':'Питающий землю и реки','craft+knowledge':'Архитектор мироздания','life+sun':'Согревающий живых','life+water':'Источник новой жизни','harvest+life':'Хранитель сытых поколений','knowledge+sun':'Око небесного знания'})[pair]||name;}
 s.name=name;if(!s.divinity.names.includes(name))s.divinity.names.push(name);
}
