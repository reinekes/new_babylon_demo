import {buildingKey,isOperational} from './definitions.js';
import {familyMemorialsAt} from './life-analytics.js';
import {usesCatDiscovery} from './scenario-profiles.js';

export const LAND_STORIES_REQUIRED=2;
const locationKinds=['building','food'];

export function bindLandMemoryPlace(s,kind,place){
 if(s.landMemoryChapter!==1||!locationKinds.includes(kind)||!s.buildings.includes(place))return undefined;
 place.landMemoryAnchor??=kind;
 return place.landMemoryAnchor;
}

export function landMemoryStories(s){
 if(s.landMemoryChapter!==1)return [];
 const stories=[],people=s.lifeAnalytics?.people||[];
 const living=new Set(s.citizens.map(c=>c.id));
 const buildings=s.buildings.filter(isOperational);
 const add=(kind,citizenId,place,ids)=>stories.push({kind,citizenId,place:place??null,
  livingIds:[...new Set(ids)].filter(id=>living.has(id))});
 for(const kind of locationKinds){
  const fact=s.revelationEvidence?.[kind];
  if(!fact)continue;
  const place=fact.anchor&&buildings.find(b=>b.x===fact.x&&b.y===fact.y&&b.landMemoryAnchor===fact.anchor);
  add(kind,fact.citizenId,place,[fact.citizenId]);
 }
 const help=s.godhood?.firstWaterHelp;
 const listeners=people.filter(person=>person.waterStory);
 if(Number.isFinite(help?.deliveredAt)&&listeners.length){
  add('waterStory',help.helperId,null,[help.helperId,help.recipientId,...listeners.map(person=>person.id)]);
 }
 for(const person of people){
  if(stories.length>=3)break;
  if(!person.memorial)continue;
  const home=person.memorial.built&&buildings.find(b=>b.type==='house'&&buildingKey(b)===person.memorial.home);
  const place=home&&familyMemorialsAt(s,home).includes(person)?home:null;
  const children=s.citizens.filter(c=>c.parents?.includes(person.id)).map(c=>c.id);
  add('memorial',person.id,place,[person.partner,...person.parents,...children]);
 }
 return stories;
}

export function landSearchReason(s){
 if(s.landMemoryChapter!==1||s.landRelicQuest?.attempts>0)return '';
 return landMemoryStories(s).length<LAND_STORIES_REQUIRED?'Для поиска Печати земли нужны две разные истории жителей':'';
}

export function validateLandMemory(s){
 const active=s.landMemoryChapter===1;
 if(s.landMemoryChapter!==undefined&&(!active||!usesCatDiscovery(s)))return false;
 const seen=new Set(),evidence=s.revelationEvidence;
 for(const kind of locationKinds){
  const fact=evidence?.[kind];
  if(fact?.anchor===undefined)continue;
  const source=evidence?.[fact.anchor];
  if(!active||!locationKinds.includes(fact.anchor)||source?.anchor!==fact.anchor||
   source.x!==fact.x||source.y!==fact.y)return false;
 }
 return s.buildings.every(b=>{
  const anchor=b.landMemoryAnchor;
  if(anchor===undefined)return true;
  const fact=evidence?.[anchor];
  if(!active||!locationKinds.includes(anchor)||fact?.anchor!==anchor||seen.has(anchor)||
   b.x!==fact.x||b.y!==fact.y)return false;
  seen.add(anchor);
  return true;
 });
}
