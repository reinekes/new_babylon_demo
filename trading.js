import {riverIsLow} from './irrigation.js';
import {validateTradeSeal} from './scribes.js';
import {isStrictSumer} from './scenario-profiles.js';
import {cityCommandReason as relicCommandReason} from './city-command-lock.js';
import {harborCargoMultiplier,isTradePort,riverEntry,riverExit,routeBoat,moveBoat,validBoatPoint} from './river-trade.js';
import {reserveStock,refundSources,stockStores} from './inventory.js';
import {availableFood} from './food-planning.js';
import {networkFor,routeBetween,invalidateAssignments} from './workforce.js';
import {buildingKey,isOperational} from './definitions.js';
import {worldWidth,worldHeight,isDryPoint,onBridge,signedRiverDistance,riverLocal,worldFromRiver,riverAcrossSize,riverLength} from './world.js';
import {MATERIALS,RESOURCE_NAMES,storageOf} from './definitions.js';
const safe=n=>Number.isSafeInteger(n)&&n>=0&&n<=1e9;
const nextVisit=t=>1+4*(Math.floor((t-1)/4)+1);
const keys=(o,list)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===list.length&&list.every(k=>k in o);
export function initializeTrade(s){s.trade??={silver:40,visits:0,nextArrival:s.tick===0?1:nextVisit(s.tick),caravan:null};s.trade.deliveries??=[];s.trade.nextDelivery??=1;s.trade.sales??=[];s.trade.nextSale??=1;if(s.trade.caravan&&s.trade.caravan.phase===undefined)Object.assign(s.trade.caravan,{phase:'waitingMarket',x:null,y:null,route:[],routeIndex:0,entry:null,market:null,unloadTime:0});return s.trade;}
function news(s,title,text){s.news.unshift({title,text,kind:'trade',tick:s.tick,year:s.year,season:s.season});s.news=s.news.slice(0,80);}
function createCaravan(tick,visit){const prices={},stock={},base={food:3,clay:4,reed:3,wood:5,stone:7,hides:6,wool:4,cloth:22,clothing:52,brick:8,firedBrick:16,pottery:14,beer:8,milk:1};for(const [i,k]of MATERIALS.entries()){const sell=base[k]+(visit+i)%3;prices[k]={buy:sell+2,sell};stock[k]=25+(visit*13+i*17)%46;}return {id:`caravan:${visit}`,name:['Купцы Урука','Караван южного пути','Торговцы речной долины'][(visit-1)%3],arrived:tick,departAt:tick+2,stock,prices,silver:180+(visit%4)*40};}
export function advanceTrade(s){
 const t=initializeTrade(s);settleTradeContract(s);
 if(s.tick<t.nextArrival)return t;
 t.nextArrival=nextVisit(s.tick);
 if(t.caravan)return t;
 const c=t.caravan=createCaravan(s.tick,++t.visits);
 Object.assign(c,{phase:'waitingMarket',x:null,y:null,route:[],routeIndex:0,entry:null,market:null,unloadTime:0});
 const low=riverIsLow(s),land=marketAccess(s,null,'market');
 const harbor=low&&(marketAccess(s,null,'harbor',3)||marketAccess(s,null,'harbor',2))||marketAccess(s,null,'harbor');
 const riverVisit=harbor&&(t.visits%2===0||!land),capacity=harbor&&harborCargoMultiplier(s,harbor.market);
 if(riverVisit&&(capacity>1||!land)){
  c.transport='river';c.name='Лодка купцов Лагаша';c.market=buildingKey(harbor.market);
  if(isStrictSumer(s))c.riverCapacity=capacity;
  for(const k of ['wood','stone'])c.stock[k]*=capacity;
  c.silver*=capacity;
 }
 news(s,`${c.name} у города`,c.transport==='river'?'Грузовая лодка идёт по реке к пристани.':
  riverVisit&&low&&capacity===1?'У мелкой пристани недостаточно глубины для полной партии. Купцы идут к рынку по суше.':'Караван ищет готовый рынок и дорогу к нему.');
 return t;
}
export function tradeReason(s,resource,side,amount){const lock=relicCommandReason(s);if(lock)return lock;if(s.lost)return 'Поселение покинуто';if(s.event)return 'Сначала заверши событие';if(!MATERIALS.includes(resource)||!['buy','sell'].includes(side))return 'Неизвестный товар или действие';if(!Number.isSafeInteger(amount)||amount<=0||amount>1e6)return 'Укажи целое положительное количество';const t=s.trade,c=t?.caravan;if(!c||s.tick<c.arrived)return 'Каравана сейчас нет';if(s.tick>=c.departAt)return 'Приём новых заказов завершён';const access=marketStatus(s);if(access)return access;const cost=c.prices[resource][side]*amount;if(!Number.isSafeInteger(cost))return 'Слишком большая сделка';if(side==='buy'){if(c.stock[resource]<amount)return 'У купцов недостаточно товара';if(t.silver<cost)return 'Не хватает серебра';if((s.resources[resource]||0)+amount+t.deliveries.filter(q=>q.resource===resource).reduce((n,q)=>n+q.amount-q.delivered,0)>storageOf(s))return 'На складе не хватает места';if(!safe(c.silver+(t.sales||[]).filter(q=>q.caravanId===c.id).reduce((n,q)=>n+(q.amount-q.loaded-q.cancelled)*q.unitPrice,0)+cost))return 'Купцы не могут принять столько серебра';}else{if((resource==='food'?availableFood(s):(s.resources[resource]||0))<amount)return resource==='food'&&s.resources.food>=amount?'Семенной резерв защищён: открой его в прогнозе еды или продай меньше':'В городе недостаточно товара';if(c.silver<cost)return 'У купцов не хватает серебра';if(!safe(t.silver+salesSummary(s).pendingSilver+cost)||!safe(c.stock[resource]+t.sales.filter(q=>q.resource===resource&&q.caravanId===c.id).reduce((n,q)=>n+q.amount-q.loaded-q.cancelled,0)+amount))return 'Слишком большая сделка';}return '';}
const CONTRACT_CLOTH=4,CONTRACT_STONE=8;
const contractForSale=(s,id)=>s.tradeContracts?.find(q=>q.saleId===id);
const contractForVisit=s=>s.tradeContracts?.at(-1)?.visit===s.trade.visits?s.tradeContracts.at(-1):null;
const outcomeTrust=status=>status==='fulfilled'?1:status==='breached'?-1:0;
export function tradePartnerTrust(s,partner){
 return (s.tradeContracts||[]).reduce((n,q)=>n+(q.partner===partner?outcomeTrust(q.status):0),0);
}
const offeredWood=trust=>trust>0?16:trust<0?8:12;
function nextTradeOrder(t){
 const id=Math.max(t.nextDelivery,t.nextSale);t.nextDelivery=id+1;t.nextSale=id+1;return id;
}

