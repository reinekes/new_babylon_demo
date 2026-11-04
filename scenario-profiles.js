// History and miracle rules are independent of the spiritual game mode.
// Keep defaults legacy until every strict view is ready for new-game activation.
export const legacyScenario=()=>({version:1,history:'legacy-v1',miracles:'classic-v1'});
export const strictScenario=()=>({version:1,history:'sumer-iii-v1',miracles:'classic-v1'});
export function validateScenario(profile){
 return !!profile&&typeof profile==='object'&&!Array.isArray(profile)&&profile.version===1&&
  ['legacy-v1','sumer-iii-v1'].includes(profile.history)&&profile.miracles==='classic-v1';
}
export const isStrictSumer=s=>s?.scenario?.history==='sumer-iii-v1';
