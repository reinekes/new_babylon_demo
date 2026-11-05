export const AUTUMN_CROPS='autumn-v1';
const spring=Object.freeze({sow:0,grow:1,harvest:2});
const autumn=Object.freeze({sow:2,grow:3,harvest:0});

export function fieldCalendar(state,field){
 return state.cropCalendar===AUTUMN_CROPS&&!field.crop?.springCycle?autumn:spring;
}

export function nextSowingYear(state,field){
 const {sow}=fieldCalendar(state,field);
 return state.year+Number(state.season>sow);
}

export function fieldRestYear(state,field){
 const {sow}=fieldCalendar(state,field);
 return nextSowingYear(state,field)+Number(state.season===sow&&(field.crop?.sown||0)>0);
}