export function tradeContractOffer(s){
 const c=s.trade?.caravan;
 if(!isStrictSumer(s)||!c)return null;
 const partner=c.name,trust=tradePartnerTrust(s,partner),wood=offeredWood(trust);
 const reason=relicCommandReason(s)||(s.lost?'Поселение покинуто':s.event?'Сначала заверши событие':
  contractForVisit(s)?'Договор этого визита уже подписан':s.tick>=c.departAt?'Срок приёма завершён':
  marketStatus(s)||((s.resources.cloth||0)<CONTRACT_CLOTH?'Нужно 4 ткани на городских складах':
   c.stock.wood<wood||c.stock.stone<CONTRACT_STONE?'У партнёра недостаточно леса или камня':''));
 return {partner,trust,wood,cloth:CONTRACT_CLOTH,stone:CONTRACT_STONE,deadline:c.departAt,reason};
}

export function acceptTradeContract(s){
 const offer=tradeContractOffer(s);
 if(!offer||offer.reason)return {ok:false,reason:offer?.reason||'Договор пока недоступен'};
 const net=networkFor(s),port=net.ports.find(p=>buildingKey(p.building)===s.trade.caravan.market);
 const component=net.components.get(port?.key);
 const eligibleStores=new Set(net.ports.filter(p=>component!==undefined&&net.components.get(p.key)===component).map(p=>buildingKey(p.building)));
 const sources=reserveStock(s,{cloth:offer.cloth},{eligibleStores});
 if(!sources)return {ok:false,reason:'Не хватает ткани на складах, связанных с торговым двором'};
 const t=s.trade,c=t.caravan,saleId=nextTradeOrder(t);
 t.sales.push({sources,allocations:structuredClone(sources),id:saleId,market:c.market,caravanId:c.id,
  resource:'cloth',amount:offer.cloth,remaining:offer.cloth,loaded:0,cancelled:0,unitPrice:0});
 c.stock.wood-=offer.wood;c.stock.stone-=offer.stone;
 (s.tradeContracts??=[]).push({visit:t.visits,partner:offer.partner,deadline:offer.deadline,wood:offer.wood,
  saleId,status:'active',deliveryId:null});
 invalidateAssignments(s);
 news(s,'Договор с купцами подписан',`${offer.partner} · 4 ткани за ${offer.wood} дерева. Ткань зарезервирована.`);
 return {ok:true};
}

