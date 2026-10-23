// Bounded display populations. Hunting, pests, temple cats and productive
// sheepfolds retain their own existing ledgers; this module never creates goods.
export const ECOLOGY_SPECIES=Object.freeze(['goat','gazelle','jackal','fish','orange-bird','goose','fox','boar','lioness','dog','duck','donkey','bull','sheep-kenchoo','sky-birds']);
export const POPULATION_LIMIT=6;
export function initializeEcology(s,{legacy=false}={}){
 if(s.ecology)return s.ecology;
 const time=s.simTime||0;
 s.ecology={version:1,...(legacy?{legacyFauna:true}:{}),populations:Object.fromEntries(ECOLOGY_SPECIES.map((kind,i)=>[kind,{count:legacy&&kind==='fish'?36:legacy&&kind==='goat'?7:legacy&&kind==='gazelle'?12:legacy&&kind==='jackal'?4:2,nextBirth:time+240+i*17}]))};return s.ecology;
}
export function ecologyCount(s,kind,fallback=2){return s.ecology?.populations?.[kind]?.count??fallback;}
export function advanceEcology(s){
 const ecology=initializeEcology(s),now=s.simTime||0;
 for(const [i,kind]of ECOLOGY_SPECIES.entries()){
  const p=ecology.populations[kind],period=240+i*17;
  if(now+1e-8<p.nextBirth)continue;
  const elapsed=Math.floor((now-p.nextBirth)/period)+1;p.count=Math.min(Math.max(POPULATION_LIMIT,p.count),p.count+elapsed);p.nextBirth+=elapsed*period;
 }
}
export function validateEcology(s){const e=s.ecology;if(!e||e.version!==1||(e.legacyFauna!==undefined&&e.legacyFauna!==true)||!e.populations||Array.isArray(e.populations)||Object.keys(e.populations).length!==ECOLOGY_SPECIES.length)return false;return ECOLOGY_SPECIES.every(k=>{const p=e.populations[k];return p&&Number.isSafeInteger(p.count)&&p.count>=2&&p.count<=(k==='fish'&&e.legacyFauna?36:12)&&Number.isFinite(p.nextBirth)&&p.nextBirth>=0&&p.nextBirth<=1e9;});}
