import {createGame} from './engine.js';
import {strictScenario,CAT_DISCOVERY_RULES} from './scenario-profiles.js';

// UI creation only. Decoding or loading a previous town never goes through here.
// Only a newly chosen Awakening enrolls in the fisherman discovery story.
export function createNewCity({mode,seed}={}){return createGame({mode,seed,scenario:{...strictScenario(),...(mode==='awakening'?{miracles:CAT_DISCOVERY_RULES}:{})}});}
