import {DAY_SECONDS} from './city-life.js';

const window=(open,close)=>Object.freeze({open,close});
const day=window(6,19),dawn=window(6.25,18.25),morning=window(6.75,18.5),workshop=window(7.25,18.75);
const windows=Object.freeze({
 fishing:window(6,18),field:dawn,garden:dawn,hunting:dawn,reed:morning,logging:morning,
 clay:morning,quarry:morning,canal:morning,sheepfold:window(6.5,18.5),cowshed:window(6.5,18.5),
 construction:morning,brickyard:morning,kiln:morning,pottery:workshop,brewery:workshop,
 bakery:window(6.5,18.75),dairyStore:workshop,weaver:workshop,tailor:workshop,linenYard:workshop,
 coppersmith:workshop,matYard:workshop,basketry:workshop,joineryYard:workshop,
 market:window(7.75,19),harbor:window(6.5,19),musicHouse:window(8,19),
 waterpoint:day,healer:day,shrine:day,ziggurat:day,granary:window(7,19),depot:window(6.5,19)
});

export const workHourAt=time=>((8+time*24/DAY_SECONDS)%24+24)%24;
export const workplaceHours=type=>Object.hasOwn(windows,type)?windows[type]:null;

export function isWorkplaceOpen(type,time){
 const {open,close}=workplaceHours(type)||day,hour=workHourAt(time);
 return hour>=open&&hour<close;
}

const residentMinute=id=>(Math.imul((id||0)>>>0,17)>>>0)%36;
export function residentDepartureHour(type,id){
 // Reserve the final five minutes for the walk from the room to the real sill.
 const person=(id||0)>>>0,minute=Math.imul(person,149)>>>0;
 const slot=minute%241,fraction=(Math.floor(person/241)*.6180339887498949)%1;
 return 5+(slot===240?slot-fraction:slot+fraction)*(235/240)/60;
}
export function residentReturnHour(type,id){
 return (workplaceHours(type)||day).close-(residentMinute(id)%7)*.04;
}

export function canDepartForWork(type,id,time){
 const hour=workHourAt(time);
 return hour>=residentDepartureHour(type,id)&&hour<(workplaceHours(type)||day).close;
}
