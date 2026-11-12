import {newCivicOrder} from './civic-order.js';
import {COURTYARD_BIRTH_FOOD} from './demography.js';
import {newInannaDiscovery} from './inanna-discovery.js';
import {newDepthSupply} from './depth-supply.js';
import {newStarObservations} from './star-observations.js';
import {newArrivalHospitality} from './arrival-hospitality.js';
import {newShapingProjects} from './shaping-projects.js';
import {newRevelationEvidence} from './revelation-evidence.js';
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
import {expandResourceSites} from './world.js';
import {strictScenario,CAT_DISCOVERY_RULES} from './scenario-profiles.js';

// UI creation only. Decoding or loading a previous town never goes through here.
// Only a newly chosen Awakening enrolls in the fisherman discovery story.
export function createNewCity({mode,seed}={}){
 const state=createGame({mode,seed,scenario:{...strictScenario(),...(mode==='awakening'?{miracles:CAT_DISCOVERY_RULES}:{})}});
 state.demography.birthFoodRule=COURTYARD_BIRTH_FOOD;
 state.world.deposits=state.world.deposits.filter(d=>d.kind!=='forest'&&d.kind!=='stone');
 expandResourceSites(state);
 if(mode==='awakening'){
  state.civicOrder=newCivicOrder();
  state.fearCrisis={version:1};
  state.rainDiscovery=newRainDiscovery();
  state.blessingDiscovery=newBlessingDiscovery();
  state.arrivalHospitality=newArrivalHospitality();
  state.peaceDiscovery=newPeaceDiscovery();
  state.earthDiscovery=newEarthDiscovery();
  state.richCatchEvidence=newRichCatchEvidence();
  state.creatorMaterials=newCreatorMaterials();
  state.shapingProjects=newShapingProjects();
  state.windDelivery=newWindDelivery();
  state.abundanceGift=newAbundanceGift();
  state.abundanceDiscovery=newAbundanceDiscovery();
  state.sunlightChapter=1;
  state.revelationEvidence=newRevelationEvidence();
  state.starObservations=newStarObservations();
  state.depthSupply=newDepthSupply();
  state.landMemoryChapter=1;
  state.inannaDiscovery=newInannaDiscovery();
 }
 state.monumentChapter=newMonumentChapter();
 enableAutumnCrops(state);
 return state;
}
