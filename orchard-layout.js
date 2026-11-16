import {extractionSource} from './extraction-courts.js';
import {isOperational} from './definitions.js';
import {isStrictSumer} from './scenario-profiles.js';
import {depositAt} from './world.js';

const stages=[
 {yield:0,growth:.35,label:'Саженцы · урожая пока нет'},
 {yield:.35,growth:.58,label:'Первый урожай · 35%'},
 {yield:.7,growth:.8,label:'Молодой сад · 70%'},
 {yield:1,growth:1,label:'Зрелый сад · 100%'}
];
export const DATE_HARVEST_CAPACITY=42;
const dateCycle=s=>s.year-Number(s.season<2);
const keyAt=({x,y})=>`${x},${y}`;
export function dateStock(s,site){
 if(!isStrictSumer(s))return Infinity;
 const row=s.dateBeds?.[keyAt(site)];
 return row?.cycle===dateCycle(s)?row.stock:DATE_HARVEST_CAPACITY;
}

export function takeDates(s,site,requested){
 if(!Number.isFinite(requested)||requested<=0)return 0;
 if(!isStrictSumer(s))return requested;
 if(depositAt(s,site.x,site.y)!=='dates')return 0;
 const stock=dateStock(s,site),amount=Math.min(stock,requested);
 if(amount>0){s.dateBeds??={};s.dateBeds[keyAt(site)]={cycle:dateCycle(s),stock:stock-amount};}
 return amount;
}

export function orchardMaturity(s,b){
 const planted=b.orchardPlantedTick;
 if(planted===undefined)return stages[3];
 return stages[Math.min(3,Math.max(0,Math.floor((s.tick-planted)/4)))];
}

export function validateOrchards(s){
 const beds=s.dateBeds;
 if(beds!==undefined&&(!isStrictSumer(s)||!beds||typeof beds!=='object'||Array.isArray(beds)||
  Object.entries(beds).some(([key,row])=>{
   const m=/^(0|[1-9]\d*),(0|[1-9]\d*)$/.exec(key);
   return !m||depositAt(s,Number(m[1]),Number(m[2]))!=='dates'||!row||Object.keys(row).length!==2||!Number.isSafeInteger(row.cycle)||row.cycle<0||row.cycle>dateCycle(s)||
    !Number.isFinite(row.stock)||row.stock<0||row.stock>=DATE_HARVEST_CAPACITY;
  })))return false;
 return s.buildings.every(b=>b.orchardPlantedTick===undefined||
  b.type==='garden'&&isStrictSumer(s)&&isOperational(b)&&
  Number.isSafeInteger(b.orchardPlantedTick)&&b.orchardPlantedTick>=0&&b.orchardPlantedTick<=s.tick);
}

// Two compact rows communicate a managed mixed garden. Spacing is a game-scale
// convention, not a claim that all ancient orchards followed a measured grid.
export function orchardPalms(b,state){
 if(b?.type!=='garden'||!isOperational(b)||!isStrictSumer(state))return [];
 const {growth}=orchardMaturity(state,b),source=extractionSource(b);
 const rotation=((Math.trunc(Number(b.rotation)||0)%4)+4)%4;
 const turn=([x,y])=>rotation===1?[y,-x]:rotation===2?[-x,-y]:rotation===3?[-y,x]:[x,y];
 return [[-.26,-.18],[.26,-.18],[-.26,.18],[.26,.18]].map((point,i)=>{
  const [dx,dy]=turn(point);return {id:`garden-${b.x}-${b.y}-${i}`,x:source.x+dx,y:source.y+dy,managed:true,resource:'dates',growth};
 });
}
