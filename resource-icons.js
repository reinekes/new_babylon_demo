// Local resource drawings share one silhouette in stock bars and cost cards.
const drawings={
 flax:'<path d="M11 22V7m0 8 6-6m-6 9-6-6m6-2-6-4"/><circle cx="11" cy="5" r="2"/><circle cx="18" cy="8" r="1.5"/><circle cx="4" cy="5" r="1.5"/><circle cx="4" cy="11" r="1.5"/>',
 basket:'<path d="M3 10h18l-2 10H5L3 10Zm4 0V7a5 5 0 0 1 10 0v3M4 14h16M5 17h14m-10-7 1 10m5-10-1 10"/>',
 mat:'<path d="M4 5h16v14H4zM8 5v14m4-14v14m4-14v14M4 10h16M4 14h16M4 2v3m4-3v3m4-3v3m4-3v3m4-3v3M4 19v3m4-3v3m4-3v3m4-3v3m4-3v3"/>',
 copper:'<path d="m3 13 4-5h10l4 5v5H3v-5Zm0 0h18m-12-3h6M6 18v2h12v-2"/>',
 axe:'<path d="m10 11-6 9 3 2 7-11m-3-1L7 7l2-4 4 2 5-2 3 7-7 1-3-1Zm6-6 2 6"/>',
 blade:'<path d="M9 15 4 22 2 20l5-7m0 0 6-8 9-3-4 9-9 4Zm1 1 9-6"/>',
 chisel:'<path d="m12 11 5-8 4 3-5 8m0 0-7 8-4-3 7-8 4 3Zm-9 3 4 3"/>',
 timber:'<path d="m2 14 13-6 5 3v5L7 22l-5-3v-5Zm0 0 5 3 13-6M7 17v5M6 12V8l12-6 4 3v4l-3 2M6 8l5 3 11-6"/>',
 joinery:'<path d="M3 8h8v3h5V8h5v7h-8v-3H8v3H3V8Zm2 3h2m10 1h2M5 6h6m2 11h6"/>',
 milk:'<path d="M8 2h8v4l3 5v10H5V11l3-5V2Zm0 4h8M5 12h14M10 16h4m-2-2v4"/>' ,
 pottery:'<path d="M8 3h8M9 3v4c-8 7-7 14 3 14s11-7 3-14V3M5 14h14m-13 4h12"/>',
 beer:'<path d="M6 5h12l-2 4c6 8 3 12-4 12S2 17 8 9L6 5Zm2 9h8M11 5V2m3 3V1"/>',
 firedBrick:'<path d="m2 13 12-4 8 4-12 4-8-4Zm0 0v6l8 4 12-4v-6M10 17v6M8 8c-3-3 3-4 1-7m6 7c-3-3 3-4 1-7"/>',
 water:'<path d="M12 2C9 7 5 10 5 15a7 7 0 0 0 14 0c0-5-4-8-7-13Z"/>',
 brick:'<path d="m2 9 13-5 7 4-13 5-7-4Zm0 0v9l7 4v-9m0 9 13-5V8M4 15l3 1m5 1 7-3"/>',
 wool:'<circle cx="11" cy="12" r="8"/><path d="M5 6c8 1 13 8 11 12M3 11c5-1 11 3 12 9M7 4c-1 7 3 12 10 14M5 17c3-5 8-9 13-9m-1 9 4 2 1-3"/>',
 clothing:'<path d="m8 3 9 4-2 14-11-2 4-16ZM8 3l7 12M5 14l11-2M5 19v3m3-2v2m4-1v1"/>',
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
const names={
 flax:'Лён',basket:'Корзина',mat:'Циновка',copper:'Медь',axe:'Медный топор',blade:'Медный нож',chisel:'Медное долото',timber:'Привозной лес',joinery:'Столярные детали',
 milk:'Молоко',pottery:'Керамика',beer:'Пиво',firedBrick:'Обожжённый кирпич',water:'Вода',brick:'Сырцовый кирпич',wool:'Шерсть',cloth:'Ткань',clothing:'Одежда',food:'Еда',wood:'Дерево',stone:'Камень',hides:'Шкуры',grain:'Зерно',clay:'Глина',reed:'Тростник',faith:'Вера',prestige:'Престиж'
};
export function resourceIcon(kind,{decorative=false}={}){return `<svg class="resource-svg resource-${kind}" viewBox="0 0 24 24" ${decorative?'aria-hidden="true"':`role="img" aria-label="${names[kind]||kind}"`} fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${decorative?'':`<title>${names[kind]||kind}</title>`}${drawings[kind]||''}</svg>`;}
