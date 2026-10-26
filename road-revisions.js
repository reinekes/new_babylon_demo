// Runtime-only topology revision. Never serialized; construction and road tools
// bump it instead of rescanning every road during each cached route lookup.
const revisions=new WeakMap();
export const roadTopologyRevision=s=>revisions.get(s)||0;
export function markRoadTopologyChanged(s){revisions.set(s,roadTopologyRevision(s)+1);}
