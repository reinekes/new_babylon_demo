import {buildingKey,isOperational} from './definitions.js';
import {homeFoodInTransit,homeMealFood,ration,supplyHome} from './households.js';
import {fieldCalendar} from './crop-calendar.js';
import {fieldWater} from './irrigation.js';
import {materialsReady} from './construction.js';
import {worldHeight,worldWidth} from './world.js';

const kinds=['food','water','construction'];

function forecast(s,b,kind){
 const key=buildingKey(b);
 if(kind==='food'&&b.type==='house'&&isOperational(b)){
  const demand=s.citizens.reduce((n,c)=>n+(supplyHome(c)===key?ration(c)*4/3:0),0);
  const missing=demand-homeMealFood(b)-homeFoodInTransit(s,key,{deliverable:true});
  if(missing>1e-7)return {score:missing,title:'К ужину может не хватить еды',
   reason:`До нормы не хватает ${missing.toLocaleString('ru',{maximumFractionDigits:2})} еды с учётом груза в пути.`,
   change:'Риск уменьшится, когда в дом направят дополнительную еду.'};
 }
 if(kind==='water'&&b.type==='field'&&isOperational(b)&&s.season===fieldCalendar(s,b).grow&&
  b.crop?.sown>0&&b.crop.growth<1&&!(s.rain>0)){
  const water=fieldWater(s,b);
  if(!water.canal&&!(b.crop.legacyYear===s.year&&water.natural))return {
   score:b.crop.sown*(1-b.crop.growth),title:'Посеву может не хватить воды',
   reason:'Посев ещё растёт, полив из канала не поступает.',
   change:'Риск исчезнет при восстановлении полива или дожде.'};
 }
 if(kind==='construction'&&b.construction){
  if(!materialsReady(b.construction))return {score:2,title:'Стройка может задержаться',
   reason:'На стройку доставлены не все материалы.',change:'Доставь недостающие материалы.'};
  if(!s.citizens.some(c=>c.site===key&&c.siteDuty==='builder'&&c.health>0))return {
   score:1,title:'Стройка может задержаться',reason:'На стройку пока не назначен строитель.',
   change:'Риск уменьшится, когда у стройки появится строитель.'};
 }
 return null;
}

export function recordStarForecast(s){
 const targets=[];
 for(const kind of kinds){
  let best=null;
  for(const b of s.buildings){
   const risk=forecast(s,b,kind);
   if(risk&&(!best||risk.score>best.score))best={score:risk.score,b};
  }
  if(best){
   const {x,y,construction}=best.b;
   targets.push({kind,x,y,...kind==='construction'?{order:construction.order??null}:{}});
  }
 }
 s.starObservations.forecast={tick:s.tick,targets};
}

export function starForecastView(s){
 const record=s.starObservations?.forecast;
 if(!record||record.tick!==s.tick)return [];
 return record.targets.flatMap(target=>{
  const b=s.buildings.find(b=>b.x===target.x&&b.y===target.y);
  if(!b||target.kind==='construction'&&(b.construction?.order??null)!==target.order)return [];
  const risk=forecast(s,b,target.kind);
  return risk?[{...target,key:buildingKey(b),...risk}]:[];
 });
}

export function validateStarForecast(s,record){
 if(record===undefined)return true;
 if(!record||Object.keys(record).length!==2||!Number.isSafeInteger(record.tick)||record.tick<0||record.tick>s.tick||
  !Array.isArray(record.targets)||record.targets.length>kinds.length)return false;
 return new Set(record.targets.map(row=>row?.kind)).size===record.targets.length&&record.targets.every(row=>
  row&&kinds.includes(row.kind)&&Object.keys(row).length===(row.kind==='construction'?4:3)&&
  Number.isInteger(row.x)&&row.x>=0&&row.x<worldWidth(s)&&Number.isInteger(row.y)&&row.y>=0&&row.y<worldHeight(s)&&
  (row.kind!=='construction'||row.order===null||Number.isSafeInteger(row.order)&&row.order>0));
}
