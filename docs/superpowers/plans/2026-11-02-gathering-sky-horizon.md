# Gathering and living sky Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ручной сбор без зданий и живая долина без видимого края фона.

**Architecture:** Отдельный модуль поручений использует существующие маршруты, доставку и сохранение. Декоративные модули используют ограниченные переиспользуемые меши, общий игровой таймер и единственный источник теней.

**Tech Stack:** ES modules, Node test runner, JSDOM, Babylon NullEngine, GitHub Pages.

**Spec:** docs/superpowers/specs/2026-11-02-gathering-sky-horizon.md

## Global Constraints

- Старые сохранения, личности и грузы сохраняются.
- Не более двух ручных сборщиков на поручение; работа значительно медленнее мастерской.
- Нет загрузки новых внешних моделей и дополнительной теневой карты.
- Большой город:200 жителей,129 зданий,4×; CPU не называется FPS.

## Review Focus

- Отмена и смена роли с грузом: груз доставлен/сохранён ровно один раз — core tests.
- Ночь, похороны, праздник, избранный: не захватывать чужое назначение — core tests.
- Панель залежи после смены города/режима: нет устаревшей команды — UI integration tests.
- Обзор64 и низкая камера на всех сторонах: скруглённый дальний песок, sky follows camera — geometry tests.
- Пауза, смена качества, dispose: нет накопления геометрии, движения и изменения состояния — scene tests.

### Task1 — Медленная добыча

Files: manual-gathering.js,workforce.js,engine.js; tests/manual-gathering.test.js.

- [x] RED: реальная залежь, бесплатный заказ, маршрут/медленная работа/груз/склад, отмена, миграция.
- [x] Implement orderManualGathering,cancelManualGathering,manualGatheringView,manualGatheringActivity и worker phases.
- [x] GREEN: целевые тесты и реальные доставки всех трёх ресурсов.

### Task2 — Управление и анимация

Files: ui-manual-gathering.js,app.js,labor-life.js,style.css; tests/ui-manual-gathering.test.js.

- [x] RED: карточка залежи, кнопка/остановка, имена-ссылки, заблокированная команда.
- [x] Implement inspector и фазы; приоритет точного клика по залежи после здания/жителя.
- [x] GREEN: UI и анимация работы; переключение панели/сохранения.

### Task3 — Птицы и перекати-поле

Files: game3d/nature-details.js,game3d/bird-flocks.js и связанная интеграция.

- [x] RED: сухие коридоры, ограниченный бюджет, старт без GLB, pause/dispose.
- [x] Implement и GREEN: небольшие стаи возле поселения, заметное качение кустов.

### Task4 — Горизонт и светила

Files: game3d/sky-horizon.js,game3d/renderer.js; tests/sky-horizon.test.js.

- [x] RED: траектория/свет,40×32/64×64, обзор и бюджет.
- [x] Implement celestialAt,createSkyHorizon,обновление единственного directional light.
- [x] GREEN: геометрия, пауза и принудительное освещение.

### Task5 — Проверка и публикация

- [x] Независимое ревью; исправить замечания.
- [x] Полный npm test,20 старых сохранений,CPU4× и бюджет сцены.
- [x] Сверить каждый пункт запроса, обновить журнал и версии import maps.
- [x] Scoped commit,Pages,проверка опубликованных SHA256.
- [x] Отдельный неизменяемый docs/versions/2026-11-02-05.md и финальная проверка публикации.

Итог:1345/1345 PASS,20старыхсохранений,39/39SHA256 опубликованного кода; версия2026-11-02-05. Ограничение: свежий GPU/FPS не измерен.
