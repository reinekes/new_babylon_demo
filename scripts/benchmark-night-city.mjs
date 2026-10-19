import {writeFileSync} from 'node:fs';
import {createGame,advanceTime,terrain,encode,decode} from '../engine.js';
import {syncCitizens} from '../workforce.js';
import {housingOf,MATERIALS} from '../definitions.js';
import {syncInventory} from '../inventory.js';
import {initializeArtisans} from '../artisan.js';
import {initializeTextiles} from '../textiles.js';
import {initializeBricks} from '../bricks.js';
import {initializeKilns} from '../kilns.js';
import {orderFestival} from '../festival.js';
const s=createGame();let n=0;
for(let y=2;y<22;y+=2)for(let x=2;x<30;x+=2)if(terrain(x,y,s)!=='water'&&!s.buildings.some(b=>b.x===x&&b.y===y)){const type=['house','house','house','field','pottery','brewery','granary','weaver','brickyard','kiln'][n++%10];s.buildings.push({type,x,y,level:2});}
s.population=200;s.capacity=housingOf(s);syncCitizens(s);initializeArtisans(s);initializeTextiles(s);initializeBricks(s);initializeKilns(s);for(const k of MATERIALS)s.resources[k]=k==='food'?3000:500;s.resources.prestige=100;syncInventory(s);for(const b of s.buildings.filter(b=>b.type==='house')){b.pantry=25;b.pantryDelivered=25;}
const order=orderFestival(s);if(!order.ok)throw Error(order.reason);
if(!decode(encode(s)))throw Error('Invalid initial stress save');
if(process.argv[2])writeFileSync(process.argv[2],encode(s));
const samples=[];for(let i=0;i<1800;i++){s.event=null;const a=performance.now();advanceTime(s,4/60);samples.push(performance.now()-a);if(i%120===0&&!decode(encode(s)))throw Error(`Invalid stress save at ${i}`);}samples.sort((a,b)=>a-b);
console.log(JSON.stringify({buildings:s.buildings.length,population:s.population,artisans:s.buildings.filter(b=>b.artisan).length,festivalStage:s.festival?.stage||'finished',simulation4xCpu:{medianMs:samples[900],p95Ms:samples[1710],maxMs:samples.at(-1)},roundTrips:15}));