function settleTradeContract(s){
 const q=contractForVisit(s),c=s.trade.caravan;
 if(!q||!c||q.deliveryId!==null||q.status==='fulfilled')return;
 const sale=s.trade.sales.find(sale=>sale.id===q.saleId);
 if(!sale)return;
 if(q.status==='active'&&s.tick>=q.deadline){
  q.status='breached';
  news(s,'Срок торгового договора истёк',`${q.partner} · доверие снизилось. За принятую ткань купцы отдадут камень.`);
 }
 if(q.status==='breached'&&sale.remaining>0){
  refundSources(s,sale.sources);sale.sources={};sale.cancelled+=sale.remaining;sale.remaining=0;
  invalidateAssignments(s);
 }
 if(sale.loaded+sale.cancelled<sale.amount)return;
 const success=q.status==='active';
 const amount=success?q.wood:sale.loaded*2;
 if(success){
  q.status='fulfilled';c.stock.stone+=CONTRACT_STONE;
  news(s,'Торговый договор выполнен',`${q.partner} · доверие выросло. Лес ждёт носильщиков.`);
 }else{
  c.stock.wood+=q.wood;c.stock.stone+=CONTRACT_STONE-amount;
 }
 // A zero-load breach has no delivery. A zero sentinel marks released reserves.
 q.deliveryId=amount?nextTradeOrder(s.trade):0;
 if(amount)s.trade.deliveries.push({id:q.deliveryId,market:sale.market,resource:success?'wood':'stone',
  amount,remaining:amount,delivered:0});
 invalidateAssignments(s);
}

