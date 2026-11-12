import {buildingKey,isOperational} from './definitions.js';
import {isStrictSumer} from './scenario-profiles.js';
import {cityCommandReason} from './city-command-lock.js';
import {connectedStores} from './district-logistics.js';
import {invalidateAssignments} from './workforce.js';
import {putStock,stockStores} from './inventory.js';
import {takeBuildingOutput} from './building-inventory.js';
import {takeFish} from './fish-provenance.js';
import {dryFishingOutput} from './cat-fishing-ledger.js';
import {riverLocal,riverPoint,signedRiverDistance} from './world.js';

export const DRIED_FISH_CAPACITY=24;
const batchSize=2,dryingSeconds=12,cargoLimit=6;
const readyDock=b=>b?.type==='harbor'&&isOperational(b);
const dockAt=(s,key)=>s.buildings.find(b=>readyDock(b)&&buildingKey(b)===key);
const dried=b=>b.driedFish??0;
const secondsBetween=(s,a,b)=>2+.8*Math.abs(riverLocal(a.x,a.y,s).along-riverLocal(b.x,b.y,s).along);
const room=(s,b)=>DRIED_FISH_CAPACITY-dried(b)-(b.fishDrying?.amount||0)-
 (s.localFerry?.to===buildingKey(b)?s.localFerry.amount:0);
const commandReason=(s,b)=>cityCommandReason(s)||(s.event?'Сначала заверши событие':s.lost?'Поселение покинуто':
 !isStrictSumer(s)||!readyDock(b)||!s.buildings.includes(b)?'Нужна готовая пристань Южного Шумера':'');
const nearby=(s,b,buildings)=>buildings.filter(other=>other!==b&&connectedStores(s,buildingKey(other),buildingKey(b)))
 .sort((a,c)=>Math.hypot(a.x-b.x,a.y-b.y)-Math.hypot(c.x-b.x,c.y-b.y));

export function riverStoreView(s,b){
 const ferry=s.localFerry,key=buildingKey(b);
 return {
  dried:dried(b),batch:b.fishDrying,room:room(s,b),
  ferry:ferry&&(ferry.from===key||ferry.to===key)?ferry:null,
  destinations:s.buildings.filter(to=>readyDock(to)&&to!==b&&room(s,to)>1e-7)
 };
}

export function startFishDrying(s,b){
 const reason=commandReason(s,b);if(reason)return {ok:false,reason};
 if(b.fishDrying||room(s,b)<batchSize)return {ok:false,reason:'Дождись конца сушки или освободи место на пристани'};
 const orders=s.district?.jobs||[];
 const reserved=new Map();
 for(const q of orders)if(!q.automatic&&q.resource==='food')reserved.set(q.source,(reserved.get(q.source)||0)+q.remaining);
 const source=nearby(s,b,s.buildings.filter(f=>f.type==='fishing'&&isOperational(f)&&
  (f.workshopStock?.output?.food||0)-(reserved.get(buildingKey(f))||0)>=batchSize))[0];
 if(!source)return {ok:false,reason:'Нужна связанная рыбацкая хижина с двумя мерами свежего улова'};
 const before=source.workshopStock.output.food,key=buildingKey(source);
 const pending=orders.filter(q=>q.source===key&&q.resource==='food'&&q.remaining>0);
 let reclaim=pending.reduce((n,q)=>n+q.remaining,0)+batchSize-before;
 // A player may redirect only fish that the automatic carriers have yet to pick up.
 for(const q of pending.reverse()){
  if(reclaim<=1e-7)break;
  if(!q.automatic)continue;
  const cancelled=Math.min(reclaim,q.remaining);
  q.remaining-=cancelled;
  q.cancelled+=cancelled;
  reclaim-=cancelled;
 }
 const amount=takeBuildingOutput(source,'food',batchSize);
 takeFish(source,'fishOutput',amount,before);
 dryFishingOutput(s,source,amount,before);
 b.fishDrying={amount,remaining:dryingSeconds};
 invalidateAssignments(s);
 return {ok:true};
}

export function releaseDriedFish(s,b){
 const reason=commandReason(s,b);if(reason)return {ok:false,reason};
 if(!dried(b))return {ok:false,reason:'Сушёного улова пока нет'};
 let accepted=0;
 for(const store of nearby(s,b,stockStores(s))){
  accepted+=putStock(s,buildingKey(store),'food',dried(b)-accepted);
  if(accepted+1e-7>=dried(b))break;
 }
 if(!accepted)return {ok:false,reason:'Нужен связанный склад со свободным местом'};
 b.driedFish-=accepted;
 if(b.driedFish<=1e-7)delete b.driedFish;
 return {ok:true};
}

