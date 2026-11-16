import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root=new URL('../',import.meta.url);
const {decode,encode,advanceTime}=await import(new URL('engine.js',root));
const raw=readFileSync(new URL('docs/benchmarks/city500-save-2026-11-13.json',root),'utf8');
const state=decode(raw),activeTrips=()=>state.citizens.reduce((n,c)=>n+Number(!!c.waterTrip),0);
if(!state||state.population!==500||state.buildings.length!==250)throw Error('Expected the 500-resident fixture');
const bursts=[],checkpoints=[];let totalMs=0;
for(let i=0;i<600;i++){
 const previous=activeTrips(),start=performance.now();
 advanceTime(state,.1);
 const ms=performance.now()-start,current=activeTrips();
 totalMs+=ms;
 if(current-previous>=20)bursts.push({step:i,previous,current,ms});
 if(i%20===0||current-previous>=20){
  const save=encode(state);
  if(encode(decode(save))!==save)throw Error(`Save round-trip changed at step ${i}`);
  checkpoints.push({step:i,sha256:createHash('sha256').update(save).digest('hex')});
 }
}
console.log(JSON.stringify({bursts,totalMs,checkpoints},null,2));