function validateTradeContracts(s){
 if(s.tradeContracts===undefined)return true;
 if(!isStrictSumer(s)||!Array.isArray(s.tradeContracts)||!Array.isArray(s.trade?.sales)||!Array.isArray(s.trade?.deliveries))return false;
 const trust=new Map(),deliveryIds=new Set();let previous=0;
 for(const q of s.tradeContracts){
  const fields=['visit','partner','deadline','wood','saleId','status','deliveryId'];
  if(q?.seal!==undefined)fields.push('seal');
  if(!keys(q,fields)||!validateTradeSeal(s,q)||
   !safe(q.visit)||q.visit<=previous||q.visit>s.trade.visits||typeof q.partner!=='string'||!q.partner||q.partner.length>100||
   !safe(q.deadline)||q.deadline%4!==3||q.deadline>s.tick+2||q.wood!==offeredWood(trust.get(q.partner)||0)||
   !['active','fulfilled','breached'].includes(q.status))return false;
  previous=q.visit;trust.set(q.partner,(trust.get(q.partner)||0)+outcomeTrust(q.status));
  const sale=s.trade.sales.find(sale=>sale?.id===q.saleId),c=s.trade.caravan;
  if(!sale||sale.unitPrice!==0||sale.resource!=='cloth'||sale.amount!==CONTRACT_CLOTH||sale.caravanId!==`caravan:${q.visit}`)return false;
  const complete=sale.loaded+sale.cancelled===sale.amount;
  const sameVisit=c?.id===sale.caravanId&&c.market===sale.market&&c.name===q.partner&&c.departAt===q.deadline;
  if(c?.id===sale.caravanId&&!sameVisit)return false;
  if(q.status==='active'&&(!sameVisit||s.tick>=q.deadline||complete||sale.cancelled!==0||q.deliveryId!==null))return false;
  if(q.status==='breached'&&s.tick<q.deadline)return false;
  if(q.status==='fulfilled'&&(sale.loaded!==sale.amount||q.deliveryId===null))return false;
  if(q.deliveryId===null){if(!sameVisit||complete)return false;continue;}
  const amount=q.status==='fulfilled'?q.wood:sale.loaded*2;
  if(!complete||!safe(q.deliveryId)||(!amount&&q.deliveryId!==0))return false;
  if(amount){
   const d=s.trade.deliveries.find(d=>d?.id===q.deliveryId);
   if(!d||deliveryIds.has(d.id)||d.id<=sale.id||d.market!==sale.market||d.amount!==amount||d.resource!==(q.status==='fulfilled'?'wood':'stone'))return false;
   deliveryIds.add(d.id);
  }
 }
 return true;
}

