/** Optional completion metadata: old saves have no fabricated construction date.
 * Improvements keep the original date; a new site is dated only on completion. */
const validDate=d=>Number.isSafeInteger(d?.year)&&d.year>=1&&Number.isInteger(d?.season)&&d.season>=0&&d.season<4&&Number.isFinite(d?.elapsed)&&d.elapsed>=0&&d.elapsed<45;
const moment=d=>((d.year-1)*4+d.season)*45+d.elapsed;
export function stampBuildingCompletion(s,b){
 if(!b||b.built!==undefined)return false;
 const d={year:s.year,season:s.season,elapsed:s.seasonElapsed||0};if(!validDate(d))return false;
 let order=s.nextBuildingOrder;
 if(order===undefined){
  // A legacy city's newest completed house may survive only in a memorial.
  let latest=-1;
  for(const item of s.buildings||[])if(Number.isSafeInteger(item.built?.order))latest=Math.max(latest,item.built.order);
  for(const person of s.lifeAnalytics?.people||[]){
   const archived=person.memorial?.built?.order;
   if(Number.isSafeInteger(archived))latest=Math.max(latest,archived);
  }
  order=latest+1;
 }
 if(!Number.isSafeInteger(order)||order<0||order===Number.MAX_SAFE_INTEGER)return false;
 b.built={...d,order};
 s.nextBuildingOrder=order+1;
 return true;
}
export function buildingChronology(b){
 const d=b?.built,known=validDate(d)&&Number.isSafeInteger(d.order)&&d.order>=0;
 return {known,year:known?d.year:null,label:known?`Год ${d.year}`:'Год неизвестен',order:known?d.order:null};
}
export function compareBuildingsNewest(a,b){
 const first=buildingChronology(a),second=buildingChronology(b);
 if(first.known!==second.known)return first.known?-1:1;
 return first.known?moment(b.built)-moment(a.built)||second.order-first.order:0;
}
export function validateBuildingChronology(s){
 const now={year:s.year,season:s.season,elapsed:s.seasonElapsed||0};if(!validDate(now))return false;
 const next=s.nextBuildingOrder;
 if(next!==undefined&&(!Number.isSafeInteger(next)||next<1||(s.lifeAnalytics?.people||[]).some(p=>p.memorial?.built?.order>=next)))return false;
 return (s.buildings||[]).every(b=>b.built===undefined||buildingChronology(b).known&&moment(b.built)<=moment(now)&&
  b.construction?.kind!=='new'&&(next===undefined||b.built.order<next));
}
