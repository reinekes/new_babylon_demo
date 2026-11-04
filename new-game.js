import {createGame} from './engine.js';
import {strictScenario} from './scenario-profiles.js';

// UI creation only. Decoding or loading a previous town never goes through here.
// Fisher discovery is enabled separately once its full quest contract is ready.
export function createNewCity({mode,seed}={}){return createGame({mode,seed,scenario:strictScenario()});}
