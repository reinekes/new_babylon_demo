import {stockStores,foodAvailability,projectedStoreStock} from './inventory.js';
import {availableFood,seedReserve} from './food-planning.js';
import {household,homeFoodCouriers,carriedMealFood} from './households.js';
import {buildingKey} from './definitions.js';
import {networkFor,routeBetween} from './workforce.js';
export function supplyOverview(s){
 const food=foodAvailability(s,{reconcile:false}),net=networkFor(s,{materializeRoads:false}),ctx={network:net},ports=new Map(net.ports.filter(p=>!p.building.siteKey).map(p=>[buildingKey(p.building),p.key]));
 let stores=stockStores(s);
 const milk=projectedStoreStock(s,'milk',stores);
 if(!stores.length)stores=s.buildings.filter(b=>b.type==='house'&&b.construction?.kind!=='new').slice(0,1);
 const houses=s.buildings.filter(b=>b.type==='house'&&b.construction?.kind!=='new').map(b=>{const h=household(s,b),demand=h.demand*4/3,trips=homeFoodCouriers(s,buildingKey(b)),reachableStores=stores.filter(store=>routeBetween(s,ports.get(buildingKey(b)),ports.get(buildingKey(store)),ctx)),reachable=reachableStores.length>0,localFood=reachableStores.reduce((n,store)=>n+(food.get(buildingKey(store))||0)+(milk.get(buildingKey(store))||0)*.5,0);
 let reason='Хватает на ближайший ужин';if(!h.residents.length)reason='Дом пуст';else if(h.food+1e-7<demand){if(trips.some(c=>c.phase==='blocked'))reason='Доставка еды не может пройти';else if(trips.length)reason=trips.some(c=>carriedMealFood(c)>0)?'Житель несёт еду домой':'Житель идёт за едой';else if(!reachable)reason='Нет пути к доступному складу';else if(localFood<=1e-7&&availableFood(s)+(s.resources.milk||0)*.5>1e-7)reason='Ближайшие доступные склады пусты. Проверь путь к складам с едой.';else if(availableFood(s)+(s.resources.milk||0)*.5<=0)reason=seedReserve(s)>0?'Еда осталась только в семенном резерве':'В общем запасе нет еды';else if(!h.residents.some(c=>c.age>=16))reason='Нет взрослого дома: нужна помощь свободного соседа';else reason='Ждём свободного взрослого дома';}
 return {...h,localFood,reachable,key:buildingKey(b),homeId:b.waterEntityId,x:b.x,y:b.y,demand,dinners:demand?h.food/demand:0,shortfall:Math.max(0,demand-h.food),reason};});
 return {houses,demand:houses.reduce((n,h)=>n+h.demand,0),atHome:houses.reduce((n,h)=>n+h.food,0),inTransit:houses.reduce((n,h)=>n+h.inTransit,0),hungry:houses.reduce((n,h)=>n+h.hungry,0),short:houses.filter(h=>h.shortfall>1e-7).length};
}

export function householdSupplyRoute(s,key,resource){
 const home=s.buildings.find(b=>b.type==='house'&&buildingKey(b)===key&&b.construction?.kind!=='new');
 if(!home)return null;
 const points=(courier,route,index)=>[{x:courier.x,y:courier.y},...route.slice(index)];
 const water=resource==='water';
 const courier=water?s.citizens.find(c=>c.waterTrip?.target===key):homeFoodCouriers(s,key).find(c=>c.phase!=='blocked');
 if(courier){
  const trip=water?courier.waterTrip:null,job=!water&&s.district?.jobs.find(q=>q.id===courier.districtJob);
  const source=water?trip.station:job?.source||courier.store;
  const loaded=water?trip.load:carriedMealFood(courier);
  return {home,source,courier:courier.id,points:points(courier,trip?.route||courier.route||[],trip?.index??courier.routeIndex??0),
   status:loaded>0?(water?'Несёт воду во двор':'Несёт еду во двор'):(water?'Идёт за водой':'Идёт за едой')};
 }
 const net=networkFor(s,{materializeRoads:false}),ctx={network:net};
 const ports=new Map(net.ports.filter(p=>!p.building.siteKey).map(p=>[buildingKey(p.building),p.key])),target=ports.get(key);
 const food=water?null:foodAvailability(s,{reconcile:false});
 const candidates=water?s.buildings.filter(b=>b.type==='waterpoint'&&b.construction?.kind!=='new'):
  stockStores(s).filter(b=>(food.get(buildingKey(b))||0)>0);
 let best=null;
 for(const source of candidates){
  const id=buildingKey(source),from=ports.get(id);
  if(!from||!target||from===target)continue;
  const route=routeBetween(s,from,target,ctx);
  if(route&&(!best||route.length<best.points.length))best={home,source:id,points:route,status:water?'Доступный путь от водозабора. Рейса сейчас нет.':'Доступный путь от склада с едой. Рейса сейчас нет.'};
 }
 if(best)return best;
 const reason=water?(candidates.length?'Пути от готовых водозаборов нет. Жители могут идти к доступному берегу.':'Готового водозабора нет. Жители могут идти к доступному берегу.'):
  supplyOverview(s).houses.find(h=>h.key===key)?.reason||'Рейс не назначен';
 return {home,source:null,points:[],status:reason};
}
