// Quarter turns are view orientation; square occupied cells and routes stay fixed.
export const canRotateBuilding=type=>!['bridge','canal'].includes(type);
export const validRotation=(type,rotation)=>Number.isInteger(rotation)&&rotation>=0&&rotation<=3&&(canRotateBuilding(type)||rotation===0);
export const nextRotation=(type,rotation=0,direction=1)=>canRotateBuilding(type)?(rotation+direction+4)%4:0;
