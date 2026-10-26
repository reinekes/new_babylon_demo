// The al-Ubaid dairy frieze supports the activity; quantities are game balance.
export const dairyRecipe=Object.freeze({reed:1,water:4});
export const dairySpec=()=>({recipe:dairyRecipe,duration:8,output:{milk:3},inputCapacity:12,outputCapacity:24});
const n=v=>Number.isFinite(v)?Math.max(0,v):0;
export function initializeDairy(s){for(const b of s.buildings||[])if(b.type==='cowshed'){b.dairy??={reed:0,water:0,elapsed:0,cows:3,calves:2};}}
export function dairyNeeds(b){return {reed:Math.max(0,3-n(b.dairy?.reed)),water:Math.max(0,12-n(b.dairy?.water))};}
// One batch per call lets the caller reserve real output room before any input is spent.
export function workDairy(b,seconds){
 const d=b.dairy;if(!d||!Number.isFinite(seconds)||seconds<=0||d.cows<1||d.reed<1||d.water<4)return 0;
 d.elapsed=Math.min(8,n(d.elapsed)+seconds);if(d.elapsed<8-1e-7)return 0;
 d.reed-=1;d.water-=4;d.elapsed=0;return 3;
}
export function validateDairy(s){return (s.buildings||[]).every(b=>b.type==='cowshed'?!!b.dairy&&Object.keys(b.dairy).every(k=>['reed','water','elapsed','cows','calves'].includes(k))&&['reed','water','elapsed','cows','calves'].every(k=>Number.isFinite(b.dairy[k])&&b.dairy[k]>=0)&&b.dairy.reed<=12&&b.dairy.water<=12&&b.dairy.elapsed<=8&&Number.isInteger(b.dairy.cows)&&b.dairy.cows<=12&&Number.isInteger(b.dairy.calves)&&b.dairy.calves<=12&&b.dairy.cows+b.dairy.calves<=12:b.dairy===undefined);}
