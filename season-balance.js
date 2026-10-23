import {isArtisan,artisanOutput} from './artisan.js';
import {seedReserve} from './food-planning.js';
import {weatherAt} from './environment.js';
import {MATERIALS,BUILDINGS,buildingKey,isOperational,outputMultiplier} from './definitions.js';
import {workRate,mealRation,beliefMultiplier} from './wellbeing.js';
import {networkFor,routeBetween} from './workforce.js';
import {stockStores,storeCapacity} from './inventory.js';
import {craftBatch,craftResource,craftState,craftLoad,fleeceCapacity} from './textiles.js';
export const RESOURCE_GROUPS=[
 {id:'basic',name:'Добыча',keys:['food','clay','reed','wood','stone','hides','wool']},
 {id:'processed',name:'Переработка',keys:['brick','firedBrick','cloth','clothing','pottery','beer']},
 {id:'divine',name:'Влияние',keys:['faith','prestige']}
];
// Analytical estimate for 45 seconds in the current season, not a second simulation.
// Local stores and current workers constrain processing; trade, building and miracles are one-offs.
export function seasonBalance(s){
 const keys=RESOURCE_GROUPS.flatMap(g=>g.keys),r=Object.fromEntries(keys.map(k=>[k,{income:0,outgo:0,net:0}])),net=networkFor(s),ports=new Map(net.ports.filter(p=>!p.building.siteKey).map(p=>[buildingKey(p.building),p])),buildings=new Map(s.buildings.map(b=>[buildingKey(b),b])),stocks=new Map(),capacities=new Map(),byComponent=new Map(),incomeByComponent=new Map(),townFuneral=s.funeral&&s.funeral.scope!=='family';
 const component=key=>net.components.get(ports.get(key)?.key),empty=()=>Object.fromEntries(MATERIALS.map(k=>[k,0]));
 for(const b of s.buildings)if(b.stock&&isOperational(b)){const id=component(buildingKey(b));if(id===undefined)continue;if(!stocks.has(id)){stocks.set(id,empty());capacities.set(id,empty());}for(const k of MATERIALS){stocks.get(id)[k]+=b.stock[k]||0;capacities.get(id)[k]+=storeCapacity(b);}}
 const production=new Map(),groups=new Map();
 for(const c of s.citizens){if(c.age<16||!c.work||c.guardPost||c.site||c.clinic||c.school||c.tradeJob||c.saleJob||c.districtJob||townFuneral||s.funeral?.actors.some(a=>a.id===c.id))continue;const b=buildings.get(c.work),id=component(c.work);if(!b||!isOperational(b)||id===undefined||!stocks.has(id)||component(c.home)!==id)continue;if(!groups.has(c.work))groups.set(c.work,[]);groups.get(c.work).push(c);}
 const flow=(id,k,n)=>{if(!byComponent.has(id))byComponent.set(id,empty());byComponent.get(id)[k]+=n;};
 const credit=(id,k,n)=>{n=Math.max(0,n);r[k].income+=n;if(MATERIALS.includes(k)){flow(id,k,n);if(!incomeByComponent.has(id))incomeByComponent.set(id,empty());incomeByComponent.get(id)[k]+=n;}};
 const debit=(id,k,n)=>{n=Math.max(0,n);r[k].outgo+=n;if(MATERIALS.includes(k)&&id!==undefined)flow(id,k,-n);};
 for(const [key,people] of groups){const b=buildings.get(key),def=BUILDINGS[b.type],id=component(key);let trips=0;
  for(const c of people){const from=ports.get(key),to=ports.get(c.store),route=from&&to&&routeBetween(s,from.key,to.key);if(!route)continue;const rate=workRate(c,b.type),distance=Math.max(0,route.length-1),travel=2*distance/(1.05*(s.buffs?.haste?1.5:1)*Math.max(.15,workRate(c,b.type))),inputTravel=isArtisan(b)?travel*4:['weaver','tailor','kiln'].includes(b.type)?travel*(b.type==='kiln'?3:Math.ceil(craftBatch(b)/3)):0;trips+=45*13/24/((def.workTime||4)/(rate*(isArtisan(b)?outputMultiplier(b):1))+travel+inputTravel);}
  production.set(key,trips);
  if(isArtisan(b)||['kiln','brickyard','waterpoint','weaver','tailor','healer','depot'].includes(b.type))continue;
  if(b.type==='field'){const crop=b.crop||{},batch=7*outputMultiplier(b);if(crop.sheaves>0||s.season===2){const harvest=s.season===2?crop.remaining||0:0;credit(id,'food',Math.min((crop.sheaves||0)+harvest,trips*batch*(harvest>0?.5:1)));}if(s.season===0)debit(id,'food',Math.min(stocks.get(id).food,Math.max(0,4-(crop.seedUsed||0))));continue;}
  if(b.type==='sheepfold'){credit(id,'wool',Math.min(trips*2*outputMultiplier(b),(b.flock?.fleece||0)+fleeceCapacity(b)*45/180));continue;}
  for(const [k,base]of Object.entries(def.output)){let mult=outputMultiplier(b);if(k==='food')mult*=s.buffs?.fertility?1.6:1;if(['clay','reed'].includes(k))mult*=s.buffs?.inspiration?1.75:1;if(['faith','prestige'].includes(k))mult*=s.buffs?.sunlight?1.8:1;if(k==='faith')mult*=beliefMultiplier(s);credit(id,k,trips*base*mult);}
 }
 // Finish each link before budgeting the next; never borrow from another bank.
 for(const type of ['weaver','tailor'])for(const [key]of groups){const b=buildings.get(key);if(b.type!==type)continue;const id=component(key),input=craftResource(b),output=type==='weaver'?'cloth':'clothing',ratio=type==='weaver'?3:2,buffer=craftState(b)?.[input]||0,incoming=s.citizens.filter(c=>c.craftSite===key).reduce((n,c)=>n+craftLoad(c),0),available=Math.max(0,stocks.get(id)[input]+(byComponent.get(id)?.[input]||0)),amount=Math.min((production.get(key)||0)*outputMultiplier(b),(available+buffer+incoming)/ratio),taken=Math.max(0,amount*ratio-buffer-incoming);debit(id,input,taken);credit(id,output,amount);}
 for(const [key] of groups){const b=buildings.get(key);if(b.type!=='brickyard')continue;const id=component(key),v=b.brickmaking||{},amounts={clay:4,reed:1},buffers={clay:v.clay||0,reed:v.reed||0};for(const c of s.citizens)if(c.craftSite===key&&c.craftMaterial)buffers[c.craftMaterial]+=c.craftAmount||0;const dryRate=s.rain>0?0:weatherAt(s).type==='rain'?0:weatherAt(s).type==='cloudy'?.6:weatherAt(s).type==='wind'?.85:1;const dryingCapacity=Math.max(0,45*dryRate-(v.wet?30-(v.drying||0):0))/30;const batches=Math.min((production.get(key)||0),dryingCapacity,...Object.entries(amounts).map(([k,n])=>(Math.max(0,stocks.get(id)[k]+(byComponent.get(id)?.[k]||0))+buffers[k])/n),(v.water||0)/2);for(const [k,n]of Object.entries(amounts))debit(id,k,Math.max(0,batches*n-buffers[k]));credit(id,'brick',(v.ready||0)+(v.wet&&45*dryRate>=30-(v.drying||0)?v.wet:0)+batches*4);}
 for(const [key]of groups){const b=buildings.get(key);if(b.type!=='kiln')continue;const id=component(key),v=b.firing||{},buffers={brick:v.brick||0,reed:v.reed||0};for(const c of s.citizens)if(c.craftSite===key&&c.craftMaterial)buffers[c.craftMaterial]+=c.craftAmount||0;const remaining=v.hot?(28-(v.time||0))/outputMultiplier(b):0,batches=Math.min(production.get(key)||0,Math.max(0,45-remaining)/(28/outputMultiplier(b)+5),...Object.entries({brick:4,reed:3}).map(([k,n])=>(Math.max(0,stocks.get(id)[k]+(byComponent.get(id)?.[k]||0))+buffers[k])/n));for(const [k,n]of Object.entries({brick:4,reed:3}))debit(id,k,Math.max(0,batches*n-buffers[k]));credit(id,'firedBrick',(v.ready||0)+(v.hot&&remaining<=45?v.hot:0)+batches*4);}
 // Artisan batches use only water already at the workshop; this conservative
 // estimate never invents future water trips or borrows protected seed grain.
 const protectedByComponent=new Map();let reserve=seedReserve(s);
 for(const store of stockStores(s)){const n=Math.min(store.stock?.food||0,reserve),id=component(buildingKey(store));protectedByComponent.set(id,(protectedByComponent.get(id)||0)+n);reserve-=n;}
 for(const type of ['pottery','brewery'])for(const [key]of groups){const b=buildings.get(key);if(b.type!==type)continue;
  const id=component(key),v=b.artisan,output=artisanOutput(b),pottery=type==='pottery',dryRate={sunny:1,cloudy:.6,wind:.85,rain:0}[weatherAt(s).type]||0;
  const buffers={clay:v.clay,reed:v.reed,food:v.food,pottery:v.pottery};for(const c of s.citizens)if(c.craftSite===key&&c.craftMaterial)buffers[c.craftMaterial]=(buffers[c.craftMaterial]||0)+(c.craftAmount||0);
  const available=k=>Math.max(0,(stocks.get(id)?.[k]||0)+(byComponent.get(id)?.[k]||0)-(k==='food'?(protectedByComponent.get(id)||0):0));
  // Stored progress is labor, not elapsed wall time. Match the forecast's
  // workday allowance and sum the actual rates of the workshop's staff.
  const laborRate=groups.get(key).reduce((n,c)=>n+workRate(c,b.type),0)*13/24*outputMultiplier(b);
  const laborTime=seconds=>laborRate>0?Math.max(0,seconds)/laborRate:Infinity;
  const duration=pottery?laborTime(5)+(dryRate?12/dryRate:Infinity)+18:laborTime(15);
  const activeRemaining={forming:laborTime(5-v.elapsed)+(dryRate?12/dryRate:Infinity)+18,drying:(dryRate?(12-v.elapsed)/dryRate:Infinity)+18,firing:12-v.elapsed+6,cooling:6-v.elapsed,brewing:laborTime(15-v.elapsed),ready:0,idle:0}[v.stage];
  const active=v.stage!=='idle'&&activeRemaining<=45?1:0;
  const amounts=pottery?{clay:4,reed:2}:{food:4};
  let batches=v.stage==='idle'?Math.floor(Math.max(0,Math.min(production.get(key)||0,45/duration,(v.water||0)/(pottery?2:3),...Object.entries(amounts).map(([k,n])=>(available(k)+buffers[k])/n),pottery?Infinity:v.vesselUses+4*(available('pottery')+buffers.pottery)))):0;
  for(const [k,n]of Object.entries(amounts))debit(id,k,Math.max(0,batches*n-buffers[k]));
  if(!pottery)debit(id,'pottery',Math.max(0,Math.ceil(Math.max(0,batches-v.vesselUses)/4)-buffers.pottery));
  credit(id,output,(batches+active)*(pottery?2:3));
 }
 for(const c of s.citizens){debit(component(c.home),'food',mealRation(c)*45/60);debit(component(c.home),'clothing',45/(540*.75));r.faith.income+=(c.faith??60)/100*.15*45/60;}
 const sites=s.pests?.sites||[];for(const q of sites){const guard=s.citizens.some(c=>c.guardPost===q.key&&c.work===q.key&&c.phase==='working'&&!s.funeral?.actors.some(a=>a.id===c.id)),cat=s.pests.cats.some(c=>c.site===q.key);debit(component(q.key),'food',Math.min(buildings.get(q.key)?.stock?.food||0,.012*q.mice*45/Math.max(1,sites.length)*(guard?.15:cat?.4:1)));}
 for(const [key,people]of groups){const b=buildings.get(key);if(b.type!=='healer')continue;const patients=s.citizens.filter(c=>c.clinic===key),need=patients.reduce((n,c)=>n+Math.max(0,(c.careGoal||85)-c.health),0),healing=Math.min(need,people.reduce((n,c)=>n+45*13/24*workRate(c,'healer'),0));debit(component(key),'food',healing*.04);debit(component(key),'reed',healing*.02);}
 // Local surpluses cannot grow a full warehouse; demand is still shown even if stock is empty.
 for(const [id,flow]of byComponent)for(const k of MATERIALS){const overflow=Math.max(0,flow[k]-((capacities.get(id)?.[k]||0)-(stocks.get(id)?.[k]||0)));if(overflow>0)r[k].income=Math.max(0,r[k].income-Math.min(overflow,incomeByComponent.get(id)?.[k]||0));}
 for(const k of keys)r[k].net=r[k].income-r[k].outgo;return r;
}
