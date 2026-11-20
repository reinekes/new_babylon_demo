import {canTillField} from '../agriculture.js';
import {fieldCalendar} from '../crop-calendar.js';
import {fieldResting} from '../field-soil.js';
import {needsCanalCleaning} from '../canal-maintenance.js';
import {workstationBuilding} from './workstations.js';
import {isWorkday,treatmentViewPosition} from '../workforce.js';
import {qualifiedHealer} from '../education.js';
import {productionOutputFits} from '../building-inventory.js';
import {canMilk} from '../dairy.js';
import {orchardMaturity} from '../orchard-layout.js';
import {buildingKey,isOperational,BUILDINGS} from '../definitions.js';
import {materialsReady,workRequired} from '../construction.js';
import {isArtisan,artisanNeeds} from '../artisan.js';
import {brickNeeds} from '../bricks.js';
import {canStartFiring,kilnNeeds,kilnNeedsRepair} from '../kilns.js';
import {craftBatch,craftResource,craftState} from '../textiles.js';
import {musicPerformance,musicWorking} from '../music.js';
import {ACCOUNT_WORK_SECONDS} from '../scribes.js';

export const WORK_POSES=new Set(['work','building','farming','gathering','pottery','weaving','brewing','brickmaking','logging','quarry','hunting','fishing','healing','music','relicSearch','scribing']);
export function workplaceIndex(s){return new Map([...(s.buildings||[]),...(s.roads||[])].map(b=>[buildingKey(b),b]));}
// View-only contract: the same active/waiting gates as workforce, without cropFor
// or any initializer (rendering must never migrate or mutate a saved city).
export function workplaceActivity(s,c,index){
 if(c.age<16)return null;
 if(c.waterTrip?.phase==='fill')return {kind:'gathering',task:'water-filling',stage:'working',target:c.waterDip||{x:c.x,y:c.y},progress:(c.waterTrip.elapsed||0)/2};
 if(c.carrying)return null;
 if(c.phase==='copyingLaw')return {kind:'scribing',task:'law-tablet',stage:'working'};
 if(c.phase==='studying'){
  const school=index.get(c.school);
  return c.role==='healer'&&school&&isOperational(school)&&['shrine','ziggurat'].includes(school.type)?
   {kind:'scribing',task:'school-tablet',stage:'working',target:school}:null;
 }
 const b=index.get(c.phase==='constructing'?c.site:c.work);
 if(c.phase==='constructing'&&b?.construction&&c.siteDuty==='builder')return {kind:'building',stage:materialsReady(b.construction)?'working':'waiting',target:workstationBuilding(b,s),progress:b.construction.work/workRequired(b)};
 if(c.phase!=='working'||!b)return null;
 if(['shrine','ziggurat'].includes(b.type)&&isOperational(b)&&!c.guarding)return {kind:'work',task:'offering',stage:'working',target:b};
 if(b.type==='canal')return {kind:'farming',task:'canal-cleaning',stage:needsCanalCleaning(b)?'working':'waiting',target:b};
 if(b.type==='granary'&&isOperational(b)&&!c.guarding&&c.calling==='scribe'&&c.role==='production'&&c.workplace===c.work){
  return {kind:'scribing',task:'account',stage:'working',target:workstationBuilding(b,s),progress:(c.workElapsed||0)/ACCOUNT_WORK_SECONDS};
 }
 if(b.type==='musicHouse')return {kind:'music',task:musicPerformance(s,b).lyrist?.id===c.id?'lyre':'lithophone',stage:musicWorking(s,b,c)?'working':'waiting',target:workstationBuilding(b,s),progress:(c.workElapsed||0)/12};
 if(b.type==='healer'){
  const waiting={kind:'healing',stage:'waiting',target:b};
  if(!isOperational(b)||c.guarding||c.role!=='healer'||!qualifiedHealer(c)||!isWorkday(s.simTime||0)||s.funeral?.actors.some(a=>a.id===c.id))return waiting;
  const patients=(s.citizens||[]).filter(p=>p.clinic===c.work&&p.phase==='treatment'&&p.health<(p.careGoal||85)&&!s.funeral?.actors.some(a=>a.id===p.id));if(!patients.length)return waiting;
  const input=b.workshopStock?.input;
  if(!(input?.food>0&&input.reed>0))return waiting;
  const patient=patients[Math.floor((s.simTime||0)/8)%patients.length],position=treatmentViewPosition(s,patient)||patient;
  return {kind:'healing',stage:'working',target:{x:position.x,y:position.y},clinicPlace:position.clinicPlace,clinic:b,patientId:patient.id,progress:1-patient.health/(patient.careGoal||85)};
 }
 if(!isOperational(b)||c.guarding||['depot','waterpoint','healer','logging','quarry','hunting','fishing'].includes(b.type))return {kind:'gathering',task:b.type,stage:'waiting',target:b};
 let kind='gathering',task=b.type,active=true;
 if(b.type==='field'){
  const crop=b.crop||{},{sow,harvest}=fieldCalendar(s,b);kind='farming';task=canTillField(s,b)?'ploughing':crop.sheaves>1e-8?'threshing':s.season===harvest?'harvesting':'sowing';
  active=task==='ploughing'||crop.sheaves>1e-8||s.season===sow&&!fieldResting(s,b)&&crop.sown<1-1e-8&&crop.seedStock>1e-8||s.season===harvest&&crop.remaining>1e-8;
 }else if(isArtisan(b)){
  kind=b.type==='pottery'?'pottery':b.type==='brewery'?'brewing':'work';task=b.artisan?.stage;
  active=['forming','brewing','milling','baking','cuttingJoinery','castingAxe','weavingMat','weavingBasket','preservingMilk','preparingFiber','weavingLinen'].includes(task)||task==='idle'&&!Object.values(artisanNeeds(b)).some(n=>n>1e-8);
 }else if(['weaver','tailor'].includes(b.type)){kind='weaving';active=(craftState(b)?.[craftResource(b)]||0)+1e-8>=craftBatch(b);}
 else if(b.type==='brickyard'){kind='brickmaking';active=!!b.brickmaking&&!b.brickmaking.wet&&(b.brickmaking.ready>0||!Object.values(brickNeeds(b)).some(n=>n>1e-8));}
 else if(b.type==='kiln'){
  if(canStartFiring(b))task='light-kiln';
  else active=!!b.firing&&!b.firing.hot&&(b.firing.ready>0||kilnNeedsRepair(b)&&kilnNeeds(b).brick===0);
 }
 else if(b.type==='cowshed')active=canMilk(b);
 else if(b.type==='garden')active=orchardMaturity(s,b).yield>0;
 else if(b.type==='sheepfold')active=(b.flock?.fleece||0)>=1-1e-8;
 if(active&&!productionOutputFits(s,b))active=false;
 return {kind,task,stage:active?'working':'waiting',target:workstationBuilding(b,s),progress:(c.workElapsed||0)/(BUILDINGS[b.type]?.workTime||12)};
}
// Palm coordinates are in the resident root's metre space. Cargo and the specialised
// hunting/fishing solves retain priority in actors.js. Distinct cycles read task time.
export function workPose(kind,time,task){
 const cycle=Math.sin(time*2.7),lift=(cycle+1)*.5;
 if(kind==='scribing')return {bend:.10,twist:0,right:[.10,1.11+lift*.05,.43],left:[-.14,1.02,.46],tool:'scribe-stylus'};
 if(task==='water-filling')return {bend:.5,twist:cycle*.025,right:[.12,.60+lift*.09,.43],left:[-.12,.65+lift*.09,.43],tool:'water-vessel'};
 if(kind==='relicSearch')return {bend:.50+lift*.08,twist:cycle*.025,right:[.13,.55+lift*.08,.60],left:[-.15,.66+lift*.06,.51],tool:null};
 if(kind==='healing')return {bend:.14+lift*.05,twist:cycle*.025,right:[.12,1.02+cycle*.055,.49],left:[-.14,1.04,.42+lift*.035],tool:null};
 if(kind==='building')return {bend:.12+lift*.07,twist:cycle*.02,right:[.17,.99+lift*.25,.47-lift*.08],left:[-.13,.88,.48],tool:'building'};
 if(kind==='farming')return {bend:.55-lift*.24,twist:cycle*.055,right:[.17,.76+lift*.18,.45+lift*.10],left:[.10,.98+lift*.16,.30+lift*.10],tool:task==='harvesting'?'sickle':'hoe'};
 if(kind==='pottery'||kind==='brickmaking')return {bend:.18+lift*.035,twist:cycle*.012,right:[.13,.88+cycle*.025,.46],left:[-.13,.88-cycle*.025,.46],tool:null};
 if(kind==='weaving')return {bend:.08,twist:cycle*.018,right:[.17,1.00,.43+lift*.06],left:[-.17,1.00,.49-lift*.06],tool:null};
 if(kind==='brewing')return {bend:.13+lift*.025,twist:cycle*.018,right:[.12,.91+lift*.06,.46],left:[-.10,1.05,.43],tool:'stirring'};
 return {bend:.10+lift*.025,twist:cycle*.012,right:[.17,.89+lift*.07,.42],left:[-.17,.93,.38],tool:kind==='gathering'?'gathering':null};
}
