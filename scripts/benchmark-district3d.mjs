import {makeStressDistrict} from '../district3d/state.js';
import {advanceTime,encode,decode} from '../engine.js';
const s=makeStressDistrict(),samples=[];let roundTrips=0;
for(let i=0;i<1800;i++){s.event=null;const start=performance.now();advanceTime(s,4/60);samples.push(performance.now()-start);if(i%120===0){if(!decode(encode(s)))throw Error(`Invalid stress save at ${i}`);roundTrips++;}}
samples.sort((a,b)=>a-b);console.log(JSON.stringify({buildings:s.buildings.length,population:s.population,simulation4xCpu:{medianMs:samples[900],p95Ms:samples[1710],maxMs:samples.at(-1)},roundTrips}));
