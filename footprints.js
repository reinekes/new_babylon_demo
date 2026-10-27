// Footprints are explicit saved data. Legacy monuments without the field keep
// their old single cell; only newly placed monuments receive the larger area.
export const newFootprint=type=>type==='ziggurat'?2:type==='ishtarGate'?3:1;
export const footprintSize=b=>b?.footprint===newFootprint(b?.type)?newFootprint(b.type):1;
export const footprintCells=b=>Array.from({length:footprintSize(b)**2},(_,i)=>({x:b.x+i%footprintSize(b),y:b.y+Math.floor(i/footprintSize(b))}));
export const occupiesCell=(b,x,y)=>x>=b.x&&y>=b.y&&x<b.x+footprintSize(b)&&y<b.y+footprintSize(b);
export const insideFootprint=(b,x,y)=>footprintSize(b)>1&&x>b.x-.5+1e-7&&x<b.x+footprintSize(b)-.5-1e-7&&y>b.y-.5+1e-7&&y<b.y+footprintSize(b)-.5-1e-7;
