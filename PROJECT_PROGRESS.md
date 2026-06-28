# V2 Project Progress

Платформа мебели, вторая версия.
Репозиторий: `Furniture web platform V2`.
Roadmap: `v2-roadmap.md`. Чек-лист фаз: `STAGE_CHECKLIST.md`.

## Текущий статус

| Параметр | Значение |
|---|---|
| Этап | Фаза 3 — PDF intake (завершена) |
| Процент готовности | 100% фазы 3 (60% общий) |
| Последний commit | (этот коммит: Phase 3 PDF intake) |
| Deploy | production: https://furniture-platform-v2.pages.dev |
| Следующий шаг | Фаза 4 — Supplier-aware pricing |

## Архитектурные решения V2

- **Наследуем стек V1:** Cloudflare Pages Functions + D1 + R2, vanilla ESM, без build-шага.
- **Наследуем паттерн безопасности:** pure core + injected sender, все «опасные» фичи gated/manual по умолчанию.
- **Новые сущности CRM:** `engagementLevel`, `servicePackage`, `creditedOnOrder`, `visualState`, `proposalDepth`, `revisionRound`, `sourceMaterialType`, `upgradeOfferState`.
- **Продуктовая линейка:** Level 1 (бесплатный rough quote) → Package A (10 000 тг) → Package B (20 000 тг) → полный заказ.
- **Credit-on-order:** стоимость платного пакета зачитывается в стоимость заказа.

## Прогресс по фазам

### Фаза 1 — Коммерческая упаковка
- Статус: завершена ✅
- 1.1 Product/Package model и CRM states — 100%
- 1.2 Коммерческая упаковка пакетов — 100%
- 1.3 Аналитика конверсии пакетов — 100%
- 1.4 Smoke и проверки — 100% (104/104, production API 200)

### Фаза 2 — Управляемый визуал
- Статус: завершена ✅
- 2.1 Deliverable standards — 100%
- 2.2 Deliverable lifecycle + revision workflow — 100%
- 2.3 Admin UI deliverable viewer — 100%
- 2.4 Smoke + деплой — 100% (167/167, production API 200)

### Фаза 3 — PDF intake
- Статус: завершена ✅
- 3.1 PDF upload workflow + миграция 0004 — 100%
- 3.2 PDF manifest v2 + draft store — 100%
- 3.3 Размеры + estimate + proposal lines — 100%
- 3.4 Human review gate + admin UI — 100%
- 3.5 Smoke + деплой — 100% (244/244, production API 200)

### Фаза 4 — Supplier-aware pricing
- Статус: не начата — 0%

### Фаза 5 — Controlled 3D upgrade
- Статус: не начата — 0%

## История этапов

| Дата | Этап | Действие | Результат |
|---|---|---|---|
| 2026-06-28 | Подготовка | Инициализация репозитория V2, roadmap, чек-лист, файлы прогресса | Репозиторий готов к началу Фазы 1 |
| 2026-06-28 | Фаза 1.1 | product/package model: миграция 0001, catalog/store/credit core, API routes, smoke 64/64 | Phase 1.1 завершён |
| 2026-06-28 | Деплой | D1 remote миграция, Pages project создан, ADMIN_TOKEN секрет, импорт-фикс | Production: furniture-platform-v2.pages.dev, API 200 |
| 2026-06-28 | Фаза 1.2 | message templates, payment store, analytics, admin UI, миграция 0002 | Фаза 1 завершена, smoke 104/104 |
| 2026-06-28 | Фаза 2 | visual standards, deliverable store, revision workflow, admin UI, миграция 0003 | Фаза 2 завершена, smoke 167/167 |
| 2026-06-28 | Фаза 3 | PDF intake: manifest v2, upload/draft/estimate store, review gate, admin UI, миграция 0004 | Фаза 3 завершена, smoke 244/244 |

## Проверки

| Проверка | Статус | Дата |
|---|---|---|
| Миграции (0001–0004) | ✅ local + remote | 2026-06-28 |
| Package lifecycle smoke | ✅ 244/244 | 2026-06-28 |
| Production API smoke | ✅ all endpoints 200 | 2026-06-28 |
| PDF intake smoke | ✅ upload → draft → review → estimate | 2026-06-28 |
| Visual progress dashboard | ✅ /progress | 2026-06-28 |

## Риски и запреты

- Не коммитить рабочие markdown-документы (handoff, coding brief, session notes) вместе с кодом без явного решения пользователя.
- Не включать автозапуск AI/OCR/3D — сохранять manual/gated политику V1.
- Не разрушать fail-closed архитектуру SketchUp/3D при апгрейде Фазы 5.
