// Local coordinates are metres from the centre of the occupied plot.
// The same door and furniture have different positions in the procedural fallback.
import {buildingKey,isResidence} from '../definitions.js';
import {BASE_TIME_RATE} from '../calendar.js';
import {DAY_SECONDS} from '../city-life.js';
import {weatherAt} from '../environment.js';
import {canDepartForWork,residentDepartureHour,workHourAt} from '../work-schedule.js';
import {isStrictSumer} from '../scenario-profiles.js';

const point=(x,z,height=.068)=>({x,z,height});
const layouts=new Map();
function layoutFor(kind,catalogue){
 const key=kind+(catalogue?'':'-fallback');
 if(layouts.has(key))return layouts.get(key);
 const earth=catalogue,ground=earth?.073:.076;
 let gate=0,door,bench,benchYaw=0,benchHeight,roof=[];
 if(kind==='communalHouse'){
  const floor=.065,deck=2.525,door=point(0,-2.25,floor),inner=point(0,-2.78,floor);
  const sill=point(0,-1.92,floor),court=point(0,-1.45,floor),entry=[inner,door,sill,court];
  const bench=[...entry,point(2.58,.75,floor),point(2.77,1.87,floor),point(3.21,1.87,floor)];
  const roof=[...entry,point(-2.24,2.99,floor),point(-2.59,3.83,floor),point(-3.06,3.83,floor)];
  for(let i=0;i<12;i++)roof.push(point(-3.06,3.50-i*.28,floor+(deck-floor)*(i+1)/12));
  roof.push(point(-3.06,-.02,deck),point(-4.12,-.12,deck));
  // Two places on the long adobe bench leave its rolled reed mat free.
  const companions=[1.02,2.21].map(z=>[...entry,point(2.23,.38,floor),point(2.71,z,floor),point(3.21,z,floor)]);
  const layout={companions,inner,door,sill,court,gate:point(0,5.52,floor),outsideCorner:5.83,bench,benchYaw:-Math.PI/2,benchHeight:.495,roof};
  layouts.set(key,layout);return layout;
 }
 if(kind==='camp'||kind==='hut'){
  const camp=kind==='camp';gate=camp?-.20:.04;
  door=point(gate,camp?.94:.74);bench=point(camp?-.42:.08,camp?1.65:1.79,ground);
  benchHeight=earth?.105:.075;
 }else if(kind===1){
  gate=-.27;door=point(earth?-.23:-.58,earth?-.13:-.12);
  bench=point(earth?-1.46:-1.45,earth?1.50:1.60,ground);benchYaw=Math.PI/2;benchHeight=earth?.38:.45;
  const deck=earth?2.175:1.965,z=earth?-.78:-1.18;
  roof=[point(gate,2.70),point(2.57,2.70),point(2.56,z),point(earth?2.46:2.30,z),point(earth?1.93:1.96,z,deck+.18),point(1.39,z,deck),point(.56,-.98,deck)];
 }else if(kind===2){
  gate=earth?.47:0;door=point(earth?.45:.2,earth?-.92:-.98);
  bench=point(earth?1.66:1.76,earth?.78:1.52,ground);benchYaw=-Math.PI/2;benchHeight=earth?.45:.55;
  const deck=earth?2.424:2.18,z=earth?-1.52:-1.55;
  roof=[point(gate,2.76),point(2.84,2.76),point(2.80,z),point(2.69,z),point(2.41,z,deck+.18),point(1.78,z,deck),point(.72,-1.29,deck)];
 }else{
  gate=earth?-.33:0;door=point(earth?-.56:-.75,earth?-.65:-.81);
  bench=point(earth?-1.10:-1.43,earth?1.59:1.42,ground);benchYaw=earth?0:Math.PI/2;benchHeight=earth?.42:.57;
  const x=earth?1.99:1.96,z=earth?1.95:1.42,run=earth?.265:.27,top=earth?2.444:2.48,deck=earth?2.264:2.49;
  roof=[point(gate,.85),point(1.32,.85),point(1.44,z+.32),point(x,z+.28)];
  for(let i=0;i<11;i++)roof.push(point(x,z-run*i,.045+(top-.045)*(i+1)/11));
  roof.push(point(x,earth?-1.10:-1.51,top),point(1.38,earth?-1.10:-1.51,top),point(.62,earth?-.97:-1.29,deck));
 }
 const inner=point(door.x,door.z-.48,ground),court=point(door.x,Math.min(1.06,door.z+1.32),ground);
 const sill=point(door.x,door.z+.46,earth?.14:ground),benchWay=[inner,door,sill,court,point(bench.x+Math.sin(benchYaw)*.40,bench.z+Math.cos(benchYaw)*.40,ground),bench];
 const result={gate:point(gate,2.74),inner,door,sill,court,bench:benchWay,benchYaw,benchHeight,roof:roof.length?[inner,door,sill,court,...roof]:null,ground};
 layouts.set(key,result);return result;
}
const length=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z,a.height-b.height);
function track(points){
 const ends=[0];
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],climb=Math.abs(b.height-a.height)>.6;
  ends.push(ends.at(-1)+length(a,b)/(climb?.57:1.04));
 }
 return {points,ends,duration:ends.at(-1)};
}
function follow(route,t){
 const {points,ends}=route;
 let i=1;while(i<ends.length-1&&t>ends[i])i++;
 const a=points[i-1],b=points[i],k=Math.max(0,Math.min(1,(t-ends[i-1])/(ends[i]-ends[i-1]||1)));
 return {x:a.x+(b.x-a.x)*k,z:a.z+(b.z-a.z)*k,height:a.height+(b.height-a.height)*k,
  yaw:Math.abs(a.height-b.height)>.6?-Math.PI/2:Math.atan2(b.x-a.x,b.z-a.z),climbing:Math.abs(a.height-b.height)>.6,walking:true};
}
const plotCenter=b=>b.type==='communalHouse'?.5:0;
const quarter=b=>(b.rotation||0)*Math.PI/2;
function local(b,c){
 const a=quarter(b),cos=Math.cos(a),sin=Math.sin(a),offset=plotCenter(b),dx=(c.x-b.x-offset)*6,dz=(c.y-b.y-offset)*6;
 return point(dx*cos-dz*sin,dx*sin+dz*cos,.035);
}
function world(b,p){
 const a=quarter(b),cos=Math.cos(a),sin=Math.sin(a);
 const offset=plotCenter(b);return {x:b.x+offset+(p.x*cos+p.z*sin)/6,y:b.y+offset+(p.z*cos-p.x*sin)/6};
}
// Follow the outside wall first if the city's street port is behind the house.
function streetToRoom(b,l,c,platform){
 let start=local(b,c);const points=[start];
 if(platform&&Math.max(Math.abs(start.x),Math.abs(start.z))>=platform.half-.02){
  const dx=-platform.wetDirection[0],dz=-platform.wetDirection[1],edge=platform.half+platform.run+.04;
  const onBank=(along,across)=>point(dx*along+dz*across,dz*along-dx*across,.018);
  const along=start.x*dx+start.z*dz;
  let across=start.x*dz-start.z*dx;
  if(along<platform.half&&Math.abs(across)<edge){
   across=(across<0?-1:1)*edge;points.push(onBank(along,across));
  }
  points.push(onBank(edge,across),onBank(edge,0),onBank(platform.half,0));
  start=points.at(-1);
 }
 const side=start.x<0?-1:1;
 const corner=l.outsideCorner||2.85;
 if(start.z<(l.outsideCorner?l.gate.z:2.50)){points.push(point(side*corner,start.z),point(side*corner,l.outsideCorner||2.76));}
 points.push(l.gate,l.court,l.sill,l.door,l.inner);return points;
}
const kindOf=(b,s)=>b.type==='communalHouse'?b.type:b.reedCamp?'camp':b.starterHut&&!isStrictSumer(s)&&(b.level||1)===1?'hut':Math.min(3,b.level||1);
const returning=p=>['toHome','toRest','toPantryHome','toClothesHome'].includes(p);
const leaving=p=>typeof p==='string'&&(p.startsWith('to')||p==='returnWork')&&!returning(p);
const homePhase=p=>p==='home'||p==='resting';
const loaded=c=>Object.values(c.cargo||{}).some(n=>n>0)||Object.values(c.buildCargo||{}).some(n=>n>0)||c.waterTrip?.load>0||c.clothingLoad>0||c.craftAmount>0||c.craftCloth>0||c.craftWool>0||c.seedFood>0||c.pantryFood>0||c.memorialMove;
const ineligible=c=>c.fireShelter||c.floodShelter||c.controlled||c.rehousing||c.clinic||c.school;
const hash=(n)=>Math.imul(n^(n>>>16),0x45d9f3b)>>>0;
const excursions=new WeakMap();
function excursion(l,roof){
 let pair=excursions.get(l);if(!pair){pair={};excursions.set(l,pair);}
 const key=roof?'roof':'bench';
 if(!pair[key]){
  const path=roof?l.roof:l.bench;
  pair[key]={out:track(path),back:track([...path].reverse())};
 }
 return pair[key];
}
const houseOffset=b=>hash(b.x*197+b.y*263)%117;
function followVisit(out,back,elapsed,hold,seat){
 if(elapsed<0)return null;
 if(elapsed<out.duration)return {...follow(out,elapsed),stage:'out',returnPoints:out.points.slice(0,out.ends.findIndex(t=>t>=elapsed)).reverse()};
 if(elapsed<out.duration+hold)return {...out.points.at(-1),...seat,walking:false,returnPoints:back.points.slice(1)};
 const t=elapsed-out.duration-hold;
 if(t<back.duration)return {...follow(back,t),stage:'in',returnPoints:back.points.slice(Math.max(1,back.ends.findIndex(end=>end>=t)))};
 return null;
}
function visitAt(l,clock,b,id,drySince){
 const offset=houseOffset(b),cycle=Math.floor((clock+offset)/117),elapsed=clock+offset-cycle*117,start=(clock-elapsed)*BASE_TIME_RATE;
 const startHour=workHourAt(start),endHour=b.type==='communalHouse'?communalDusk:19;
 if(startHour<6.15||startHour>=endHour||clock-elapsed<drySince||!canDepartForWork(undefined,id,start)||(startHour-residentDepartureHour(undefined,id))*hourSeconds<morningWindow)return null;
 const roof=!!l.roof&&((cycle+id+b.x+b.y)&1)===1,{out,back}=excursion(l,roof),hold=7+(hash(id+cycle)%6);
 if(startHour+(out.duration+hold+back.duration)/hourSeconds>=endHour)return null;
 return followVisit(out,back,elapsed,hold,{yaw:roof?.12:l.benchYaw,stage:roof?'roof':l.roof?'bench':'mat',seatHeight:roof?.13:l.benchHeight-out.points.at(-1).height+.085});
}
// A morning visit uses the simulation clock and stable resident ID. Reopening a
// save halfway through the doorway reconstructs the same position and heading.
const hourSeconds=DAY_SECONDS/(24*BASE_TIME_RATE),morningWindow=12,communalDusk=17.25,communalClose=23.95;
const morningRoutes=new WeakMap();
function morningVisit(l,id,elapsed,sheltered){
 let routes=morningRoutes.get(l);
 if(!routes){
  routes=[-.24,0,.24].map(side=>{
   const spot=point(l.court.x+side,Math.max(l.court.z+.18,l.sill.z+.25),l.court.height);
   const points=[l.inner,l.door,l.sill,l.court,spot];
   return {out:track(points),back:track([...points].reverse())};
  });
  const threshold=[l.inner,l.door];
  routes.push({out:track(threshold),back:track([...threshold].reverse())});
  morningRoutes.set(l,routes);
 }
 const route=routes[sheltered?3:id%3],pose=followVisit(route.out,route.back,elapsed,2+(id%5)*.35,{stage:sheltered?'threshold':'courtyard',yaw:(id%3-1)*.55});
 return pose&&{...pose,morning:true,sheltered};
}
function homeCaregivers(residents){
 const households=new Map();
 for(const c of residents)if(c.age<3&&homePhase(c.phase)){
  if(!households.has(c.home))households.set(c.home,{parents:new Set(),carer:null,rank:Infinity});
  const h=households.get(c.home);for(const id of c.parents||[])h.parents.add(id);
 }
 if(!households.size)return households;
 for(const c of residents){
  const h=households.get(c.home);
  if(!h||c.age<16||!homePhase(c.phase)||ineligible(c)||loaded(c)||c.guardPost||c.recovering||c.health<65)continue;
  const rank=(h.parents.has(c.id)?0:1);
  if(rank<h.rank||rank===h.rank&&c.id<h.carer){h.rank=rank;h.carer=c.id;}
 }
 return households;
}
const socialRoutes=new WeakMap();
function socialRoute(layout,index){
 let routes=socialRoutes.get(layout);
 if(!routes){
  routes=[...layout.companions,layout.roof].map(path=>({out:track(path),back:track([...path].reverse())}));socialRoutes.set(layout,routes);
 }
 return routes[index];
}
function eveningVisit(layout,slot,clock){
 const {out,back}=socialRoute(layout,slot.index),roof=slot.index===2;
 const hold=slot.finish-slot.start-out.duration-back.duration;
 return followVisit(out,back,clock-slot.start,hold,{stage:roof?'roof':'bench',yaw:roof?.40:layout.benchYaw+(slot.index===0?.76:-.76),seatHeight:roof?.13:layout.benchHeight-out.points.at(-1).height+.085,companion:roof?undefined:slot.index});
}
export function createHomeVisits(homeAsset=()=>true,homePlatform=()=>null){
 let previous=new Map(),transits=new Map(),seats=new Map(),evenings=new Map(),lastState=null,lastClock=-Infinity,wasWet=false,drySince=-Infinity,wetSince=-Infinity;
 return function homeVisits(s,people,weather){
  const clock=(s.simTime||0)/BASE_TIME_RATE;
  const reset=s!==lastState||clock<lastClock||clock-lastClock>40;
  const wet=(weather||weatherAt(s).type)==='rain';
  if(reset){previous.clear();transits.clear();seats.clear();evenings.clear();drySince=wetSince=-Infinity;}
  else if(!wet&&wasWet)drySince=clock;
  else if(wet&&!wasWet)wetSince=clock;
  wasWet=wet;
  lastClock=clock;lastState=s;
  const homes=new Map(),shown=new Map(),next=new Map(),residents=s.citizens||[],frameLayouts=new Map();
  const houseLayout=b=>{
   if(!frameLayouts.has(b))frameLayouts.set(b,layoutFor(kindOf(b,s),homeAsset(b,s)));
   return frameLayouts.get(b);
  };
  for(const b of s.buildings||[])if(isResidence(b)&&!b.campSalvage&&b.construction?.kind!=='new')homes.set(buildingKey(b),b);
  for(const c of people)shown.set(c.id,c);
  // Reserve a household's single seat for one daylight outing. A new arrival
  // must not replace someone already halfway up the ladder.
  const openings=new Map();
  for(const [key,b] of homes){
   const cycle=Math.floor((clock+houseOffset(b))/117);
   if(seats.get(key)?.cycle!==cycle)openings.set(key,{cycle,id:null,rank:Infinity});
  }
  for(const key of seats.keys())if(!homes.has(key))seats.delete(key);
  if(openings.size){
   for(const c of residents){
    const slot=openings.get(c.home);
    if(!slot||c.age<16||!homePhase(c.phase)||ineligible(c)||loaded(c))continue;
    const rank=hash(c.id^Math.imul(slot.cycle,0x9e3779b1));
    if(rank<slot.rank){slot.id=c.id;slot.rank=rank;}
   }
   for(const [key,slot] of openings)seats.set(key,slot);
  }
  const hour=workHourAt(s.simTime||0),social=new Map();
  const morning=hour>=5&&hour<=9+morningWindow/hourSeconds&&!s.funeral&&!s.miracleCelebration;
  let carers=morning?homeCaregivers(residents):null;
  if(!wet&&hour>=communalDusk&&hour<communalClose&&(!s.funeral||s.funeral.scope==='family')){
   const dusk=clock-(hour-communalDusk)*hourSeconds;
   const day=Math.floor(((s.simTime||0)+DAY_SECONDS/3)/DAY_SECONDS);
   for(const [key,b] of homes){
    if(b.type!=='communalHouse')continue;
    let group=evenings.get(key);
    if(!group||group.day!==day){group={day,slots:new Map()};evenings.set(key,group);}
    social.set(key,group);
   }
   if(social.size){
    carers=homeCaregivers(residents);
    const available=new Map();
    for(const c of residents){
     if(!social.has(c.home)||!homePhase(c.phase)||c.age<16||ineligible(c)||loaded(c)||c.guardPost||c.recovering||c.health<65||carers.get(c.home)?.carer===c.id||shown.has(c.id)||transits.has(c.id)||returning(previous.get(c.id)?.phase))continue;
     if(!available.has(c.home))available.set(c.home,[]);available.get(c.home).push(c.id);
    }
    for(const [key,group] of social){
     const ids=available.get(key)||[];
     for(const id of group.slots.keys())if(!ids.includes(id))group.slots.delete(id);
     if(!ids.length||group.slots.size===3)continue;
     ids.sort((a,b)=>hash(a^Math.imul(day,0x9e3779b1))-hash(b^Math.imul(day,0x9e3779b1)));
     const used=new Set([...group.slots.values()].map(slot=>slot.index));
     for(const id of ids){if(group.slots.has(id)||used.size===3)continue;
      const index=[0,1,2].find(i=>!used.has(i)),start=Math.max(drySince,dusk+1.2+index*1.6,reset?-Infinity:clock);
      const finish=dusk+(communalClose-communalDusk)*hourSeconds-index*1.1;
      const {out,back}=socialRoute(houseLayout(homes.get(key)),index);
      if(finish-start<out.duration+back.duration+3)break;
      group.slots.set(id,{start,finish,index});used.add(index);
     }
    }
   }
  }else evenings.clear();
  for(const c of residents){
   const b=homes.get(c.home),real=shown.get(c.id),prior=previous.get(c.id),wasHome=prior?.home===c.home&&homePhase(prior.phase);
   if(b&&real?.playing&&!ineligible(c)){next.set(c.id,{home:c.home,phase:'playing',port:{x:real.x,y:real.y}});transits.delete(c.id);continue;}
   if(!b||ineligible(c)||real&&(real.eventContact||real.miracleContact||real.funeralContact||real.festivalContact||real.peaceRelief||real.phase==='copyingLaw')||s.funeral?.scope==='city'){transits.delete(c.id);continue;}
   const atHome=homePhase(c.phase),given=transits.get(c.id);
   const canStepOut=c.age>=16&&!c.guardPost&&!c.recovering&&!(c.health<65)&&!(c.diningUntil>s.simTime)&&carers?.get(c.home)?.carer!==c.id;
   const waterExit=c.waterTrip?.origin===c.home&&(c.waterTrip.phase==='source'||c.waterTrip.phase==='deliver'),departing=leaving(c.phase)||waterExit;
   const streetRoute=waterExit?c.waterTrip.route:c.route,streetIndex=waterExit?c.waterTrip.index:c.routeIndex;
   if(!atHome&&!wasHome&&!given){if(returning(c.phase))next.set(c.id,{home:c.home,phase:c.phase,parcel:real?.carrying?{...real.cargo}:null});continue;}
   let transit=given,p;
   let indoorsUntil=prior?.indoorsUntil||0;
   if((wet&&!prior?.p?.sheltered||prior?.p?.morning&&!canStepOut)&&atHome&&prior?.p&&!given&&prior.p.returnPoints?.length){
    const route=track([prior.p,...prior.p.returnPoints]);
    transit={route,start:clock,entry:true,home:c.home};transits.set(c.id,transit);
   }else if(atHome&&(returning(prior?.phase)||prior?.phase==='playing')&&prior.home===c.home){
    const port=prior.phase==='playing'?prior.port:c;
    transit={route:track(streetToRoom(b,houseLayout(b),port,homePlatform(b))),start:clock,entry:true,home:c.home,parcel:prior.parcel};transits.set(c.id,transit);
    const offset=houseOffset(b);
    indoorsUntil=(Math.floor((clock+transit.route.duration+offset)/117)+1)*117-offset;
   }else if(!atHome&&wasHome&&departing&&streetRoute?.length>1&&!given?.exit){
    const roomOut=streetToRoom(b,houseLayout(b),streetRoute[0]||prior.port||c,homePlatform(b)).reverse();
    // An interrupted outing returns by its own stairs or ladder before joining the street.
    const pose=prior.p;
    const points=pose?.morning?[pose,...roomOut.slice(Math.min(3,pose.returnPoints.length))]:pose?[pose,...(pose.returnPoints||[]),...roomOut]:roomOut;
    transit={route:track(points),start:clock,exit:true,fromMorning:!!pose?.morning,home:c.home};transits.set(c.id,transit);
   }
   if(transit&&(transit.home!==c.home||transit.exit&&!departing&&!(transit.fromMorning&&real&&!atHome)||transit.entry&&!atHome)){transits.delete(c.id);transit=null;}
   if(transit){
    const t=clock-transit.start,r=transit.route;
    if(t<r.duration){
     const index=r.ends.findIndex(end=>end>=t);
     p={...follow(r,t),stage:transit.entry?'enter':'leave',returnPoints:r.points.slice(Math.max(1,index))};
    }else if(transit.exit&&real){
     // Catch up along the street's actual waypoints, never a diagonal through a neighbour.
     const tail=(streetRoute||[]).slice(1,streetIndex).map(v=>local(b,v));
     const walk=track([r.points.at(-1),...tail,local(b,real)]);
     if(t-r.duration<walk.duration*.60)p={...follow(walk,(t-r.duration)/.60),stage:'leave',returnPoints:[]};
    }
    if(!p){transits.delete(c.id);if(transit.entry)transit=null;}
   }else if(atHome&&!real&&!loaded(c)){
    const slot=social.get(c.home)?.slots.get(c.id);
    if(morning&&canStepOut&&clock>=indoorsUntil){
     const elapsed=(hour-residentDepartureHour(undefined,c.id))*hourSeconds;
     const sheltered=wet||prior?.p?.sheltered;
     if(elapsed>=0&&elapsed<morningWindow&&(prior?.p?.sheltered||clock-elapsed>=(wet?wetSince:drySince)))p=morningVisit(houseLayout(b),c.id,elapsed,sheltered);
    }
    if(slot)p=eveningVisit(houseLayout(b),slot,clock);
    else if(!p&&!wet&&canStepOut&&clock>=indoorsUntil&&seats.get(c.home)?.id===c.id)p=visitAt(houseLayout(b),clock,b,c.id,drySince);
   }
   if(atHome||returning(c.phase)||p)next.set(c.id,{phase:c.phase,home:c.home,port:{x:c.x,y:c.y},indoorsUntil,p});
   if(!p)continue;
   const platform=homePlatform(b),at=world(b,p),parcel=transit?.entry&&transit.parcel,view={...(real||c),...at,...(parcel?{cargo:parcel}:{}),kind:'person',walking:p.walking,playing:false,carrying:!!(parcel||real?.carrying||loaded(c)),activity:null,
    homeVisit:{house:c.home,depth:b.x+b.y+.012,stage:p.stage,...(p.morning?{morning:true}:{}),height:p.height,deck:platform&&Math.max(Math.abs(p.x),Math.abs(p.z))<=platform.half?platform.lift:undefined,yaw:p.yaw+quarter(b),climbing:!!p.climbing,seatHeight:p.seatHeight,companion:p.companion}};
   shown.set(c.id,view);
  }
  for(const id of transits.keys())if(!next.has(id))transits.delete(id);
  // Gestures alternate only while two actual housemates are seated together.
  for(const group of social.values()){
   const pair=[...group.slots.keys()].map(id=>shown.get(id)).filter(c=>c?.homeVisit?.companion!==undefined);
   if(pair.length===2)for(const c of pair)c.homeVisit.speaking=Math.floor(clock/3.6)%2===c.homeVisit.companion;
  }
  previous=next;
  return [...shown.values()];
 };
}
