// Local resource drawings share one silhouette in stock bars and cost cards.
const drawings={
 grain:'<path d="M12 22V5m0 6C5 11 4 7 5 4c5 0 7 3 7 7Zm0 5c-6 0-8-3-7-6 5 0 7 2 7 6Zm0-5c6 0 8-4 7-7-5 0-7 3-7 7Zm0 5c6 0 8-3 7-6-5 0-7 2-7 6Z"/>',
 clay:'<path d="m3 9 13-5 6 4-13 5-6-4Zm0 0v9l6 4V13m0 9 13-5V8M4 14l5 3 12-5"/>',
 reed:'<path d="m7 22 3-18m2 18 1-20m3 20 1-17M6 15l13 1M6 18l13 1M9 7 6 4m7 3 3-4m1 6 4-3"/>',
 faith:'<path d="M12 2v5m0 10v5M2 12h5m10 0h5M5 5l3 3m8 8 3 3M5 19l3-3m8-8 3-3m-7 1 3 6-3 6-3-6 3-6Z"/>',
 prestige:'<path d="m7 13-3 9 7-3 2-6m4 0 3 9-7-3-2-6"/><circle cx="12" cy="9" r="7"/><path d="m12 5 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z"/>'
};
const names={grain:'Зерно',clay:'Глина',reed:'Тростник',faith:'Вера',prestige:'Престиж'};
export function resourceIcon(kind){return `<svg class="resource-svg resource-${kind}" viewBox="0 0 24 24" role="img" aria-label="${names[kind]||kind}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><title>${names[kind]||kind}</title>${drawings[kind]||''}</svg>`;}
