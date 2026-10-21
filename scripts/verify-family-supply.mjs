import assert from 'node:assert/strict';
import {makeStressDistrict} from '../district3d/state.js';
import {advanceTime,encode,decode} from '../engine.js';
import {stockStores,syncInventory} from '../inventory.js';
import {buildingKey} from '../definitions.js';
import {networkFor} from '../workforce.js';

// Adversarial fixture comparison, never a runtime grant or a player-save edit.
// Both scenarios start with the same finite 3000 warehouse food and no bridge.
const DURATION=640,STEP=.2,INITIAL_FOOD=3000;
function scenario(distributeInitialFood){
 const s=makeStressDistrict(),stores=stockStores(s),network=networkFor(s);
 assert.equal(s.resources.food,INITIAL_FOOD);assert.ok(!s.buildings.some(b=>b.type==='bridge'));
 const component=new Map(network.ports.filter(p=>!p.building.siteKey).map(p=>[buildingKey(p.building),network.components.get(p.key)]));
 const source=stores.find(b=>b.stock.food>0),fedComponent=component.get(buildingKey(source)),isolated=s.citizens.filter(c=>component.get(c.home)!==fedComponent),initialIds=new Set(isolated.map(c=>c.id));
 assert.equal(isolated.length,68,'the original fixture has 68 residents on the disconnected empty bank');
 const isolatedComponent=component.get(isolated[0].home);assert.ok(isolated.every(c=>component.get(c.home)===isolatedComponent));
 assert.equal(new Set(component.values()).size,2);
 assert.ok(stores.filter(b=>component.get(buildingKey(b))!==fedComponent).every(b=>b.stock.food===0));
 if(distributeInitialFood){for(const b of stores)b.stock.food=INITIAL_FOOD/stores.length;syncInventory(s);}
 assert.equal(s.resources.food,INITIAL_FOOD);assert.ok(decode(encode(s)),'initial fixture must be a valid save');
 const initialPopulation=s.population,started=process.cpuUsage();
 // Clearing random-choice popups is restricted to these throwaway fixtures.
 // No homes, routes, health, hunger, meals, work, reserves or stock are altered.
 for(let i=0;i<Math.round(DURATION/STEP);i++){s.event=null;advanceTime(s,STEP);}
 const usedCpu=process.cpuUsage(started),simulationCpuMs=(usedCpu.user+usedCpu.system)/1000;
 assert.ok(decode(encode(s)),'final fixture must remain a valid save');
 const deaths=s.lifeAnalytics.people.filter(p=>p.diedTick!==null),starvation=deaths.filter(p=>p.cause==='starvation');
 if(distributeInitialFood){assert.equal(deaths.length,0,'finite local stores prevent starvation without a bridge or later gifts');assert.ok(s.population>=initialPopulation);}
 else{
  // Newborn children of the isolated families may also die during the longer
  // run. The original 68-person cohort must all be recorded, and every death
  // must belong to the same initially unfed component, rather than the fed bank.
  assert.equal(starvation.filter(p=>initialIds.has(p.id)).length,68);
  assert.ok(deaths.every(p=>p.cause==='starvation'&&component.get(p.home)===isolatedComponent),JSON.stringify({population:s.population,food:s.resources.food,unexpectedDeaths:deaths.filter(p=>p.cause!=='starvation'||component.get(p.home)!==isolatedComponent).map(p=>({id:p.id,home:p.home,cause:p.cause}))}));
 }
 return {scenario:distributeInitialFood?'finite_food_on_both_banks':'food_only_on_disconnected_bank',durationSeconds:DURATION,initialStoredFood:INITIAL_FOOD,initialPopulation,initialIsolatedResidents:isolated.length,population:s.population,deaths:deaths.length,originalIsolatedCohortDeaths:deaths.filter(p=>initialIds.has(p.id)).length,storedFood:s.resources.food,simulationCpuMs:Math.round(simulationCpuMs*100)/100};
}
console.log(JSON.stringify({verified:true,measurement:'Node process CPU milliseconds; not FPS',scenarios:[scenario(false),scenario(true)]}));
