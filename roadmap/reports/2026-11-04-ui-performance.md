## accepted-20261104-ui-performance | Сезонные задержки и две правки интерфейса
date: 2026-11-04
type: completion
release: season-relocation-ui-20261104-1
commit: 81faab7d25463099fb3fe3aa1601e87077410c0e
publication: not_published
groups: ux; performance
completed: ux-resident-links; ux-inspiration-chance
source: docs/benchmarks/2026-11-04-season-performance.json

### Изменения
Имя избранного в HUD открывает карточку по ID без снятия блокировки городских команд. Список и карточка используют тот же шанс, что выполнение: первое гарантированное вдохновение строителя показывает 100%. Убраны лишние поиски пути при переселении, пересборки сетей при входе каравана и проверки недостижимо далёких участников церемонии.

### Проверки
1382/1382 Node PASS. Воспроизводимый город: 200 жителей/129 зданий, три сезонные перемотки. Сезонные CPU 145/68/39→33/18/14мс; итоговое сохранение и сценарий церемонии побайтово одинаковы с baseline eb9023d. Это не FPS. Полный обзор perf-city-4x остаётся открытым; пик церемонии 117мс ещё есть.

### Исходные требования

#### ux-resident-links | Имя избранного открывает карточку
group: ux
status: partial
priority: P1
depends: -
sources: docs/UNFINISHED_DISCUSSIONS_AUDIT_2026-10-27.md; ui-relic-control.js; ui-resident-links.js

##### Описание
Прямой остаток: в заголовке HUD реликвии имя выводится через b без resident-link.

##### Что уже есть
Подтверждено ui-relic-control.js; остальные списки используют ID-ссылки.

##### Следующий шаг
Подключить существующий механизм ID-ссылок с сохранением блокировки команд.

##### Готово когда
Имя открывает правильного жителя, городские команды во время поиска закрыты.

#### ux-inspiration-chance | Правдивый шанс первого вдохновения
group: ux
status: partial
priority: P1
depends: -
sources: docs/UNFINISHED_DISCUSSIONS_AUDIT_2026-10-27.md; ui-city-tools.js; godhood.js; management.js

##### Описание
Компактный список считает обычный inspirationChance, хотя первый строитель-свидетель гарантирован firstBuilderInspiration.

##### Что уже есть
Подтверждены personControls и firstBuilderInspiration.

##### Следующий шаг
Использовать единое вычисление показываемого результата.

##### Готово когда
Первый строитель показывает 100%; последующие попытки соответствуют реальному шансу.
