export const sections = {
  buildings: {'buildings':'Здания и сооружения', 'other':'Отдельные модели зданий'},
  animals: {'animals':'Животные', 'birds':'Птицы'},
  mini: {'people':'Люди', 'mythology':'Мифология', 'transport':'Транспорт', 'plants':'Растения', 'goods':'Грузы и предметы'}
};

export function sectionForGroup(group) {
  if (group==='fauna') return 'animals';
  if (Object.hasOwn(sections,group)) return group;
  return Object.keys(sections).find(section=>Object.hasOwn(sections[section],group));
}

export function usageOf(row) {
  const item=row.previews[0];
  const status=item.entry?.status;
  if (item.kind==='source') return 'source';
  if (item.studio||status==='optional') return 'studio';
  if (status==='spare'||status==='fallback'||item.reserve) return 'reserve';
  return 'game';
}
