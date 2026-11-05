## plough-team-20261105 | Рабочие волы и деревянный плуг
date: 2026-11-05
type: progress
release: plough-team-20261105-1
commit: dffe2d625b5ed7c31584390cbbc50a985276a1c8
publication: recorded
groups: history
completed: hist-bulls
source: docs/versions/2026-11-05-18.md

### Результат
Пахарь и два вола с ярмом работают в WebGL и 2D при активном посеве с доставленными семенами. Ход сцены привязан к прогрессу. Рабочая пара отделена от свободного быка и молочного стада. Исправлен цвет пашни. Тесты и проверка 200 жителей на 4× пройдены. GitHub Pages 42079410642, 14 файлов по SHA-256.

### Архив исходного требования

#### hist-bulls | Рабочие волы и сцена вспашки
group: history
status: partial
priority: P1
depends: -
sources: game3d/ambient-fauna.js; game3d/dairy-herd.js; game3d/architecture.js

##### Описание
Для поля рассмотреть волов и плуг как отдельную механику/сцену.

##### Что уже есть
Есть ambient-bull.glb и декоративный bull; молочное стадо cowshed отдельно. Пахотной упряжки не найдено.

##### Следующий шаг
Сверить живую сцену с указанными источниками и выбрать конкретный объём исправления. Бык, корова и кастрированный рабочий вол — разные функции; наличие коров не доказывает упряжку.

##### Готово когда
Бык окружения, коровы и рабочая упряжка различимы; экономика не считает их одним объектом.

##### Исторические источники
- [Chicago ISAC: cattle and dairy archaeology](https://isac.uchicago.edu/sites/default/files/uploads/shared/docs/saoc62.pdf)