export function trade(s,resource,side,amount){const reason=tradeReason(s,resource,side,amount);if(reason)return {ok:false,reason};const t=s.trade,c=t.caravan,total=c.prices[resource][side]*amount;const orderId=nextTradeOrder(t);if(side==='buy'){t.deliveries.push({id:orderId,market:c.market,resource,amount,remaining:amount,delivered:0});c.stock[resource]-=amount;t.silver-=total;c.silver+=total;}else{const sources=reserveStock(s,{[resource]:amount});if(!sources)return {ok:false,reason:'В городе недостаточно товара'};c.silver-=total;t.sales.push({sources,allocations:structuredClone(sources),id:orderId,market:c.market,caravanId:c.id,resource,amount,remaining:amount,loaded:0,cancelled:0,unitPrice:c.prices[resource].sell});}invalidateAssignments(s);news(s,side==='buy'?'Товар куплен':'Продажа принята',`${RESOURCE_NAMES[resource]}: ${amount} · ${total} серебра${side==='sell'?' после погрузки':''}`);return {ok:true,resource,side,amount,total};}
export function cancelSale(s,id){const lock=relicCommandReason(s);if(lock)return {ok:false,reason:lock};if(s.event||s.lost)return {ok:false,reason:'Сначала заверши событие'};const q=s.trade?.sales?.find(q=>q.id===id),c=s.trade?.caravan;if(contractForSale(s,id))return {ok:false,reason:'Резерв договора освободится в срок расчёта'};if(!q||q.remaining<=0||c?.id!==q.caravanId)return {ok:false,reason:'Нет неотправленных товаров для отмены'};const amount=q.remaining;refundSources(s,q.sources);q.sources={};c.silver+=amount*q.unitPrice;q.cancelled+=amount;q.remaining=0;invalidateAssignments(s);return {ok:true,amount};}
export function salesSummary(s){const q=s.trade?.sales||[];return {queued:q.reduce((n,q)=>n+q.remaining,0),inTransit:q.reduce((n,q)=>n+q.amount-q.remaining-q.loaded-q.cancelled,0),loaded:q.reduce((n,q)=>n+q.loaded,0),pendingSilver:q.reduce((n,q)=>n+(q.amount-q.loaded-q.cancelled)*q.unitPrice,0)};}
export function loadSaleCargo(s,c){const q=s.trade?.sales?.find(q=>q.id===c.saleJob),caravan=s.trade?.caravan;if(!q||caravan?.id!==q.caravanId||caravan.market!==q.market||caravan.phase!=='trading')return false;const amount=c.cargo[q.resource]||0;if(!amount)return false;caravan.stock[q.resource]+=amount;q.loaded+=amount;if(Math.abs(q.amount-q.cancelled-q.loaded)<1e-7)q.loaded=q.amount-q.cancelled;s.trade.silver+=amount*q.unitPrice;c.cargo={};c.saleJob=null;c.saleMarket=null;settleTradeContract(s);invalidateAssignments(s);return true;}
export function validateTrade(s){const t=s.trade;if(!validateTradeContracts(s)||!keys(t,['silver','visits','nextArrival','caravan','deliveries','nextDelivery','sales','nextSale'])||!safe(t.silver)||!safe(t.visits)||!safe(t.nextArrival)||t.nextArrival<=s.tick||t.nextArrival%4!==1||t.nextArrival>s.tick+4)return false;if(!Array.isArray(t.deliveries)||!safe(t.nextDelivery)||t.nextDelivery<1)return false;const ids=new Set();for(const q of t.deliveries){if(!keys(q,['id','market','resource','amount','remaining','delivered'])||!safe(q.id)||q.id<1||q.id>=t.nextDelivery||ids.has(q.id)||!MATERIALS.includes(q.resource)||typeof q.market!=='string'||q.delivered<q.amount&&!s.buildings.some(b=>buildingKey(b)===q.market&&isTradePort(b)&&isOperational(b))||!safe(q.amount)||q.amount<1||!Number.isFinite(q.remaining)||q.remaining<0||q.remaining>q.amount||!Number.isFinite(q.delivered)||q.delivered<0||q.remaining+q.delivered>q.amount+1e-7)return false;ids.add(q.id);const carried=(s.citizens||[]).filter(c=>c.tradeJob===q.id).reduce((n,c)=>n+(c.cargo[q.resource]||0),0);if(Math.abs(q.amount-q.remaining-q.delivered-carried)>1e-7)return false;}if(!Array.isArray(t.sales)||!safe(t.nextSale)||t.nextSale<1)return false;const saleIds=new Set();for(const q of t.sales){if(!keys(q,['id','market','caravanId','resource','amount','remaining','loaded','cancelled','unitPrice','sources','allocations'])||!safe(q.id)||q.id<1||q.id>=t.nextSale||saleIds.has(q.id)||typeof q.market!=='string'||typeof q.caravanId!=='string'||!MATERIALS.includes(q.resource)||!safe(q.amount)||q.amount<1||!safe(q.remaining)||!safe(q.loaded)||!safe(q.cancelled)||!safe(q.unitPrice)||(q.unitPrice===0)!==!!contractForSale(s,q.id)||q.remaining+q.loaded+q.cancelled>q.amount)return false;if(!saleSources(s,q.sources,q.resource,q.remaining,q.loaded+q.cancelled===q.amount)||!saleSources(s,q.allocations,q.resource,q.amount,q.loaded+q.cancelled===q.amount))return false;saleIds.add(q.id);const carried=(s.citizens||[]).filter(c=>c.saleJob===q.id).reduce((n,c)=>n+(c.cargo[q.resource]||0),0);if(Math.abs(q.amount-q.remaining-q.loaded-q.cancelled-carried)>1e-7)return false;if(q.loaded+q.cancelled<q.amount&&(!t.caravan||t.caravan.id!==q.caravanId||t.caravan.market!==q.market||q.unitPrice>0&&q.unitPrice!==t.caravan.prices[q.resource].sell||!s.buildings.some(b=>buildingKey(b)===q.market&&isTradePort(b)&&isOperational(b))))return false;}const c=t.caravan;if(c===null)return true;if(!(c.transport===undefined||c.transport==='river')||!keys(c.transport?Object.fromEntries(Object.entries(c).filter(([k])=>k!=='transport'&&k!=='riverCapacity')):c,['id','name','arrived','departAt','stock','prices','silver','phase','x','y','route','routeIndex','entry','market','unloadTime'])||c.id!==`caravan:${t.visits}`||!t.visits||typeof c.name!=='string'||!c.name||c.name.length>100||!safe(c.arrived)||c.arrived%4!==1||c.departAt!==c.arrived+2||c.arrived>s.tick||!safe(c.silver)||!keys(c.stock,MATERIALS)||!keys(c.prices,MATERIALS))return false;const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-.5&&p.x<=worldWidth(s)-.5&&p.y>=-.5&&p.y<=worldHeight(s)-.5;
 if(c.riverCapacity!==undefined&&(c.transport!=='river'||!isStrictSumer(s)||![1,2,3].includes(c.riverCapacity)||
  c.riverCapacity<3&&Math.floor(c.arrived/4)%3!==1))return false;
 if(c.transport==='river'&&(c.route.some(p=>!validBoatPoint(p,s))||c.x!==null&&!validBoatPoint(c,s)||!s.buildings.some(b=>b.type==='harbor'&&buildingKey(b)===c.market)))return false;
 if(c.route.length>worldWidth(s)*worldHeight(s)*2||c.route.some((p,i)=>!point(p)||typeof p.key!=='string'||p.key!==`${p.x+.5},${p.y+.5}`||i&&(c.transport==='river'?Math.abs(p.x-c.route[i-1].x)+Math.abs(p.y-c.route[i-1].y)>1.000001:Math.abs(p.x-c.route[i-1].x)>1.000001||Math.abs(p.y-c.route[i-1].y)>1.000001))||c.x===null!== (c.y===null)||c.x!==null&&!point(c)||c.entry!==null&&typeof c.entry!=='string')return false;
 if(['arriving','unloading','trading'].includes(c.phase)&&c.market===null)return false;
 if(!['waitingMarket','arriving','unloading','trading','departing','blocked'].includes(c.phase)||!Array.isArray(c.route)||!safe(c.routeIndex)||c.routeIndex>c.route.length||!Number.isFinite(c.unloadTime)||c.unloadTime<0||c.unloadTime>4||c.x!==null&&!Number.isFinite(c.x)||c.y!==null&&!Number.isFinite(c.y)||c.market!==null&&!s.buildings.some(b=>b.type===(c.transport==='river'?'harbor':'market')&&buildingKey(b)===c.market))return false;return MATERIALS.every(k=>safe(c.stock[k])&&keys(c.prices[k],['buy','sell'])&&safe(c.prices[k].buy)&&safe(c.prices[k].sell)&&c.prices[k].sell>0&&c.prices[k].buy>c.prices[k].sell);}

