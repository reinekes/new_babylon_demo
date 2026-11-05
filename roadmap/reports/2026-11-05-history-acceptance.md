## history-acceptance-20261105 | Приёмка опубликованного Южного Шумера
date: 2026-11-05
type: progress
release: history-acceptance-20261105-1
commit: 11cf86c1ad99389c108ff2154a2f6d2378110940
publication: pending
groups: history
completed: hist-domes; hist-camels; hist-ziggurat; hist-gates
source: docs/HISTORY_ACCEPTANCE_2026-11-05.md

### Результат
Проверены исходные критерии4задач уже опубликованной строгой ветви: отдельные стартовый/обычный дома, ослы/пауза/грузы/маршрут, подписанные материалы ярусов, Врата Инанны/прежние Иштар.18объектов3D/14силуэтов2D/21кадр/6показаний транспорта,8миграционных и16визуальных Node PASS. Введены воспроизводимые изолированные страницы, производственный код не меняется. Научные источники/границы реконструкции и ссылки на реальные4×торговые протоколы сохранены. 6Python/4roadmapNode/model-index66 PASS;ревью безP1P2. Публикация доказательств впереди;P0 открыт.

### Архив исходных требований
Ниже точный текст удалённых из открытого плана разделов до приёмки; старые пометки partial/«публикации нет» — историческое состояние, заменённое результатом выше.

#### hist-domes | Проверить форму стартового жилья
group: history
status: partial
priority: P1
depends: -
sources: game3d/house-architecture.js; starter-settlement.js; docs/NEW_GAME_PROFILES_2026-11-04.md

##### Описание
Выбрать археологический образец жилья южной Месопотамии и пересмотреть форму стартовых домов.

##### Что уже есть
Строгая ветвь в рабочей копии использует плоский сырцовый дом/двор без снятия starterHut: вместимость4 и склад сохранены. Legacy сохраняет beehive. Основание — Абу-Салабих, Postgate с40–41; реконструктивный характер крыши и спорность второго этажа явно отмечены.

##### Следующий шаг
Итоговая проверка новой партии/сохранения и публикация после C01; форма — игровая интерпретация, не точная реконструкция.

##### Готово когда
Есть датированный региональный образец формы; отдельно показан стартовый и обычный дом.

##### Исторические источники
- [Penn Museum: Mesopotamian City Life](https://www.penn.museum/sites/expedition/mesopotamian-city-life/)
- [French archaeological mission: plaster and whitewash Mari](https://archeologie.culture.gouv.fr/mari/en/palaces-painted-decorations)

#### hist-camels | Ослиный караван для исторического профиля
group: history
status: partial
priority: P1
depends: -
sources: game3d/caravan.js; game3d/ambient-fauna.js; docs/CARAVAN_RENEWAL_2026-10-23.md; docs/NEW_GAME_PROFILES_2026-11-04.md

##### Описание
Для исторического режима заменить вьючных верблюдов ослами с сохранением торговли и грузов.

##### Что уже есть
В рабочей ветке строгий караван — купец source-walk-male и два ambient-donkey с вьюками; средневековый купец и верблюды сохранены для legacy. Пауза/направление/stock/смена профиля проверены тестами и в браузере; публикации нет.

##### Следующий шаг
Итоговая4× проверка большого города с торговлей и общий выпуск строгой ветви после C01.

##### Готово когда
Караван использует ослов; запасы/пауза/маршрут неизменны.

##### Исторические источники
- [PNAS: dromedary domestication ancient DNA](https://pmc.ncbi.nlm.nih.gov/articles/PMC4914195/)
- [Penn Museum: Mesopotamian City Life](https://www.penn.museum/sites/expedition/mesopotamian-city-life/)

#### hist-ziggurat | Проверить материалы конкретного зиккурата
group: history
status: partial
priority: P1
depends: -
sources: game3d/architecture.js; architecture.js; docs/NEW_GAME_PROFILES_2026-11-04.md

##### Описание
Сверить снимок и runtime-материалы конкретного объекта; для храмов взять образец Ура конца III тысячелетия.

##### Что уже есть
В строгой ветви3D/2D процедурные сырцовые/кирпичные платформы1–3ярусов; поздние sacredGLB не запрашиваются. Legacy сохраняет shrineIII/zigguratI/III GLB. Изолированная подписанная галерея и тесты проверены; на публичном сайте пока прежний выпуск.

##### Следующий шаг
Завершить общую проверку/публикацию после C01. Ориентир Ур около2100г.; верхние ярусы реконструируются, а не копируются с полностью сохранившейся постройки.

##### Готово когда
На снимке подписаны type и материалы; исторический и фантастический элементы обозначены.

##### Исторические источники
- [Penn Museum: Mesopotamian City Life](https://www.penn.museum/sites/expedition/mesopotamian-city-life/)
- [Chicago ISAC museum publication: Ishtar Gate sixth century](https://isac.uchicago.edu/sites/default/files/uploads/shared/docs/oimp34.pdf)

#### hist-gates | Решить судьбу поздних Ворот Иштар
group: history
status: partial
priority: P1
depends: -
sources: game3d/architecture.js; definitions.js; GAME_DESIGN.md; docs/NEW_GAME_PROFILES_2026-11-04.md

##### Описание
Для новых строгих партий заменить поздние Врата Иштар шумерским образом; старым сохранениям оставить прежнюю модель и подпись. Реализовано в рабочей ветке; публикация впереди.

##### Что уже есть
В рабочей ветке строгий профиль использует сырцовые «Врата Инанны» с прямоугольным деревянным перекрытием в3D/2D. Цена/footprint/internal ishtarGate и чудо сохранены; legacy остаётся синяя модель и имя Иштар. Описание/каталог/сообщения и переключение ветви проверены.

##### Следующий шаг
Итоговая4× проверка и общий выпуск после C01; публичная активация ещё не выполнена. Врата Инанны — честно обозначенная игровая стилизация.

##### Готово когда
Выбор зафиксирован; подпись и модель согласованы.

##### Исторические источники
- [Chicago ISAC museum publication: Ishtar Gate sixth century](https://isac.uchicago.edu/sites/default/files/uploads/shared/docs/oimp34.pdf)
