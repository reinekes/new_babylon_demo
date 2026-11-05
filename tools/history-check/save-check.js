import {MATERIALS} from '../../definitions.js';

// syncInventory reconciles each local stock to the aggregate on encode/decode.
// Keep its last-bit noise visible; never relax cargo, people, crops or the clock.
export function compareSavedState(before,after){
 const changes=[];
 function changed(path,a,b){
  const stock=/^\/buildings\/\d+\/stock\/([^/]+)$/.exec(path),delta=typeof a==='number'&&typeof b==='number'?b-a:null;
  const roundoff=!!stock&&MATERIALS.includes(stock[1])&&Number.isFinite(a)&&Number.isFinite(b)&&a>=0&&b>=0&&Math.abs(delta)<=1e-9;
  changes.push({path,before:a,after:b,delta,roundoff});
 }
 function walk(a,b,path){
  if(a===b)return;
  if(a===null||b===null||typeof a!==typeof b||typeof a!=='object'||Array.isArray(a)!==Array.isArray(b)){changed(path,a,b);return;}
  const keys=[...new Set([...Object.keys(a),...Object.keys(b)])];
  for(const key of keys){if(!Object.hasOwn(a,key)||!Object.hasOwn(b,key))changed(path+'/'+key,a[key],b[key]);else walk(a[key],b[key],path+'/'+key);}
 }
 walk(before,after,'');return {equal:changes.length===0,equivalent:changes.every(c=>c.roundoff),changes};
}
