import {availableFood,seedReserve} from './food-planning.js';
import {household} from './households.js';
import {buildingKey} from './definitions.js';
import {networkFor,routeBetween} from './workforce.js';
export function supplyOverview(s){
 const net=networkFor(s),ctx={network:net},ports=new Map(net.ports.filter(p=>!p.building.siteKey).map(p=>[buildingKey(p.building),p.key]));
 let stores=s.buildings.filter(b=>['shrine','granary'].includes(b.type)&&b.construction?.kind!=='new');if(!stores.length)stores=s.buildings.filter(b=>b.type==='house'&&b.construction?.kind!=='new').slice(0,1);
 const houses=s.buildings.filter(b=>b.type==='house'&&b.construction?.kind!=='new').map(b=>{const h=household(s,b),demand=h.demand*4/3,trips=s.citizens.filter(c=>c.home===buildingKey(b)&&c.pantryTrip),reachable=stores.some(store=>routeBetween(s,ports.get(buildingKey(b)),ports.get(buildingKey(store)),ctx));
 let reason='Хватает на ближайший ужин';if(!h.residents.length)reason='Дом пуст';else if(h.food+1e-7<demand){if(trips.some(c=>c.phase==='blocked'))reason='Доставка еды не может пройти';else if(trips.length)reason=trips.some(c=>c.pantryFood>0)?'Житель несёт еду домой':'Житель идёт за едой';else if(!reachable)reason='Нет пути к доступному складу';else if(availableFood(s)<=0)reason=seedReserve(s)>0?'Еда осталась только в семенном резерве':'В общем запасе нет еды';else if(!h.residents.some(c=>c.age>=16))reason='В доме нет взрослого поставщика';else reason='Ждём свободного взрослого дома';}
 return {...h,key:buildingKey(b),x:b.x,y:b.y,demand,dinners:demand?h.food/demand:0,shortfall:Math.max(0,demand-h.food),reason};});
 return {houses,demand:houses.reduce((n,h)=>n+h.demand,0),atHome:houses.reduce((n,h)=>n+h.food,0),inTransit:houses.reduce((n,h)=>n+h.inTransit,0),hungry:houses.reduce((n,h)=>n+h.hungry,0),short:houses.filter(h=>h.shortfall>1e-7).length};
}
