// Shared initial conditions for browser/node checks. Gameplay transitions use
// advanceTime and the same explicit testing/management APIs as the application.
import {createGame,advanceTime,decode,encode} from '../../engine.js';
import {grantTestResources} from '../../test-tools.js';
import {setCitizenRole,assignWorkplace} from '../../management.js';
import {initializeArtisans} from '../../artisan.js';
import {initializeBuildingInventory,putBuildingInput} from '../../building-inventory.js';
import {stockStores,takeStock} from '../../inventory.js';
import {buildingKey} from '../../definitions.js';
import {syncCitizens} from '../../workforce.js';

export function testingCity(){
 const s=createGame({start:'established',mode:'mature'});grantTestResources(s);
 for(const c of s.citizens)if(c.age>=16)setCitizenRole(s,c.id,'carrier');return s;
}
export function brewingCity(){
 const s=testingCity(),b={type:'brewery',x:10,y:9,level:1};s.buildings.push(b);initializeArtisans(s);initializeBuildingInventory(s);syncCitizens(s);
 for(const c of s.citizens.filter(c=>c.age>=16).slice(0,2)){setCitizenRole(s,c.id,'production');assignWorkplace(s,c.id,'10,9');}
 // Seed real input buffers, deducting materials from their actual store. The
 // workshop still needs its workers and full brewing time; no phase is forged.
 const store=buildingKey(stockStores(s)[0]);for(const [key,n]of Object.entries({food:4,pottery:1}))putBuildingInput(s,b,key,takeStock(s,store,key,n));
 putBuildingInput(s,b,'water',3);return s;
}
export const clockOf=s=>({simTime:s.simTime,seasonElapsed:s.seasonElapsed,tick:s.tick,season:s.season,year:s.year});
export const reloadCity=s=>decode(encode(s));
export function advanceUntil(s,predicate,{steps=3000,dt=.1,onStage}={}){
 let previous='';for(let i=0;i<steps&&!predicate(s);i++){
  advanceTime(s,dt);const stage=[s.firstBeerFeast?.status,s.festival?.stage,s.funeral?.stage].join(':');
  if(stage!==previous){onStage?.(s,stage);previous=stage;}
 }
 return predicate(s);
}
