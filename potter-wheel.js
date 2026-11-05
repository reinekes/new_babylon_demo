import {artisanSummary} from './artisan.js';

// Six hand-driven turns per forming batch. The saved labour counter is the only
// clock: waiting, pause and reload cannot invent work or change the clay buffer.
export function potterWheelView(b){
 const v=b?.type==='pottery'?artisanSummary(b):null;
 const forming=v?.stage==='forming';
 return {forming,angle:forming?v.elapsed/5*Math.PI*12:0};
}
