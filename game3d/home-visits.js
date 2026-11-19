// Local coordinates are metres in the five shipped courtyard/shelter meshes.
// The same door and furniture have different positions in the procedural fallback.
import {buildingKey} from '../definitions.js';
import {BASE_TIME_RATE} from '../calendar.js';
import {DAY_SECONDS} from '../city-life.js';
import {workHourAt} from '../work-schedule.js';
import {isStrictSumer} from '../scenario-profiles.js';

const point=(x,z,height=.068)=>({x,z,height});
const layouts=new Map();
function layoutFor(kind,catalogue){
 const key=kind+(catalogue?'':'-fallback');
 if(layouts.has(key))return layouts.get(key);
 const earth=catalogue,ground=earth?.073:.076;
 let gate=0,door,bench,benchYaw=0,benchHeight,roof=[];
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
const quarter=b=>(b.rotation||0)*Math.PI/2;
function local(b,c){
 const a=quarter(b),cos=Math.cos(a),sin=Math.sin(a),dx=(c.x-b.x)*6,dz=(c.y-b.y)*6;
 return point(dx*cos-dz*sin,dx*sin+dz*cos,.035);
}
function world(b,p){
 const a=quarter(b),cos=Math.cos(a),sin=Math.sin(a);
 return {x:b.x+(p.x*cos+p.z*sin)/6,y:b.y+(p.z*cos-p.x*sin)/6};
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
 if(start.z<2.50){points.push(point(side*2.85,start.z),point(side*2.85,2.76));}
 points.push(l.gate,l.court,l.sill,l.door,l.inner);return points;
}
const kindOf=(b,s)=>b.reedCamp?'camp':b.starterHut&&!isStrictSumer(s)&&(b.level||1)===1?'hut':Math.min(3,b.level||1);
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
function visitAt(l,clock,b,id){
 // Start and finish indoors. Suppress cycles that would cross nightfall.
 const offset=houseOffset(b),cycle=Math.floor((clock+offset)/117),
 elapsed=clock+offset-cycle*117,startHour=workHourAt((clock-elapsed)*BASE_TIME_RATE);
 if(startHour<6.15||startHour>=19)return null;
 const roof=!!l.roof&&((cycle+id+b.x+b.y)&1)===1,{out,back}=excursion(l,roof),hold=7+(hash(id+cycle)%6);
 if(startHour+(out.duration+hold+back.duration)*BASE_TIME_RATE*24/DAY_SECONDS>=19)return null;
 if(elapsed<out.duration)return {...follow(out,elapsed),stage:'out',returnPoints:[...out.points.slice(0,out.ends.findIndex(x=>x>=elapsed))].reverse()};
 if(elapsed<out.duration+hold)return {...out.points.at(-1),yaw:roof?.12:l.benchYaw,walking:false,stage:roof?'roof':l.roof?'bench':'mat',seatHeight:(roof?.13:l.benchHeight-out.points.at(-1).height+.085),returnPoints:[...out.points].reverse().slice(1)};
 if(elapsed<out.duration+hold+back.duration){
  const t=elapsed-out.duration-hold,index=back.ends.findIndex(x=>x>=t);
  return {...follow(back,t),stage:'in',returnPoints:back.points.slice(Math.max(1,index))};
 }
 return null;
}
export function createHomeVisits(homeAsset=()=>true,homePlatform=()=>null){
 let previous=new Map(),transits=new Map(),seats=new Map(),lastState=null,lastClock=-Infinity;
 return function homeVisits(s,people){
  const clock=(s.simTime||0)/BASE_TIME_RATE;
  if(s!==lastState||clock<lastClock||clock-lastClock>40){previous.clear();transits.clear();seats.clear();}
  lastClock=clock;lastState=s;
  const homes=new Map((s.buildings||[]).filter(b=>b.type==='house'&&!b.campSalvage&&b.construction?.kind!=='new').map(b=>[buildingKey(b),b]));
  const shown=new Map(people.map(c=>[c.id,c])),next=new Map(),residents=s.citizens||[];
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
  for(const c of residents){
   const b=homes.get(c.home),real=shown.get(c.id),prior=previous.get(c.id),wasHome=prior?.home===c.home&&homePhase(prior.phase);
   if(b&&real?.playing&&!ineligible(c)){next.set(c.id,{home:c.home,phase:'playing',port:{x:real.x,y:real.y}});transits.delete(c.id);continue;}
   if(!b||ineligible(c)||real&&(real.eventContact||real.miracleContact||real.funeralContact||real.festivalContact||real.peaceRelief)||s.funeral?.scope==='city'){transits.delete(c.id);continue;}
   const atHome=homePhase(c.phase),given=transits.get(c.id);
   if(!atHome&&!wasHome&&!given){if(returning(c.phase))next.set(c.id,{home:c.home,phase:c.phase,parcel:real?.carrying?{...real.cargo}:null});continue;}
   const l=layoutFor(kindOf(b,s),homeAsset(b,s)),platform=homePlatform(b);let transit=given,p;
   let indoorsUntil=prior?.indoorsUntil||0;
   if(atHome&&(returning(prior?.phase)||prior?.phase==='playing')&&prior.home===c.home){
    const port=prior.phase==='playing'?prior.port:c;
    transit={route:track(streetToRoom(b,l,port,platform)),start:clock,entry:true,home:c.home,parcel:prior.parcel};transits.set(c.id,transit);
    const offset=houseOffset(b);
    indoorsUntil=(Math.floor((clock+transit.route.duration+offset)/117)+1)*117-offset;
   }else if(!atHome&&wasHome&&leaving(c.phase)&&c.route?.length>1&&!given?.exit){
    const roomOut=streetToRoom(b,l,c.route?.[0]||prior.port||c,platform).reverse();
    // An interrupted outing returns by its own stairs or ladder before joining the street.
    const prefix=prior.p?[prior.p,...(prior.p.returnPoints||[])]:[];
    const points=prefix.length?[...prefix,...roomOut]:roomOut;
    transit={route:track(points),start:clock,exit:true,home:c.home};transits.set(c.id,transit);
   }
   if(transit&&(transit.home!==c.home||transit.exit&&!leaving(c.phase)||transit.entry&&!atHome)){transits.delete(c.id);transit=null;}
   if(transit){
    const t=clock-transit.start,r=transit.route;
    if(t<r.duration){
     const index=r.ends.findIndex(end=>end>=t);
     p={...follow(r,t),stage:transit.entry?'enter':'leave',returnPoints:r.points.slice(Math.max(1,index))};
    }else if(transit.exit&&real){
     // Catch up along the street's actual waypoints, never a diagonal through a neighbour.
     const tail=(c.route||[]).slice(1,c.routeIndex).map(v=>local(b,v));
     const walk=track([r.points.at(-1),...tail,local(b,real)]);
     if(t-r.duration<walk.duration*.60)p={...follow(walk,(t-r.duration)/.60),stage:'leave',returnPoints:[]};
    }
    if(!p){transits.delete(c.id);if(transit.entry)transit=null;}
   }else if(atHome&&clock>=indoorsUntil&&!real&&seats.get(c.home)?.id===c.id&&!loaded(c))p=visitAt(l,clock,b,c.id);
   if(atHome||returning(c.phase)||p)next.set(c.id,{phase:c.phase,home:c.home,port:{x:c.x,y:c.y},indoorsUntil,p});
   if(!p)continue;
   const at=world(b,p),parcel=transit?.entry&&transit.parcel,view={...(real||c),...at,...(parcel?{cargo:parcel}:{}),kind:'person',walking:p.walking,playing:false,carrying:!!(parcel||real?.carrying||loaded(c)),activity:null,
    homeVisit:{house:c.home,stage:p.stage,height:p.height,deck:platform&&Math.max(Math.abs(p.x),Math.abs(p.z))<=platform.half?platform.lift:undefined,yaw:p.yaw+quarter(b),climbing:!!p.climbing,seatHeight:p.seatHeight}};
   shown.set(c.id,view);
  }
  for(const id of transits.keys())if(!next.has(id))transits.delete(id);
  previous=next;
  return [...shown.values()];
 };
}
