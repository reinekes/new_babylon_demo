// Player commands stop during possession; automatic city systems keep running.
const CONTROL_PHASES=new Set(['controlled','searching','rejoicing','carrying','celebrating','returning']);
export const relicControlActive=s=>[s?.relicQuest,s?.landRelicQuest].some(q=>CONTROL_PHASES.has(q?.phase));
export const relicCommandReason=s=>relicControlActive(s)?'Ты ведёшь одного человека: сначала заверши поиск артефакта':'';

export const cityCommandReason=s=>s?.miracleCelebration?'Жители встречают чудо: дождись завершения церемонии':relicCommandReason(s);
