import {residentIdentity} from './game3d/resident-motion.js';

export function residentPortrait(c){
 const traits=residentIdentity(c.id),age=c.age??20,child=age<16;
 const skin=['#996343','#ae7550','#bf895c','#cd9a70','#845237'][traits.skin];
 const hair=age>=55?'#aaa08d':['#30211b','#402923','#533627','#251d1b'][traits.hair];
 const cloth=['#b99664','#9b6952','#c1aa87','#80958f','#858968','#865d61','#a5a294'][traits.cloth];
 const wide=(child?13:15)*traits.headWidth;
 const hairline=['M15 26Q16 11 32 11Q47 11 49 26L44 18Q32 13 20 20Z','M14 29Q13 10 32 9Q51 10 50 30L44 24Q32 15 20 24Z','M12 41V25Q12 9 32 8Q52 9 52 25V41L46 35L44 22Q32 14 20 22L18 35Z','M14 29Q13 11 32 10Q50 11 50 29L43 22L35 17L20 24Z'][traits.hair];
 return `<svg class="resident-portrait" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
 <circle cx="32" cy="30" r="25" fill="#46514e" stroke="#ad8a56" stroke-opacity=".55"/>
 <path d="M5 64Q8 52 25 48H39Q56 52 59 64Z" fill="${cloth}"/>
 <path d="M13 63L42 52M19 64L47 55" fill="none" stroke="#ead4a6" stroke-opacity=".55" stroke-width="2"/>
 <path d="M26 39H38V50L32 55L26 50Z" fill="${skin}"/>
 <ellipse cx="32" cy="31" rx="${wide}" ry="${(child?15:17)*traits.headHeight}" fill="${skin}"/>
 ${traits.hair||c.sex==='f'||child?`<path d="${hairline}" fill="${hair}"/>`:''}
 ${!child&&c.sex!=='f'&&traits.beard?`<path d="M19 35Q24 43 32 39Q40 43 45 35L41 48Q32 ${50+traits.beard*2} 23 48Z" fill="${hair}"/>`:''}
 <path d="M22 29Q26 26 29 29M35 29Q39 26 42 29M32 30L30 36H33M29 40Q32 41 35 40" fill="none" stroke="#432c22" stroke-linecap="round" stroke-width="1.4"/>
 <circle cx="26" cy="31" r="1.3" fill="#31231e"/><circle cx="38" cy="31" r="1.3" fill="#31231e"/>
 </svg>`;
}
