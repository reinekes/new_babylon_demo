## accepted-vegetation-gpu-20261105 | GPU-привязки растений и живой реестр мешей
date: 2026-11-05
type: completion
release: vegetation-gpu-bindings-20261105-1
commit: 14231ac49ab462b45336830168c19aeb5c87bb7b
publication: pending
groups: graphics; performance
completed: -
source: docs/VEGETATION_GPU_BINDINGS_2026-11-05.md

### Изменения
Региональные thin-instance группы имеют отдельную geometry для независимых world0…3;материалы/текстуры общие. Удалённые владельцами меши покидают реестр в том же update. Правила/ресурсы/грузы/личности/save не менялись.

### Проверки
RED→GREEN,GPU-идентичность/реальныеGLB/low-high-low/топология/чистотаsave;1490Node PASS,model-index66/0 ошибок,ревью безP1P2. WebGL4×/DPR2/canvas1920×855/200→229/129 зданий/реальная дорога/торговля:108групп1474части,неверныеGPU-привязки96→0,sourceSHAдвухмодулей совпадают. FPS обзор28.71→27.94,близко40.04→39.50;ускорение не заявляется,пики иP0 открыты. Снимки day/night и обе камеры проверены.

### Публикация
Кандидат ещё не опубликован. [Методика и ограничения](../../docs/VEGETATION_GPU_BINDINGS_2026-11-05.md).
