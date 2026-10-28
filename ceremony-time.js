/** Calendar time and ceremony time are separate. No hidden global state. */
export const ceremonyActive=s=>!!s?.funeral||s?.festival?.stage==='celebrating';
export function ceremonyLabel(s){return s?.funeral?'Похороны · календарь остановлен':s?.festival?.stage==='celebrating'?'Пир · календарь остановлен':'';}
