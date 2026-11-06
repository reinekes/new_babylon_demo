import {buildingKey,isOperational} from './definitions.js';
import {isStrictSumer} from './scenario-profiles.js';
import {hourOf,mealCycle,mealRation} from './wellbeing.js';

const DURATION=5;
export function availableEveningPlayer(c,time,day,home,phases=['home','resting']){
 return c.age>=16&&c.home===home&&!c.floodShelter&&phases.includes(c.phase)&&
  c.mealDay===day&&c.mealEaten>=.95*mealRation(c)&&c.diningUntil<=time&&c.health>=60&&c.hunger<25&&c.thirst<30&&
  !c.clinic&&!c.waterTrip&&!c.pantryTrip&&!c.districtJob&&!c.tradeJob&&!c.saleJob&&!c.memorialMove&&
  !Object.values(c.cargo||{}).some(n=>n>0)&&!Object.values(c.buildCargo||{}).some(n=>n>0);
}

export const peacefulGame=(s,b)=>isOperational(b)&&!b.floodDamage&&!s.funeral&&!s.festival&&!s.miracleCelebration&&!s.event;

export function advanceEveningGame(s,b,family){
 if(!isStrictSumer(s)||b.type!=='house')return;
 const hour=hourOf(s.simTime),day=mealCycle(s.simTime),game=b.eveningGame,key=buildingKey(b);
 const peaceful=peacefulGame(s,b);
 if(game?.guestHome&&['waiting','playing'].includes(game.status)){
  const host=family?.find(c=>c.id===game.players[0]),guest=s.citizens.find(c=>c.id===game.players[1]);
  if(!peaceful||game.day!==day||!(hour>=21||hour<2)||!host||!guest||!availableEveningPlayer(host,s.simTime,day,key)||
   !availableEveningPlayer(guest,s.simTime,day,game.guestHome,['toEveningGame','eveningGuest']))game.status='interrupted';
  else if(game.status==='waiting'&&guest.phase==='eveningGuest'){game.status='playing';game.playedAt=s.simTime;}
  else if(game.status==='playing'&&guest.phase==='eveningGuest'&&s.simTime>=game.playedAt+DURATION){
   game.status='finished';for(const c of [host,guest])c.mood=Math.min(100,c.mood+2);
  }
  return;
 }
 if(game?.status==='playing'){
  const players=game.players.map(id=>family?.find(c=>c.id===id));
  if(!peaceful||game.day!==day||!(hour>=21||hour<2)||!players.every(c=>c&&availableEveningPlayer(c,s.simTime,day,key))){
   game.status='interrupted';
  }else if(s.simTime>=game.startedAt+DURATION){
   game.status='finished';
   for(const c of players)c.mood=Math.min(100,c.mood+2);
  }
  return;
 }
 if(!peaceful||!family||hour<21||hour>=23||game?.day===day)return;
 const players=family.filter(c=>availableEveningPlayer(c,s.simTime,day,key)).slice(0,2);
 if(players.length===2)b.eveningGame={day,players:players.map(c=>c.id),startedAt:s.simTime,status:'playing'};
}

export function validateEveningGames(s){
 return s.buildings.every(b=>{
  const game=b.eveningGame;
  if(game===undefined)return true;
  return isStrictSumer(s)&&b.type==='house'&&game&&Number.isFinite(game.startedAt)&&game.startedAt>=0&&game.startedAt<=s.simTime&&
   Number.isSafeInteger(game.day)&&game.day===mealCycle(game.startedAt)&&hourOf(game.startedAt)>=21&&hourOf(game.startedAt)<23&&
   Array.isArray(game.players)&&game.players.length===2&&game.players[0]!==game.players[1]&&
   game.players.every(id=>Number.isSafeInteger(id)&&id>=0&&id<s.demography.nextId)&&
   ['playing','finished','interrupted',...(game.guestHome?['waiting']:[])].includes(game.status)&&
   (game.guestHome===undefined?game.playedAt===undefined:typeof game.guestHome==='string'&&/^\d+,\d+$/.test(game.guestHome)&&game.guestHome!==buildingKey(b)&&
    (game.playedAt===undefined?['waiting','interrupted'].includes(game.status):Number.isFinite(game.playedAt)&&game.playedAt>=game.startedAt&&game.playedAt<=s.simTime&&game.status!=='waiting'))&&
   (game.status!=='finished'||(game.playedAt??game.startedAt)+DURATION<=s.simTime);
 });
}
