// Local resource drawings share one silhouette in stock bars and cost cards.
const drawings={
 wool:'<circle cx="11" cy="12" r="8"/><path d="M5 6c8 1 13 8 11 12M3 11c5-1 11 3 12 9M7 4c-1 7 3 12 10 14M5 17c3-5 8-9 13-9m-1 9 4 2 1-3"/>',
 clothing:'<path d="m5 3 7 3 7-3 3 5-5 3v10H7V11L2 8l3-5Z"/><path d="m7 14 10-2M8 19l2 2m2-2 2 2m2-2 1 1M12 6v5"/>',
 cloth:'<path d="m3 7 12-3 6 4v12l-12 2-6-4V7Zm0 0 6 4 12-3M9 11v11M3 12l6 4 12-3"/><path d="m12 6 5 3m-5 7 6-1"/>',
 food:'<path d="M3 13h18c0 6-4 9-9 9s-9-3-9-9ZM5 10c-3-5 4-6 2-9m5 9c-3-5 4-6 2-9m5 9c-3-5 4-6 2-9"/>',
 wood:'<path d="m4 7 11-4 6 4v11l-11 4-6-4V7Zm0 0 6 4 11-4M10 11v11"/><ellipse cx="7" cy="14" rx="1.5" ry="3"/>',
 stone:'<path d="m2 16 4-10 9-3 7 9-4 9-11 1-5-6Zm4-10 6 7 10-1M12 13l-5 9m5-9 6 8"/>',
 hides:'<path d="m6 3 6 3 6-3 3 5-4 4 4 8-6 2-3-3-3 3-6-2 4-8-4-4 3-5Z"/><path d="M12 8v8m-3-6 3 2 3-2"/>',
 grain:'<path d="M12 22V5m0 6C5 11 4 7 5 4c5 0 7 3 7 7Zm0 5c-6 0-8-3-7-6 5 0 7 2 7 6Zm0-5c6 0 8-4 7-7-5 0-7 3-7 7Zm0 5c6 0 8-3 7-6-5 0-7 2-7 6Z"/>',
 clay:'<path d="m3 9 13-5 6 4-13 5-6-4Zm0 0v9l6 4V13m0 9 13-5V8M4 14l5 3 12-5"/>',
 reed:'<path d="m7 22 3-18m2 18 1-20m3 20 1-17M6 15l13 1M6 18l13 1M9 7 6 4m7 3 3-4m1 6 4-3"/>',
 faith:'<path d="M12 2v5m0 10v5M2 12h5m10 0h5M5 5l3 3m8 8 3 3M5 19l3-3m8-8 3-3m-7 1 3 6-3 6-3-6 3-6Z"/>',
 prestige:'<path d="m7 13-3 9 7-3 2-6m4 0 3 9-7-3-2-6"/><circle cx="12" cy="9" r="7"/><path d="m12 5 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z"/>'
};
const names={wool:'Шерсть',cloth:'Ткань',clothing:'Одежда',food:'Еда',wood:'Дерево',stone:'Камень',hides:'Шкуры',grain:'Зерно',clay:'Глина',reed:'Тростник',faith:'Вера',prestige:'Престиж'};
export function resourceIcon(kind){return `<svg class="resource-svg resource-${kind}" viewBox="0 0 24 24" role="img" aria-label="${names[kind]||kind}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><title>${names[kind]||kind}</title>${drawings[kind]||''}</svg>`;}
