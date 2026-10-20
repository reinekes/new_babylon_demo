import {buildingKey,isOperational,BUILDINGS} from '../definitions.js';
import {materialsReady,workRequired} from '../construction.js';
import {artisanNeeds} from '../artisan.js';
import {brickNeeds} from '../bricks.js';
import {kilnNeeds} from '../kilns.js';
import {craftBatch,craftResource,craftState} from '../textiles.js';

export const WORK_POSES=new Set(['work','building','farming','gathering','pottery','weaving','brewing','brickmaking','logging','quarry','hunting','fishing']);
export function workplaceIndex(s){return new Map([...(s.buildings||[]),...(s.roads||[])].map(b=>[buildingKey(b),b]));}
// View-only contract: the same active/waiting gates as workforce, without cropFor
// or any initializer (rendering must never migrate or mutate a saved city).
export function workplaceActivity(s,c,index){
 if(c.carrying||c.age<16)return null;
 const b=index.get(c.phase==='constructing'?c.site:c.work);
 if(c.phase==='constructing'&&b?.construction&&c.siteDuty==='builder')return {kind:'building',stage:materialsReady(b.construction)?'working':'waiting',target:b,progress:b.construction.work/workRequired(b)};
 if(c.phase!=='working'||!b)return null;
 if(!isOperational(b)||c.guarding||['depot','waterpoint','healer','logging','quarry','hunting','fishing'].includes(b.type))return {kind:'gathering',task:b.type,stage:'waiting',target:b};
 let kind='gathering',task=b.type,active=true;
 if(b.type==='field'){
  const crop=b.crop||{};kind='farming';task=crop.sheaves>1e-8?'threshing':s.season===2?'harvesting':'sowing';
  active=crop.sheaves>1e-8||s.season===0&&crop.sown<1-1e-8&&crop.seedStock>1e-8||s.season===2&&crop.remaining>1e-8;
 }else if(['pottery','brewery'].includes(b.type)){
  kind=b.type==='pottery'?'pottery':'brewing';task=b.artisan?.stage;
  active=['forming','brewing'].includes(task)||task==='idle'&&!Object.values(artisanNeeds(b)).some(n=>n>1e-8);
 }else if(['weaver','tailor'].includes(b.type)){kind='weaving';active=(craftState(b)?.[craftResource(b)]||0)+1e-8>=craftBatch(b);}
 else if(b.type==='brickyard'){kind='brickmaking';active=!!b.brickmaking&&!b.brickmaking.wet&&(b.brickmaking.ready>0||!Object.values(brickNeeds(b)).some(n=>n>1e-8));}
 else if(b.type==='kiln')active=!!b.firing&&!b.firing.hot&&(b.firing.ready>0||!Object.values(kilnNeeds(b)).some(n=>n>1e-8));
 else if(b.type==='sheepfold')active=(b.flock?.fleece||0)>=1-1e-8;
 return {kind,task,stage:active?'working':'waiting',target:b,progress:(c.workElapsed||0)/(BUILDINGS[b.type]?.workTime||12)};
}
// Palm coordinates are in the resident root's metre space. Cargo and the specialised
// hunting/fishing solves retain priority in actors.js. Distinct cycles read task time.
export function workPose(kind,time,task){
 const cycle=Math.sin(time*3.6),lift=(cycle+1)*.5;
 if(kind==='building')return {bend:.13+lift*.16,twist:cycle*.045,right:[.20,.75+lift*.60,.50-lift*.18],left:[-.13,.88,.48],tool:'building'};
 if(kind==='farming')return {bend:.55-lift*.24,twist:cycle*.055,right:[.17,.76+lift*.18,.45+lift*.10],left:[.10,.98+lift*.16,.30+lift*.10],tool:task==='harvesting'?'sickle':'hoe'};
 if(kind==='pottery'||kind==='brickmaking')return {bend:.22+lift*.10,twist:cycle*.035,right:[.13,.70+cycle*.07,.47],left:[-.13,.70-cycle*.07,.47],tool:null};
 if(kind==='weaving')return {bend:.10,twist:cycle*.06,right:[.20,.93,.35+lift*.18],left:[-.20,.93,.53-lift*.18],tool:null};
 if(kind==='brewing')return {bend:.15+lift*.05,twist:cycle*.06,right:[.12,.79+lift*.13,.48],left:[-.10,1.05,.43],tool:'stirring'};
 return {bend:.12+lift*.09,twist:cycle*.035,right:[.18,.75+lift*.22,.43],left:[-.17,.86,.36],tool:kind==='gathering'?'gathering':null};
}
