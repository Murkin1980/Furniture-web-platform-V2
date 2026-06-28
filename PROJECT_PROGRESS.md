# V2 Project Progress

Платформа мебели, вторая версия.
Репозиторий: `Furniture web platform V2`.
Roadmap: `v2-roadmap.md`. Чек-лист фаз: `STAGE_CHECKLIST.md`.

## Текущий статус

| Параметр | Значение |
|---|---|
| Этап | Фаза 1 — Коммерческая упаковка |
| Процент готовности | 20% |
| Последний commit | 1bc1571 — fix import depth |
| Deploy | production: https://furniture-platform-v2.pages.dev |
| Следующий шаг | 1.2 Коммерческая упаковка пакетов: шаблоны сообщений, менеджерский UI |

## Архитектурные решения V2

- **Наследуем стек V1:** Cloudflare Pages Functions + D1 + R2, vanilla ESM, без build-шага.
- **Наследуем паттерн безопасности:** pure core + injected sender, все «опасные» фичи gated/manual по умолчанию.
- **Новые сущности CRM:** `engagementLevel`, `servicePackage`, `creditedOnOrder`, `visualState`, `proposalDepth`, `revisionRound`, `sourceMaterialType`, `upgradeOfferState`.
- **Продуктовая линейка:** Level 1 (бесплатный rough quote) → Package A (10 000 тг) → Package B (20 000 тг) → полный заказ.
- **Credit-on-order:** стоимость платного пакета зачитывается в стоимость заказа.

## Прогресс по фазам

### Фаза 1 — Коммерческая упаковка
- Статус: в работе
- 1.1 Product/Package model и CRM states — 100% (завершён)
- 1.2 Коммерческая упаковка пакетов — 0%
- 1.3 Аналитика конверсии пакетов — 0%
- 1.4 Smoke и проверки — 40% (package lifecycle smoke пройден, analytics pending)

### Фаза 2 — Управляемый визуал
- Статус: не начата — 0%

### Фаза 3 — PDF intake
- Статус: не начата — 0%

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

## Проверки

| Проверка | Статус | Дата |
|---|---|---|
| Миграции Фазы 1 (0001) | ✅ local + remote | 2026-06-28 |
| Package lifecycle smoke | ✅ 64/64 | 2026-06-28 |
| Production API smoke | ✅ GET /api/packages 200 | 2026-06-28 |
| Analytics pipeline smoke | — | — |

## Риски и запреты

- Не коммитить рабочие markdown-документы (handoff, coding brief, session notes) вместе с кодом без явного решения пользователя.
- Не включать автозапуск AI/OCR/3D — сохранять manual/gated политику V1.
- Не разрушать fail-closed архитектуру SketchUp/3D при апгрейде Фазы 5.
