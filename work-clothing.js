import {professionForBuilding,professionRole} from './professions.js';
import {MANUAL_GATHERING,manualGatheringOrder} from './manual-gathering.js';

// The common terracotta dye makes the whole clay chain legible across the city.
const clay='#b46b42';
const profiles={
 clayworker:[clay,'short'],brickmaker:[clay,'wrap'],potter:[clay,'apron'],kilnworker:[clay,'sash'],
 farmer:['#9f854f','short'],gardener:['#788555','wrap'],shepherd:['#a39772','sash'],dairyman:['#b6a278','apron'],
 lumberjack:['#755c43','sash'],joiner:['#895f41','apron'],quarrier:['#888077','short'],coppersmith:['#865b4c','apron'],
 reedcutter:['#819357','short'],basketweaver:['#a28c56','apron'],matweaver:['#8b9058','wrap'],
 fisher:['#4f7b82','short'],watercarrier:['#568591','sash'],canalworker:['#69888a','short'],hunter:['#78684b','sash'],
 weaver:['#548780','wrap'],tailor:['#796e87','wrap'],musician:['#758b77','sash'],
 baker:['#b8a17b','apron'],brewer:['#a08651','apron'],healer:['#7c9981','apron'],
 priest:['#c4b28d','mantle'],scribe:['#8f7463','mantle'],lawmaker:['#9a715b','mantle'],guard:['#876357','sash'],
 builder:['#93825d','short'],carrier:['#9c875f','sash'],production:['#a18d68','wrap']
};
const clothes=Object.fromEntries(Object.entries(profiles).map(([id,[color,shape]])=>[id,Object.freeze({id,color,shape})]));
const workplaces={bakery:'baker',dairyStore:'dairyman',basketry:'basketweaver',matYard:'matweaver',coppersmith:'coppersmith',joineryYard:'joiner',
 canal:'canalworker',watchHouse:'guard',market:'carrier',harbor:'carrier'};
const forWork=type=>professionForBuilding(type)||workplaces[type];
function workplaceType(buildings,id){
 if(!id)return null;
 return buildings instanceof Map?buildings.get(id):buildings.find(b=>(b.id||`${b.x},${b.y}`)===id)?.type;
}

// Resolve live jobs before a future appointment. Carrying goods is part of the
// same job and never changes a person's dress, assignment or saved inventory.
export function professionClothing(c,buildings=[],state={}){
 if(c.age<16||c.phase==='mourning')return null;
 if(c.phase==='copyingLaw')return clothes.lawmaker;
 const workplace=id=>forWork(workplaceType(buildings,id));
 let id;
 if(c.manualGathering){
  const order=manualGatheringOrder(state,c);
  id=forWork(MANUAL_GATHERING[order?.resource]?.task);
 }
 if(!id){
  if(c.siteDuty)id=c.siteDuty;
  else if(c.tradeJob||c.saleJob||c.districtJob)id='carrier';
  else if(c.guardPost||c.guarding)id='guard';
  else id=workplace(c.craftSite)||workplace(c.work)||workplace(c.workplace);
 }
 if(!id&&!c.pendingRole&&c.role===professionRole(c.calling))id=c.calling;
 // Legacy residents can carry a direct workforce role without a calling.
 if(!id&&(!c.calling||c.calling==='auto'||c.pendingRole)&&c.role!=='production')id=c.role;
 return clothes[id]||null;
}
