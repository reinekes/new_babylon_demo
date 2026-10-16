export const WIDTH=40, HEIGHT=32;
export function river(y){return 16-y*.27+Math.sin(y*.55)*.7;}
export function terrain(x,y){if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=WIDTH||y>=HEIGHT)return 'void';const d=Math.abs(x-river(y));return d<1.1?'water':d<4.5?'fertile':'sand';}
// A bridge follows the front boundary of its selected river tile.
export function bridgeSpan(row){const y=row+.5,c=river(y);return {left:Math.floor(c-.75)-.5,right:Math.ceil(c+1.75)-.5,y,keyY:row+1};}
export function onBridge(buildings,x,y){return buildings.some(b=>{if(b.type!=='bridge'||b.construction?.kind==='new')return false;const p=bridgeSpan(b.y);return Math.abs(y-p.y)<.16&&x>=p.left&&x<=p.right;});}
