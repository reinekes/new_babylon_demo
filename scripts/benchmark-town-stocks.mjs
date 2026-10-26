import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {makeStressDistrict} from '../district3d/state.js';
import {advanceTime,decode,encode} from '../engine.js';
import {simulationSeconds} from '../calendar.js';

// CPU timings, not FPS. Close rendering tabs and other benchmarks before use.
// A 4x game clock sampled at 15 updates/real second: 0.06667 simulation seconds per call.
// First save a fixture, then reuse that exact JSON when comparing code revisions:
// node scripts/benchmark-town-stocks.mjs --write-snapshot /tmp/town-stocks.json
// node scripts/benchmark-town-stocks.mjs --snapshot /tmp/town-stocks.json
const args=process.argv.slice(2),option=name=>{const i=args.indexOf(name);if(i<0)return null;if(!args[i+1]||args[i+1].startsWith('--'))throw Error(`Missing path after ${name}`);return args[i+1];};
const source=option('--snapshot'),destination=option('--write-snapshot');
if(args.some((arg,i)=>i%2===0&&!['--snapshot','--write-snapshot'].includes(arg)))throw Error('Use --snapshot path or --write-snapshot path');
const raw=source?readFileSync(source,'utf8'):encode(makeStressDistrict());
const s=decode(raw);if(!s)throw Error('Invalid benchmark snapshot');if(destination)writeFileSync(destination,raw);
const initial={buildings:s.buildings.length,population:s.population,jobs:s.district.jobs.length,simTime:s.simTime},samples=[],targetUpdateHz=15,speed=4,step=simulationSeconds(1/targetUpdateHz,speed);
for(let i=0;i<20;i++){s.event=null;const start=performance.now();advanceTime(s,step);samples.push(performance.now()-start);}
if(!decode(encode(s)))throw Error('Benchmark produced an invalid save');
const sorted=[...samples].sort((a,b)=>a-b),mean=values=>values.reduce((a,b)=>a+b,0)/values.length;
console.log(JSON.stringify({snapshotSHA256:createHash('sha256').update(raw).digest('hex'),initial,steps:samples.length,targetUpdateHz,speed,simulationSecondsPerStep:step,simulation4xCpu:{meanMs:mean(samples),p95Ms:sorted[Math.ceil(sorted.length*.95)-1],maxMs:sorted.at(-1),warmMeanMs:mean(samples.slice(1))},finalJobs:s.district.jobs.length}));
