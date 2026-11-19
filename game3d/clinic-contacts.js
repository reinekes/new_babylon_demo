import {frontApproach} from './artisan-contacts.js';
import {workstationWorldPoint} from './workstations.js';

// First patient occupies the existing linen-covered couch under the awning.
// Further patients wait inside the same yard, leaving the entrance aisle free.
export function clinicPlaces(b,slot,origin){
 const point=(x,h,z)=>workstationWorldPoint(b,[x,h,z]);
 const seated=slot===0,x=seated?-1.24:-.58+(slot-1)%3*.72,z=seated?.88:1.70+Math.floor((slot-1)/3)*.65;
 const stand=point(x,0,z),front=point(0,0,2.16),via=[...frontApproach(b,origin,workstationWorldPoint),front,stand];
 const target=point(x+.18,seated?.99:1.16,z);
 return {stand,target,via,seatHeight:seated?.57:null,yaw:Math.atan2(target.x-stand.x,target.y-stand.y)};
}
export function clinicProvider(b,patient,origin){
 const layout=patient.clinicPlace;
 if(!layout)return null;
 const angle=layout.yaw,dx=Math.sin(angle),dy=Math.cos(angle);
 const stand={x:layout.stand.x+dx*.65/6,y:layout.stand.y+dy*.65/6};
 const target={...layout.target,height:layout.seatHeight?1.03:1.23};
 return {kind:'healing',task:'care',building:b,stand,target,seatHeight:layout.seatHeight?.72:undefined,via:[...frontApproach(b,origin,workstationWorldPoint),workstationWorldPoint(b,[0,0,2.16]),stand]};
}
