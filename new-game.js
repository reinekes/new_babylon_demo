import {newAbundanceDiscovery} from './abundance-discovery.js';
import {newAbundanceGift} from './abundance-gift.js';
import {newWindDelivery} from './wind-delivery.js';
import {newCreatorMaterials} from './creator-materials.js';
import {newRichCatchEvidence} from './fish-provenance.js';
import {newEarthDiscovery} from './field-grain.js';
import {newPeaceDiscovery} from './peace-discovery.js';
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
  state.peaceDiscovery=newPeaceDiscovery();
  state.earthDiscovery=newEarthDiscovery();
  state.richCatchEvidence=newRichCatchEvidence();
  state.creatorMaterials=newCreatorMaterials();
  state.windDelivery=newWindDelivery();
  state.abundanceGift=newAbundanceGift();
  state.abundanceDiscovery=newAbundanceDiscovery();
 }
 state.monumentChapter=newMonumentChapter();
 enableAutumnCrops(state);
 return state;
}
