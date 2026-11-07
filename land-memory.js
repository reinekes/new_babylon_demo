import {usesCatDiscovery} from './scenario-profiles.js';

export const LAND_STORIES_REQUIRED=2;

export function landMemoryStories(s){
 if(s.landMemoryChapter!==1)return [];
 const stories=[];
 const evidence=s.revelationEvidence;
 if(evidence?.building)stories.push({kind:'building',citizenId:evidence.building.citizenId});
 if(evidence?.food)stories.push({kind:'food',citizenId:evidence.food.citizenId});
 const people=s.lifeAnalytics?.people||[],help=s.godhood?.firstWaterHelp;
 if(Number.isFinite(help?.deliveredAt)&&people.some(person=>person.waterStory)){
  stories.push({kind:'waterStory',citizenId:help.helperId});
 }
 for(const person of people){
  if(stories.length>=3)break;
  if(person.memorial)stories.push({kind:'memorial',citizenId:person.id});
 }
 return stories;
}

export function landSearchReason(s){
 if(s.landMemoryChapter!==1||s.landRelicQuest?.attempts>0)return '';
 return landMemoryStories(s).length<LAND_STORIES_REQUIRED?'Для поиска Печати земли нужны две разные истории жителей':'';
}

export function validateLandMemory(s){
 return s.landMemoryChapter===undefined||s.landMemoryChapter===1&&usesCatDiscovery(s);
}
