import {buildingKey,isOperational} from './definitions.js';
import {occupiesCell} from './footprints.js';
import {putStock,stockStores,storeCapacity} from './inventory.js';
import {usesCatDiscovery} from './scenario-profiles.js';
import {worldHeight,worldWidth} from './world.js';

export const ABUNDANCE_LIMIT=45;
export const newAbundanceGift=()=>({version:1});
const eligible=b=>['shrine','depot','granary'].includes(b.type)&&isOperational(b);

export function abundanceQuote(s,target){
 const store=Number.isInteger(target?.x)&&Number.isInteger(target?.y)&&
  s.buildings.find(b=>eligible(b)&&occupiesCell(b,target.x,target.y));
 if(!store)return {store:null,room:0,amount:0,reason:'Выбери готовое хранилище на карте'};
 const stores=stockStores(s);
 const balance=s.resources.food-stores.reduce((n,b)=>n+(b.stock?.food||0),0);
 // Match the inventory reconciliation without modifying a city during a preview.
 let food=store.stock?.food||0;
 if(balance>0&&stores[0]===store)food+=balance;
 if(balance<0&&s.inventory){
  const earlier=stores.slice(0,stores.indexOf(store)).reduce((n,b)=>n+(b.stock?.food||0),0);
  food=Math.max(0,food-Math.max(0,-balance-earlier));
 }
 const room=Math.max(0,storeCapacity(store)-food);
 return {store,room,amount:Math.min(ABUNDANCE_LIMIT,room),reason:room>0?'':'Выбранное хранилище заполнено'};
}

export function receiveAbundance(s,target){
 const {store,amount,reason}=abundanceQuote(s,target);
 if(reason)return {ok:false,reason};
 if(target.expectedStore!==undefined&&target.expectedStore!==store||
  target.expectedAmount!==undefined&&(!Number.isFinite(target.expectedAmount)||Math.abs(target.expectedAmount-amount)>1e-8)){
  return {ok:false,reason:'Условия дара изменились. Проверь выбранный склад и объём'};
 }
 const key=buildingKey(store),accepted=putStock(s,key,'food',amount,{gift:[amount]});
 if(accepted<=0)return {ok:false,reason:'Выбранное хранилище заполнено'};
 s.abundanceGift.last={store:key,amount:accepted,at:s.simTime};
 return {ok:true};
}

export function validateAbundanceGift(s){
 const q=s.abundanceGift;
 if(q===undefined)return true;
 if(!usesCatDiscovery(s)||!q||q.version!==1||Object.keys(q).length!==1+Number(q.last!==undefined))return false;
 if(q.last===undefined)return true;
 const {store,amount,at}=q.last??{};
 const cell=typeof store==='string'&&/^(\d+),(\d+)$/.exec(store);
 return !!cell&&Number(cell[1])<worldWidth(s)&&Number(cell[2])<worldHeight(s)&&Object.keys(q.last).length===3&&
  Number.isFinite(amount)&&amount>0&&amount<=ABUNDANCE_LIMIT&&Number.isFinite(at)&&at>=0&&at<=s.simTime;
}
