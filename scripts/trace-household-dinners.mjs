// node scripts/trace-household-dinners.mjs <city.json> [--relief]
import {readFileSync} from 'node:fs';
import {advanceTime, decode, encode, miracle} from '../engine.js';
import {setSeedProtection} from '../food-planning.js';

const city = decode(readFileSync(process.argv[2], 'utf8'));
const cohort = new Set(city.citizens.filter(c => c.lastMealQuality < 1e-7).map(c => c.id));
const addresses = new Set(city.citizens.filter(c => cohort.has(c.id)).flatMap(c => [c.home, c.floodShelter, c.fireShelter?.host]));
const homes = city.buildings.filter(b => addresses.has(b.x + ',' + b.y));
const delivered = new Map(homes.map(b => [b, b.pantryDelivered || 0]));
const currentDinner = () => Math.max(...city.citizens.map(c => c.mealEvaluated));
let day = currentDinner();
const last = day + 6;
let reliefTick = -1;
for (let step = 0; step < 120000 && day < last && !city.lost; step++) {
  if (process.argv.includes('--relief') && !city.funeral && reliefTick !== city.tick) {
    reliefTick = city.tick;
    if (city.foodPlan.protectSeeds) setSeedProtection(city, false);
    if (city.resources.food < city.population * .8) console.log('relief', city.tick, miracle(city, 'abundance'));
  }
  advanceTime(city, .25);
  for (const b of homes) {
    const amount = (b.pantryDelivered || 0) - delivered.get(b);
    if (amount <= 1e-7) continue;
    console.log('delivery', city.simTime.toFixed(2), b.x + ',' + b.y, amount.toFixed(2), b.lastRation?.source ?? '?');
    delivered.set(b, b.pantryDelivered);
  }
  if (currentDinner() <= day) continue;
  day = currentDinner();
  const group = city.citizens.filter(c => cohort.has(c.id) && c.mealEvaluated === day);
  console.log('dinner', day, city.population, group.length, group.filter(c => c.lastMealQuality < 1e-7).length,
    group.filter(c => c.lastMealQuality >= .95).length, city.citizens.filter(c => c.lastMealQuality < 1e-7).length);
  if (!decode(encode(city))) throw Error('Сохранение не прошло проверку после ужина ' + day);
}
if (day < last) console.log('ended before sixth dinner', day);