export function launchLocalFerry(s,b,key){
 const reason=commandReason(s,b);if(reason)return {ok:false,reason};
 if(s.localFerry)return {ok:false,reason:'Дождись прибытия местной лодки'};
 if(!b.boatTender||b.boatWear)return {ok:false,reason:'Нужна исправная перегрузочная лодка'};
 const to=dockAt(s,key);
 if(!to||b===to)return {ok:false,reason:'Выбери другую готовую пристань'};
 const amount=Math.min(dried(b),room(s,to),cargoLimit);
 if(amount<=1e-7)return {ok:false,reason:'Нужен сушёный улов и свободное место на другой пристани'};
 b.driedFish-=amount;
 if(!b.driedFish)delete b.driedFish;
 s.localFerry={from:buildingKey(b),to:key,amount,elapsed:0};
 return {ok:true};
}

export function advanceRiverStores(s,seconds){
 if(seconds<=0||!isStrictSumer(s))return;
 for(const b of s.buildings){
  const batch=b.fishDrying;if(!batch)continue;
  batch.remaining-=seconds;
  if(batch.remaining>1e-7)continue;
  b.driedFish=dried(b)+batch.amount;
  delete b.fishDrying;
 }
 const trip=s.localFerry;if(!trip)return;
 const from=dockAt(s,trip.from),to=dockAt(s,trip.to);
 trip.elapsed+=seconds;
 if(trip.elapsed+1e-7<secondsBetween(s,from,to))return;
 to.driedFish=dried(to)+trip.amount;
 delete s.localFerry;
}

export function localFerryVessel(s){
 const trip=s.localFerry;if(!trip)return null;
 const from=dockAt(s,trip.from),to=dockAt(s,trip.to);
 const a=riverLocal(from.x,from.y,s).along,b=riverLocal(to.x,to.y,s).along;
 const offset=dock=>Math.sign(signedRiverDistance(dock.x,dock.y,s))*.6;
 const duration=secondsBetween(s,from,to),sailing=duration-.65;
 const progress=Math.min(1,trip.elapsed/sailing);
 const unload=Math.max(0,(trip.elapsed-sailing)/(duration-sailing));
 const point=t=>riverPoint(a+(b-a)*t,s,offset(from)+(offset(to)-offset(from))*t);
 const arriving=progress<1;
 const heading=arriving?point(Math.min(1,progress+.02)):{x:point(1).x*2-point(.98).x,y:point(1).y*2-point(.98).y};
 return {...point(progress),id:'local-ferry',transport:'river',phase:arriving?'arriving':'unloading',unload,
  landing:{x:to.x,y:to.y},stock:{food:trip.amount},route:[heading],routeIndex:0};
}

export function riverStoreDemolitionReason(s,b){
 if(b.type!=='harbor')return '';
 const key=buildingKey(b);
 if(s.localFerry&&(s.localFerry.from===key||s.localFerry.to===key))return 'Дождись прибытия лодки с сушёной рыбой';
 if(b.fishDrying)return 'Дождись окончания сушки рыбы';
 return dried(b)?'Перед сносом передай сушёную рыбу на склад или отправь лодкой':'';
}

export function validateRiverStores(s){
 for(const b of s.buildings){
  if(b.fishDrying===undefined&&b.driedFish===undefined)continue;
  if(!isStrictSumer(s)||!readyDock(b)||b.driedFish!==undefined&&(!Number.isFinite(b.driedFish)||b.driedFish<=0)||room(s,b)<-1e-7)return false;
  const batch=b.fishDrying;
  if(batch!==undefined&&(!batch||batch.amount!==batchSize||!Number.isFinite(batch.remaining)||batch.remaining<=0||batch.remaining>dryingSeconds))return false;
 }
 const trip=s.localFerry;if(trip===undefined)return true;
 if(!trip||!isStrictSumer(s)||trip.from===trip.to||!Number.isFinite(trip.amount)||trip.amount<=0||trip.amount>cargoLimit)return false;
 const from=dockAt(s,trip.from),to=dockAt(s,trip.to);
 return !!from?.boatTender&&!!to&&room(s,to)>=-1e-7&&Number.isFinite(trip.elapsed)&&trip.elapsed>=0&&trip.elapsed<secondsBetween(s,from,to);
}
