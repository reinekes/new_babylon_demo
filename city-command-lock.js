// Player commands stop during possession; automatic city systems keep running.
const CONTROL_PHASES=new Set(['controlled','searching','rejoicing','carrying','celebrating']);
export const relicControlActive=s=>CONTROL_PHASES.has(s?.relicQuest?.phase);
export const relicCommandReason=s=>relicControlActive(s)?'Ты ведёшь одного человека: сначала заверши поиск артефакта':'';
