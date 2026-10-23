import {createGame,decode,advanceTime} from '../engine.js';
import {terrain} from '../world.js';
import {MATERIALS,housingOf} from '../definitions.js';
import {syncCitizens} from '../workforce.js';
import {syncInventory} from '../inventory.js';
import {initializeArtisans} from '../artisan.js';
import {initializeTextiles} from '../textiles.js';
import {initializeBricks} from '../bricks.js';
import {initializeKilns} from '../kilns.js';
import {initializeCrops} from '../agriculture.js';
export const DISTRICT_SOURCE_KEY='new-babylon-v1';
export function readCityCopy(storage){try{const raw=storage.getItem(DISTRICT_SOURCE_KEY);if(!raw)return {ok:false,reason:'В этом браузере пока нет сохранённого города.'};const state=decode(raw);return state?{ok:true,state}:{ok:false,reason:'Не удалось прочитать город. Исходное сохранение не изменено.'};}catch{return {ok:false,reason:'Браузер не разрешил прочитать сохранение.'};}}
export function makeDemoDistrict(){
 const s=createGame({start:'established'});
 const sites=[['house',7,8,1],['house',7,9,2],['house',8,10,1],['house',9,10,3],['granary',10,9,2],['pottery',7,10,2],['brewery',6,10,1],['weaver',8,11,1],['sheepfold',6,9,1],['brickyard',6,11,1],['kiln',7,11,1],['field',11,9,1],['harbor',11,11,1]];
 for(const [type,x,y,level]of sites)s.buildings.push({type,x,y,level});
 s.population=32;s.capacity=housingOf(s);syncCitizens(s);initializeArtisans(s);initializeTextiles(s);initializeBricks(s);initializeKilns(s);initializeCrops(s);
 for(const k of MATERIALS)s.resources[k]=k==='food'?450:k==='clothing'?35:k==='beer'?18:100;s.resources.prestige=80;s.resources.faith=100;syncInventory(s);
 for(let i=0;i<100;i++)advanceTime(s,.1);
 return s;
}

// Reproducible opt-in load fixture. It is never written into primary storage.
export function makeStressDistrict(){
 const s=makeDemoDistrict();let n=0;
 for(let y=2;y<25&&s.buildings.length<129;y+=2)for(let x=2;x<31&&s.buildings.length<129;x+=2)if(!s.buildings.some(b=>b.x===x&&b.y===y)&&terrain(x,y,s)!=='water')s.buildings.push({type:['house','house','field','house','pottery','weaver','granary','sheepfold'][n++%8],x,y,level:2});
 s.population=200;s.capacity=housingOf(s);syncCitizens(s);initializeArtisans(s);initializeTextiles(s);initializeCrops(s);for(const k of MATERIALS)s.resources[k]=k==='food'?3000:500;syncInventory(s);return s;
}
