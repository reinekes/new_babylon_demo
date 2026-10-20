import {MATERIALS,RESOURCE_NAMES,buildingKey} from './definitions.js';
import {stockStores,syncInventory,putStock} from './inventory.js';

// Explicit player-invoked testing aid. It never runs on load or on a clock.
export function grantTestResources(state){
 const store=stockStores(state)[0];if(!store)return {ok:false,reason:'Нет места для тестовых запасов'};
 syncInventory(state);const added={};
 for(const key of Object.keys(RESOURCE_NAMES)){
  const amount=Math.min(1000,Math.max(0,1e9-state.resources[key]));
  if(MATERIALS.includes(key))added[key]=putStock(state,buildingKey(store),key,amount,{overflow:true});
  else{state.resources[key]+=amount;added[key]=amount;}
 }
 return {ok:true,added};
}
