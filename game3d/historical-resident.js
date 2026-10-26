// A limited specialist variant keeps the heavier robed figure out of the whole
// population. It is still the actual saved resident, with the same route/cargo.
// A proposed future calling changes appearance only after inspiration succeeds.
export function usesHistoricalMan(c){
 return !!(c&&c.id!=null&&c.age>=16&&c.sex==='m'&&!c.pendingRole&&c.role==='production'&&['priest','musician'].includes(c.calling));
}
