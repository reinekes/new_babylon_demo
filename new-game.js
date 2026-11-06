import {newBlessingDiscovery} from './blessing-discovery.js';
import {newRainDiscovery} from './rain-discovery.js';
import {newMonumentChapter} from './monument-chapter.js';
import {enableAutumnCrops} from './agriculture.js';
import {createGame} from './engine.js';
import {strictScenario,CAT_DISCOVERY_RULES} from './scenario-profiles.js';

// UI creation only. Decoding or loading a previous town never goes through here.
// Only a newly chosen Awakening enrolls in the fisherman discovery story.
export function createNewCity({mode,seed}={}){
 const state=createGame({mode,seed,scenario:{...strictScenario(),...(mode==='awakening'?{miracles:CAT_DISCOVERY_RULES}:{})}});
 state.world.deposits=state.world.deposits.filter(d=>d.kind!=='forest'&&d.kind!=='stone');
 if(mode==='awakening'){
  state.rainDiscovery=newRainDiscovery();
  state.blessingDiscovery=newBlessingDiscovery();
 }
 state.monumentChapter=newMonumentChapter();
 enableAutumnCrops(state);
 return state;
}