export function marketStatus(s){const c=s.trade?.caravan;if(!c)return 'Каравана сейчас нет';if(s.tick>=c.departAt&&(s.trade.sales||[]).some(q=>q.caravanId===c.id&&q.loaded+q.cancelled<q.amount))return 'Караван ждёт завершения погрузки';if(c.transport==='river'&&c.phase!=='trading')return ({waitingMarket:'Ждёт доступной пристани',arriving:'Лодка идёт по реке',unloading:'Лодка швартуется и разгружает товары',departing:'Лодка уходит по реке',blocked:'Пристань ждёт дороги к складу и домам'})[c.phase]||'Лодка недоступна';if(c.phase!=='trading')return ({waitingMarket:'Нужен готовый рынок',arriving:'Караван идёт к рынку',unloading:'Караван разгружает товары',departing:'Караван уходит',blocked:'Путь каравана перекрыт'})[c.phase]||'Караван недоступен';const access=marketAccess(s,c.market);return access?'':'Нет дороги от торгового двора к складу и домам';}
export function marketAccess(s,key,type,minCargo=1){const net=networkFor(s);for(const market of s.buildings.filter(b=>isTradePort(b)&&(!type||b.type===type)&&isOperational(b)&&(b.type!=='harbor'||harborCargoMultiplier(s,b)>=minCargo)&&(!key||buildingKey(b)===key))){const p=net.ports.find(p=>p.building===market);if(!p)continue;const component=net.components.get(p.key),store=net.ports.find(p=>['shrine','granary','depot'].includes(p.building.type)&&isOperational(p.building)&&net.components.get(p.key)===component),home=net.ports.find(p=>p.building.type==='house'&&isOperational(p.building)&&net.components.get(p.key)===component&&s.citizens.some(c=>c.home===buildingKey(p.building)));if(store&&home)return {market,p,store,home};}return null;}
export function logisticsSummary(s){const q=s.trade?.deliveries||[],c=s.trade?.caravan;return {market:c?.market||null,phase:c?.phase||'absent',queued:q.reduce((n,q)=>n+q.remaining,0),inTransit:q.reduce((n,q)=>n+q.amount-q.remaining-q.delivered,0),delivered:q.reduce((n,q)=>n+q.delivered,0),reason:marketStatus(s)};}
function routeCaravan(s,c,target,phase){const net=networkFor(s);let origin=null,d=Infinity;for(const p of net.nodes.values()){const n=Math.abs(p.x-c.x)+Math.abs(p.y-c.y);if(n<d){d=n;origin=p;}}const route=origin&&routeBetween(s,origin.key,target);if(!route){c.phase='blocked';c.route=[];c.routeIndex=0;return false;}c.route=route.map(p=>({x:p.x,y:p.y,key:p.key}));c.routeIndex=0;c.phase=phase;return true;}
export function advanceTradeLogistics(s,dt){const c=s.trade?.caravan;if(!c)return;settleTradeContract(s);if(c.transport==='river'){advanceRiverLogistics(s,c,dt);return;}const pending=(s.trade.sales||[]).some(q=>q.caravanId===c.id&&q.loaded+q.cancelled<q.amount),departing=s.tick>=c.departAt&&!pending;
 if(c.x===null){const access=marketAccess(s,null,'market'),ref=access?.p||networkFor(s).ports.find(p=>p.building.type==='shrine')||networkFor(s).ports[0];if(!ref)return;const left=signedRiverDistance(ref.x,ref.y,s)<0,across=left?0:riverAcrossSize(s)-1;let along=Math.round(riverLocal(ref.x,ref.y,s).along),entryPoint;while(along<riverLength(s)){entryPoint=worldFromRiver(across,along,s);if(isDryPoint(s,entryPoint.x+.5,entryPoint.y+.5))break;along++;}if(along>=riverLength(s))return;const {x,y}=entryPoint;s.roadAnchors??=[];if(!s.roadAnchors.some(a=>a.x===x&&a.y===y))s.roadAnchors.push({type:'road',x,y});const net=networkFor(s),entry=net.ports.find(p=>p.building.type==='road'&&p.building.x===x&&p.building.y===y);if(!entry)return;c.entry=entry.key;c.x=entry.x;c.y=entry.y;}
 if(c.phase==='waitingMarket'&&!departing){const access=marketAccess(s,null,'market');if(!access)return;c.market=buildingKey(access.market);routeCaravan(s,c,access.p.key,'arriving');}
 if(departing&&c.phase!=='departing')routeCaravan(s,c,c.entry,'departing');
 if(c.phase==='blocked'){const access=marketAccess(s,c.market);if(departing)routeCaravan(s,c,c.entry,'departing');else if(access)routeCaravan(s,c,access.p.key,'arriving');return;}
 if(c.phase==='trading'){if(!marketAccess(s,c.market))c.phase='blocked';return;}
 if(c.phase==='unloading'){c.unloadTime=Math.min(4,c.unloadTime+dt);if(c.unloadTime>=4)c.phase='trading';return;}
 if(!['arriving','departing'].includes(c.phase))return;const net=networkFor(s);let remaining=dt;
 while(remaining>1e-8){const p=c.route[c.routeIndex];if(!p){if(c.phase==='departing'){s.trade.caravan=null;news(s,'Караван покинул долину','Купцы вышли из долины по дороге.');}else {c.phase='unloading';c.unloadTime=0;}return;}const prev=c.route[c.routeIndex-1];if(!net.nodes.has(p.key)||prev&&prev.key!==p.key&&!net.graph.get(prev.key)?.has(p.key)){c.phase='blocked';return;}const distance=Math.hypot(p.x-c.x,p.y-c.y),travel=distance/1.1;if(travel<=remaining){c.x=p.x;c.y=p.y;c.routeIndex++;remaining-=travel;}else{const fraction=remaining/travel;c.x+=(p.x-c.x)*fraction;c.y+=(p.y-c.y)*fraction;return;}}
}

