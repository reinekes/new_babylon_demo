import {stockStores,storeStock,takeStock,putStock} from '../inventory.js';
import {buildingKey,MATERIALS} from '../definitions.js';
// Compare every field present in the historical fixture, including nested escrow.
export function projectLegacy(current,legacy){if(Array.isArray(legacy))return legacy.map((v,i)=>projectLegacy(current[i],v));if(legacy&&typeof legacy==='object')return Object.fromEntries(Object.entries(legacy).map(([k,v])=>[k,projectLegacy(current?.[k],v)]));return current;}
// Test setup: empty the origin explicitly before exercising a demolition flow.
export function emptyStore(s,key){const target=stockStores(s).find(b=>buildingKey(b)!==key);if(!target)throw new Error('Test needs another store');for(const k of MATERIALS)putStock(s,buildingKey(target),k,takeStock(s,key,k,storeStock(s,key,k)),{overflow:true});}
