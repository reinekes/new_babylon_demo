import {recordBuildingProduction} from './building-production-history.js';
import {isOperational,outputMultiplier} from './definitions.js';
export const KILN_RECIPE=Object.freeze({brick:4,reed:3});
export const FIRING_SECONDS=20,COOLING_SECONDS=8;
const fields=['brick','reed','hot','time','ready'];
const empty=()=>({brick:0,reed:0,hot:0,time:0,ready:0});
function valid(v){return v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===fields.length&&fields.every(k=>Number.isFinite(v[k])&&v[k]>=0)&&v.brick<=4&&v.reed<=3&&[0,4].includes(v.hot)&&[0,4].includes(v.ready)&&!(v.hot&&v.ready)&&v.time<FIRING_SECONDS+COOLING_SECONDS&&(!v.time||v.hot>0)&&(!v.hot&&!v.ready||v.brick===0&&v.reed===0);}
export function initializeKilns(s){for(const b of s.buildings||[])if(b.type==='kiln'&&b.firing===undefined)b.firing=empty();}
export function kilnNeeds(b){const v=b?.firing;return b?.type==='kiln'&&isOperational(b)&&valid(v)&&!v.hot&&!v.ready?{brick:4-v.brick,reed:3-v.reed}:{brick:0,reed:0};}
// Loading/ignition is worker action; charged fuel keeps burning overnight.
export function startFiring(b){const v=b?.firing;if(b?.type!=='kiln'||!isOperational(b)||!valid(v)||v.hot||v.ready||v.brick<4||v.reed<3)return 0;v.brick-=4;v.reed-=3;v.hot=4;v.time=0;return 4;}
export function advanceKilns(s,dt){if(!Number.isFinite(dt)||dt<=0)return;for(const b of s.buildings||[]){const v=b.firing;if(b.type!=='kiln'||!isOperational(b)||!valid(v)||!v.hot)continue;v.time=Math.min(28,v.time+dt*outputMultiplier(b));if(v.time>=28){v.ready=v.hot;v.hot=0;v.time=0;recordBuildingProduction(s,b,'firedBrick',v.ready);}}}
export function collectFired(b){if(b?.type!=='kiln'||!isOperational(b)||!valid(b.firing))return 0;const n=b.firing.ready;b.firing.ready=0;return n;}
export function validateKilns(s){return Array.isArray(s.buildings)&&s.buildings.every(b=>b.type==='kiln'?valid(b.firing):!Object.hasOwn(b,'firing'));}