function saleSources(s,sources,resource,amount,complete=false){if(!sources||typeof sources!=='object'||Array.isArray(sources))return false;const stores=new Set(stockStores(s).map(buildingKey));let total=0;for(const [key,stock]of Object.entries(sources)){if(!complete&&!stores.has(key)||!stock||typeof stock!=='object'||Array.isArray(stock))return false;for(const [k,n]of Object.entries(stock)){if(!MATERIALS.includes(k)||!Number.isFinite(n)||n<0||k!==resource&&n!==0)return false;if(k===resource)total+=n;}}return Math.abs(total-amount)<1e-7;}

function advanceRiverLogistics(s,c,dt){
 const pending=s.trade.sales.some(q=>q.caravanId===c.id&&q.loaded+q.cancelled<q.amount),departing=s.tick>=c.departAt&&!pending;
 if(c.x===null){Object.assign(c,riverEntry(s));c.entry='river';const harbor=s.buildings.find(b=>buildingKey(b)===c.market)||c;routeBoat(c,riverLocal(harbor.x,harbor.y,s).along,'arriving',s);}
 const exit=riverExit(s),exitAlong=riverLocal(exit.x,exit.y,s).along;
 if(departing&&c.phase!=='departing')routeBoat(c,exitAlong,'departing',s);
 if(c.phase==='blocked'){if(departing)routeBoat(c,exitAlong,'departing',s);else if(marketAccess(s,c.market)){c.phase='unloading';c.unloadTime=0;}return;}
 if(c.phase==='trading'){if(!marketAccess(s,c.market))c.phase='blocked';return;}
 if(c.phase==='unloading'){
  const access=marketAccess(s,c.market);
  if(!access){c.phase='blocked';return;}
  c.unloadTime=Math.min(4,c.unloadTime+dt*(access.market.boatWear ? .5 : 1));
  if(c.unloadTime>=4)c.phase='trading';
  return;
 }
 if(['arriving','departing'].includes(c.phase)&&moveBoat(c,dt,s)){if(c.phase==='departing'){
  const harbor=s.buildings.find(b=>b.type==='harbor'&&buildingKey(b)===c.market);
  if(harbor&&isStrictSumer(s)&&c.unloadTime>=4)harbor.boatWear=true;
  s.trade.caravan=null;news(s,'Лодка покинула город','Купцы увезли погруженный товар по реке.');}else{c.phase='unloading';c.unloadTime=0;}}
}
