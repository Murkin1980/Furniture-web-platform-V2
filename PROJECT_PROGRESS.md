# V2 Project Progress

Платформа мебели, вторая версия.
Репозиторий: `Furniture web platform V2`.
Roadmap: `v2-roadmap.md`. Чек-лист фаз: `STAGE_CHECKLIST.md`.

## Текущий статус

| Параметр | Значение |
|---|---|
| Этап | Фаза 1 — Коммерческая упаковка |
| Процент готовности | 0% |
| Последний commit | (нет коммитов) |
| Deploy | (не настроен) |
| Следующий шаг | Спроектировать product/package model и CRM states, начать миграции |

## Архитектурные решения V2

- **Наследуем стек V1:** Cloudflare Pages Functions + D1 + R2, vanilla ESM, без build-шага.
- **Наследуем паттерн безопасности:** pure core + injected sender, все «опасные» фичи gated/manual по умолчанию.
- **Новые сущности CRM:** `engagementLevel`, `servicePackage`, `creditedOnOrder`, `visualState`, `proposalDepth`, `revisionRound`, `sourceMaterialType`, `upgradeOfferState`.
- **Продуктовая линейка:** Level 1 (бесплатный rough quote) → Package A (10 000 тг) → Package B (20 000 тг) → полный заказ.
- **Credit-on-order:** стоимость платного пакета зачитывается в стоимость заказа.

## Прогресс по фазам

### Фаза 1 — Коммерческая упаковка
- Статус: не начата
- 1.1 Product/Package model и CRM states — 0%
- 1.2 Коммерческая упаковка пакетов — 0%
- 1.3 Аналитика конверсии пакетов — 0%
- 1.4 Smoke и проверки — 0%

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

## Проверки

| Проверка | Статус | Дата |
|---|---|---|
| Миграции Фазы 1 | — | — |
| Package lifecycle smoke | — | — |
| Analytics pipeline smoke | — | — |

## Риски и запреты

- Не коммитить рабочие markdown-документы (handoff, coding brief, session notes) вместе с кодом без явного решения пользователя.
- Не включать автозапуск AI/OCR/3D — сохранять manual/gated политику V1.
- Не разрушать fail-closed архитектуру SketchUp/3D при апгрейде Фазы 5.
