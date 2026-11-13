import {isOperational} from './definitions.js';
import {isStrictSumer} from './scenario-profiles.js';

export const CITY_STAGE_POPULATION=48;
export const MONUMENT_VICTORY_YEAR=10;
export const MONUMENT_VICTORY_POPULATION=30;
export const newMonumentChapter=()=>({version:1,cityAt:null,openedAt:null});

export function advanceMonumentChapter(s){
 const chapter=s.monumentChapter;
 if(!chapter||chapter.openedAt!==null)return false;
 if(chapter.cityAt===null&&s.population>=CITY_STAGE_POPULATION)chapter.cityAt=s.tick;
 if(chapter.cityAt===null||s.tick<=chapter.cityAt||!s.buildings.some(b=>b.type==='shrine'&&isOperational(b)))return false;
 chapter.openedAt=s.tick;
 return true;
}

export function monumentChapterReason(s){
 const chapter=s.monumentChapter;
 if(!chapter||chapter.openedAt!==null)return '';
 if(chapter.cityAt===null)return `Поздняя глава: достигни городского этапа с ${CITY_STAGE_POPULATION} жителями`;
 if(s.tick<=chapter.cityAt)return 'Поздняя глава: дождись смены сезона после городского этапа';
 return 'Поздняя глава: нужен действующий храм';
}

export function validateMonumentChapter(s){
 const chapter=s.monumentChapter;
 if(chapter===undefined)return true;
 const validTick=tick=>Number.isSafeInteger(tick)&&tick>=0&&tick<=s.tick;
 return isStrictSumer(s)&&!!chapter&&Object.keys(chapter).length===3&&chapter.version===1&&
  (chapter.cityAt===null||validTick(chapter.cityAt))&&
  (chapter.openedAt===null||validTick(chapter.openedAt)&&chapter.cityAt!==null&&chapter.openedAt>chapter.cityAt);
}
