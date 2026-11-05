## measured-static-grass-mask-20261105 | Статичная часть дорожной маски травы
date: 2026-11-05
type: progress
release: grass-static-mask-20261105-1
commit: 11cd5950350ec601eb7f3f2b733f340d172c5648
publication: recorded
groups: performance
completed: -
source: docs/PERF_STATIC_GRASS_MASK_2026-11-05.md

### Изменения
Кеш берега/зданий в alpha травы,точная инвалидация/координаты/порядок дорожных множителей. Нет изменений геометрии,shader/save/симуляции/грузов. Новых исторических практик нет.

### Проверки
7целевых PASS/RED→GREEN/ревью безP1P2;5реальных80с4×прогонов/200→229/129зданий/настоящая дорога/торговля/save,оба ракурса4SHAтравы равны/GPU0ошибок. CPUмаски53.9–63.4→10.3–11.7мс;обзор40.46→35.95→повторконтроля35.83FPS,близко49.85→49.79;среднееускорение не заявляется,пики/P0 открыты. 1497Node/model-index66/6Python/4roadmapNode PASS;4cachekey/диагностическийsnapshot обновлены,кандидат9a4e9d3 опубликован/Pages42000910877/18SHA.

### Публикация
Кандидат9a4e9d3/Pages42000910877 build/deploy/report success,18/18SHA256. Код11cd595,снимок docs/versions/2026-11-05-07.md.84задачи иP0 FPS открыты.
