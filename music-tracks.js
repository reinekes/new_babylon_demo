/** User-provided recordings. Metadata only: no requests or playback on import. */
export const MUSIC_TRACKS=Object.freeze([
  {
    "id": "main",
    "file": "Main-theme-start-game.mp3",
    "title": "Основная тема",
    "usage": "Начало игры и малое поселение"
  },
  {
    "id": "grown",
    "file": "Город-становится-больше-2-тема.mp3",
    "title": "Город становится больше",
    "usage": "Дневная тема города от 24 жителей"
  },
  {
    "id": "night",
    "file": "Ночная-музыка-3-тема.mp3",
    "title": "Ночная музыка",
    "usage": "Обычная ночь в поселении"
  },
  {
    "id": "lithophone",
    "file": "литофон.mp3",
    "title": "Литофон",
    "usage": "Музыкант рядом с камерой"
  },
  {
    "id": "funeral1",
    "file": "Nin-me-shar-ra-Кто-то-умер-несут-труп-1.mp3",
    "title": "Nin me shar-ra",
    "usage": "Погребальная процессия · первый вариант",
    "articleId": "inanna"
  },
  {
    "id": "funeral2",
    "file": "Ud-re-a-nam-Кто-то-умер-несут-труп-2-женский-голос.mp3",
    "title": "Ud re-a nam",
    "usage": "Погребальная процессия · женский голос",
    "articleId": "enki"
  },
  {
    "id": "afterFuneral",
    "file": "An-gal-ta-ki-gal-she-Грустная-музыка-сразу-после-похорон.mp3",
    "title": "An gal-ta ki gal-she",
    "usage": "Грустная музыка сразу после похорон",
    "articleId": "descent"
  },
  {
    "id": "firstBeer",
    "file": "Gakkul-e-Lam-sa-re-Сделали-первую-кружку-пива.mp3",
    "title": "Gakkul-e, Lam-sa-re",
    "usage": "Пир первой кружки пива",
    "articleId": "drinking-song"
  },
  {
    "id": "nightLights",
    "file": "Shag-Hul-la-Ngal-La-Bi-Ночь-огней.mp3",
    "title": "Shag hul-la ngal-la-bi",
    "usage": "Ночь огней",
    "articleId": "night-feast"
  },
  {
    "id": "extinction",
    "file": "Uru-a-she-er-gig-ga-конце-игры-потому-что-поселение-вымерло.mp3",
    "title": "Uru a-she-er gig-ga",
    "usage": "Гибель поселения",
    "articleId": "city-lament"
  },
{
  "id": "catArrival",
  "file": "Sa-a! Sa-a! - пришла кошка.mp3",
  "title": "Sa-a! Sa-a!",
  "usage": "Приход кошки · общинный танец",
  "articleId": "cat-arrival"
},
{
  "id": "earthBreath",
  "file": "Numun he-mu... - Чудо Дыхание земли.mp3",
  "title": "Numun he-mu...",
  "usage": "Дыхание земли · общинный танец",
  "articleId": "earth-breath"
}
].map(Object.freeze));
export const EVENT_MUSIC_TRACKS=Object.freeze(Object.fromEntries(MUSIC_TRACKS.map(t=>[t.id,t.file])));
export const musicTrackURL=id=>{const file=EVENT_MUSIC_TRACKS[id];return file?new URL(`./assets/audio/${file}`,import.meta.url).href:null;};
