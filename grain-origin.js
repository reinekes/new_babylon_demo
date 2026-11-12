// Offsets count the unlabelled food before a batch. Trailing unlabelled food
// is implicit, so older saves and other food producers need no extra records.
const EPS=1e-8, LIMIT=32;
const end=parts=>parts.at(-1)?.end||0;

export function appendGrain(holder,key,parts,before){
 if(!holder||!parts.length)return;
 const queue=(holder[key]||[]).filter(part=>part.end<=before+EPS);
 for(const part of parts){
  const next={...part,end:before+part.end};
  const last=queue.at(-1);
  if(last?.field===next.field&&Math.abs(last.end-next.end+next.amount)<EPS){
   last.amount+=next.amount;last.end=next.end;
  }else queue.push(next);
 }
 holder[key]=queue.slice(-LIMIT);
}

export function takeGrain(holder,key,amount,before){
 const parts=holder?.[key];
 if(!parts||amount<=EPS)return [];
 const removed=[],remaining=[];
 for(const part of parts){
  if(part.end>before+EPS)continue;
  const taken=Math.min(part.amount,Math.max(0,amount-part.end+part.amount));
  if(taken>EPS)removed.push({...part,amount:taken,end:Math.min(part.end,amount)});
  if(part.amount-taken>EPS)remaining.push({...part,amount:part.amount-taken,end:part.end-amount});
 }
 if(remaining.length)holder[key]=remaining;else delete holder[key];
 return removed;
}

export function recordGrainDinner(s,home,amount){
 const parts=takeGrain(home,'grainPantry',amount,home.pantry);
 if(!parts.length)return;
 const day=Math.floor((s.simTime-30+EPS)/60);
 const previous=home.grainDinner?.day===day?home.grainDinner.fields:[];
 const fields=new Map(previous.map(part=>[part.field,part.amount]));
 for(const part of parts)fields.set(part.field,(fields.get(part.field)||0)+part.amount);
 home.grainDinner={day,fields:[...fields].slice(-LIMIT).map(([field,amount])=>({field,amount}))};
}

const validPart=p=>p&&typeof p.field==='string'&&/^\d+,\d+$/.test(p.field)&&Number.isFinite(p.amount)&&p.amount>EPS;
function validQueue(queue,physical=0){
 return queue===undefined||Array.isArray(queue)&&queue.length>0&&queue.length<=LIMIT&&end(queue)<=physical+EPS&&
  queue.every((p,i)=>validPart(p)&&Number.isFinite(p.end)&&p.end-p.amount>=end(queue.slice(0,i))-EPS);
}
export function validateGrainOrigin(s){
 return s.buildings.every(b=>validQueue(b.grainStock,b.stock?.food)&&
  (b.grainOutput===undefined||b.type==='field'&&validQueue(b.grainOutput,b.workshopStock?.output?.food))&&
  (b.grainPantry===undefined||b.type==='house'&&validQueue(b.grainPantry,b.pantry))&&
  validQueue(b.lastRation?.grain,b.lastRation?.amount)&&
  (b.grainDinner===undefined||b.type==='house'&&Number.isSafeInteger(b.grainDinner?.day)&&
   b.grainDinner.day>=0&&b.grainDinner.day<=Math.floor(s.simTime/60)&&
   Array.isArray(b.grainDinner.fields)&&b.grainDinner.fields.length>0&&b.grainDinner.fields.length<=LIMIT&&
   b.grainDinner.fields.every(validPart)))&&
  s.citizens.every(c=>validQueue(c.grainCargo,c.cargo?.food)&&validQueue(c.grainPantry,c.pantryFood));
}
